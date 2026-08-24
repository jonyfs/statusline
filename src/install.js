import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

export function install() {
  const settings = loadSettings();
  const backupPath = backupSettings(settings);

  const command = `node ${CLI_PATH} render`;
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

export function uninstall() {
  if (!existsSync(SETTINGS_PATH)) {
    return { changed: false, reason: `${SETTINGS_PATH} does not exist.` };
  }
  const settings = loadSettings();
  if (!settings.statusLine || !String(settings.statusLine.command || "").includes("cli.js")) {
    return { changed: false, reason: "No statusline installed by this plugin was found." };
  }

  backupSettings(settings);
  delete settings.statusLine;
  writeSettings(settings);

  return { changed: true, settingsPath: SETTINGS_PATH };
}
