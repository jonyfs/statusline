import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { runTaskRows, renderTaskRow } from "../../src/taskRows.js";
import { subagentActivity } from "../../src/skills.js";
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

await test("running subagent activity appears on the skills line", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 100, tasks: [task({ name: "explore" })] }) });
    // The fixtures' `subagentActivity` stub always returns []; this test is
    // specifically about the real reader, so it's overridden back to it.
    const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [], subagentActivity });
    assert.match(out, /explore/);
  });
});

// FR-002: combined overflow count is accurate.
await test("the skills line's overflow count reflects both sources combined", async () => {
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
    });
    // 3 directly-invoked + 3 subagent = 6 total, SKILLS_SHOWN is 5, so +1 hidden.
    assert.match(out, /\+1/);
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
