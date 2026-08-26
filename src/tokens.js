/**
 * Context %, 5-hour %, and 7-day % below come straight from Claude Code's
 * statusLine stdin payload — no local estimation. Verified against a real
 * payload captured from a live session:
 *
 *   context_window: { used_percentage, remaining_percentage, ... }
 *   rate_limits: { five_hour: { used_percentage, resets_at }, seven_day: { ... } }
 *
 * A field the payload does not carry stays null here and renders as `?%`.
 * Principle III forbids standing an estimate in its place.
 */

export function getContextPercent(payload) {
  const pct = payload?.context_window?.used_percentage;
  return typeof pct === "number" && Number.isFinite(pct) ? Math.round(pct) : null;
}

export function getRateLimits(payload) {
  const fiveHour = payload?.rate_limits?.five_hour;
  const sevenDay = payload?.rate_limits?.seven_day;
  return {
    fiveHourPct: typeof fiveHour?.used_percentage === "number" ? Math.round(fiveHour.used_percentage) : null,
    fiveHourResetsAt: typeof fiveHour?.resets_at === "number" ? fiveHour.resets_at : null,
    sevenDayPct: typeof sevenDay?.used_percentage === "number" ? Math.round(sevenDay.used_percentage) : null,
    sevenDayResetsAt: typeof sevenDay?.resets_at === "number" ? sevenDay.resets_at : null,
  };
}

/**
 * How long a window is judged to be "resetting now" once its moment has
 * passed. Inside this grace period the reset is genuinely happening; past
 * it, the payload is describing a moment that is over, and the honest
 * answer is that the next reset time is unknown rather than a countdown
 * that has been saying "now" for three hours.
 */
const RESETTING_GRACE_MS = 2 * 60 * 1000;

/**
 * `resetsAt` is a Unix timestamp in seconds, as returned by the payload.
 * `now` is injectable so a countdown can be tested at a chosen instant
 * rather than only against the wall clock.
 */
export function formatResetCountdown(resetsAtSeconds, now = Date.now()) {
  if (typeof resetsAtSeconds !== "number" || !Number.isFinite(resetsAtSeconds)) return null;
  const diffMs = resetsAtSeconds * 1000 - now;
  if (diffMs <= 0) {
    return diffMs > -RESETTING_GRACE_MS ? "resetting now" : null;
  }

  const totalHours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);

  // Past a day, hours-only reads as noise ("resets in 78h00m") — the
  // 7-day window routinely lands days out, so switch units there.
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `resets in ${days}d ${hours}h`;
  }
  return `resets in ${totalHours}h${String(minutes).padStart(2, "0")}m`;
}
