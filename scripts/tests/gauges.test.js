import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload, gather, renderReadings } from "../../src/render.js";
import { track, paceBand, contextBand, eighthsBar } from "../../src/ramp.js";
import { displayWidth } from "../../src/theme.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const opts = { ...RENDER_OPTIONS, maxWidth: 360, maxHeight: 40 };
const pool = (payload = PAYLOAD) =>
  renderReadings(gather(payload, { ...SOURCES }, { now: FIXED_NOW * 1000 }), payload, { ...opts, asPool: true });
const chip = (key, payload) => pool(payload).find((e) => e.key === key);

const g = GLYPHS.nerd;
const cells = (...kinds) => kinds.join("");
const FULL = [g.trackFullStart, g.trackFullMid, g.trackFullMid, g.trackFullMid, g.trackFullEnd];
const EMPTY = [g.trackEmptyStart, g.trackEmptyMid, g.trackEmptyMid, g.trackEmptyMid, g.trackEmptyEnd];
const expected = (full) => FULL.map((c, i) => (i < full ? c : EMPTY[i])).join("");

await test("the track is five cells, full from (i + 0.5) * 20 percent", () => {
  assert.equal(track(0, g), expected(0));
  assert.equal(track(10, g), expected(1));
  assert.equal(track(29, g), expected(1));
  assert.equal(track(30, g), expected(2));
  assert.equal(track(50, g), expected(3));
  assert.equal(track(90, g), expected(5));
  assert.equal(track(100, g), expected(5));
  assert.equal(track(250, g), expected(5), "past 100 is a full track");
  assert.equal(track(null, g), cells(g.trackEmptyStart, g.trackEmptyMid, g.trackEmptyMid, g.trackEmptyMid, g.trackEmptyEnd));
});

await test("the track cells are the Nerd Font progress set", () => {
  assert.equal(g.trackEmptyStart, "\u{EE00}");
  assert.equal(g.trackEmptyMid, "\u{EE01}");
  assert.equal(g.trackEmptyEnd, "\u{EE02}");
  assert.equal(g.trackFullStart, "\u{EE03}");
  assert.equal(g.trackFullMid, "\u{EE04}");
  assert.equal(g.trackFullEnd, "\u{EE05}");
  assert.equal(displayWidth(track(50, g)), 5);
});

await test("the plain and emoji tiers draw the track in ASCII, five columns", () => {
  assert.equal(track(50, GLYPHS.plain), "|||..");
  assert.equal(displayWidth(track(100, GLYPHS.plain)), 5);
});

await test("a window is banded by pace when its reset is known", () => {
  assert.equal(paceBand(62, 80).band, "ok");
  assert.equal(paceBand(62, 20).band, "critical");
  assert.equal(paceBand(30, 20).band, "warn");
  assert.equal(paceBand(92, 99).band, "critical", "used >= 90 is critical whatever the pace");
  assert.equal(paceBand(50, 50).band, "ok");
  assert.equal(paceBand(62, 20).pace, 42);
  assert.equal(paceBand(40, 50).pace, -10);
});

await test("an unknown elapsed time falls back to the absolute bands", () => {
  assert.equal(paceBand(50, null).band, "ok");
  assert.equal(paceBand(70, null).band, "warn");
  assert.equal(paceBand(90, null).band, "critical");
});

await test("the context warns at 70 and is critical at 85, and takes its own limits", () => {
  assert.equal(contextBand(69).band, "ok");
  assert.equal(contextBand(70).band, "warn");
  assert.equal(contextBand(84).band, "warn");
  assert.equal(contextBand(85).band, "critical");
  assert.equal(contextBand(60, { warn: 50, critical: 80 }).band, "warn");
  assert.equal(contextBand(60, { warn: 90, critical: 80 }).band, "ok", "limits out of order are ignored");
  assert.equal(contextBand(null).band, null);
});

await test("an agent row bar is eight cells with eighth blocks", () => {
  assert.equal(displayWidth(eighthsBar(0)), 8);
  assert.equal(eighthsBar(0), " ".repeat(8));
  assert.equal(eighthsBar(100), "█".repeat(8));
  assert.equal(displayWidth(eighthsBar(12)), 8);
  assert.match(eighthsBar(12), /^[█]?[▉-▏]? *$/);
  assert.equal(eighthsBar(50), "█".repeat(4) + " ".repeat(4));
});

import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sparkline } from "../../src/samples.js";
import { SAMPLES } from "../composer-fixture.js";

