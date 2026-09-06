import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { runTaskRows, renderTaskRow } from "../../src/taskRows.js";
import { subagentActivity, subagentRoster } from "../../src/skills.js";
import { appendSkillEvent } from "../../src/skillEvents.js";
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
await test("agents past the third are counted rather than dropped", async () => {
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
    // Three run and the window is wide, so all three are named.
    assert.match(out, /sub-a/);
    assert.match(out, /sub-b/);
    assert.match(out, /sub-c/);
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

// Four running, three named: the fourth is counted, in the same shape the
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
    assert.match(out, /\+1/, "the fourth agent is counted");
    assert.doesNotMatch(out, /sub-d/);
  });
});

// Every combination line 2 can be in. The chips are independent: neither one
// waits on the other, and the line renders whatever it has.
await test("line 2 renders with skills, with agents, with both, and with neither", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const draw = (skills) =>
      render(fullPayload(), {
        ...gitSources(),
        getActiveSkills: () => skills,
        getActiveSkillsTrueCount: () => skills.length,
        subagentActivity,
        subagentRoster,
      });

    // No snapshot at all: no agents anywhere on the line.
    const skillsOnly = draw(["humanizer"]);
    assert.match(skillsOnly, /humanizer/);
    assert.doesNotMatch(skillsOnly, /explore/);

    const neither = draw([]);
    assert.doesNotMatch(neither, /humanizer|explore/);

    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });

    const both = draw(["humanizer"]);
    assert.match(both, /humanizer/, "the skills chip is still there");
    assert.match(both, /explore/, "and so is the agent chip");

    // Agents with no skills: the agent chip does not wait on a skills chip
    // that has nothing to say.
    const agentsOnly = draw([]);
    assert.match(agentsOnly, /explore/);
    assert.doesNotMatch(agentsOnly, /humanizer/);
  });
});

// The hook reports an `agent_id` for a tool call made inside a subagent, and
// the rows report a task `id`. Nothing in Claude Code's contract says they
// are the same value; measured on 2026-09-06 they are, which is what lets a
// row say what its agent is running. These cases pin the behaviour on both
// sides of that: attributed where the ids match, silent where they do not.
await test("a subagent row names the skills recorded against its own id", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    appendSkillEvent("s1", "humanizer", { now: NOW, agentId: "agent-a" });
    appendSkillEvent("s1", "code-review", { now: NOW, agentId: "agent-a" });
    appendSkillEvent("s1", "dataviz", { now: NOW, agentId: "agent-b" });
    // No agent id: a skill the session itself invoked, which belongs to no row.
    appendSkillEvent("s1", "artifact-design", { now: NOW });

    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        session_id: "s1",
        columns: 200,
        tasks: [
          { id: "agent-a", name: "explore", type: "agent" },
          { id: "agent-c", name: "review", type: "agent" },
        ],
      }),
    });
    const rows = out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));

    assert.match(rows[0], /humanizer, code-review/, "its own skills, in the order they were used");
    assert.doesNotMatch(rows[0], /dataviz/, "not another agent's");
    assert.doesNotMatch(rows[0], /artifact-design/, "and not the session's own");
    assert.doesNotMatch(rows[1], /humanizer|dataviz|artifact-design/, "an agent with nothing recorded says nothing");
  });
});

// The correlation is undocumented, so its absence must be survivable.
await test("a row whose id matches no recorded agent renders exactly as before", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    appendSkillEvent("s1", "humanizer", { now: NOW, agentId: "some-other-id" });
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({ session_id: "s1", columns: 200, tasks: [task({ name: "explore" })] }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.match(row, /explore/);
    assert.doesNotMatch(row, /humanizer/);
  });
});

// Two Claude Code windows, two projects, two rosters. Until 2026-09-06 both
// wrote the same `latest.json` and each read the other's agents onto its own
// line 2 — the leak this file used to call unavoidable.
await test("one session's agents never reach another session's line", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({ session_id: "window-a", columns: 100, tasks: [task({ id: "a", name: "reviewing-the-gate" })] }),
    });
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({ session_id: "window-b", columns: 100, tasks: [task({ id: "b", name: "packing-the-release" })] }),
    });

    assert.deepEqual(subagentActivity(NOW + 1000, "window-a"), ["reviewing-the-gate"]);
    assert.deepEqual(subagentActivity(NOW + 1000, "window-b"), ["packing-the-release"]);

    const drawnFor = (id) =>
      render(fullPayload({ session_id: id }), { ...gitSources(), getActiveSkills: () => [], subagentActivity, subagentRoster });

    const a = drawnFor("window-a");
    assert.match(a, /reviewing-the-gate/);
    assert.doesNotMatch(a, /packing-the-release/, "the other window's agent is not on this line");

    const b = drawnFor("window-b");
    assert.match(b, /packing-the-release/);
    assert.doesNotMatch(b, /reviewing-the-gate/);
  });
});

// A tick with no session id keeps the shared name, so a harness that does not
// send one behaves exactly as it did before the key existed.
await test("a tick with no session id still writes and reads the shared roster", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });
    assert.deepEqual(subagentActivity(NOW + 1000), ["explore"]);
    assert.deepEqual(subagentActivity(NOW + 1000, "some-session"), [], "and does not leak into a keyed one");
  });
});
