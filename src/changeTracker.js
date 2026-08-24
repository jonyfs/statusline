import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Marks segments that changed since the previous render, and cycles their
 * icon through a short frame sequence while the change is still recent.
 *
 * The honest constraint this is built around: a statusline is printed
 * once per render and then it is static text — there is no timer, no
 * redraw loop, and no way for this process to animate anything after it
 * exits. Frames therefore advance per render, and Claude Code re-renders
 * roughly every 5-6 seconds during activity (measured, not assumed). The
 * result reads as a slow pulse that draws the eye to what changed, not as
 * smooth motion, and if nothing triggers a re-render the icon simply
 * holds on its current frame.
 */

const STATE_DIR = path.join(os.homedir(), ".claude", "statusline", "state");
const HIGHLIGHT_MS = 30_000;
const STALE_STATE_MS = 7 * 24 * 60 * 60 * 1000;

/** Frames a changed icon cycles through, per tracked segment kind. */
const FRAMES = {
  branch: ["🌱", "🌿", "🌳", "🌿"],
  pr: ["🔵", "🔷", "🔹", "🔷"],
  skills: ["✨", "🌟", "⭐", "🌟"],
  model: ["🔆", "🔅", "🔆", "🔅"],
  effort: ["⚡", "✨", "⚡", "✨"],
  ahead: ["⏫", "🔼", "⏫", "🔼"],
  behind: ["⏬", "🔽", "⏬", "🔽"],
};

function sessionStateFile(sessionId) {
  const safe = String(sessionId || "default").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(STATE_DIR, `${safe}.json`);
}

function loadState(sessionId) {
  try {
    return JSON.parse(readFileSync(sessionStateFile(sessionId), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Deletes state for sessions untouched for a week. Without this, every
 * session Claude Code ever opened would leave a file behind forever.
 */
function pruneStaleState(now) {
  try {
    for (const name of readdirSync(STATE_DIR)) {
      const file = path.join(STATE_DIR, name);
      try {
        if (now - statSync(file).mtimeMs > STALE_STATE_MS) unlinkSync(file);
      } catch {
        // a file vanishing mid-sweep is fine
      }
    }
  } catch {
    // no state dir yet
  }
}

function saveState(sessionId, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(sessionStateFile(sessionId), JSON.stringify(state));
  } catch {
    // best-effort: losing change tracking must never break the statusline
  }
}

/**
 * Compares the current snapshot against the previous render's and returns
 * `{ isChanged(key), iconFor(key, staticIcon) }`.
 *
 * Only discrete state is tracked. Usage percentages deliberately are not:
 * they tick up on nearly every render, so highlighting them would leave
 * the line permanently animated and the highlight would stop meaning
 * anything.
 */
export function trackChanges(sessionId, snapshot, { now = Date.now(), enabled = true } = {}) {
  if (!enabled) {
    return { isChanged: () => false, iconFor: (_key, staticIcon) => staticIcon };
  }

  const previous = loadState(sessionId);
  const changedAt = { ...(previous?.changedAt || {}) };
  const frame = ((previous?.frame ?? -1) + 1) % 4;

  for (const [key, value] of Object.entries(snapshot)) {
    const before = previous?.snapshot?.[key];
    // A first-ever render has nothing to compare against; treating every
    // value as "just changed" would light up the whole line on startup.
    if (previous && before !== value) changedAt[key] = now;
  }

  for (const [key, at] of Object.entries(changedAt)) {
    if (now - at > HIGHLIGHT_MS) delete changedAt[key];
  }

  // Swept once per session, on its first render — deterministic, and
  // frequent enough given each session starts exactly once.
  if (!previous) pruneStaleState(now);
  saveState(sessionId, { snapshot, changedAt, frame });

  return {
    isChanged: (key) => Object.hasOwn(changedAt, key),
    iconFor: (key, staticIcon) => {
      if (!Object.hasOwn(changedAt, key)) return staticIcon;
      const frames = FRAMES[key];
      return frames ? frames[frame % frames.length] : staticIcon;
    },
  };
}
