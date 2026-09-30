import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../bin/cli.js", import.meta.url));
const PACKAGE_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

/** The oldest Node this code runs on, as `package.json`'s `engines` says. */
export const MIN_NODE_MAJOR = 18;

/**
 * Why this Node cannot run the plugin, or null when it can.
 *
 * On Node 14 the install used to print "Statusline installed." and the bar
 * then drew "statusline unavailable": nothing checked `engines`, so the
 * failure surfaced later and somewhere else (specs/024-install-update).
 */
export function unsupportedNode(version = process.versions.node) {
  const major = Number.parseInt(String(version).split(".")[0], 10);
  if (Number.isFinite(major) && major >= MIN_NODE_MAJOR) return null;
  return `Node ${MIN_NODE_MAJOR} or newer is required; this is Node ${version}.`;
}

/**
 * What is being installed: the package version, and the clone's commit when
 * there is one. Printed so that an install run over a clone that a failed
 * `git clone` never updated says plainly that it is the old code.
 */
export function installedVersion() {
  let version = null;
  try {
    version = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")).version ?? null;
  } catch {
    // A missing package.json is not a reason to refuse an install.
  }
  let commit = null;
  let date = null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%h %cs"], {
      cwd: path.dirname(PACKAGE_PATH),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    [commit = null, date = null] = out.split(" ");
  } catch {
    // Not a clone, or no git: the version alone still says something.
  }
  return { version, commit, date };
}

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
function cloneCommandFor() {
  return `git clone https://github.com/jonyfs/statusline.git "${shellPath(path.join(os.homedir(), ".claude", "statusline-plugin"))}"`;
}

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
      `  ${cloneCommandFor()}`,
      `  node "${shellPath(path.join(os.homedir(), ".claude", "statusline-plugin", "bin", "cli.js"))}" install`,
    ].join("\n")
  );
}

function loadSettings() {
  const file = settingsPath();
  if (!existsSync(file)) return {};
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Could not parse existing ${file} — fix or remove it before installing.`);
  }
  // Valid JSON is not enough: the settings root has to be a plain object for
  // the keys to survive being written back. Assigning `statusLine` to an
  // array succeeds silently in JavaScript and is then dropped by
  // `JSON.stringify`, which serialises only a list's indices — so the install
  // reported "Statusline installed." over a file it had changed in no way.
  // A refusal is the honest outcome; a false success is the one that costs
  // someone an afternoon.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `${file} is ${Array.isArray(parsed) ? "a list" : `a ${parsed === null ? "null" : typeof parsed}`}, not a settings object — fix or remove it before installing.`
    );
  }
  return parsed;
}

function backupSettings(settings) {
  mkdirSync(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir(), `settings.${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(settings, null, 2));
  return backupPath;
}

/**
 * Written to a temporary file beside the target and renamed over it, which
 * is atomic on all three platforms. Written in place, a process killed
 * mid-write left a truncated settings file, and Claude Code reads this one
 * file for everything else it is configured with.
 */
function writeSettings(settings) {
  const file = settingsPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n");
    renameSync(tmp, file);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    throw err;
  }
}

/**
 * A path as a shell command should carry it. Claude Code's statusline docs
 * ask for forward slashes on Windows, and every Windows program this
 * project starts accepts them.
 */
export function shellPath(p, platform = process.platform) {
  return platform === "win32" ? String(p).replace(/\\/g, "/") : String(p);
}

let nodeRunsCache;
/** Whether a bare `node` runs from the shell doing the install. */
function nodeRuns() {
  if (nodeRunsCache !== undefined) return nodeRunsCache;
  try {
    // No `shell: true` here. `execFileSync` searches PATH on its own, and
    // Node 26 deprecates passing arguments through a shell (DEP0190),
    // which printed a warning over the install's own output.
    execFileSync("node", ["--version"], { stdio: "ignore", timeout: 5000 });
    nodeRunsCache = true;
  } catch {
    nodeRunsCache = false;
  }
  return nodeRunsCache;
}

