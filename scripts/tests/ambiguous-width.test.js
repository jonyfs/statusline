/**
 * A bar whose width depends on its value is a bar that moves the line.
 *
 * `U+2591` LIGHT SHADE is East Asian Narrow while `U+2588`, `U+2592` and
 * `U+2593` are Ambiguous, so a gauge built from them changed width as it
 * filled on a terminal configured to draw Ambiguous wide. `U+25B4` is Narrow
 * and `U+25B2` beside it is Ambiguous, so crossing 85% widened the band mark
 * and shifted every segment after it on the busiest line of the bar
 * (specs/017-line-legibility, open until 2026-09-07).
 */
import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { displayWidth } from "../../src/theme.js";
import { bar, bandMark, barWidth } from "../../src/ramp.js";

const wide = (fn) => {
  process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = "1";
  try {
    return fn();
  } finally {
    delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  }
};

await test("a gauge's cells are one width whatever it is showing", () => {
  const levels = [0, 20, 62, 85, 100];
  // The critical band appends `!`, which is a chosen mark rather than an
  // accident of width, so the cells are measured without it.
  const cells = (pct) => displayWidth(bar(pct, 120).replace(/!$/, ""));
  for (const ambiguous of [false, true]) {
    const measure = () => levels.map(cells);
    const widths = ambiguous ? wide(measure) : measure();
    const first = widths[0];
    for (let i = 0; i < widths.length; i++) {
      assert.equal(
        widths[i],
        first,
        `at ${levels[i]}% the gauge is ${widths[i]} columns and at ${levels[0]}% it is ${first}` +
          (ambiguous ? " (ambiguous drawn wide)" : "")
      );
    }
  }
});

await test("both band marks are the same width, so crossing a band moves nothing", () => {
  const marks = [bandMark(62), bandMark(90)];
  assert.deepEqual(marks.map(displayWidth), [1, 1], "narrow in an ordinary terminal");
  assert.deepEqual(
    wide(() => marks.map(displayWidth)),
    [1, 1],
    "and narrow still where Ambiguous is drawn wide, since neither mark is Ambiguous"
  );
});

await test("the marks still differ, so the band survives without colour", () => {
  assert.notEqual(bandMark(62), bandMark(90), "warn and critical are distinguishable");
  assert.equal(bandMark(20), "", "the safe band needs no symbol");
});

// The switch is the only way a reader can tell the bar what its terminal does,
// since nothing in the environment reports it.
await test("the switch widens what is Ambiguous and leaves the rest alone", () => {
  assert.equal(displayWidth("·"), 1);
  assert.equal(wide(() => displayWidth("·")), 2, "the separator is Ambiguous");
  assert.equal(wide(() => displayWidth("main")), 4, "ASCII is never affected");
  assert.equal(wide(() => displayWidth("▴")), 1, "a Narrow neighbour is not swept up by a range");
});

await test("a gauge fills the width it was given", () => {
  const cells = barWidth(120);
  assert.equal(displayWidth(bar(0, 120)), cells, "an empty gauge is the full track");
  assert.equal(displayWidth(bar(100, 120).replace(/!$/, "")), cells, "and a full one matches it");
});
