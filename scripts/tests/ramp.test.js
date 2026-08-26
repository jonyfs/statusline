import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { bandFor, rampColour, bar, barWidth, bandMark } from "../../src/ramp.js";
import { renderPayload } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

const atLevel = (pct, extra = {}) =>
  stripAnsi(
    renderPayload(
      fullPayload({
        context_window: { used_percentage: pct },
        rate_limits: {
          five_hour: { used_percentage: pct, resets_at: Math.floor(NOW / 1000) + 3600 },
          seven_day: { used_percentage: pct, resets_at: Math.floor(NOW / 1000) + 86400 },
        },
      }),
      { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40, ...extra }
    )
  )
    .split("\n")
    .pop();

await test("the bands break at 60 and 85, per E4", () => {
  assert.equal(bandFor(0).name, "ok");
  assert.equal(bandFor(59.9).name, "ok");
  assert.equal(bandFor(60).name, "warn");
  assert.equal(bandFor(84.9).name, "warn");
  assert.equal(bandFor(85).name, "critical");
  assert.equal(bandFor(100).name, "critical");
});

await test("an unknown level is not a band", () => {
  // Painting an absent figure green would be an answer the payload never
  // gave. Principle III.
  assert.equal(bandFor(null), null);
  assert.equal(bandFor(undefined), null);
  assert.equal(bandFor(Number.NaN), null);
  assert.equal(rampColour(null, "yellow"), "yellow", "it keeps its own colour instead");
});

await test("each band has its own colour", () => {
  assert.equal(rampColour(10, "x"), "green");
  assert.equal(rampColour(70, "x"), "yellow");
  assert.equal(rampColour(95, "x"), "red");
});

await test("each band also changes the bar's characters", () => {
  // E6, and Section 508: colour may not be the only carrier. This is what
  // survives greyscale, a colour-blind reader and a broken palette.
  const ok = bar(20, 120);
  const warn = bar(70, 120);
  const critical = bar(95, 120);

  assert.ok(ok.includes("█"), "the safe band is solid");
  assert.ok(warn.includes("▓"), "the warning band is visibly lighter");
  assert.ok(critical.includes("▒"), "the critical band is lighter again");
  assert.ok(critical.endsWith("!"), "and carries a mark colour cannot lose");
  assert.equal(new Set([ok[0], warn[0], critical[0]]).size, 3, "three bands, three fills");
});

await test("bar width follows the terminal, per E3", () => {
  assert.equal(barWidth(80), 8);
  assert.equal(barWidth(120), 10);
  assert.equal(barWidth(200), 16);
  assert.equal(barWidth(undefined), 10, "an unknown width gets the middle size");
});

await test("a bar is exactly as wide as it claims", () => {
  for (const columns of [80, 120, 200]) {
    for (const pct of [0, 1, 50, 99, 100]) {
      const drawn = bar(pct, columns);
      const expected = barWidth(columns) + (pct >= 85 ? 1 : 0);
      assert.equal(displayWidth(drawn), expected, `${pct}% at ${columns} columns`);
    }
  }
});

await test("an unknown percentage draws an empty track, not a missing one", () => {
  // The number beside it already says `?%`. A bar that vanished would make
  // the line's width jump whenever the payload skipped a field.
  assert.equal(displayWidth(bar(null, 120)), 10);
  assert.ok(!bar(null, 120).includes("█"));
});

await test("the context segment renders a number, and no bar", () => {
  // E1 originally chose a bar beside the number. The bar cost ten to
  // sixteen columns on the widest line for something the number already
  // said in three, so it was dropped on 2026-08-26.
  const line = atLevel(38);
  assert.match(line, /Context/);
  assert.match(line, /38%/);
  assert.doesNotMatch(line, /[█▓▒░]/, "the bar is gone from the statusline");
});

await test("the ramp reaches the rate limits as well, per E5", () => {
  // Same thresholds on all three, so a glance reads them the same way.
  const safe = atLevel(20);
  const warn = atLevel(70);
  const hot = atLevel(95);
  assert.doesNotMatch(safe, /[▴▲]/, "nothing is wrong needs no symbol");
  assert.match(warn, /▴/);
  assert.match(hot, /▲/);
  // Two of them. The context figure carries its level in colour alone since
  // 2026-08-26; the two rate limits, which have the consequence you cannot
  // undo, still mark their band.
  assert.equal((hot.match(/▲/g) || []).length, 2);
  assert.doesNotMatch(hot.slice(0, hot.indexOf("5h")), /▲/, "and none of them is the context figure");
});

await test("the band survives without colour, per E6", () => {
  // Section 508: colour may not be the only carrier. The bar used to do
  // this job; a one-character mark does it now, at a fraction of the width.
  assert.equal(bandMark(10), "");
  assert.equal(bandMark(70), "▴");
  assert.equal(bandMark(95), "▲");
  assert.equal(bandMark(null), "", "an unknown level has no band to mark");
});

await test("the bar itself still exists, for the subagent rows", () => {
  // taskRows.js draws one per running task, where there is a whole row to
  // spend and no other number competing for it.
  assert.match(bar(50, 120), /[█░]/);
});

await test("a bar never renders for a segment the payload left out", () => {
  const line = stripAnsi(
    renderPayload({}, { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 400 })
  )
    .split("\n")
    .pop();
  assert.match(line, /Context [░█▓▒]* ?\?%/);
  assert.doesNotMatch(line, /[█▓▒]/, "no level, no fill");
});
