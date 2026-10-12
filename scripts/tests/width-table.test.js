import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { displayWidth } from "../../src/theme.js";
import { GLYPHS } from "../../src/render.js";
import { UNICODE_VERSION, WIDE } from "../../src/data/wide.js";
import { buildTable, renderModule, SOURCES } from "../generate-width-table.js";

const wide = (fn) => {
  const before = process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = "1";
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
    else process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = before;
  }
};

await test("the emoji the old ranges missed measure two columns", () => {
  for (const e of ["🟢", "🟡", "🔴", "🟣", "🟩", "➕", "➖", "❔", "🆕"]) {
    assert.equal(displayWidth(e), 2, `${e} U+${e.codePointAt(0).toString(16)}`);
  }
});

await test("the emoji that already measured two still do", () => {
  for (const e of ["✅", "❌", "🔄", "⏩", "🧠", "🦀", "🪙"]) {
    assert.equal(displayWidth(e), 2, e);
  }
});

await test("a line with a wide emoji in it measures its columns", () => {
  assert.equal(displayWidth("a➕b"), 4);
});

await test("every Nerd Font glyph in the table is one column, in both settings", () => {
  for (const [name, glyph] of Object.entries(GLYPHS.nerd)) {
    if (typeof glyph !== "string" || !/[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]/u.test(glyph)) continue;
    assert.equal(displayWidth(glyph), 1, `nerd.${name}`);
    assert.equal(wide(() => displayWidth(glyph)), 1, `nerd.${name} with Ambiguous wide`);
  }
});

await test("variation selectors, joiners and combining marks stay zero width", () => {
  assert.equal(displayWidth("⏱️"), 2, "VS16 asks for emoji presentation");
  assert.equal(displayWidth("é"), 1, "a combining acute adds nothing");
  assert.equal(displayWidth("👩‍💻"), 4, "the joiner itself is zero");
});

await test("the committed table is what the generator makes from the committed sources", () => {
  const eaw = readFileSync(SOURCES.eastAsianWidth, "utf8");
  const emoji = readFileSync(SOURCES.emojiData, "utf8");
  const table = buildTable(eaw, emoji);
  assert.deepEqual(WIDE, table.ranges, "ranges match");
  assert.equal(UNICODE_VERSION, table.version, "version matches");
  const file = readFileSync(new URL("../../src/data/wide.js", import.meta.url), "utf8");
  assert.equal(file, renderModule(table), "the file is byte for byte the generator's output");
});

await test("the table is sorted, merged and covers both source properties", () => {
  for (let i = 0; i < WIDE.length; i++) {
    const [lo, hi] = WIDE[i];
    assert.ok(lo <= hi, "range is ordered");
    if (i > 0) assert.ok(lo > WIDE[i - 1][1] + 1, "ranges neither overlap nor touch");
  }
  assert.equal(UNICODE_VERSION, "16.0.0");
});
