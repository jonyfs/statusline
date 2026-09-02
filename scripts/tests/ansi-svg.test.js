/**
 * The converter, and the promise that making it constructible changed no
 * pixel of what it draws.
 *
 * `createAnsiToSvg` exists so the composer page can be handed a glyph table
 * instead of reading one off a disk it does not have. That is only worth
 * doing if the committed previews are byte-identical afterwards, which is
 * what the first case here is for.
 */

import { test } from "../test-harness.js";
import { ansiToSvg, createAnsiToSvg, loadGlyphs } from "../../src/preview/ansiToSvg.js";
import { gather, renderReadings } from "../../src/render.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const bar = () => {
  const readings = gather(PAYLOAD, { ...SOURCES }, { now: FIXED_NOW * 1000 });
  return renderReadings(readings, PAYLOAD, { ...RENDER_OPTIONS, maxWidth: 200, maxHeight: 40 });
};

await test("a converter built from the loaded table draws what the export draws", () => {
  const built = createAnsiToSvg(loadGlyphs());
  const ansi = bar();
  assert(built(ansi, { title: "t" }) === ansiToSvg(ansi, { title: "t" }), "the two converters disagree");
});

await test("the real bar converts, glyphs and emoji included", () => {
  const svg = ansiToSvg(bar(), { title: "composer fixture" });
  assert(svg.startsWith("<svg "), "not an svg");
  assert(/<path /.test(svg), "no Nerd Font outline was drawn");
  // The clock face on the merged reset segment is an emoji, and emoji stay
  // as text because every platform has a font for them.
  assert(/<text /.test(svg), "no text was drawn");
  assert(svg.trimEnd().endsWith("</svg>"), "the svg was not closed");
});

await test("loadGlyphs returns a table with outlines and an em size", () => {
  const glyphs = loadGlyphs();
  assert(typeof glyphs.unitsPerEm === "number" && glyphs.unitsPerEm > 0, "no em size");
  assert(Object.keys(glyphs.glyphs).length > 0, "no outlines");
});
