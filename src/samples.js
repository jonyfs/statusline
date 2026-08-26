/**
 * A short history of the numbers that move.
 *
 * Four selected items need to know where a value has been, not only where it
 * is: the burn rate on the 5-hour window, the projection that follows from
 * it, the context trend, and the rule that the savings figure only renders
 * once it has moved five points.
 *
 * The samples live in the per-session state file the change tracker already
 * writes, swept on the same schedule and failing the same safe way. A second
 * store would have doubled the failure modes for the same data.
 *
 * The ring is bounded at sixty samples, roughly six minutes of redraws, and
 * a rate is refused below five samples spanning a minute. A rate computed
 * over twelve seconds swings wildly, and a number that swings wildly beside
 * measured ones gets read as measured.
 */

/** How many samples to keep. Sixty redraws is about six minutes. */
export const MAX_SAMPLES = 60;

/** Below these, a rate is not computed at all. */
export const MIN_SAMPLES_FOR_RATE = 5;
export const MIN_SPAN_MS = 60_000;

/**
 * Appends a sample and evicts the oldest. Values that are absent stay
 * absent: a missing percentage is not a zero.
 */
export function pushSample(samples, sample) {
  const ring = Array.isArray(samples) ? samples : [];
  const clean = {
    at: sample.at,
    contextPct: numberOrNull(sample.contextPct),
    fiveHourPct: numberOrNull(sample.fiveHourPct),
    rtkPct: numberOrNull(sample.rtkPct),
  };
  // A clock that jumped backwards would make every rate negative. Drop the
  // out-of-order sample rather than the whole history.
  const last = ring[ring.length - 1];
  if (last && clean.at < last.at) return ring;
  return [...ring, clean].slice(-MAX_SAMPLES);
}

function numberOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Whether the ring holds enough to say anything about a direction. */
export function hasEnough(samples, field) {
  const usable = (samples || []).filter((s) => numberOrNull(s?.[field]) !== null);
  if (usable.length < MIN_SAMPLES_FOR_RATE) return false;
  return usable[usable.length - 1].at - usable[0].at >= MIN_SPAN_MS;
}

/**
 * Percentage points per hour, from the first usable sample to the last.
 *
 * Null when there is not enough history, which is the first minute of every
 * session. Rendering nothing there is deliberate: a rate is a claim about
 * the future, and one drawn from twelve seconds of past is not one worth
 * making.
 */
export function ratePerHour(samples, field) {
  if (!hasEnough(samples, field)) return null;
  const usable = samples.filter((s) => numberOrNull(s?.[field]) !== null);
  const first = usable[0];
  const last = usable[usable.length - 1];
  const hours = (last.at - first.at) / 3_600_000;
  if (hours <= 0) return null;
  return (last[field] - first[field]) / hours;
}

/**
 * When a percentage climbing at this rate would reach 100, in Unix
 * milliseconds. Null when it is falling, flat, or the rate is unknown.
 */
export function projectFull(samples, field, now) {
  const rate = ratePerHour(samples, field);
  if (rate === null || rate <= 0) return null;
  const usable = samples.filter((s) => numberOrNull(s?.[field]) !== null);
  const current = usable[usable.length - 1][field];
  if (current >= 100) return now;
  return now + ((100 - current) / rate) * 3_600_000;
}

/**
 * Whether a value has moved far enough from the last one shown to be worth
 * the width. Item C5's chosen form for the savings figure: five points.
 */
export function movedBy(previous, current, points) {
  if (typeof current !== "number") return false;
  if (typeof previous !== "number") return true;
  return Math.abs(current - previous) >= points;
}
