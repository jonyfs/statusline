import { readFileSync } from "node:fs";

/**
 * Best-effort scan of the current session transcript for Skill tool
 * invocations, most-recent first, deduplicated by skill name.
 * Transcript format is not a stable public contract, so every step here
 * is defensive: a parse failure yields an empty list instead of a crash.
 */
export function getActiveSkills(transcriptPath, limit = 3) {
  if (!transcriptPath) return [];
  let lines;
  try {
    lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }

  const found = [];
  const seen = new Set();

  for (let i = lines.length - 1; i >= 0 && found.length < limit; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const blocks = entry?.message?.content;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (block?.type !== "tool_use") continue;
      const name = String(block.name || "").toLowerCase();
      if (name !== "skill") continue;
      const skillName = block.input?.skill || block.input?.name;
      if (skillName && !seen.has(skillName)) {
        seen.add(skillName);
        found.push(skillName);
      }
    }
  }

  return found;
}
