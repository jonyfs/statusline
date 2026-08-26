import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../bin/cli.js", import.meta.url));

// Resolved per call rather than at import time, so a test can point HOME at
// a throwaway directory. Install and uninstall write to the file a
// developer's own Claude Code reads; a test that touched it would be one
// failing assertion away from costing them their configuration.
const settingsPath = () => path.join(os.homedir(), ".claude", "settings.json");
const backupDir = () => path.join(os.homedir(), ".claude", "statusline", "backups");

/**
 * Running this straight out of a package-manager scratch directory
 * (`~/.npm/_npx/<hash>/...`) records a path that only exists until the
 * cache is evicted. The statusline then silently disappears with no
 * clue why. Refusing here, with the command that does work, is far
 * kinder than that delayed failure.
 */
function assertNotRunningFromNpxCache() {
  const normalized = CLI_PATH.replace(/\\/g, "/");
  if (!normalized.includes("/_npx/")) return;
  throw new Error(
    [
      "Refusing to install from an npx cache directory.",
      "",
      `  ${CLI_PATH}`,
      "",
      "That cache is temporary and gets evicted later, which would leave",
      "Claude Code pointing at a path that no longer exists.",
      "",
      "Clone it somewhere permanent instead:",
      "",
      "  git clone https://github.com/jonyfs/statusline.git ~/.claude/statusline-plugin",
      "  node ~/.claude/statusline-plugin/bin/cli.js install",
    ].join("\n")
  );
}

function loadSettings() {
  const file = settingsPath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Could not parse existing ${file} — fix or remove it before installing.`);
  }
}

function backupSettings(settings) {
  mkdirSync(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir(), `settings.${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(settings, null, 2));
  return backupPath;
}

function writeSettings(settings) {
  mkdirSync(path.dirname(settingsPath()), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2) + "\n");
}

/**
 * Both the interpreter and the script path are quoted because either can
 * contain spaces — `C:\Users\John Smith\...` on Windows, `/Users/x/My
 * Projects/...` anywhere — and an unquoted path would be split into
 * separate arguments by the shell.
 */
function buildCommand(interpreter, cliPath, subcommand = "render") {
  return `"${interpreter}" "${cliPath}" ${subcommand}`;
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
    // No `shell: true` here. `execFileSync` searches PATH on its own, and
    // Node 26 deprecates passing arguments through a shell (DEP0190),
    // which printed a warning over the install's own output.
    execFileSync("node", ["--version"], { stdio: "ignore", timeout: 5000 });
    return "node";
  } catch {
    return process.execPath;
  }
}

/**
 * The skill hook's command.
 *
 * `process.execPath` here, deliberately unlike the `statusLine` command
 * above. Principle IX requires a spawned command to use the interpreter
 * already running; the bare `node` above is a documented exception that
 * predates this feature, and an exception does not extend itself to a
 * command string that did not exist before.
 */
export function buildHookCommand() {
  return buildCommand(process.execPath, CLI_PATH, "note-skill");
}

/** Whether a command string belongs to this plugin's own CLI. */
function isOurCommand(command) {
  const normalize = (p) =>
    process.platform === "win32" ? p.replace(/\\/g, "/").toLowerCase() : p;
  return normalize(String(command || "")).includes(normalize(CLI_PATH));
}

/**
 * Adds the `PostToolUse` entry that records skill invocations, leaving
 * every other hook alone. Idempotent: a second install replaces this
 * plugin's own entry rather than stacking another beside it.
 */
function registerHook(settings) {
  const command = buildHookCommand();
  settings.hooks = settings.hooks || {};
  const existing = Array.isArray(settings.hooks.PostToolUse) ? settings.hooks.PostToolUse : [];

  const others = existing.filter(
    (group) => !(group?.hooks || []).some((h) => isOurCommand(h?.command))
  );

  settings.hooks.PostToolUse = [
    ...others,
    { matcher: "Skill", hooks: [{ type: "command", command }] },
  ];
  return command;
}

/** Removes only the entry this plugin wrote, matched on its own CLI path. */
function removeHook(settings) {
  const groups = settings?.hooks?.PostToolUse;
  if (!Array.isArray(groups)) return false;

  const kept = groups.filter((group) => !(group?.hooks || []).some((h) => isOurCommand(h?.command)));
  if (kept.length === groups.length) return false;

  if (kept.length) settings.hooks.PostToolUse = kept;
  else delete settings.hooks.PostToolUse;
  // Leave no empty container behind that was not there before.
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return true;
}

export function install({ registerHook: wantHook = true } = {}) {
  assertNotRunningFromNpxCache();

  const settings = loadSettings();
  const backupPath = backupSettings(settings);

  const command = buildCommand(resolveInterpreter(), CLI_PATH);
  const alreadyInstalled = settings.statusLine?.command === command;

  settings.statusLine = { type: "command", command };
  // Registering by default keeps the skills line immediate for everyone,
  // and `--no-hook` is there for anyone who would rather not have a hook
  // in their settings. Asking interactively would break both idempotence
  // and any scripted install, which Principle IV rules out.
  const hookCommand = wantHook ? registerHook(settings) : null;
  if (!wantHook) removeHook(settings);
  writeSettings(settings);

  return {
    settingsPath: settingsPath(),
    backupPath,
    command,
    hookRegistered: Boolean(hookCommand),
    hookCommand,
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
export function uninstall() {
  const file = settingsPath();
  if (!existsSync(file)) {
    return { changed: false, reason: `${file} does not exist.` };
  }
  const settings = loadSettings();
  const hasStatusLine = settings.statusLine && isOurCommand(settings.statusLine.command);
  const hasHook = (settings?.hooks?.PostToolUse || []).some((group) =>
    (group?.hooks || []).some((h) => isOurCommand(h?.command))
  );

  if (!hasStatusLine && !hasHook) {
    return { changed: false, reason: "No statusline installed by this plugin was found." };
  }

  backupSettings(settings);
  if (hasStatusLine) delete settings.statusLine;
  const hookRemoved = removeHook(settings);
  writeSettings(settings);

  return { changed: true, settingsPath: file, hookRemoved };
}
