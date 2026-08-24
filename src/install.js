import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const SETTINGS_PATH = path.join(HOME, ".claude", "settings.json");
const BACKUP_DIR = path.join(HOME, ".claude", "statusline", "backups");
const CLI_PATH = fileURLToPath(new URL("../bin/cli.js", import.meta.url));

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    throw new Error(`Could not parse existing ${SETTINGS_PATH} — fix or remove it before installing.`);
  }
}

function backupSettings(settings) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `settings.${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(settings, null, 2));
  return backupPath;
}

function writeSettings(settings) {
  mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

/**
 * Both the interpreter and the script path are quoted because either can
 * contain spaces — `C:\Users\John Smith\...` on Windows, `/Users/x/My
 * Projects/...` anywhere — and an unquoted path would be split into
 * separate arguments by the shell.
 */
function buildCommand(interpreter, cliPath) {
  return `"${interpreter}" "${cliPath}" render`;
}

/** Exposed so the cross-platform smoke test can check Windows-style paths. */
export const buildCommandForTest = buildCommand;

/**
 * Prefers a bare `node` over this process's absolute executable path,
 * but only after confirming a shell can actually resolve it.
 *
 * `process.execPath` looks safer and is not: package managers hand out
 * version-pinned paths (Homebrew's `/usr/local/Cellar/node/26.7.0/bin/node`,
 * nvm's `~/.nvm/versions/node/v26.7.0/bin/node`), so pinning it means the
 * statusline breaks the next time Node is upgraded. A bare `node` follows
 * upgrades, and the probe below rules out the one case it fails — a shell
 * whose PATH has no node at all.
 */
function resolveInterpreter() {
  try {
    execFileSync("node", ["--version"], { stdio: "ignore", timeout: 5000, shell: true });
    return "node";
  } catch {
    return process.execPath;
  }
}

export function install() {
  const settings = loadSettings();
  const backupPath = backupSettings(settings);

  const command = buildCommand(resolveInterpreter(), CLI_PATH);
  const alreadyInstalled = settings.statusLine?.command === command;

  settings.statusLine = { type: "command", command };
  writeSettings(settings);

  return {
    settingsPath: SETTINGS_PATH,
    backupPath,
    command,
    alreadyInstalled,
  };
}

/**
 * Matches on this plugin's own CLI path rather than a bare "cli.js", so
 * uninstalling never removes some other tool's statusline that happens
 * to be a cli.js too. Windows path comparison is case-insensitive and
 * tolerates either slash direction, since the stored command may have
 * been written by a different shell than the one running now.
 */
function isOurCommand(command) {
  const normalize = (p) =>
    process.platform === "win32" ? p.replace(/\\/g, "/").toLowerCase() : p;
  return normalize(String(command || "")).includes(normalize(CLI_PATH));
}

export function uninstall() {
  if (!existsSync(SETTINGS_PATH)) {
    return { changed: false, reason: `${SETTINGS_PATH} does not exist.` };
  }
  const settings = loadSettings();
  if (!settings.statusLine || !isOurCommand(settings.statusLine.command)) {
    return { changed: false, reason: "No statusline installed by this plugin was found." };
  }

  backupSettings(settings);
  delete settings.statusLine;
  writeSettings(settings);

  return { changed: true, settingsPath: SETTINGS_PATH };
}
