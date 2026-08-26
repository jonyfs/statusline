/**
 * Reads the end of a session transcript without reading the whole file.
 *
 * The transcript is the only source whose cost grows with the length of
 * the session. Reading a real 78 MB transcript took 235 ms plus 86 ms to
 * split it into lines, on every redraw, for the sake of three skill names
 * at the very end of it. Reading the last 2 MB through a file descriptor
 * took 9 ms and parsing that took 8 ms.
 *
 * So the read walks backwards in chunks and stops as soon as it has what
 * it came for. Two things bound it: a byte cap, so a pathological
 * transcript cannot consume the redraw, and a time budget, so a slow disk
 * cannot either. Both are reported back, because "no skills were used
 * recently" and "the scan gave up" are different answers and the
 * diagnostic has to tell them apart.
 */

import { openSync, closeSync, fstatSync, readSync } from "node:fs";
import { TRANSCRIPT_BYTE_CAP, SOURCE_BUDGET_MS } from "./freshness.js";

const CHUNK_BYTES = 256 * 1024;

/**
 * Lines from the end of `file`, newest first, read in chunks until
 * `enough(lines)` is satisfied or a limit is reached.
 *
 * The first line of a chunk that does not start at byte 0 is a partial
 * line: its beginning is in the chunk before it. It is dropped rather than
 * parsed, since half a JSON object is not an entry.
 */
export function readTailLines(
  file,
  {
    enough = () => false,
    byteCap = TRANSCRIPT_BYTE_CAP,
    budgetMs = SOURCE_BUDGET_MS.transcript,
    now = () => Date.now(),
  } = {}
) {
  const started = now();
  let fd;
  try {
    fd = openSync(file, "r");
  } catch {
    return { lines: [], truncated: false, bytesRead: 0 };
  }

  try {
    const size = fstatSync(fd).size;
    let end = size;
    let carry = "";
    let bytesRead = 0;
    const lines = [];

    while (end > 0) {
      if (bytesRead >= byteCap) return { lines, truncated: true, bytesRead };
      if (now() - started > budgetMs) return { lines, truncated: true, bytesRead };

      const length = Math.min(CHUNK_BYTES, end);
      const start = end - length;
      const buffer = Buffer.allocUnsafe(length);
      readSync(fd, buffer, 0, length, start);
      bytesRead += length;
      end = start;

      const chunk = buffer.toString("utf8") + carry;
      const parts = chunk.split("\n");
      // Whatever precedes the first newline continues into the chunk
      // before this one, so it is carried rather than used, unless this
      // chunk starts the file and there is nothing before it.
      carry = end > 0 ? parts.shift() : "";
      if (end === 0 && parts.length === 0) break;

      for (let i = parts.length - 1; i >= 0; i--) {
        const line = parts[i];
        if (!line) continue;
        lines.push(line);
        if (enough(lines)) return { lines, truncated: false, bytesRead };
      }
    }

    if (carry) {
      lines.push(carry);
    }
    return { lines, truncated: false, bytesRead };
  } catch {
    return { lines: [], truncated: false, bytesRead: 0 };
  } finally {
    try {
      closeSync(fd);
    } catch {
      // already gone
    }
  }
}

/**
 * Skills invoked recently, newest first, read from the tail of a
 * transcript.
 *
 * Entries are only roughly chronological: one real session had 16
 * out-of-order timestamps and 90 entries with none at all in its last 400
 * lines. So the walk does not stop at the first old entry; it stops when
 * it has enough skills, or when it has walked past `windowMs` of material,
 * or when it hits one of the limits above.
 */
export function scanTailForSkills(
  file,
  { limit = 3, windowMs = 30 * 60 * 1000, now = Date.now(), byteCap, budgetMs } = {}
) {
  const cutoff = now - windowMs;
  const found = [];
  const seen = new Set();
  // How far past the window the walk keeps looking before accepting that
  // everything older is genuinely older. Without a margin, a single stray
  // old timestamp would end the scan; without a limit, a session with no
  // skills at all would read to the start of the file.
  let consecutiveOld = 0;
  const OLD_ENTRY_PATIENCE = 200;

  const collect = () => {
    const { lines, truncated, bytesRead } = readTailLines(file, {
      byteCap,
      budgetMs,
      enough: (acc) => {
        const line = acc[acc.length - 1];
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          return false;
        }

        const stamp = Date.parse(entry?.timestamp ?? "");
        // An entry with no parseable timestamp is kept: dropping it would
        // hide a skill that may well be active, which is the worse error.
        // Entries stamped after `now` are skipped too, which at runtime
        // only happens when the clock jumps.
        if (Number.isFinite(stamp) && (stamp < cutoff || stamp > now)) {
          consecutiveOld++;
          return consecutiveOld > OLD_ENTRY_PATIENCE;
        }
        consecutiveOld = 0;

        const blocks = entry?.message?.content;
        if (!Array.isArray(blocks)) return false;
        for (const block of blocks) {
          if (block?.type !== "tool_use") continue;
          if (String(block.name || "").toLowerCase() !== "skill") continue;
          const skillName = block.input?.skill || block.input?.name;
          if (skillName && !seen.has(skillName)) {
            seen.add(skillName);
            found.push(skillName);
          }
        }
        return found.length >= limit;
      },
    });
    return { truncated, bytesRead, scanned: lines.length };
  };

  const { truncated, bytesRead } = collect();
  return { skills: found.slice(0, limit), truncated, bytesRead };
}
