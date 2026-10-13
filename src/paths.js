/**
 * Where a render keeps its state, and whether it may write at all
 * (specs/057-passive-mode).
 *
 * Two variables decide, and nothing else reads them:
 *
 * - `CLAUDE_STATUSLINE_CACHE_DIR`, an absolute path, is the root of the cache,
 *   the session state, the task snapshots, the skill events and the Copilot
 *   event cache. A relative path is ignored: a host that meant a place would
 *   name it in full.
 * - `CLAUDE_STATUSLINE_PASSIVE=1` is a host asking to be certain. A render
 *   then starts no child process but read-only `git` and writes only inside
 *   the cache directory, and nowhere when none was given.
 *
 * The person's own configuration (`layout.json`, `updates.json`, the
 * remembered terminal background) is not state. It is read from the home
 * directory in every mode and a render never writes it.
 */

import os from "node:os";
import path from "node:path";

/** True when the host asked for a render that touches nothing it was not told to. */
export function isPassive(env = process.env) {
  return env.CLAUDE_STATUSLINE_PASSIVE === "1";
}

/** The directory the host named, or null. */
export function cacheRoot(env = process.env) {
  const dir = env.CLAUDE_STATUSLINE_CACHE_DIR;
  return typeof dir === "string" && dir !== "" && path.isAbsolute(dir) ? dir : null;
}

/** The root of everything a render keeps. */
export function stateRoot(env = process.env) {
  return cacheRoot(env) ?? path.join(os.homedir(), ".claude", "statusline");
}

/** Whether a render may write a file: always, except passive without a cache directory. */
export function canWrite(env = process.env) {
  return !isPassive(env) || cacheRoot(env) !== null;
}
