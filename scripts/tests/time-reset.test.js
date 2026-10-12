import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { GLYPHS, gather, renderReadings, renderPayload } from "../../src/render.js";
import { resetMomentLabel } from "../../src/timeIcons.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const opts = { ...RENDER_OPTIONS, maxWidth: 520, maxHeight: 40 };
const pool = (payload = PAYLOAD) =>
  renderReadings(gather(payload, { ...SOURCES }, { now: FIXED_NOW * 1000 }), payload, { ...opts, asPool: true });
const chip = (key, payload) => pool(payload).find((e) => e.key === key);
const ansi = (payload) =>
  renderPayload(payload, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 520, maxHeight: 40, now: FIXED_NOW * 1000, samples: RENDER_OPTIONS.samples });

const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);
const now = new Date("2026-08-24T14:20:00Z");

await test("a moment is written in the forms of section 5.7", () => {
  // The suite pins TZ=UTC, so local time is UTC.
  assert.equal(resetMomentLabel(at("2026-08-24T15:00:00Z"), now), "15:00");
  assert.equal(resetMomentLabel(at("2026-08-25T09:00:00Z"), now), "tmrw 09:00");
  assert.equal(resetMomentLabel(at("2026-08-27T18:00:00Z"), now), "thu 18:00");
  assert.equal(resetMomentLabel(at("2026-09-02T12:00:00Z"), now), "sep 2");
  assert.equal(resetMomentLabel(at("2026-10-17T12:00:00Z"), now), "oct 17");
});

await test("the reset glyph is the sync mark, in each tier", () => {
  assert.equal(GLYPHS.nerd.reset, "\u{F04E6}");
  assert.equal(GLYPHS.emoji.reset, "\u{1F504}");
  assert.equal(GLYPHS.plain.reset, "↻");
  assert.ok(chip("fiveHour").text.includes(GLYPHS.nerd.reset));
  assert.ok(!chip("fiveHour").text.includes("·"));
});

await test("a reset under ten minutes on a critical window is drawn in the healthy colour", () => {
  const withReset = (pct, minutes) => ({
    ...PAYLOAD,
    rate_limits: { ...PAYLOAD.rate_limits, five_hour: { used_percentage: pct, resets_at: FIXED_NOW + minutes * 60 } },
  });
  // The colour sequence that sits right before the 5-hour chip's reset glyph.
  const colourBeforeReset = (payload) => {
    const out = ansi(payload);
    const from = out.indexOf("5h");
    const at = out.indexOf(GLYPHS.nerd.reset, from);
    const before = out.slice(from, at);
    return [...before.matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].pop()?.[1] ?? null;
  };
  const relief = colourBeforeReset(withReset(95, 8));
  const slow = colourBeforeReset(withReset(95, 12));
  const calm = colourBeforeReset(withReset(20, 8));
  assert.ok(relief, "a colour is set");
  assert.notEqual(relief, slow, "ten minutes is the line");
  assert.notEqual(relief, calm, "and a window that is not critical is not good news");
  // The healthy green is dark on a red chip and light on a neutral one, but
  // either way green leads: its green channel is the largest.
  const [r, g, b] = relief.split(";").map(Number);
  assert.ok(g >= r && g >= b, `rgb(${relief}) is green`);
});

await test("the session duration waits for half an hour", () => {
  const cost = (ms) => ({ ...PAYLOAD, cost: { ...PAYLOAD.cost, total_duration_ms: ms } });
  assert.equal(chip("duration", cost(29 * 60_000)), undefined);
  const long = chip("duration", cost(31 * 60_000));
  assert.ok(long.text.includes(GLYPHS.nerd.duration));
  assert.equal(GLYPHS.nerd.duration, "\u{F520}");
});

await test("a warm cache is an hourglass that empties by thirds of its TTL", () => {
  const warm = (secondsLeft, ttl = "5m") => ({
    ...PAYLOAD,
    prompt_cache: { warm: true, ttl, expires_at: FIXED_NOW + secondsLeft, caching_observed: true },
  });
  const glyphOf = (payload) => [...(chip("promptCache", payload)?.text.trim() ?? "")][0];
  // Inside the closing window of a 5 minute TTL: 110 seconds is a third and a bit.
  assert.equal(glyphOf(warm(110)), GLYPHS.nerd.cacheWarmHalf);
  assert.equal(glyphOf(warm(60)), GLYPHS.nerd.cacheWarmLow);
  assert.equal(GLYPHS.nerd.cacheWarm, "\u{F078C}");
  assert.equal(GLYPHS.nerd.cacheWarmHalf, "\u{F051F}");
  assert.equal(GLYPHS.nerd.cacheWarmLow, "\u{F06AD}");
});

await test("the 7-day window draws the week calendar", () => {
  assert.equal(GLYPHS.nerd.calendar, "\u{F0A33}");
  assert.ok(chip("sevenDay").text.includes(GLYPHS.nerd.calendar));
});
