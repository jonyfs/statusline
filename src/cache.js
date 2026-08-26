/**
 * The cache behind the sources a redraw cannot afford to wait for.
 *
 * A redraw is allowed 300 ms. The pull request lookup alone takes 540 ms
 * on a warm network and its whole timeout when `gh` is unauthenticated, so
 * it cannot be on that path. Instead the redraw reads the last value from
 * a file here, and, when that value is halfway to expiring, starts a
 * detached process that does the lookup and writes it back.
 *
 * That process is not a daemon: it performs one lookup and exits. If it
 * never runs, the statusline still renders, only without those segments.
 *
 * Every write goes to a temporary file in the same directory and is then
 * renamed over the target, which is atomic on all three platforms. A
 * reader therefore sees either the whole previous file or the whole new
 * one, never half of either, even with two sessions redrawing at once.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { MAX_AGE_MS, REFRESH_BUDGET_MS } from "./freshness.js";

const SCHEMA = 1;
const CLI_PATH = fileURLToPath(new URL("../bin/cli.js", import.meta.url));

function cacheDir() {
  return path.join(os.homedir(), ".claude", "statusline", "cache");
}

/**
 * A filename-safe key for a directory. A hash rather than the path itself:
 * a path is not a legal filename anywhere, and two checkouts of the same
 * repository are legitimately different caches.
 */
export function repoKey(dir) {
  return createHash("sha256").update(String(dir || "no-directory")).digest("hex").slice(0, 16);
}

export function cacheFileFor(key) {
  return path.join(cacheDir(), `${key}.json`);
}

function loadFile(key) {
  try {
    const parsed = JSON.parse(readFileSync(cacheFileFor(key), "utf8"));
    // A file from another schema is a miss, never a migration: guessing at
    // the shape of an older cache is how a stale value gets misread as a
    // current one.
    if (parsed?.schema !== SCHEMA) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveFile(key, data) {
  const file = cacheFileFor(key);
  // A per-process suffix keeps two writers from sharing one temporary file
  // and handing a reader the interleaving of both.
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
    return true;
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    return false;
  }
}

/** The stored entry for `name`, or null when there is nothing usable. */
export function readEntry(key, name) {
  const file = loadFile(key);
  const entry = file?.entries?.[name];
  if (!entry || typeof entry.at !== "number") return null;
  return entry;
}

/** Stores `value` for `name`, leaving every other entry in the file alone. */
export function writeEntry(key, name, value, { now = Date.now() } = {}) {
  const file = loadFile(key) || { schema: SCHEMA, entries: {} };
  file.entries[name] = { value, at: now };
  return saveFile(key, file);
}

/**
 * Whether a refresh is due.
 *
 * Half the maximum age rather than the whole of it: refreshing only once a
 * value has expired would make the segment flicker between present and
 * absent on every cycle (FR-006).
 */
export function shouldRefresh(name, entry, now = Date.now()) {
  if (!entry) return true;
  const maxAge = MAX_AGE_MS[name] ?? 60_000;
  return now - entry.at > maxAge / 2;
}

/**
 * Claims the right to refresh `name`, or refuses when someone else already
 * has it. Without this, every redraw would spawn its own refresh process.
 *
 * A lock older than the maximum age is treated as abandoned, so a refresh
 * killed before it finished cannot block the key forever. Passing
 * `release` clears the lock without writing a value, which is what a
 * failed lookup does: the previous good value stays exactly where it is.
 */
export function takeLock(key, name, { now = Date.now(), release = false } = {}) {
  const file = loadFile(key) || { schema: SCHEMA, entries: {} };
  const locks = file.entries._locks || {};
  if (release) {
    delete locks[name];
    file.entries._locks = locks;
    saveFile(key, file);
    return true;
  }
  const held = locks[name];
  // The lock has to outlive the refresh it guards, or a slow lookup gets a
  // second process started on top of it. It also has to expire, or a
  // refresh killed before it finished would block the key forever.
  const lockMs = Math.max(MAX_AGE_MS[name] ?? 60_000, REFRESH_BUDGET_MS[name] ?? 0);
  if (typeof held === "number" && now - held < lockMs && held <= now) return false;
  locks[name] = now;
  file.entries._locks = locks;
  saveFile(key, file);
  return true;
}

/**
 * Starts the detached refresh for one cache key.
 *
 * `process.execPath` rather than a bare `node`: this is a spawned command,
 * and Principle IX requires the interpreter to be the one already running.
 * Arguments travel as an array and the directory as `cwd`, so nothing
 * derived from the environment is ever spliced into a shell string.
 *
 * Returns whether a process was started. `CLAUDE_STATUSLINE_NO_REFRESH=1`
 * suppresses it entirely, which is what keeps generated previews and the
 * test suite from touching anything live.
 */
export function spawnRefresh(key, name, cwd, { now = Date.now() } = {}) {
  if (process.env.CLAUDE_STATUSLINE_NO_REFRESH === "1") return false;
  if (!takeLock(key, name, { now })) return false;
  try {
    const child = spawn(process.execPath, [CLI_PATH, "refresh", name, key], {
      cwd,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return true;
  } catch {
    takeLock(key, name, { now, release: true });
    return false;
  }
}
