import { scanTailForSkills } from "./transcriptTail.js";
import { readSkillEvents } from "./skillEvents.js";

/**
 * How long a skill counts as active after it was last invoked.
 *
 * Claude Code emits no "skill unloaded" event, so there is nothing to
 * observe that says a skill stopped mattering. Without a window, a skill
 * invoked once stays on the line for the rest of the session: in a real
 * transcript this showed a skill used three hours and 3,300 entries
 * earlier, sitting next to one from a minute ago as though both were
 * equally current.
 *
 * A time window is the honest approximation. It uses the timestamp the
 * transcript already records, and it degrades in the safe direction: a
 * skill that is genuinely still shaping the work will have been used
 * recently, and one that has not been touched in half an hour almost
 * certainly belongs to a finished task.
 */
const DEFAULT_WINDOW_MS = 30 * 60 * 1000;

export function windowMs() {
  const raw = process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN;
  if (!raw) return DEFAULT_WINDOW_MS;
  const minutes = Number(raw);
  // A non-numeric or negative override falls back rather than disabling
  // expiry by accident, which would silently restore the stale-skill bug.
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60000 : DEFAULT_WINDOW_MS;
}

/**
 * Skills invoked recently in the current session, most recent first,
 * deduplicated by name and dropped once they fall outside the window.
 *
 * Two paths lead here, and they agree on the answer. The optional
 * `PostToolUse` hook appends each invocation to a small per-session file,
 * which is a few hundred bytes to read and is written the moment the skill
 * runs. Without the hook, the transcript's tail is scanned instead, which
 * costs more and reacts only once the entry has been flushed. The hook is
 * an accelerator, never a dependency: the fallback is the source of truth
 * for correctness.
 *
 * The transcript format is not a stable public contract, so every step is
 * defensive: a parse failure yields fewer skills rather than a crash, and
 * an entry with no usable timestamp is kept rather than discarded, since
 * dropping it would hide a skill that may well be active.
 */
export function getActiveSkills(transcriptPath, limit = 3, { now = Date.now(), sessionId } = {}) {
  const window = windowMs();

  if (sessionId) {
    const fromHook = readSkillEvents(sessionId, { limit, windowMs: window, now });
    if (fromHook.length) return fromHook;
  }

  if (!transcriptPath) return [];
  return scanTailForSkills(transcriptPath, { limit, windowMs: window, now }).skills;
}

/**
 * The same scan, with the bookkeeping the diagnostic needs: how much was
 * read, and whether the walk gave up before it ran out of material.
 */
export function getActiveSkillsDetailed(transcriptPath, limit = 3, { now = Date.now(), sessionId } = {}) {
  const window = windowMs();

  if (sessionId) {
    const fromHook = readSkillEvents(sessionId, { limit, windowMs: window, now });
    if (fromHook.length) {
      return { skills: fromHook, truncated: false, bytesRead: 0, source: "hook" };
    }
  }

  if (!transcriptPath) return { skills: [], truncated: false, bytesRead: 0, source: "transcript" };
  return { ...scanTailForSkills(transcriptPath, { limit, windowMs: window, now }), source: "transcript" };
}
