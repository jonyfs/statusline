/**
 * What Claude Code cached for its own `/usage` screen, read as written
 * (specs/069-usage-credits, specs/070-account-coverage).
 *
 * A Claude Enterprise seat metered in dollars (`seatTier` is
 * `enterprise_usage_based`) has no 5-hour or 7-day window, and Claude Code
 * sends it no `rate_limits` at all. Its allowance is a monthly cap on usage
 * credits. Claude Code fetches that figure for its own `/usage` screen and
 * keeps the last answer in `~/.claude.json` under `cachedUsageUtilization`.
 * The same answer carries a subscriber's 5-hour and 7-day windows as
 * `{ utilization, resets_at }`, the pair Claude Code turns into the payload's
 * `used_percentage` and `resets_at` once the session's first response is in.
 * This reads that file, and nothing else: no fetch, no credential, no
 * estimate. The bar is as fresh as Claude Code's last fetch, and says so.
 *
 * The figure counts only for the signed-in account (`accountUuid` matches
 * `oauthAccount.accountUuid`) and only within a day of its fetch. Anything
 * else is answered as absent, so a stale or borrowed figure never draws.
 *
 * Only percentages and reset instants leave this module. The cache also
 * carries the amounts in money, and they stay here: a status line is shared
 * on screens and in screenshots with people who have no reason to learn that
 * seats carry different caps. A percentage says how much is left without
 * saying of what.
 */

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { plainText } from "./text.js";

/** How long a cached fetch may be trusted. Beyond it the figure is absent. */
export const USAGE_CREDITS_FRESH_MS = 24 * 60 * 60 * 1000;
/** Past this age a cached chip loses its band (specs/070, FR-004). */
export const CACHE_DIM_AFTER_MS = 6 * 60 * 60 * 1000;
/** Past this age a cached chip says how old it is (specs/070, FR-004). */
export const CACHE_AGE_AFTER_MS = 12 * 60 * 60 * 1000;

const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** The rounded percentage of a daily or weekly block, or null when the cache has none. */
function periodPct(block) {
  if (!isBlock(block) || !finite(block.utilization)) return null;
  return Math.round(block.utilization);
}

/** A window as the payload would carry it: `{ pct, resetsAt }`, or null. */
function windowOf(block) {
  if (!isBlock(block) || !finite(block.utilization)) return null;
  return { pct: Math.round(block.utilization), resetsAt: finite(block.resets_at) ? block.resets_at : null };
}

/**
 * When the monthly cap is assumed to come back (specs/071, FR-009): the
 * first day of the next calendar month at midnight in this computer's own
 * zone, in epoch seconds. An estimate, since the cache names no reset for
 * the cap; the chip marks it with a tilde for that reason.
 */
export function monthResetAt(now = Date.now()) {
  const d = new Date(now);
  return Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime() / 1000);
}

/**
 * The reset of the extra-usage cap when the cache carries one: the earliest
 * future `resets_at` among active `limits` whose kind or group names the
 * extra usage, credits, spend or overage. Null otherwise. Epoch seconds.
 */
function capResetOf(limits, now) {
  if (!Array.isArray(limits)) return null;
  let best = null;
  for (const l of limits) {
    if (!isBlock(l) || l.is_active === false) continue;
    const name = `${l.kind ?? ""} ${l.group ?? ""}`.toLowerCase();
    if (!/extra|credit|spend|overage/.test(name)) continue;
    const at = typeof l.resets_at === "string" ? Date.parse(l.resets_at) : NaN;
    if (!Number.isFinite(at) || at <= now) continue;
    if (best === null || at < best) best = at;
  }
  return best === null ? null : Math.floor(best / 1000);
}

/**
 * The age mark of a cached figure: `{ dim, label }`. `dim` past six hours,
 * `label` (`13h`) past twelve. Null when the fetch time is unknown.
 */
export function cacheAgeMark(fetchedAt, now = Date.now()) {
  if (!finite(fetchedAt)) return null;
  const age = now - fetchedAt;
  return {
    dim: age > CACHE_DIM_AFTER_MS,
    label: age > CACHE_AGE_AFTER_MS ? `${Math.floor(age / 3_600_000)}h` : null,
  };
}

