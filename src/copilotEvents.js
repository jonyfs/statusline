/**
 * Skills and working state from a Copilot CLI session (specs/029-multi-harness).
 *
 * Copilot's payload names a session directory as `transcript_path`, and the
 * session writes `events.jsonl` there: one `{type, data, timestamp}` per line.
 * A real session on 2026-10-01 wrote `assistant.turn_start` and
 * `assistant.turn_end` around each answer; Copilot emits `skill.invoked` with
 * the skill's `name` in `data`. This returns the same shape the Claude
 * transcript reader does, so the rest of the bar does not know the difference.
 */

import { openSync, readSync, fstatSync, closeSync } from "node:fs";
import path from "node:path";
import { windowMs } from "./skills.js";
import { plainText } from "./text.js";

/** As much of the log as a redraw reads, from the end. */
const TAIL_BYTES = 2 * 1024 * 1024;

/** The Claude reader's window for "something happened just now". */
const ACTIVE_WITHIN_MS = 10_000;

function readTail(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString("utf8");
    // A read that starts mid-file starts mid-line; that first piece is not an event.
    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function copilotSessionActivity(sessionDir, { now = Date.now(), limit = 3 } = {}) {
  if (typeof sessionDir !== "string" || !sessionDir) return null;
  const text = readTail(path.join(sessionDir, "events.jsonl"));
  if (text === null) return null;

  const window = windowMs();
  const skills = [];
  let lastAt = null;
  let turnOpen = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const t = Date.parse(event?.timestamp);
    if (Number.isFinite(t)) lastAt = Math.max(lastAt ?? t, t);
    if (event?.type === "assistant.turn_start") turnOpen = true;
    else if (event?.type === "assistant.turn_end") turnOpen = false;
    else if (event?.type === "skill.invoked" && Number.isFinite(t) && now - t <= window) {
      const name = plainText(event?.data?.name);
      if (name) skills.push(name);
    }
  }
  // Newest first, each skill once.
  const unique = [...new Set(skills.reverse())];
  return {
    skills: unique.slice(0, limit),
    skillsTrueCount: unique.length,
    todos: null,
    working: turnOpen || (lastAt !== null && now - lastAt <= ACTIVE_WITHIN_MS),
  };
}
