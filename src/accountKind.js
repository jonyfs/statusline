/**
 * Which kind of account the payload describes, and what was last seen
 * (specs/063-account-kind).
 *
 * A subscriber has `rate_limits.five_hour` and `seven_day`; an account metered
 * in dollars by a gateway has `spend_limit` and neither. The gateway drops
 * `spend_limit` once its reset has passed, and `rate_limits` is absent before
 * the first response, so a payload alone cannot always say which kind it is.
 * The last kind seen is kept for 30 days to fill that gap. It is one value for
 * the machine, not one per repository: the account does not change with the
 * directory.
 */

import { repoKey, readEntry, writeEntry } from "./cache.js";

export const ACCOUNT_KIND_KEY = repoKey("account-kind-global");
const KEPT_MS = 30 * 24 * 60 * 60 * 1000;
// A kind seen again is not rewritten on every redraw, only once a day, which
// is all the 30-day allowance needs.
const REWRITE_AFTER_MS = 24 * 60 * 60 * 1000;

const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** "subscriber", "budget", or null when the payload says neither. */
export function accountKindOf(payload) {
  const rl = payload?.rate_limits;
  if (!isBlock(rl)) return null;
  if (isBlock(rl.five_hour) || isBlock(rl.seven_day)) return "subscriber";
  if (isBlock(rl.spend_limit)) return "budget";
  return null;
}

/** The remembered kind, or null when none was seen in the last 30 days. */
export function getAccountKind({ now = Date.now() } = {}) {
  const entry = readEntry(ACCOUNT_KIND_KEY, "accountKind");
  if (!entry || now - entry.at > KEPT_MS) return null;
  return entry.value === "budget" || entry.value === "subscriber" ? entry.value : null;
}

/** Remembers `kind`. A null kind changes nothing, so silence never erases it. */
export function noteAccountKind(kind, { now = Date.now() } = {}) {
  if (kind !== "budget" && kind !== "subscriber") return false;
  const entry = readEntry(ACCOUNT_KIND_KEY, "accountKind");
  if (entry && entry.value === kind && now - entry.at < REWRITE_AFTER_MS) return false;
  return writeEntry(ACCOUNT_KIND_KEY, "accountKind", kind, { now });
}
