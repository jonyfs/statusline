import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { test } from "../test-harness.js";
import { PRESETS } from "../composer-presets.js";
import { PAYLOAD, SOURCES, FIXED_NOW, SAMPLES } from "../composer-fixture.js";
import { gather, renderReadings } from "../../src/render.js";
import { SEGMENTS } from "../../src/segments.js";
import { loadGlyphs } from "../../src/preview/ansiToSvg.js";

// fileURLToPath, not `.pathname`: on Windows a file URL's pathname carries a
// leading slash before the drive letter, and a child process cannot find the
// module that produces (Principle IX).
const PAGE = fileURLToPath(new URL("../../specs/004-statusline-redesign-research/composer.html", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../generate-composer.js", import.meta.url));

const generate = () => execFileSync(process.execPath, [GENERATOR], { encoding: "utf8" });

await test("the page regenerates to the same bytes", () => {
  generate();
  const first = readFileSync(PAGE, "utf8");
  generate();
  const second = readFileSync(PAGE, "utf8");
  assert.equal(first, second, "two generations disagree, so the page is not reproducible");
});

// The page is opened from a file:// URL by somebody who may be offline, on a
// machine with no Nerd Font. A script src, a stylesheet link or a fetch would
// quietly break that for exactly the reader most likely to be in a terminal.
await test("the page reaches for nothing outside itself", () => {
  const html = readFileSync(PAGE, "utf8");
  assert.doesNotMatch(html, /<script[^>]+src=/i, "no external script");
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i, "no external stylesheet");
  assert.doesNotMatch(html, /@import/, "no imported stylesheet");
  assert.doesNotMatch(html, /\bfetch\(/, "no network call");
  // The SVG namespace is a name rather than an address, and nothing fetches
  // it. Every other URL in the file would be a request.
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0]);
  const unexpected = urls.filter((u) => u !== "http://www.w3.org/2000/svg" && !u.startsWith("https://github.com/"));
  assert.deepEqual(unexpected, [], `the page references ${unexpected.join(", ")}`);
});

await test("the inlined renderer carries no import, export or node builtin", () => {
  const html = readFileSync(PAGE, "utf8");
  const script = html.slice(html.indexOf('<script type="module">'), html.lastIndexOf("</script>"));
  assert.doesNotMatch(script, /^\s*import\s/m, "an import survived inlining");
  assert.doesNotMatch(script, /^\s*export\s/m, "an export survived inlining");
  assert.doesNotMatch(script, /node:/, "a node builtin survived inlining");
  assert.match(script, /function resolveArrangement/, "the resolver was not inlined");
  assert.match(script, /function fitToWidth/, "the layout was not inlined");
  assert.match(script, /function renderRow/, "the palette chain was not inlined");
  assert.match(script, /function createAnsiToSvg/, "the drawer was not inlined");
});

await test("every segment the bar can draw is on the page", () => {
  const html = readFileSync(PAGE, "utf8");
  for (const row of SEGMENTS) {
    assert.ok(html.includes(`"key":"${row.key}"`), `${row.key} is missing from the page`);
  }
});

await test("every preset is on the page with its three sentences", () => {
  const html = readFileSync(PAGE, "utf8");
  for (const p of PRESETS) {
    assert.ok(html.includes(`data-preset="${p.id}"`), `${p.id} has no card`);
    assert.ok(html.includes(p.label), `${p.id}'s label is missing`);
    for (const field of ["optimisesFor", "givesUp", "forWhom"]) {
      const sentence = p[field].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      assert.ok(html.includes(sentence), `${p.id}'s ${field} is missing`);
    }
    for (const conflict of p.conflicts) {
      assert.ok(html.includes(conflict.replace(/—/g, "—")), `${p.id}'s conflict is not stated`);
    }
  }
});

