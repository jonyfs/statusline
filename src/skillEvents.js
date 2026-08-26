/**
 * The per-session record of skill invocations written by the optional
 * `PostToolUse` hook.
 *
 * Why it exists: the transcript is written when Claude Code flushes it, so
 * a skill invoked a moment ago may not be readable yet. The hook fires at
 * the invocation itself, so the line reacts on the next redraw rather than
 * whenever the file catches up.
 *
 * Why the fallback stays: a hook is a second place for behaviour to live.
 * Anyone who skipped it, uses another machine, or edits their settings
 * would otherwise see a silently different statusline. The transcript scan
 * remains the source of truth; this only makes it faster (FR-019).
 *
 * The file is appended to, one JSON object per line, so a hook writing
 * while a redraw reads can never produce half a record.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const MAX_TAIL_BYTES = 64 * 1024;

function skillsDir() {
  return path.join(os.homedir(), ".claude", "statusline", "skills");
}

/** The same sanitising the animation state files already use. */
export function sessionFileFor(sessionId) {
  const safe = String(sessionId || "default").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(skillsDir(), `${safe}.jsonl`);
}

/** Appends one invocation. Best effort: losing a record costs one redraw's speed. */
export function appendSkillEvent(sessionId, skill, { now = Date.now() } = {}) {
  if (!skill) return false;
  try {
    mkdirSync(skillsDir(), { recursive: true });
    appendFileSync(sessionFileFor(sessionId), JSON.stringify({ skill, at: now }) + "\n");
    return true;
  } catch {
    return false;
  }
}

/**
 * Recent skills for a session, newest first, deduplicated and windowed.
 *
 * Only the tail of the file is read, and a malformed line is skipped
 * rather than ending the read: a truncated write in the middle of the file
 * must not hide the good records after it.
 */
export function readSkillEvents(sessionId, { limit = 3, windowMs = 30 * 60 * 1000, now = Date.now() } = {}) {
  let text;
  try {
    text = readFileSync(sessionFileFor(sessionId), "utf8");
  } catch {
    return [];
  }

  if (text.length > MAX_TAIL_BYTES) text = text.slice(-MAX_TAIL_BYTES);
  const cutoff = now - windowMs;
  const lines = text.split("\n").filter(Boolean);
  const found = [];
  const seen = new Set();

  for (let i = lines.length - 1; i >= 0 && found.length < limit; i--) {
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (typeof record?.at !== "number" || record.at < cutoff || record.at > now) continue;
    if (!record.skill || seen.has(record.skill)) continue;
    seen.add(record.skill);
    found.push(record.skill);
  }

  return found;
}

/**
 * The `note-skill` subcommand: read the hook payload from stdin, append one
 * record, say nothing, exit 0. A `PostToolUse` hook's non-zero exit is
 * feedback to the agent, and a statusline has nothing to tell it.
 */
export async function runNoteSkill({ now = Date.now() } = {}) {
  const raw = await new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });

  try {
    const payload = JSON.parse(raw || "{}");
    const input = payload?.tool_input || payload?.toolInput || {};
    const skill = input.skill || input.name || payload?.skill;
    const sessionId = payload?.session_id || payload?.sessionId;
    if (skill) appendSkillEvent(sessionId, skill, { now });
  } catch {
    // An unrecognised payload shape means do nothing, not fail.
  }
  return true;
}