const withEnv = (vars, fn) => {
  const before = {};
  for (const k of Object.keys(vars)) {
    before[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
};

const withPct = (pct, reset = FIXED_NOW + 7740) => ({
  ...PAYLOAD,
  context_window: { used_percentage: pct },
  rate_limits: { ...PAYLOAD.rate_limits, five_hour: { used_percentage: pct, resets_at: reset } },
});

await test("a gauge draws its track, then its figure", () => {
  const c = chip("context", withPct(50));
  assert.ok(c.text.includes(expected(3)), "three of five cells full at 50%");
  assert.ok(c.text.trim().endsWith(`${"\u2007"}50%`) || c.text.includes("50%"));
});

await test("an unknown figure is the empty track and a dash", () => {
  const unknown = { ...PAYLOAD, context_window: {} };
  const c = chip("context", unknown);
  assert.ok(c.text.includes(EMPTY.join("")), "the empty track");
  assert.ok(c.text.includes("\u2014"), "and a dash, not ?%");
  assert.ok(!c.text.includes("?%"));
});

await test("the band marks: alert glyph before a critical figure, none in warn or ok", () => {
  assert.ok(chip("context", withPct(90)).text.includes(`${g.bandCritical}`));
  assert.ok(!chip("context", withPct(75)).text.includes(g.bandCritical), "warn has no glyph");
  assert.ok(!chip("context", withPct(20)).text.includes(g.bandCritical));
  assert.ok(!/[\u25b4\u25b5]/.test(chip("context", withPct(90)).text), "the triangles are gone");
});

await test("a window ahead of pace shows how far, and is banded by it", () => {
  // 62% used with 5 minutes of the 5 hours gone: 60 points ahead.
  const ahead = chip("fiveHour", withPct(62, FIXED_NOW + 295 * 60));
  // Critical, though the 7-day window is higher and keeps the one red
  // background: this one shows red text on the neutral fill.
  assert.ok(ahead.color === "red" || ahead.tone === "red");
  assert.match(ahead.text, /\+60pp/);
  // 62% used with most of the window gone is behind the clock: fine.
  const behind = chip("fiveHour", withPct(62, FIXED_NOW + 30 * 60));
  assert.equal(behind.color, "surface0");
  assert.doesNotMatch(behind.text, /pp/);
});

await test("the context thresholds come from the repository when valid", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ctxbands-"));
  writeFileSync(path.join(dir, ".statusline.json"), JSON.stringify({ contextBands: { warn: 50, critical: 80 } }));
  const at = (pct) => chip("context", { ...withPct(pct), cwd: dir, workspace: { ...PAYLOAD.workspace, current_dir: dir } });
  assert.equal(at(55).color, "peach");
  assert.equal(at(85).color, "red");
  assert.equal(chip("context", withPct(55)).color, "surface0", "the default warns at 70");
});

await test("the burn rate and the projection are one chip", () => {
  const p = pool();
  const burn = p.find((e) => e.key === "burnRate");
  assert.ok(burn.text.includes("%/h"));
  assert.match(burn.text, /full ~\d\d:\d\d/);
  assert.ok(!p.some((e) => e.key === "projection"), "projection has no chip of its own");
});

await test("the sparkline is optional and needs eight samples", () => {
  const eight = [
    ...SAMPLES,
    { at: FIXED_NOW * 1000 - 12 * 60000, fiveHourPct: 55, sevenDayPct: 76, contextPct: 30, rtkPct: 81 },
    { at: FIXED_NOW * 1000 - 14 * 60000, fiveHourPct: 54, sevenDayPct: 76, contextPct: 29, rtkPct: 81 },
  ].sort((a, b) => a.at - b.at);
  assert.equal(sparkline(eight, "fiveHourPct", 8).length, 8);
  assert.equal(sparkline(SAMPLES, "fiveHourPct", 8), null, "six samples are not enough");
  const run = (samples) =>
    renderReadings(gather(PAYLOAD, { ...SOURCES }, { now: FIXED_NOW * 1000 }), PAYLOAD, { ...opts, samples, asPool: true }).find(
      (e) => e.key === "burnRate"
    );
  assert.ok(!/[\u2581-\u2588]/.test(withEnv({ CLAUDE_STATUSLINE_SPARKLINE: undefined }, () => run(eight)?.text ?? "")));
  assert.ok(/[\u2581-\u2588]{8}/.test(withEnv({ CLAUDE_STATUSLINE_SPARKLINE: "1" }, () => run(eight)?.text ?? "")));
});

await test("the plain tier draws the track in ASCII", () => {
  const out = strip(
    renderPayload(withPct(50), { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 300, maxHeight: 40, asciiArrows: true })
  );
  assert.ok(out.includes("|||.."), out);
});
