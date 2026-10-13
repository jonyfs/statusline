import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderReadings, gather } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

await test("no separator style draws a line wider than the window, update chip included", () => {
  // The right-aligned update chip used to add a space the width fit did not
  // count, which overflowed rows that fit exactly (122, 144, 148, 151, 162,
  // 184, 197 and 231 columns on this fixture).
  const now = FIXED_NOW * 1000;
  const sources = { ...SOURCES, getUpdateNotice: () => ({ state: "ready", text: "update ready" }) };
  const before = process.env.CLAUDE_STATUSLINE_SEPARATOR;
  try {
    for (const style of ["arrow", "slant", "thin"]) {
      process.env.CLAUDE_STATUSLINE_SEPARATOR = style;
      for (let width = 60; width <= 260; width++) {
        const out = strip(
          renderReadings(gather(PAYLOAD, sources, { now }), PAYLOAD, { ...RENDER_OPTIONS, maxWidth: width, maxHeight: 40, trailingRows: false })
        );
        for (const line of out.split("\n")) {
          assert.ok(displayWidth(line) <= width, `${style} at ${width}: ${displayWidth(line)} columns`);
        }
      }
    }
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_SEPARATOR;
    else process.env.CLAUDE_STATUSLINE_SEPARATOR = before;
  }
});
