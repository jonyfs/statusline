import { readFileSync } from "node:fs";

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

function windowMs() {
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
 * The transcript format is not a stable public contract, so every step is
 * defensive: a parse failure yields fewer skills rather than a crash, and
 * an entry with no usable timestamp is kept rather than discarded, since
 * dropping it would hide a skill that may well be active.
 */
export function getActiveSkills(transcriptPath, limit = 3, { now = Date.now() } = {}) {
  if (!transcriptPath) return [];
  let lines;
  try {
    lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }

  const cutoff = now - windowMs();
  const found = [];
  const seen = new Set();

  // Scan a bounded slice of the tail rather than stopping at the first
  // out-of-window entry. Transcript order is close to chronological but
  // not strictly so: a real session had 16 out-of-order timestamps and 90
  // entries carrying none at all within its last 400 lines, so an
  // early break would have stopped on one stray old entry and hidden
  // every skill behind it. The cap keeps the read cheap on a long
  // session while leaving correctness to the per-entry check below.
  const MAX_SCAN = 2000;
  const stop = Math.max(0, lines.length - MAX_SCAN);

  for (let i = lines.length - 1; i >= stop && found.length < limit; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }

    const blocks = entry?.message?.content;
    if (!Array.isArray(blocks)) continue;

    // An entry with no parseable timestamp is kept: dropping it would
    // hide a skill that may well be active, which is the worse error.
    // Entries stamped after `now` are skipped too. At runtime that never
    // happens, but without the check the window is only half a window and
    // the behaviour cannot be tested at a chosen instant.
    const stamp = Date.parse(entry?.timestamp ?? "");
    if (Number.isFinite(stamp) && (stamp < cutoff || stamp > now)) continue;

    for (const block of blocks) {
      if (block?.type !== "tool_use") continue;
      if (String(block.name || "").toLowerCase() !== "skill") continue;
      const skillName = block.input?.skill || block.input?.name;
      if (skillName && !seen.has(skillName)) {
        seen.add(skillName);
        found.push(skillName);
      }
    }
  }

  return found;
}
