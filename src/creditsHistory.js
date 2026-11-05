/**
 * How fast the credits move, measured from Claude Code's own fetches
 * (specs/071-line-3-credits-seat, FR-002 and FR-003).
 *
 * The cached credits figure (src/usageCredits.js) changes only when Claude
 * Code refetches it, every few minutes while it runs. This keeps one point
 * per distinct fetch for a day, machine-wide, since the credits belong to
 * the account and not to a repository, and reads two things off it: the
 * rate per hour across the kept points, and how far the figure moved since
 * each session's first redraw. Both are differences between figures Claude
 * Code wrote; nothing is projected, because the cache names no reset.
 */

import { repoKey, readEntry, writeEntry } from "./cache.js";

export const CREDITS_HISTORY_KEY = repoKey("credits-history-global");
/** How long a point is kept. */
export const KEPT_MS = 24 * 60 * 60 * 1000;
/** How long a session's starting figure is kept. */
export const SESSION_KEPT_MS = 48 * 60 * 60 * 1000;
/** Two points closer than this say nothing about a rate. */
export const MIN_SPAN_MS = 30 * 60 * 1000;
/** A fall this large means the month rolled; the points before it describe another month. */
export const ROLL_DROP_POINTS = 1;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** A state read from the cache, or an empty one when the file is missing or of another shape. */
function cleanState(raw) {
  const ring = Array.isArray(raw?.ring) ? raw.ring.filter((p) => isBlock(p) && finite(p.at) && finite(p.pct)) : [];
  const sessions = {};
  if (isBlock(raw?.sessions)) {
    for (const [id, s] of Object.entries(raw.sessions)) {
      if (isBlock(s) && finite(s.at) && finite(s.pct)) sessions[id] = { at: s.at, pct: s.pct };
    }
  }
  return { ring, sessions };
}

/**
 * The next state and what it says: `{ state, ratePerHour, sessionDelta }`.
 * Pure, so a test can drive it without a file. `ratePerHour` is null below
 * two points, under thirty minutes of span, or without a rise; `sessionDelta`
 * is the rise since the session's first point, null when the figure fell.
 */
export function trendOf(previous, { pct, fetchedAt, sessionId, now }) {
  const state = cleanState(previous);
  let ring = state.ring.filter((p) => now - p.at <= KEPT_MS);
  const last = ring[ring.length - 1];
  if (!last || last.at !== fetchedAt) {
    if (last && (pct < last.pct - ROLL_DROP_POINTS || fetchedAt < last.at)) ring = [];
    if (!ring.length || ring[ring.length - 1].at !== fetchedAt) ring = [...ring, { at: fetchedAt, pct }];
  }
  const first = ring[0];
  const tail = ring[ring.length - 1];
  const spanMs = tail.at - first.at;
  const rise = tail.pct - first.pct;
  const ratePerHour = ring.length >= 2 && spanMs >= MIN_SPAN_MS && rise > 0 ? Number((rise / (spanMs / 3_600_000)).toFixed(2)) : null;

  const sessions = {};
  for (const [id, s] of Object.entries(state.sessions)) if (now - s.at <= SESSION_KEPT_MS) sessions[id] = s;
  let sessionDelta = null;
  if (typeof sessionId === "string" && sessionId) {
    const start = sessions[sessionId];
    if (!start || pct < start.pct - ROLL_DROP_POINTS) {
      sessions[sessionId] = { at: now, pct };
      sessionDelta = 0;
    } else {
      sessionDelta = Math.max(0, pct - start.pct);
    }
  }
  return { state: { ring, sessions }, ratePerHour, sessionDelta };
}

/**
 * Reads the history, folds the current figure in, writes it back, and
 * returns `{ ratePerHour, sessionDelta }`. A file that cannot be written
 * still yields this redraw's answer.
 */
export function creditsTrend({ pct, fetchedAt, sessionId = null, now = Date.now() }) {
  if (!finite(pct) || !finite(fetchedAt)) return null;
  const entry = readEntry(CREDITS_HISTORY_KEY, "creditsHistory");
  const { state, ratePerHour, sessionDelta } = trendOf(entry?.value, { pct, fetchedAt, sessionId, now });
  try {
    writeEntry(CREDITS_HISTORY_KEY, "creditsHistory", state, { now });
  } catch {
    // the next redraw folds the same figure in again
  }
  return { ratePerHour, sessionDelta };
}
