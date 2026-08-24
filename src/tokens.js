/**
 * Context %, 5-hour %, and 7-day % below come straight from Claude Code's
 * statusLine stdin payload — no local estimation. Verified against a real
 * payload captured from a live session:
 *
 *   context_window: { used_percentage, remaining_percentage, ... }
 *   rate_limits: { five_hour: { used_percentage, resets_at }, seven_day: { ... } }
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
 * `resetsAt` is a Unix timestamp in seconds, as returned by the payload.
 */
export function formatResetCountdown(resetsAtSeconds) {
  if (typeof resetsAtSeconds !== "number") return null;
  const diffMs = resetsAtSeconds * 1000 - Date.now();
  if (diffMs <= 0) return "resetting now";
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `resets in ${hours}h${String(minutes).padStart(2, "0")}m`;
}