/**
 * A command every shell Claude Code runs it through can parse: POSIX `sh`,
 * Git Bash, and PowerShell, which it uses on Windows when Git Bash is absent
 * (specs/028-cross-platform, Principle IX).
 *
 * The script path is quoted, since it can hold spaces anywhere. The
 * interpreter is not: PowerShell reads a line that opens with a quoted
 * string as an expression and never runs it, and the `&` that would make it
 * a command is a syntax error in bash. So an interpreter with a space is
 * quoted only on POSIX, and on Windows, where the usual one is
 * `C:\Program Files\nodejs\node.exe`, it becomes a bare `node` when that
 * runs; otherwise it stays quoted and only Git Bash can run it, which
 * install says.
 */
function buildCommand(interpreter, cliPath, subcommand = "render", { platform = process.platform, nodeRuns: canRunNode = nodeRuns } = {}) {
  let interp = shellPath(interpreter, platform);
  if (/\s/.test(interp)) interp = platform === "win32" && canRunNode() ? "node" : `"${interp}"`;
  return `${interp} "${shellPath(cliPath, platform)}" ${subcommand}`;
}

/** Exposed so the cross-platform tests can check each platform's form. */
export const buildCommandForTest = buildCommand;
export const CLI_PATH_FOR_TEST = CLI_PATH;

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
  return nodeRuns() ? "node" : process.execPath;
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

/** The command that draws the subagent task rows (item F2). */
export function buildTaskRowCommand() {
  return buildCommand(process.execPath, CLI_PATH, "task-rows");
}

/**
 * How often Claude Code re-runs the command on its own, in seconds.
 *
 * Updates are event-driven, and the events go quiet while a session is
 * idle. The countdowns and the clock are exactly the segments that keep
 * changing while nothing else does, so without an interval they freeze at
 * whatever they said when the last event fired. Item F1's chosen value.
 */
export const REFRESH_INTERVAL_SECONDS = 60;

/** Whether a command string belongs to this plugin's own CLI. */
function isOurCommand(command) {
  const normalize = (p) =>
    process.platform === "win32" ? p.replace(/\\/g, "/").toLowerCase() : p;
  return normalize(String(command || "")).includes(normalize(CLI_PATH));
}

/**
 * This plugin's skill hook, wherever its clone lives.
 *
 * `isOurCommand` matches the running clone's own path, which is right for
 * uninstall and wrong for cleanup: a clone moved or re-made elsewhere left
 * the first one's hook behind, and every skill then ran two hooks, one of
 * them in a directory that may be gone. `note-skill` is a subcommand no other
 * tool has, and it sits at the very end of the command this install writes.
 */
function isOurSkillHookAnywhere(command) {
  return /cli\.js"\s+note-skill\s*$/.test(String(command || ""));
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
    (group) =>
      !(group?.hooks || []).some((h) => isOurCommand(h?.command) || isOurSkillHookAnywhere(h?.command))
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

export function install({
  registerHook: wantHook = true,
  refreshInterval: wantInterval = true,
  taskRows: wantTaskRows = true,
} = {}) {
  assertNotRunningFromNpxCache();
  const tooOld = unsupportedNode();
  if (tooOld) throw new Error(tooOld);

  const settings = loadSettings();
  const backupPath = backupSettings(settings);

  const command = buildCommand(resolveInterpreter(), CLI_PATH);
  const alreadyInstalled = settings.statusLine?.command === command;

  settings.statusLine = { type: "command", command };
  if (wantInterval) settings.statusLine.refreshInterval = REFRESH_INTERVAL_SECONDS;
  // The subagent rows are their own top-level setting with their own tick,
  // not a field on `statusLine`. This was installed as `statusLine.taskCommand`
  // until 2026-09-06, which Claude Code does not read: the rows kept their
  // default rendering and the snapshot the skills line reads from was never
  // written, so line 2 could never name a running agent. Removed here as well
  // as written, so an install fixes a settings file that already has it.
  delete settings.statusLine.taskCommand;
  if (wantTaskRows) {
    settings.subagentStatusLine = { type: "command", command: buildTaskRowCommand() };
  } else if (isOurCommand(settings.subagentStatusLine?.command)) {
    delete settings.subagentStatusLine;
  }
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
    refreshInterval: wantInterval ? REFRESH_INTERVAL_SECONDS : null,
    taskRows: Boolean(wantTaskRows),
    alreadyInstalled,
    // Only Git Bash can run a command whose interpreter had to stay quoted.
    needsGitBash: process.platform === "win32" && [command, hookCommand, settings.subagentStatusLine?.command].some((c) => typeof c === "string" && c.startsWith('"')),
    ...installedVersion(),
  };
}

