/**
 * A throwaway HOME with its own settings.json.
 *
 * Install and uninstall write to `~/.claude/settings.json`. Testing them
 * against the real one would put a developer's own configuration at the
 * mercy of a failing assertion, so every such case runs in here instead.
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Creates the directory, seeds `settings.json` with `settings`, and returns
 * helpers for reading it back. `dir` is what to pass as HOME.
 */
export function makeHome(settings = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-home-"));
  const claude = path.join(dir, ".claude");
  mkdirSync(claude, { recursive: true });
  const settingsPath = path.join(claude, "settings.json");
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  return {
    dir,
    settingsPath,
    read: () => JSON.parse(readFileSync(settingsPath, "utf8")),
    raw: () => (existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : null),
  };
}

/**
 * Runs `fn` with `os.homedir()` and the HOME/USERPROFILE variables pointing
 * at `home.dir`, then restores them. Modules that resolve the home
 * directory at import time must be imported inside `fn`.
 */
export async function withHome(home, fn) {
  const realHomedir = os.homedir;
  const prev = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  os.homedir = () => home.dir;
  process.env.HOME = home.dir;
  process.env.USERPROFILE = home.dir;
  try {
    return await fn();
  } finally {
    os.homedir = realHomedir;
    if (prev.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = prev.HOME;
    if (prev.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prev.USERPROFILE;
  }
}
