import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { runTaskRows, renderTaskRow } from "../../src/taskRows.js";
import { subagentActivity } from "../../src/skills.js";
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

// --- what line 2 says about subagents (User Story 1, as amended) ----------
//
// Nothing, by name. The agent chip lived here from 2026-09-06 until the
// owner's decision the same day: line 2 is the skills shaping this session
// and whether it is working, and four agents' names and tiers crowded both
// off it. What a running subagent still does is answer the working question.

await test("a running subagent shows working without appearing by name", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });
    const out = render(fullPayload(), {
      ...gitSources(),
      getActiveSkills: () => [],
      // The top-level session is quiet; the subagent is what makes it working.
      getSessionActivity: () => ({ skills: [], todos: null, working: false }),
      subagentActivity,
    });
    assert.match(out, /working/, "a running subagent means the session is working (specs/012)");
    assert.doesNotMatch(out, /explore/, "and it is not named on line 2");
  });
});

await test("line 2 carries the session's own skills and nothing about agents", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 100,
        tasks: [task({ id: "a", name: "sub-a" }), task({ id: "b", name: "sub-b" })],
      }),
    });
    const out = render(fullPayload(), {
      ...gitSources(),
      getActiveSkills: () => ["humanizer", "code-review"],
      getActiveSkillsTrueCount: () => 2,
      subagentActivity,
    });
    assert.match(out, /humanizer, code-review/);
    assert.doesNotMatch(out, /sub-a|sub-b/, "no agent names, no tiers, no ages");
  });
});

await test("no snapshot leaves the skills line exactly as it is today", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => ["alpha"] });
    assert.match(out, /alpha/);
    assert.doesNotMatch(out, /sub-/);
  });
});

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
await test("one session's agents never answer another session's working state", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({ session_id: "window-a", columns: 100, tasks: [task({ id: "a", name: "reviewing-the-gate" })] }),
    });
    await runTaskRows({
      now: NOW,
      input: JSON.stringify({ session_id: "window-b", columns: 100, tasks: [] }),
    });

    assert.deepEqual(subagentActivity(NOW + 1000, "window-a"), ["reviewing-the-gate"]);
    assert.deepEqual(subagentActivity(NOW + 1000, "window-b"), [], "an idle window stays idle");

    const quiet = { ...gitSources(), getActiveSkills: () => [], subagentActivity, getSessionActivity: () => ({ skills: [], todos: null, working: false }) };
    assert.match(render(fullPayload({ session_id: "window-a" }), quiet), /working/, "its own agent is running");
    assert.match(render(fullPayload({ session_id: "window-b" }), quiet), /idle/, "the other window's is not its business");
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
