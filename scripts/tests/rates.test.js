import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";
import { parsePorcelainV2 } from "../../src/git.js";

const T0 = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 600, maxHeight: 40 };

/**
 * Renders a session over several redraws, so the sample ring fills the way
 * it does in a real one. Tracking has to be on: the ring is the state.
 */
function overTime(session, steps) {
  let out = "";
  for (const step of steps) {
    out = stripAnsi(
      renderPayload(
        fullPayload({
          session_id: session,
          context_window: { used_percentage: step.context },
          rate_limits: {
            five_hour: { used_percentage: step.fiveHour, resets_at: Math.floor((T0 + 5 * 3600_000) / 1000) },
            seven_day: { used_percentage: 20, resets_at: Math.floor((T0 + 5 * 86400_000) / 1000) },
          },
        }),
        { sources: gitSources(), now: T0 + step.at, ...WIDE }
      )
    );
  }
  return out;
}

await test("no burn rate in the first minute of a session", () => {
  // A rate over twelve seconds swings wildly, and a number that swings
  // beside measured ones gets read as measured.
  const early = overTime(`rate-early-${process.pid}`, [
    { at: 0, context: 10, fiveHour: 10 },
    { at: 6000, context: 11, fiveHour: 11 },
    { at: 12000, context: 12, fiveHour: 12 },
  ]);
  assert.doesNotMatch(early, /%\/h/, "not enough history to claim a rate");
  assert.doesNotMatch(early, /empty ~/, "and none to project from");
});

await test("a burn rate appears once the ring has enough", () => {
  const steps = [];
  for (let i = 0; i < 8; i++) steps.push({ at: i * 20_000, context: 10 + i, fiveHour: 10 + i });
  const later = overTime(`rate-later-${process.pid}`, steps);
  assert.match(later, /↑ \d+(\.\d)?%\/h/, "seven samples over two minutes is enough");
});

await test("a falling window has no rate and no projection", () => {
  const steps = [];
  for (let i = 0; i < 8; i++) steps.push({ at: i * 20_000, context: 50 - i, fiveHour: 50 - i });
  const falling = overTime(`rate-falling-${process.pid}`, steps);
  assert.doesNotMatch(falling, /%\/h/, "a window that is emptying is not burning");
  assert.doesNotMatch(falling, /empty ~/);
});

await test("the projection only renders when it lands before the reset", () => {
  // A projection that lands after the window resets says nothing: the window
  // resets first, which is the good outcome.
  const gentle = [];
  for (let i = 0; i < 8; i++) gentle.push({ at: i * 20_000, context: 10, fiveHour: 10 + i * 0.1 });
  assert.doesNotMatch(overTime(`proj-gentle-${process.pid}`, gentle), /empty ~/);

  const steep = [];
  for (let i = 0; i < 8; i++) steep.push({ at: i * 20_000, context: 10, fiveHour: 50 + i * 3 });
  assert.match(overTime(`proj-steep-${process.pid}`, steep), /empty ~\d\d:\d\d/);
});

await test("a sparkline appears once there are two samples to draw", () => {
  const steps = [];
  for (let i = 0; i < 6; i++) steps.push({ at: i * 20_000, context: 10 + i * 5, fiveHour: 10 });
  const out = overTime(`spark-${process.pid}`, steps);
  assert.match(out, /[▁▂▃▄▅▆▇█]{2,}/, "the trend is drawn");
});

await test("the compaction warning appears near the limit and not before", () => {
  const calm = overTime(`compact-calm-${process.pid}`, [{ at: 0, context: 50, fiveHour: 10 }]);
  assert.doesNotMatch(calm, /compacting soon/);

  const near = overTime(`compact-near-${process.pid}`, [{ at: 0, context: 92, fiveHour: 10 }]);
  assert.match(near, /⚠ compacting soon/);
});

await test("a clock renders in 24-hour form", () => {
  const out = overTime(`clock-${process.pid}`, [{ at: 0, context: 10, fiveHour: 10 }]);
  assert.match(out, /\b\d\d:\d\d\b/);
});

await test("merge conflicts are counted apart from ordinary changes", () => {
  // The parser already saw them; counting an unmerged path as a change
  // understated a state that stops everything.
  const NUL = String.fromCharCode(0);
  const records = [
    "# branch.oid abc123",
    "# branch.head main",
    "1 .M N... 100644 100644 100644 aaa bbb changed.txt",
    "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflicted.txt",
    "u UU N... 100644 100644 100644 100644 aaa bbb ccc also-conflicted.txt",
    "? untracked.txt",
  ].join(NUL);

  const git = parsePorcelainV2(records);
  assert.equal(git.changed, 1, "only the real change counts as one");
  assert.equal(git.conflicts, 2);
  assert.equal(git.untracked, 1);
});

await test("a conflict renders on line 1, and nothing renders without one", () => {
  const conflicted = stripAnsi(
    renderPayload(fullPayload(), {
      sources: gitSources({ conflicts: 2 }),
      trackChanges: false,
      now: T0,
      ...WIDE,
    })
  );
  assert.match(conflicted, /✖ 2/);

  const clean = stripAnsi(
    renderPayload(fullPayload(), { sources: gitSources(), trackChanges: false, now: T0, ...WIDE })
  );
  assert.doesNotMatch(clean, /✖/);
});
