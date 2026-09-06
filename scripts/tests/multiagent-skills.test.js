import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { runTaskRows, renderTaskRow } from "../../src/taskRows.js";
import { subagentActivity, subagentRoster } from "../../src/skills.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

const task = (over = {}) => ({ id: "t1", name: "explore", type: "agent", ...over });

function snapshotFile(home) {
  return path.join(home.dir, ".claude", "statusline", "tasks", "latest.json");
}

// --- write side (T002) -----------------------------------------------------

await test("runTaskRows writes a snapshot with the task's label", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task()] }) });
    const snapshot = JSON.parse(readFileSync(snapshotFile(home), "utf8"));
    assert.equal(snapshot.writtenAt, NOW);
    assert.deepEqual(snapshot.tasks, [{ id: "t1", label: "explore" }]);
  });
});

// FR-005: the snapshot label matches renderTaskRow's own leading identity.
await test("the snapshot label matches renderTaskRow's identity for the same task", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const t = task({ name: "review", description: "Reviewing the PR" });
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [t] }) });
    const snapshot = JSON.parse(readFileSync(snapshotFile(home), "utf8"));
    const row = stripAnsi(renderTaskRow(t, { now: NOW }).content);
    assert.ok(row.startsWith(snapshot.tasks[0].label), "the row leads with the same label the snapshot recorded");
  });
});

// FR-006: a task with neither name nor type is omitted, not placeholdered.
await test("a task with no identifying name or type is omitted from the snapshot", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [{ id: "t1" }] }) });
    const snapshot = JSON.parse(readFileSync(snapshotFile(home), "utf8"));
    assert.deepEqual(snapshot.tasks, []);
  });
});

// User Story 2: an empty tick overwrites the snapshot to empty too.
await test("an empty tick overwrites a previous snapshot to empty", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task()] }) });
    await runTaskRows({ now: NOW + 1000, input: JSON.stringify({ columns: 100, tasks: [] }) });
    const snapshot = JSON.parse(readFileSync(snapshotFile(home), "utf8"));
    assert.deepEqual(snapshot.tasks, []);
  });
});

// --- read side (T003) -------------------------------------------------------

await test("subagentActivity reads a fresh snapshot's labels", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task(), task({ id: "t2", name: "review" })] }) });
    assert.deepEqual(subagentActivity(NOW + 1000), ["explore", "review"]);
  });
});

await test("subagentActivity ignores a stale snapshot", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task()] }) });
    assert.deepEqual(subagentActivity(NOW + 60_000), [], "60s later, past the freshness window, nothing is trusted");
  });
});

await test("subagentActivity returns [] with no snapshot file at all", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.deepEqual(subagentActivity(NOW), []);
  });
});

// --- merge into the skills chip (User Story 1) ------------------------------

const render = (payload, sources) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...WIDE }));

await test("running subagent activity appears on line 2", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });
    // The fixtures stub both readers to []; this case is specifically about
    // the real ones, so they are overridden back.
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [], subagentActivity, subagentRoster });
    assert.match(out, /explore/);
  });
});

// The agent chip is its own segment now, so a running subagent is named
// once rather than also being folded into the skills chip beside it.
await test("a running subagent is named once, not in both chips", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });
    const out = render(fullPayload(), {
      ...gitSources(),
      getActiveSkills: () => ["humanizer"],
      getActiveSkillsTrueCount: () => 1,
      subagentActivity,
      subagentRoster,
    });
    assert.equal(out.match(/explore/g)?.length, 1, "the agent is named exactly once");
    assert.match(out, /humanizer/, "the skills chip still carries the skill");
  });
});

// What the tick reported about each agent, not just that one exists.
await test("an agent chip carries the tier and the age the tick reported", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 100,
        tasks: [{ id: "a", name: "explore", type: "agent", model: "claude-opus-5", effort: "high", startTime: NOW - 120_000 }],
      }),
    });
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [], subagentActivity, subagentRoster });
    assert.match(out, /explore opus\u00b7high 2m/);
  });
});

// Principle III: an unresolved model is left out, never guessed.
await test("an agent whose model has not resolved shows no tier", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({ columns: 100, tasks: [{ id: "a", name: "explore", type: "agent", startTime: NOW - 5_000 }] }),
    });
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [], subagentActivity, subagentRoster });
    assert.match(out, /explore 5s/);
    assert.doesNotMatch(out, /opus|sonnet|haiku/);
  });
});

// More agents than the chip names are counted, never dropped silently.
await test("agents past the second are counted rather than dropped", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 100,
        tasks: [task({ id: "a", name: "sub-a" }), task({ id: "b", name: "sub-b" }), task({ id: "c", name: "sub-c" })],
      }),
    });
    const out = render(fullPayload(), {
      ...gitSources(),
      getActiveSkills: () => ["one", "two", "three"],
      getActiveSkillsTrueCount: () => 3,
      subagentActivity,
      subagentRoster,
    });
    // Three run, two are named, the third is counted.
    assert.match(out, /sub-a/);
    assert.match(out, /sub-b/);
    assert.match(out, /\+1/, "the third agent is counted");
    assert.doesNotMatch(out, /sub-c/);
  });
});

// FR-004: no snapshot means no change from today's behaviour.
await test("no snapshot leaves the skills line exactly as it is today", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => ["alpha"] });
    assert.match(out, /alpha/);
    assert.doesNotMatch(out, /sub-/);
  });
});

// Four running, two named: the other two are counted, in the same shape the
// skills chip uses, rather than quietly disappearing.
await test("the agents past the chip's limit are counted, not dropped", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 100,
        tasks: ["a", "b", "c", "d"].map((id) => ({ id, name: `sub-${id}`, type: "agent" })),
      }),
    });
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [], subagentActivity, subagentRoster });
    assert.match(out, /sub-a/);
    assert.match(out, /\+2/, "the third and fourth agents are counted");
    assert.doesNotMatch(out, /sub-d/);
  });
});

// Principle X's off switch: settled, the indicator is the filled circle it
// was before the frames existed, and it still says working.
await test("the working indicator settles when the spinner is switched off", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const busy = { ...gitSources(), getActiveSkills: () => [], getSessionActivity: () => ({ skills: [], todos: null, working: true }) };
    const spinning = render(fullPayload(), busy);
    process.env.CLAUDE_STATUSLINE_NO_SPINNER = "1";
    try {
      const settled = render(fullPayload(), busy);
      assert.match(settled, /working/);
      assert.notEqual(settled, spinning, "the settled bar is not the spinning one");
    } finally {
      delete process.env.CLAUDE_STATUSLINE_NO_SPINNER;
    }
  });
});
