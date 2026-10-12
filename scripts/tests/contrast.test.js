import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { PALETTES } from "../../src/theme.js";
import { contrastRatio, chipColours, toOklch, lightenOklch } from "../../src/contrast.js";

await test("contrast ratio follows WCAG 2.2", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21, "order does not matter");
});

// The expected texts and ratios come from section 5.1 of the design review.
const LATTE = [
  ["peach", "#fe640b", "#11111b", 6.3],
  ["yellow", "#df8e1d", "#11111b", 7.2],
  ["green", "#40a02b", "#11111b", 5.6],
  ["sapphire", "#209fb5", "#11111b", 6.0],
  ["teal", "#179299", "#11111b", 5.0],
  ["lavender", "#7287fd", "#11111b", 5.9],
  ["pink", "#ea76cb", "#11111b", 7.1],
  ["red", "#d20f39", "#ffffff", 5.4],
  ["blue", "#1e66f5", "#ffffff", 4.9],
  ["mauve", "#8839ef", "#ffffff", 5.4],
];

await test("the Latte accents get the review's text colours and ratios", () => {
  for (const [name, bg, fg, ratio] of LATTE) {
    assert.equal(PALETTES.latte[name], bg, `${name} is the colour the review measured`);
    const got = chipColours(PALETTES.latte, bg);
    assert.equal(got.fg, fg, name);
    assert.equal(got.bg, bg, `${name} keeps its background`);
    assert.equal(Math.round(contrastRatio(got.fg, got.bg) * 10) / 10, ratio, name);
  }
});

await test("crust stays first, so a dark palette keeps its text colour", () => {
  for (const name of ["peach", "green", "red", "lavender"]) {
    assert.equal(chipColours(PALETTES.mocha, PALETTES.mocha[name]).fg, PALETTES.mocha.crust, name);
  }
});

await test("a background no candidate reaches is darkened until one does", () => {
  const palette = { crust: "#808080", text: "#8a8a8a" };
  const got = chipColours(palette, "#7a7a7a");
  assert.notEqual(got.bg, "#7a7a7a");
  assert.ok(contrastRatio(got.fg, got.bg) >= 4.5, `${got.fg} on ${got.bg}`);
});

await test("the choice is computed once per palette and background", () => {
  assert.equal(chipColours(PALETTES.latte, "#fe640b"), chipColours(PALETTES.latte, "#fe640b"));
});

await test("lightening in OKLCH keeps the hue and raises the lightness", () => {
  for (const hex of [PALETTES.mocha.red, PALETTES.mocha.blue, PALETTES.latte.mauve, PALETTES.nord.teal]) {
    const before = toOklch(hex);
    const after = toOklch(lightenOklch(hex));
    const dh = Math.min(Math.abs(after.h - before.h), 360 - Math.abs(after.h - before.h));
    assert.ok(after.L > before.L, `${hex} lighter`);
    assert.ok(dh <= 3, `${hex} hue moved ${dh.toFixed(1)} degrees`);
    assert.ok(after.C <= before.C + 0.005, `${hex} chroma did not grow`);
  }
});
