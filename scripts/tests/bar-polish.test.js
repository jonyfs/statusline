import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G, PLAIN, re } from "./glyphs.js";

// specs/027-bar-polish.

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const SEC = Math.floor(NOW / 1000);
const render = (payload, opts = {}) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40, ...opts }));
const lineWith = (text, marker) => text.split("\n").find((l) => l.includes(marker)) ?? "";

const narrow = fullPayload({
  now: NOW,
  model: { display_name: "Claude Opus 5 (preview)" },
  effort: { level: "xhigh" },
  context_window: { used_percentage: 100 },
  rate_limits: {
    five_hour: { used_percentage: 100, resets_at: SEC + 3600 },
    seven_day: { used_percentage: 100, resets_at: SEC + 6 * 86400 },
  },
});

// Story 1 -----------------------------------------------------------------

await test("a narrow line gives up the reset text before it gives up the model", () => {
  const l = lineWith(render(narrow, { maxWidth: 70 }), "Context");
  assert.match(l, /Claude Opus 5/, `the model was dropped: ${l}`);
  assert.match(l, /5h 100%▴ full/, "the exhausted window keeps its word");
  assert.doesNotMatch(l, /1h00m|· \d/, `reset text survived: ${l}`);
});

await test("the 7-day reset goes before the 5-hour countdown", () => {
  const widths = [];
  for (let w = 140; w >= 40; w -= 1) widths.push([w, lineWith(render(narrow, { maxWidth: w }), "Context")]);
  const firstNo7d = widths.find(([, l]) => /7d/.test(l) && !/7d 100%▴ full ·/.test(l));
  const firstNo5h = widths.find(([, l]) => /5h/.test(l) && !/5h 100%▴ full ·/.test(l));
  assert.ok(firstNo7d && firstNo5h);
  assert.ok(firstNo7d[0] >= firstNo5h[0], `7d reset went at ${firstNo7d[0]}, 5h at ${firstNo5h[0]}`);
});

await test("with room enough after dropping minor segments, every reset stays", () => {
  const l = lineWith(render(narrow, { maxWidth: 120 }), "Context");
  assert.match(l, /5h 100%▴ full · 1h00m/);
});

// Story 2 -----------------------------------------------------------------

await test("vim mode is shown on line 2, and only when the payload has it", () => {
  const out = render(fullPayload({ now: NOW, vim: { mode: "NORMAL" } }));
  assert.match(out, re`${G.vim} NORMAL`);
  assert.match(render(fullPayload({ now: NOW, vim: { mode: "VISUAL LINE" } })), /VISUAL LINE/);
  const plain = render(fullPayload({ now: NOW }));
  assert.doesNotMatch(plain, new RegExp(G.vim, "u"));
  assert.equal(render(fullPayload({ now: NOW, vim: { mode: 7 } })), plain);
  assert.match(render(fullPayload({ now: NOW, vim: { mode: "INSERT" } }), { asciiArrows: true }), new RegExp(`${PLAIN.vim} INSERT`, "u"));
});

// Story 3 -----------------------------------------------------------------

await test("fast mode is shown beside the effort, and only when on", () => {
  assert.match(render(fullPayload({ now: NOW, fast_mode: true })), re`${G.fast} fast`);
  const off = render(fullPayload({ now: NOW, fast_mode: false }));
  assert.doesNotMatch(off, /fast/);
  assert.equal(off, render(fullPayload({ now: NOW })));
  assert.equal(PLAIN.fast, "⇶");
  assert.equal(PLAIN.vim, "⌨");
});
