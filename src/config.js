/**
 * Per-repository settings, for the one case environment variables cannot
 * cover: a monorepo and a scratch repository wanting different bars.
 *
 * The file is optional, small, and read once per redraw. Environment
 * variables still win, which is item F4's chosen form: they stay the
 * mechanism, and this only fills in where nobody has set one.
 *
 * A file in the home directory is ignored. Configuration that lives in a
 * repository travels to everyone who clones it, and `~` is not a project.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const FILENAME = ".statusline.json";

/** Only these keys are read. Anything else in the file is ignored. */
const KNOWN = ["flavor", "ascii", "separator", "skillWindowMin"];

/**
 * Walks up from `cwd` looking for the file, stopping at the filesystem root
 * or the home directory, whichever comes first.
 */
function findConfigFile(cwd) {
  const home = os.homedir();
  let dir = cwd;
  for (let depth = 0; depth < 64; depth++) {
    if (dir === home) return null;
    const candidate = path.join(dir, FILENAME);
    try {
      return { path: candidate, text: readFileSync(candidate, "utf8") };
    } catch {
      // not here; keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * The repository's settings, or an empty object. A file that cannot be read
 * or parsed is not an error: it means no settings, the same as no file.
 */
export function repoConfig(cwd = process.cwd()) {
  const found = findConfigFile(cwd);
  if (!found) return {};
  try {
    const parsed = JSON.parse(found.text);
    const out = {};
    for (const key of KNOWN) {
      if (parsed[key] !== undefined) out[key] = parsed[key];
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The settings a render should use: an environment variable when one is
 * set, then the repository's file, then the default.
 */
export function resolveSettings(cwd = process.cwd(), env = process.env) {
  const file = repoConfig(cwd);
  return {
    flavor: env.CLAUDE_STATUSLINE_FLAVOR || file.flavor || "mocha",
    asciiArrows: env.CLAUDE_STATUSLINE_ASCII === "1" || file.ascii === true,
    separator: env.CLAUDE_STATUSLINE_SEPARATOR || file.separator || null,
    skillWindowMin: env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN || file.skillWindowMin || null,
  };
}
