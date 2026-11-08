import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import {
  pushSample,
  hasEnough,
  ratePerHour,
  projectFull,
  MAX_SAMPLES,
  MIN_SAMPLES_FOR_RATE,
  MAX_SPAN_MS,
  MAX_GAP_MS,
  MIN_SAMPLE_INTERVAL_MS,
} from "../../src/samples.js";

const T0 = 1787000000000;
const ring = (count, step = 15_000, from = 10, per = 1) =>
  Array.from({ length: count }, (_, i) => ({
    at: T0 + i * step,
    contextPct: from + i * per,
    fiveHourPct: from + i * per,
    rtkPct: 80,
  }));

await test("the ring is bounded and evicts the oldest", () => {
  let samples = [];
  for (let i = 0; i < MAX_SAMPLES + 20; i++) {
    samples = pushSample(samples, { at: T0 + i * MIN_SAMPLE_INTERVAL_MS, contextPct: i });
  }
  // The span caps the history before the count does at a minute a sample.
  assert.ok(samples.length <= MAX_SAMPLES);
  assert.equal(samples[samples.length - 1].contextPct, MAX_SAMPLES + 19);
});

await test("a redraw every two seconds keeps one sample a minute, so the history still reaches back minutes, not two", () => {
  let samples = [];
  for (let i = 0; i < 600; i++) {
    samples = pushSample(samples, { at: T0 + i * 2000, contextPct: i });
  }
  // Twenty minutes of redraws: one kept sample per minute, bounded by the span.
  const span = samples[samples.length - 1].at - samples[0].at;
  assert.ok(span >= 10 * 60_000, `history spans ${span / 60000} minutes, expected at least 10`);
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i].at - samples[i - 1].at >= MIN_SAMPLE_INTERVAL_MS, "no two kept samples closer than the floor");
  }
});

await test("an absent value stays absent rather than becoming a zero", () => {
  const [only] = pushSample([], { at: T0, contextPct: undefined, fiveHourPct: null });
  assert.equal(only.contextPct, null);
  assert.equal(only.fiveHourPct, null);
});

await test("a clock that jumped backwards drops the sample, not the history", () => {
  const samples = pushSample(ring(3), { at: T0 - 60_000, contextPct: 99 });
  assert.equal(samples.length, 3, "the out-of-order sample is refused");
  assert.equal(samples[2].contextPct, 12, "and the history it would have corrupted survives");
});

await test("no rate until there is enough history", () => {
  // The first minute of every session. A rate over twelve seconds swings
  // wildly, and a number that swings beside measured ones reads as measured.
  assert.equal(hasEnough(ring(MIN_SAMPLES_FOR_RATE - 1), "fiveHourPct"), false);
  assert.equal(ratePerHour(ring(3), "fiveHourPct"), null);

  // Five samples, but only sixty seconds apart in total.
  assert.equal(hasEnough(ring(5, 5_000), "fiveHourPct"), false, "five samples over 20s is not enough");
  assert.equal(hasEnough(ring(5, 15_000), "fiveHourPct"), true, "five over a minute is");
});

await test("the rate is percentage points per hour", () => {
  // Five samples, fifteen seconds apart, one point each: four points over a
  // minute is 240 points an hour.
  const rate = ratePerHour(ring(5, 15_000, 10, 1), "fiveHourPct");
  assert.equal(Math.round(rate), 240);
});

await test("a falling value has no projection", () => {
  const falling = ring(6, 15_000, 50, -2);
  assert.equal(projectFull(falling, "fiveHourPct", T0), null);
});

await test("a rising value projects when it reaches 100", () => {
  const rising = ring(6, 60_000, 40, 5); // 5 points a minute, 300 an hour
  const at = projectFull(rising, "fiveHourPct", T0 + 300_000);
  assert.ok(at > T0, "the projection is in the future");
  // At 65% climbing 300 points an hour, 35 points away is about 7 minutes.
  assert.ok(Math.abs(at - (T0 + 300_000) - 7 * 60_000) < 60_000);
});

await test("a series already at the limit projects now", () => {
  const full = ring(6, 60_000, 95, 1).map((s) => ({ ...s, fiveHourPct: 100 }));
  full[0].fiveHourPct = 90;
  const at = projectFull(full, "fiveHourPct", T0);
  assert.equal(at, T0);
});

// Bounding the history --------------------------------------------------
//
// The ring is capped by count, and a count is not a bound on time: redraws
// are event-driven and the installed refresh interval is 60 seconds, so
// sixty samples can span an hour, or a night in a session left open.

await test("a sample older than the span is dropped, so a rate stays recent", () => {
  const old = [{ at: T0, contextPct: 10, fiveHourPct: 10, rtkPct: null }];
  const pushed = pushSample(old, { at: T0 + MAX_SPAN_MS + 60_000, contextPct: 12, fiveHourPct: 12 });
  assert.equal(pushed.length, 1, "only the new sample survives its own span");
  assert.equal(pushed[0].fiveHourPct, 12);
});

await test("a gap nobody observed ends the history rather than stretching it", () => {
  const before = ring(5, 15_000, 10, 1);
  const last = before[before.length - 1];
  const resumed = pushSample(before, {
    at: last.at + MAX_GAP_MS + 1000,
    contextPct: 40,
    fiveHourPct: 40,
  });
  assert.equal(resumed.length, 1);
  assert.equal(ratePerHour(resumed, "fiveHourPct"), null, "one sample is not a rate");
});

await test("a window that reset starts the history again", () => {
  // The 5-hour figure only climbs inside its window. A fall of this size is
  // the window rolling, and a rate spanning the boundary is arithmetic on
  // two unrelated series.
  const climbing = ring(6, MIN_SAMPLE_INTERVAL_MS, 80, 1);
  const last = climbing[climbing.length - 1];
  const afterReset = pushSample(climbing, { at: last.at + MIN_SAMPLE_INTERVAL_MS, contextPct: 30, fiveHourPct: 2 });
  assert.equal(afterReset.length, 1);
  assert.equal(afterReset[0].fiveHourPct, 2);
});

await test("an ordinary redraw still extends the history", () => {
  const before = ring(4, MIN_SAMPLE_INTERVAL_MS, 10, 1);
  const last = before[before.length - 1];
  const pushed = pushSample(before, { at: last.at + MIN_SAMPLE_INTERVAL_MS, contextPct: 20, fiveHourPct: last.fiveHourPct + 1 });
  assert.equal(pushed.length, 5);
});
