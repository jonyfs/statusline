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
import { GLYPHS } from "../../src/render.js";

const wide = (fn) => {
  process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = "1";
  try {
    return fn();
  } finally {
    delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  }
};

await test("the band mark is one column, so crossing a band moves nothing", () => {
  // The critical mark is the Nerd Font alert glyph (constitution 8.4.0): a
  // private-use codepoint, one column whatever the Ambiguous setting says.
  const mark = GLYPHS.nerd.bandCritical;
  assert.equal(displayWidth(mark), 1, "narrow in an ordinary terminal");
  assert.equal(wide(() => displayWidth(mark)), 1, "and narrow still where Ambiguous is drawn wide");
});

await test("the eighths and the unknown dash are Ambiguous, so the switch widens them", () => {
  for (const ch of ["\u2589", "\u258f", "\u2581", "\u2587", "\u2014"]) {
    assert.equal(displayWidth(ch), 1, `${ch} is one column by default`);
    assert.equal(wide(() => displayWidth(ch)), 2, `${ch} is two where Ambiguous is drawn wide`);
  }
});

// The switch is the only way a reader can tell the bar what its terminal does,
// since nothing in the environment reports it.
await test("the switch widens what is Ambiguous and leaves the rest alone", () => {
  assert.equal(displayWidth("·"), 1);
  assert.equal(wide(() => displayWidth("·")), 2, "the separator is Ambiguous");
  assert.equal(wide(() => displayWidth("main")), 4, "ASCII is never affected");
  assert.equal(wide(() => displayWidth("▴")), 1, "a Narrow neighbour is not swept up by a range");
});

