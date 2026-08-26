/**
 * Builds synthetic session transcripts.
 *
 * Real transcripts on this machine reach 78 MB with entries several
 * kilobytes wide, which is why a fixed-size tail read is not enough on
 * its own. `padBytes` reproduces that shape rather than writing narrow
 * lines that would make a tail read look better than it is.
 */

import { openSync, writeSync, closeSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CHUNK_ENTRIES = 200;

function assistantEntry(timestamp, padBytes, skill) {
  const content = [{ type: "text", text: "x".repeat(padBytes) }];
  if (skill) content.push({ type: "tool_use", name: "Skill", input: { skill } });
  return JSON.stringify({ type: "assistant", timestamp, message: { content } });
}

/**
 * Writes a transcript of roughly `sizeBytes`, with `skills` invoked in the
 * final entries so a tail read finds them and a head read does not.
 *
 * Returns the file path. The caller does not clean up: these live in the
 * OS temp directory and the OS sweeps them.
 */
export function writeTranscript({
  sizeBytes = 1024 * 1024,
  padBytes = 3000,
  skills = ["fixture-skill"],
  skillsAt = "tail",
  now = Date.now(),
  // How old the filler entries are. The default puts them well outside any
  // activity window, which is the normal shape of a long session. Passing
  // something small makes every entry recent, so a scan keeps walking
  // instead of stopping at the window, which is what the budget tests need.
  fillerAgeMs = 6 * 60 * 60 * 1000,
  dir,
} = {}) {
  const target = dir || mkdtempSync(path.join(os.tmpdir(), "transcript-"));
  const file = path.join(target, "session.jsonl");
  const fd = openSync(file, "w");

  const stamp = (offsetMs) => new Date(now - offsetMs).toISOString();
  let written = 0;
  let buffer = [];

  // The bulk: old entries, stamped well outside any activity window, so a
  // reader that walks past the tail is walking past expired material.
  const filler = assistantEntry(stamp(fillerAgeMs), padBytes) + "\n";
  const headSkills = skillsAt === "head" ? skills : [];
  for (const skill of headSkills) {
    buffer.push(assistantEntry(stamp(fillerAgeMs), padBytes, skill) + "\n");
  }

  while (written < sizeBytes) {
    buffer.push(filler);
    written += filler.length;
    if (buffer.length >= CHUNK_ENTRIES) {
      writeSync(fd, buffer.join(""));
      buffer = [];
    }
  }

  // The tail: recent entries, one per requested skill, newest last.
  if (skillsAt !== "head") {
    skills.forEach((skill, i) => {
      buffer.push(assistantEntry(stamp((skills.length - i) * 1000), padBytes, skill) + "\n");
    });
  }

  writeSync(fd, buffer.join(""));
  closeSync(fd);
  return file;
}
