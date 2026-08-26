import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import {
  pushSample,
  hasEnough,
  ratePerHour,
  projectFull,
  seriesOf,
  sparkline,
  movedBy,
  MAX_SAMPLES,
  MIN_SAMPLES_FOR_RATE,
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
    samples = pushSample(samples, { at: T0 + i * 1000, contextPct: i });
  }
  assert.equal(samples.length, MAX_SAMPLES);
  assert.equal(samples[samples.length - 1].contextPct, MAX_SAMPLES + 19);
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

await test("a sparkline needs two points and scales to its own range", () => {
  assert.equal(sparkline([]), null);
  assert.equal(sparkline([5]), null);

  const flat = sparkline([50, 50, 50, 50]);
  assert.equal(new Set(flat).size, 1, "a flat series reads as flat");

  const rising = sparkline([0, 25, 50, 75, 100]);
  assert.equal(rising[0], "▁");
  assert.equal(rising[rising.length - 1], "█");
  assert.equal(rising.length, 5);
});

await test("the series is the last few usable values, oldest first", () => {
  const s = seriesOf(ring(20), "contextPct", 8);
  assert.equal(s.length, 8);
  assert.equal(s[s.length - 1], 29, "the newest value is last");
});

await test("a value only counts as moved once it has moved far enough", () => {
  assert.equal(movedBy(80, 80, 5), false);
  assert.equal(movedBy(80, 84, 5), false);
  assert.equal(movedBy(80, 85, 5), true);
  assert.equal(movedBy(80, 75, 5), true, "down counts too");
  assert.equal(movedBy(undefined, 80, 5), true, "the first value always counts");
});