/**
 * A `statusLine` in the project's own settings, which Claude Code applies
 * over the user's, so the bar a person sees there is not this one. `doctor`
 * names it; nothing here edits a project file.
 */
export function projectOverrides(cwd = process.cwd()) {
  const found = [];
  for (const name of ["settings.json", "settings.local.json"]) {
    const file = path.join(cwd, ".claude", name);
    let command;
    try {
      command = JSON.parse(readFileSync(file, "utf8"))?.statusLine?.command;
    } catch {
      continue;
    }
    if (typeof command !== "string") continue;
    const ours = /cli\.js"?\s+render\s*$/.test(command) && /statusline/i.test(command);
    if (!ours) found.push({ file, command });
  }
  return found;
}

const OUR_SUBCOMMANDS = new Set(["render", "task-rows", "note-skill"]);

/** The two quoted paths and the subcommand of a command this plugin wrote. */
function parseCommand(command) {
  // The interpreter is quoted in commands written before specs/028 and when
  // it holds a space on POSIX, and bare otherwise.
  const m = /^(?:"([^"]+)"|(\S+))\s+"([^"]+)"\s+(\S+)\s*$/.exec(String(command || ""));
  return m ? { interpreter: m[1] ?? m[2], cli: m[3], subcommand: m[4] } : null;
}

/**
 * Whether each entry this plugin wrote still points at something that exists.
 *
 * The skill hook and the subagent rows name the interpreter that ran the
 * install, as Principle IX requires, so removing that Node version breaks
 * them with nothing on screen to say why. `doctor` asks this instead. A bare
 * `node`, which the status line uses, is resolved by the shell and is not a
 * path to check.
 */
export function checkInstall(settings, exists = existsSync) {
  const entries = [];
  if (settings?.statusLine?.command) entries.push(["statusLine", settings.statusLine.command]);
  if (settings?.subagentStatusLine?.command) entries.push(["subagentStatusLine", settings.subagentStatusLine.command]);
  for (const group of settings?.hooks?.PostToolUse || []) {
    for (const h of group?.hooks || []) {
      if (isOurSkillHookAnywhere(h?.command)) entries.push(["skill hook", h.command]);
    }
  }
  return entries
    .map(([entry, command]) => [entry, parseCommand(command)])
    .filter(([, parsed]) => parsed && /cli\.js$/.test(parsed.cli) && OUR_SUBCOMMANDS.has(parsed.subcommand))
    .map(([entry, { interpreter, cli }]) => {
      const missing = [];
      if (path.isAbsolute(interpreter) && !exists(interpreter)) missing.push(`interpreter ${interpreter}`);
      if (!exists(cli)) missing.push(`script ${cli}`);
      return missing.length
        ? { entry, ok: false, problem: `${missing.join(" and ")} no longer exists` }
        : { entry, ok: true, problem: null };
    });
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
  // The whole statusLine object goes, so the refresh interval it carries
  // goes with it. The subagent rows are a separate top-level setting and
  // are removed separately, on the same test: it was written by this
  // install and does not outlive it.
  const hasStatusLine = settings.statusLine && isOurCommand(settings.statusLine.command);
  const hasSubagentLine = isOurCommand(settings.subagentStatusLine?.command);
  const hasHook = (settings?.hooks?.PostToolUse || []).some((group) =>
    (group?.hooks || []).some((h) => isOurCommand(h?.command))
  );

  if (!hasStatusLine && !hasSubagentLine && !hasHook) {
    return { changed: false, reason: "No statusline installed by this plugin was found." };
  }

  backupSettings(settings);
  if (hasStatusLine) delete settings.statusLine;
  if (hasSubagentLine) delete settings.subagentStatusLine;
  const hookRemoved = removeHook(settings);
  writeSettings(settings);

  return { changed: true, settingsPath: file, hookRemoved };
}
