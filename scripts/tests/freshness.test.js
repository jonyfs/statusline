import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { reading, isRenderable, MAX_AGE_MS, SOURCE_BUDGET_MS } from "../../src/freshness.js";
import { renderPayload } from "../../src/render.js";
import { emptySources } from "./fixtures/sources.js";
import { SEGMENTS } from "../../src/segments.js";

const NOW = 1787000000000;

await test("a reading with no value never renders", () => {
  const r = reading({ value: null, at: NOW, source: "gh" });
  assert.equal(isRenderable("pr", r, NOW), false);
});

await test("a reading inside its maximum age renders", () => {
  const r = reading({ value: { number: 1 }, at: NOW - 1000, source: "gh" });
  assert.equal(isRenderable("pr", r, NOW), true);
});

await test("a reading past its maximum age does not render", () => {
  const r = reading({ value: { number: 1 }, at: NOW - MAX_AGE_MS.pr - 1, source: "gh" });
  assert.equal(isRenderable("pr", r, NOW), false);
});

await test("a reading stamped in the future is treated as a miss", () => {
  // What a clock jump looks like. Trusting it would keep a value alive
  // for as long as the skew lasts.
  const r = reading({ value: 42, at: NOW + 60_000, source: "rtk" });
  assert.equal(isRenderable("rtk", r, NOW), false);
});

await test("every segment key has a maximum age and every source a budget", () => {
  const keys = [
    "dir", "branch", "worktree", "pr", "skills", "model", "effort",
    "outputStyle", "context", "fiveHour", "fiveHourReset", "sevenDay",
    "sevenDayReset", "rtk", "remote",
  ];
  for (const key of keys) {
    assert.equal(typeof MAX_AGE_MS[key], "number", `${key} has no maximum age`);
  }
  for (const source of ["git", "transcript", "hook", "cache"]) {
    assert.ok(SOURCE_BUDGET_MS[source] > 0, `${source} has no budget`);
  }
});

await test("the on-path source budgets fit inside the redraw budget", () => {
  // FR-003: the sources a redraw can wait on must sum to less than FR-001's
  // 300 ms, or the guarantee is arithmetic that does not add up.
  const onPath = ["git", "transcript", "hook", "cache"];
  const total = onPath.reduce((sum, s) => sum + SOURCE_BUDGET_MS[s], 0);
  assert.ok(total < 300, `on-path budgets sum to ${total} ms, which exceeds the redraw budget`);
});

await test("usage segments keep their slot and show ?% instead of disappearing", () => {
  // Principle III and FR-010. Every other segment vanishes when its source
  // has nothing; these five must not, or a reader cannot tell "unknown"
  // from "the segment moved".
  const plain = stripAnsi(renderPayload({}, { sources: emptySources }));
  assert.match(plain, /Context [░█▓▒]* ?\?%/);
  assert.match(plain, /5h \?%/);
  assert.match(plain, /7d \?%/);
  assert.match(plain, /reset unknown/);
  assert.doesNotMatch(plain, /NaN|undefined|null/);
});

await test("a partial payload leaves the present figures alone", () => {
  const plain = stripAnsi(
    renderPayload(
      { context_window: { used_percentage: 41 }, rate_limits: { five_hour: {} } },
      { sources: emptySources }
    )
  );
  assert.match(plain, /Context [░█▓▒]* ?41%/);
  assert.match(plain, /5h \?%/);
  assert.match(plain, /7d \?%/);
});

await test("every segment in the registry has a maximum age", () => {
  // `isRenderable` refuses a key it has no allowance for, so a segment
  // missing from the table renders on the bar and reads as absent in the
  // diagnostic — the diagnostic contradicting the line it explains.
  const missing = SEGMENTS.filter((row) => MAX_AGE_MS[row.key] === undefined).map((row) => row.key);
  assert.deepEqual(missing, []);
});