/**
 * `{ pct, daily, weekly, enabled, reached, hasWindows, fetchedAt,
 * disabledReason, severity, creditsEverEnabled, windows }` from Claude
 * Code's cache, or null when there is no fresh figure for the signed-in
 * account. `pct` is the month's share of the credits used (null when the
 * cache has no usable `extra_usage`); `daily` and `weekly` are the same for a
 * day and a week when the cache carries those blocks. `windows` holds the
 * 5-hour and 7-day windows the cache carries, each `{ pct, resetsAt }` or
 * null; `hasWindows` is whether either exists at all, which is what tells a
 * subscriber from a usage-based seat. `severity` is the cache's own word for
 * the spend (`normal`, `warning`, `critical`) when it has one.
 */
/**
 * Who is signed in, from `oauthAccount` (specs/071, FR-007): the
 * organisation's name, the address, the seat tier and the organisation
 * type, each a string or null. Never the token. Null without the block.
 */
export function readAccountIdentity({ homedir = os.homedir() } = {}) {
  let root;
  try {
    root = JSON.parse(readFileSync(path.join(homedir, ".claude.json"), "utf8"));
  } catch {
    return null;
  }
  const a = root?.oauthAccount;
  if (!isBlock(a)) return null;
  // Sanitised like any payload string: a name is text written by someone
  // else, and a control sequence in it would reach the terminal otherwise.
  // Capped, so an organisation's name cannot take the line.
  const text = (v) => {
    const clean = plainText(v);
    return clean && clean.length > 40 ? `${clean.slice(0, 39)}\u2026` : clean;
  };
  return { org: text(a.organizationName), email: text(a.emailAddress), seatTier: text(a.seatTier), orgType: text(a.organizationType) };
}

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
  const windows = { fiveHour: windowOf(util.five_hour), sevenDay: windowOf(util.seven_day), perModel: [] };
  // The per-model weeks (specs/076): every `seven_day_<model>` block.
  for (const [key, block] of Object.entries(util)) {
    const m = key.match(/^seven_day_([a-z0-9]+)$/);
    if (!m || ["oauth_apps", "breakdown", "cowork", "omelette"].includes(m[1])) continue;
    const w = windowOf(block);
    if (w) windows.perModel.push({ model: m[1], ...w });
  }
  const extra = util.extra_usage;
  const credits =
    isBlock(extra) && finite(extra.monthly_limit) && finite(extra.used_credits) && finite(extra.utilization) &&
    extra.monthly_limit > 0 && extra.used_credits >= 0
      ? extra
      : null;
  if (!credits && !windows.fiveHour && !windows.sevenDay) return null;
  const severity = typeof util.spend?.severity === "string" ? util.spend.severity : null;
  // The cap stays in here (specs/071, FR-005): `shareOfCap` answers what
  // share of it a sum in dollars is, so the renderer never holds the amount.
  const places = finite(credits?.decimal_places) && credits.decimal_places >= 0 ? credits.decimal_places : 2;
  const capUsd = credits ? credits.monthly_limit / 10 ** places : null;
  return {
    pct: credits ? Math.round(credits.utilization) : null,
    pctExact: credits ? credits.utilization : null,
    shareOfCap: (usd) => (capUsd > 0 && finite(usd) && usd >= 0 ? (usd / capUsd) * 100 : null),
    daily: credits ? periodPct(credits.daily) : null,
    weekly: credits ? periodPct(credits.weekly) : null,
    enabled: credits !== null && credits.is_enabled === true && credits.user_disabled !== true,
    reached: credits?.spend_limit_reached === true,
    hasWindows: isBlock(util.five_hour) || isBlock(util.seven_day),
    fetchedAt: cached.fetchedAtMs,
    disabledReason: typeof credits?.disabled_reason === "string" ? credits.disabled_reason : null,
    severity,
    creditsEverEnabled: credits?.credits_ever_enabled === true,
    windows,
    resetsAt: capResetOf(util.limits, now),
  };
}
