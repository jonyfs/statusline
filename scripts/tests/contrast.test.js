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

// Every scenario the previews are drawn from, in every palette, read back
// from the ANSI the renderer emits.
import { renderPayload } from "../../src/render.js";
import { SCENARIOS, FLAVOR_SCENARIO } from "../preview-fixtures.js";

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const FLAVORS = ["mocha", "frappe", "macchiato", "latte", "nord", "gruvbox"];
const SEPARATOR_GLYPH = /[\u{E0B0}-\u{E0D4}▸]/u;

/** Every run of text drawn with an explicit foreground and background. */
function pairs(ansi) {
  const out = [];
  let fg = null;
  let bg = null;
  const re = /\x1b\[([0-9;:]*)m|\x1b\]8;;[^\x07]*\x07|([^\x1b]+)/g;
  let m;
  while ((m = re.exec(ansi))) {
    if (m[2] !== undefined) {
      const text = m[2].replace(SEPARATOR_GLYPH, "").replace(/\s+/g, "");
      if (text && fg && bg) out.push({ fg, bg, text: m[2] });
    } else if (m[1] !== undefined) {
      const p = m[1].split(";");
      for (let i = 0; i < p.length; i++) {
        const n = Number(p[i]);
        if (n === 0 || m[1] === "") (fg = null), (bg = null);
        else if (n === 39) fg = null;
        else if (n === 49) bg = null;
        else if ((n === 38 || n === 48) && p[i + 1] === "2") {
          const hex = `#${[p[i + 2], p[i + 3], p[i + 4]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
          if (n === 38) fg = hex;
          else bg = hex;
          i += 4;
        }
      }
    }
  }
  return out;
}

const withFlavors = (fn) => {
  for (const flavor of FLAVORS) fn(flavor);
};

await test("every emitted foreground and background pair reaches 4.5:1 in every palette", () => {
  const failures = [];
  withFlavors((flavor) => {
    for (const scenario of [...SCENARIOS, FLAVOR_SCENARIO]) {
      const ansi = renderPayload(scenario.payload, {
        flavor,
        sources: scenario.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        maxWidth: scenario.width ?? 120,
        maxHeight: 40,
      });
      for (const p of pairs(ansi)) {
        const ratio = contrastRatio(p.fg, p.bg);
        if (ratio < 4.5) failures.push(`${flavor} ${p.fg} on ${p.bg} ${ratio.toFixed(2)} "${p.text.trim()}"`);
      }
    }
  });
  assert.deepEqual([...new Set(failures)], []);
});

/** The backgrounds a row steps through, one entry per chip. */
function chipBackgrounds(line) {
  const out = [];
  for (const m of line.matchAll(/\x1b\[48;2;(\d+);(\d+);(\d+)m/g)) {
    const hex = `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
    if (out[out.length - 1] !== hex) out.push(hex);
  }
  return out;
}

// Lightness is what tells two grey chips apart. Two accents are told apart
// by hue, which a luminance ratio does not measure, so the rule is for
// backgrounds that are both neutral.
const neutralOf = (flavor) => new Set(["crust", "mantle", "base", "surface1", "surface2"].map((k) => PALETTES[flavor][k]));

await test("neighbouring neutral chips on different backgrounds are at least 1.6:1 apart", () => {
  const close = [];
  withFlavors((flavor) => {
    for (const scenario of [...SCENARIOS, FLAVOR_SCENARIO]) {
      const ansi = renderPayload(scenario.payload, {
        flavor,
        sources: scenario.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        maxWidth: scenario.width ?? 120,
        maxHeight: 40,
      });
      for (const line of ansi.split("\n")) {
        const bgs = chipBackgrounds(line);
        for (let i = 1; i < bgs.length; i++) {
          if (!neutralOf(flavor).has(bgs[i - 1]) || !neutralOf(flavor).has(bgs[i])) continue;
          const r = contrastRatio(bgs[i - 1], bgs[i]);
          if (r < 1.6) close.push(`${flavor} ${bgs[i - 1]} next to ${bgs[i]} ${r.toFixed(2)}`);
        }
      }
    }
  });
  assert.deepEqual([...new Set(close)], []);
});

await test("the repository sits on the directory chip's background, in a quieter colour", () => {
  const full = SCENARIOS.find((s) => s.file === "full.svg");
  const ansi = renderPayload(full.payload, {
    flavor: "mocha",
    sources: full.sources,
    trackChanges: false,
    layout: NO_ARRANGEMENT,
    maxWidth: 120,
    maxHeight: 40,
  });
  const line = ansi.split("\n")[0];
  const at = line.indexOf("jonyfs/statusline");
  assert.ok(at > 0, "the repository is shown");
  const beforeRepo = line.slice(0, at);
  const dirAt = beforeRepo.lastIndexOf("statusline");
  const between = beforeRepo.slice(dirAt);
  const backgrounds = [...between.matchAll(/\x1b\[48;2;[0-9;]+m/g)].map((m) => m[0]);
  assert.equal(new Set(backgrounds).size, 1, "one background from the directory to the repository");
});
