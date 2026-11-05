import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { runTaskRows, splitFinished, FINISHED_ROW_MS } from "../../src/taskRows.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/067-hide-finished-rows. Claude Code lists a finished subagent in every
// tick; the row is taken off with an empty `content` once it has had its time.

const T0 = Date.parse("2026-11-04T12:00:00.000Z");
const run = { id: "a1", name: "explore", status: "running", startTime: T0 - 5000 };
const done = { id: "b2", name: "review", status: "completed", startTime: T0 - 60000 };

const tick = (now, tasks) =>
  runTaskRows({ now, input: JSON.stringify({ columns: 120, session_id: "s1", tasks }) }).then((out) =>
    out ? out.split("\n").map((l) => JSON.parse(l)) : [],
  );

await test("a task first seen finished is kept, and one past the grace is hidden", () => {
  const first = splitFinished([done], {}, T0);
  assert.deepEqual(first.hidden, []);
  assert.equal(first.visible.length, 1);
  assert.deepEqual(first.next, { b2: T0 });
  const later = splitFinished([done], first.next, T0 + FINISHED_ROW_MS);
  assert.deepEqual(later.hidden, ["b2"]);
  assert.equal(later.visible.length, 0);
});

await test("running tasks are never hidden, and a resumed one is forgotten", () => {
  const r = splitFinished([run, { ...done, status: "running" }], { b2: T0 - 10 * FINISHED_ROW_MS }, T0);
  assert.deepEqual(r.hidden, []);
  assert.equal(r.visible.length, 2);
  assert.deepEqual(r.next, {});
});

await test("failed and killed tasks leave too, an unknown status does not", () => {
  const seen = { f: T0 - FINISHED_ROW_MS, k: T0 - FINISHED_ROW_MS, p: T0 - FINISHED_ROW_MS };
  const r = splitFinished(
    [
      { id: "f", status: "failed" },
      { id: "k", status: "killed" },
      { id: "p", status: "paused" },
    ],
    seen,
    T0,
  );
  assert.deepEqual(r.hidden.sort(), ["f", "k"]);
  assert.deepEqual(r.visible.map((t) => t.id), ["p"]);
});

await test("a task the tick no longer lists is dropped from the memory", () => {
  assert.deepEqual(splitFinished([run], { gone: T0 - 1 }, T0).next, {});
});

await test("across ticks the finished row stays, then goes with an empty content", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const first = await tick(T0, [run, done]);
    assert.deepEqual(first.map((r) => r.id).sort(), ["a1", "b2"]);
    assert.ok(first.every((r) => r.content !== ""));
    const soon = await tick(T0 + 30_000, [run, done]);
    assert.ok(soon.find((r) => r.id === "b2").content !== "");
    const late = await tick(T0 + FINISHED_ROW_MS + 1000, [run, done]);
    assert.equal(late.find((r) => r.id === "b2").content, "");
    assert.notEqual(late.find((r) => r.id === "a1").content, "");
  });
});

await test("when only finished tasks are left, the hide lines are still written", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    await tick(T0, [done]);
    const late = await tick(T0 + FINISHED_ROW_MS, [done]);
    assert.deepEqual(late, [{ id: "b2", content: "" }]);
  });
});
