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

/**
 * Token counts are long, and a bar cares more about a predictable column
 * count than about the last three digits. 16,742 becomes 16.7k; 1,000,000
 * becomes 1M. Item E9's chosen form.
 */
export function abbreviate(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (Math.abs(n) < 1000) return String(Math.round(n));
  if (Math.abs(n) < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * The context window's own numbers: how many tokens are in it, how big it
 * is, and whether the payload's fixed 200k flag is set. All three come
 * straight from the payload; none is estimated.
 */
export function getContextTokens(payload) {
  const cw = payload?.context_window;
  const input = typeof cw?.total_input_tokens === "number" ? cw.total_input_tokens : null;
  const output = typeof cw?.total_output_tokens === "number" ? cw.total_output_tokens : null;
  const size = typeof cw?.context_window_size === "number" ? cw.context_window_size : null;
  const used = input === null && output === null ? null : (input ?? 0) + (output ?? 0);
  return { input, output, used, size, exceeds200k: payload?.exceeds_200k_tokens === true };
}

/**
 * What the session has cost in time and lines. Dollars are in the payload
 * too, and were not selected.
 */
export function getSessionCost(payload) {
  const c = payload?.cost;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    durationMs: num(c?.total_duration_ms),
    apiMs: num(c?.total_api_duration_ms),
    linesAdded: num(c?.total_lines_added),
    linesRemoved: num(c?.total_lines_removed),
  };
}

/** `1h04m`, or `04m` under an hour. Item A4's chosen form. */
export function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

/**
 * A countdown with no words, for the segment that carries two of them.
 * `1h29m`, `3d`, or null when the moment is unknown or long past.
 */
export function shortCountdown(resetsAtSeconds, now = Date.now()) {
  const full = formatResetCountdown(resetsAtSeconds, now);
  if (full === null) return null;
  if (full === "resetting now") return "now";
  return full.replace(/^resets in /, "").replace(/ (\d+)h$/, "");
}