await test("the widths and both glyph modes are offered", () => {
  const html = readFileSync(PAGE, "utf8");
  for (const width of [80, 120, 160]) {
    assert.ok(html.includes(`${width}`), `${width} columns is not offered`);
  }
  assert.match(html, /Nerd Font/, "the Nerd Font mode is not offered");
  assert.match(html, /Plain text/, "the plain mode is not offered");
  assert.match(html, /"nerd":\[/, "the Nerd Font pool is missing");
  assert.match(html, /"plain":\[/, "the plain pool is missing");
});

await test("the handover and the warnings are on the page", () => {
  const html = readFileSync(PAGE, "utf8");
  assert.match(html, /id="handover"/, "there is nowhere to read the arrangement");
  assert.match(html, /Copy the arrangement/, "there is no way to copy it");
  assert.match(html, /~\/\.claude\/statusline\/layout\.json/, "the user path is not named");
  assert.match(html, /\.statusline\.json/, "the repository path is not named");
  assert.match(html, /id="warnings"/, "there is nowhere for a warning to appear");
  assert.match(html, /Every segment is switched off/, "the empty-bar warning is missing");
  assert.match(html, /cannot fit the narrowest terminal/, "the too-wide warning is missing");
});

await test("work in progress is kept across a reload", () => {
  const html = readFileSync(PAGE, "utf8");
  assert.match(html, /localStorage\.setItem/, "nothing is stored");
  assert.match(html, /localStorage\.getItem/, "nothing is restored");
});

await test("the embedded pool is what the renderer builds", () => {
  const html = readFileSync(PAGE, "utf8");
  const now = FIXED_NOW * 1000;
  const readings = gather(PAYLOAD, { ...SOURCES }, { now });
  const pool = renderReadings(readings, PAYLOAD, {
    flavor: "mocha", tracking: false, now, samples: SAMPLES,
    maxWidth: 400, maxHeight: 40, asPool: true,
  });
  assert.ok(pool.length > 0, "the renderer built nothing");
  assert.ok(html.includes(JSON.stringify(pool).slice(1, -1).slice(0, 400)), "the page's pool is not the renderer's");
});

await test("every Nerd Font codepoint the pool draws has an outline in the page", () => {
  const now = FIXED_NOW * 1000;
  const readings = gather(PAYLOAD, { ...SOURCES }, { now });
  const pool = renderReadings(readings, PAYLOAD, {
    flavor: "mocha", tracking: false, now, samples: SAMPLES,
    maxWidth: 400, maxHeight: 40, asPool: true,
  });
  const glyphs = loadGlyphs();
  const html = readFileSync(PAGE, "utf8");
  const isPrivateUse = (cp) =>
    (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
  for (const entry of pool) {
    for (const ch of entry.text) {
      const cp = ch.codePointAt(0);
      if (!isPrivateUse(cp)) continue;
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      assert.ok(glyphs.glyphs[hex], `${entry.key} draws ${hex}, which has no outline`);
      assert.ok(html.includes(`"${hex}"`), `${hex} is not embedded in the page`);
    }
  }
});

// The promise the whole page rests on: what it draws is what the terminal
// draws. This runs the page's own composition in Node, over the same pool it
// embeds, and compares it against the renderer for the same arrangement at
// the same width. It cannot drive a browser, and it does not need to: the
// composition is the four calls below, and they are the ones the page makes.
await test("the page composes the same bar the renderer draws", async () => {
  const { resolveArrangement, placementsForLine } = await import("../../src/arrangement.js");
  const { fitToWidth, alignColumns } = await import("../../src/layout.js");
  const { PALETTES, renderRow } = await import("../../src/theme.js");
  const { stripAnsi } = await import("../test-harness.js");

  const now = FIXED_NOW * 1000;
  const readings = () => gather(PAYLOAD, { ...SOURCES }, { now });
  const base = { flavor: "mocha", tracking: false, now, samples: SAMPLES, maxHeight: 40 };
  const pool = renderReadings(readings(), PAYLOAD, { ...base, maxWidth: 400, asPool: true });
  const byKey = new Map(pool.map((s) => [s.key, s]));

  const compose = (arrangement, width) => {
    const resolved = resolveArrangement(SEGMENTS, arrangement, "page");
    const rows = [];
    for (const line of [1, 2, 3, 4]) {
      const row = placementsForLine(resolved, line)
        .map((p) => (byKey.has(p.key) ? { ...p, ...byKey.get(p.key) } : null))
        .filter(Boolean);
      if (row.length) rows.push(fitToWidth(row, width));
    }
    if (!rows.length) return "";
    return alignColumns(rows, width)
      .map((row) => renderRow(PALETTES.mocha, row, { asciiArrows: false }))
      .join("\n");
  };

  for (const preset of PRESETS) {
    for (const width of [120, 160]) {
      const fromPage = stripAnsi(compose(preset.arrangement, width));
      const fromRenderer = stripAnsi(
        renderReadings(readings(), PAYLOAD, {
          ...base,
          maxWidth: width,
          arrangement: preset.arrangement,
          arrangementOrigin: "test",
        })
      );
      assert.equal(fromPage, fromRenderer, `${preset.id} differs at ${width} columns`);
    }
  }
});

// The arrangement the page hands over has to be usable exactly as copied.
await test("what the page hands back needs no editing", async () => {
  const { resolveArrangement } = await import("../../src/arrangement.js");
  for (const preset of PRESETS) {
    const resolved = resolveArrangement(SEGMENTS, preset.arrangement, "page");
    assert.deepEqual(resolved.ignored, [], `${preset.id} would be partly ignored`);
    assert.equal(preset.arrangement.version, 1, `${preset.id} does not name a version`);
  }
});
