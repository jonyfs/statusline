/**
 * The usage credits of a seat billed by usage, as Claude Code cached them
 * (specs/069-usage-credits).
 *
 * A Claude Enterprise seat metered in dollars (`seatTier` is
 * `enterprise_usage_based`) has no 5-hour or 7-day window, and Claude Code
 * sends it no `rate_limits` at all. Its allowance is a monthly cap on usage
 * credits. Claude Code fetches that figure for its own `/usage` screen and
 * keeps the last answer in `~/.claude.json` under `cachedUsageUtilization`.
 * This reads that file as written, and nothing else: no fetch, no credential,
 * no estimate. The bar is as fresh as Claude Code's last fetch.
 *
 * The figure counts only for the signed-in account (`accountUuid` matches
 * `oauthAccount.accountUuid`) and only within a day of its fetch. Anything
 * else is answered as absent, so a stale or borrowed figure never draws.
 *
 * Only percentages leave this module. The cache also carries the amounts in
 * money, and they stay here: a status line is shared on screens and in
 * screenshots with people who have no reason to learn that seats carry
 * different caps. A percentage says how much is left without saying of what.
 */

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** How long a cached fetch may be trusted. Beyond it the figure is absent. */
export const USAGE_CREDITS_FRESH_MS = 24 * 60 * 60 * 1000;

const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** The rounded percentage of a daily or weekly block, or null when the cache has none. */
function periodPct(block) {
  if (!isBlock(block) || !finite(block.utilization)) return null;
  return Math.round(block.utilization);
}

/**
 * `{ pct, daily, weekly, enabled, reached, hasWindows, fetchedAt }` from
 * Claude Code's cache, or null when there is no fresh figure for the
 * signed-in account. `pct` is the month's share used; `daily` and `weekly`
 * are the same for a day and a week when the cache carries those blocks,
 * else null. `hasWindows` is whether the same answer carries a 5-hour or
 * 7-day window, which is what tells a subscriber from a usage-based seat.
 */
export function readUsageCredits({ now = Date.now(), homedir = os.homedir() } = {}) {
  let root;
  try {
    root = JSON.parse(readFileSync(path.join(homedir, ".claude.json"), "utf8"));
  } catch {
    return null;
  }
  if (!isBlock(root)) return null;
  const cached = root.cachedUsageUtilization;
  const signedIn = root.oauthAccount?.accountUuid;
  if (!isBlock(cached) || typeof signedIn !== "string" || signedIn === "" || cached.accountUuid !== signedIn) return null;
  if (!finite(cached.fetchedAtMs) || now - cached.fetchedAtMs > USAGE_CREDITS_FRESH_MS || cached.fetchedAtMs > now) return null;
  const util = cached.utilization;
  if (!isBlock(util)) return null;
  const extra = util.extra_usage;
  if (!isBlock(extra) || !finite(extra.monthly_limit) || !finite(extra.used_credits) || !finite(extra.utilization)) return null;
  if (extra.monthly_limit <= 0 || extra.used_credits < 0) return null;
  return {
    pct: Math.round(extra.utilization),
    daily: periodPct(extra.daily),
    weekly: periodPct(extra.weekly),
    enabled: extra.is_enabled === true && extra.user_disabled !== true,
    reached: extra.spend_limit_reached === true,
    hasWindows: isBlock(util.five_hour) || isBlock(util.seven_day),
    fetchedAt: cached.fetchedAtMs,
  };
}
