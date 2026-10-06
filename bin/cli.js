#!/usr/bin/env node
// Nothing is imported statically. The modules use syntax and APIs an old
// Node cannot load, and a failed static import happens before any line here
// runs, so the version check below would never get to say why. On Node 14
// the bar used to read "statusline unavailable" after an install that had
// reported success (specs/024-install-update).
const MIN_NODE_MAJOR = 18;
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
const nodeTooOld = !(nodeMajor >= MIN_NODE_MAJOR);

const [, , subcommand, ...rest] = process.argv;

/**
 * The last line of defence for the statusline command itself.
 *
 * Whatever goes wrong, this prints something plausible and exits 0. A
 * non-zero exit is a reason for the harness to stop calling the command,
 * and a stack trace printed where the bar should be is worse than a bar
 * with one line on it. Anything worth investigating goes to `doctor`,
 * which a person runs on purpose.
 */
function renderFallback() {
  return " statusline unavailable ";
}

/**
 * A reader that goes away mid-write is not an error worth reporting.
 *
 * Claude Code cancels the command it has in flight when a new update
 * triggers, which closes the pipe under whichever write is happening. Node's
 * default for that is an unhandled `EPIPE`: a stack trace printed where the
 * bar should be, and a non-zero exit, which is a reason for a harness to
 * stop calling the command at all. Both are worse than printing nothing,
 * and printing nothing is the correct answer when nobody is reading.
 */
function ignoreClosedOutput() {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", (err) => {
      if (err?.code === "EPIPE") process.exit(0);
      throw err;
    });
  }
}

const UPDATE_COMMAND = `node "${process.argv[1]}" update`;

// One string for both answers: `--help` asked for it, and an unknown command
// needs it. Two copies is how the install flags went missing from one.
const INSTALL_FLAGS = "[--no-hook] [--no-refresh-interval] [--no-task-rows]";
const USAGE = [
  `Usage: node "${process.argv[1]}" <command>`,
  "",
  "  install " + INSTALL_FLAGS,
  "  install --harness copilot|codex",
  "  update " + INSTALL_FLAGS,
  "  updates [auto|notify|off]",
  "  check-updates",
  "  uninstall [--harness copilot|codex]",
  "  render",
  "  doctor [--json|--explain]",
  "  help",
].join("\n");

/** The line `install` and `update` print about updates (specs/026-update-check, FR-014). */
async function updatesSummary() {
  const { readBehaviour } = await import("../src/updateCheck.js");
  const { mode } = readBehaviour();
  const other = mode === "auto" ? "notify" : "auto";
  return `${mode} (change with: node "${process.argv[1]}" updates ${other})`;
}

/** `--harness copilot` or `--harness=codex`, or null for Claude Code. */
function harnessFlag() {
  const i = rest.findIndex((a) => a === "--harness" || a.startsWith("--harness="));
  if (i === -1) return null;
  const value = rest[i].includes("=") ? rest[i].split("=")[1] : rest[i + 1];
  if (!["copilot", "codex"].includes(value)) {
    console.error(`--harness takes copilot or codex, not "${value ?? ""}".`);
    process.exit(1);
  }
  return value;
}

function installFlags() {
  return {
    registerHook: !rest.includes("--no-hook"),
    refreshInterval: !rest.includes("--no-refresh-interval"),
    taskRows: !rest.includes("--no-task-rows"),
  };
}

async function main() {
  ignoreClosedOutput();
  if (nodeTooOld) {
    if (subcommand === "render" || subcommand === undefined) {
      process.stdout.write(` statusline needs Node ${MIN_NODE_MAJOR}+ \n`);
      return;
    }
    throw new Error(`Node ${MIN_NODE_MAJOR} or newer is required; this is Node ${process.versions.node}. Nothing was changed.`);
  }
  switch (subcommand) {
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    case "install": {
      const harness = harnessFlag();
      if (harness) {
        const { installHarness } = await import("../src/install.js");
        const r = installHarness(harness);
        if (!r.ok) {
          console.error(r.reason);
          process.exit(1);
        }
        console.log(`Statusline set up for ${harness}.`);
        console.log(`  Settings file: ${r.file}`);
        if (r.backupPath) console.log(`  Backup saved:  ${r.backupPath}`);
        if (r.command) console.log(`  Command:       ${r.command}`);
        for (const note of r.notes ?? []) console.log(`  Note:          ${note}`);
        console.log(`  Restart ${harness === "copilot" ? "Copilot CLI" : "Codex"} to see it.`);
        break;
      }
      const { install } = await import("../src/install.js");
      const result = install({
        ...installFlags(),
      });
      const version = [result.version && `v${result.version}`, result.commit, result.date && `(${result.date})`]
        .filter(Boolean)
        .join(" ");
      console.log(`Statusline installed.`);
      console.log(`  Version:       ${version || "unknown"}`);
      console.log(`  Settings file: ${result.settingsPath}`);
      console.log(`  Backup saved:  ${result.backupPath}`);
      console.log(`  Command:       ${result.command}`);
      console.log(`  Skill hook:    ${result.hookRegistered ? "registered (PostToolUse: Skill)" : "skipped"}`);
      console.log(`  Refresh every: ${result.refreshInterval ? `${result.refreshInterval}s` : "only on events"}`);
      console.log(`  Task rows:     ${result.taskRows ? "styled by this plugin" : "left to Claude Code"}`);
      console.log(`  Updates:       ${await updatesSummary()}`);
      if (result.needsGitBash) {
        console.log(`  Warning:       node is not on this shell's PATH, so a command had to keep a quoted`);
        console.log(`                 interpreter path. Git Bash can run it; PowerShell cannot. Install Git`);
        console.log(`                 for Windows, or put node on the PATH and run install again.`);
      }
      // This used to say "safe to run again", which read as "you are current"
      // to someone whose second `git clone` had just failed. The settings
      // being in place says nothing about whether the code is new.
      if (result.alreadyInstalled) {
        console.log(`  Settings were already in place. To get a newer version: ${UPDATE_COMMAND}`);
      }
      break;
    }
    case "update": {
      const { update } = await import("../src/update.js");
      const flags = rest.filter((f) => f.startsWith("--no-"));
      const result = update({ flags });
      if (!result.ok) {
        console.error(result.reason);
        process.exit(result.exitCode || 1);
      }
      console.log(
        result.current
          ? `Already at the latest commit (${result.after}); settings refreshed.`
          : `Updated ${result.before} to ${result.after}.`
      );
      break;
    }
    case "updates": {
      const { readBehaviour, writeBehaviour, UPDATE_MODES } = await import("../src/updateCheck.js");
      const [mode] = rest;
      if (mode !== undefined) {
        if (!UPDATE_MODES.includes(mode)) {
          console.error(`Unknown update behaviour "${mode}". Use one of: ${UPDATE_MODES.join(", ")}.`);
          process.exit(1);
        }
        writeBehaviour(mode);
      }
      const now = readBehaviour();
      const where = {
        default: "default",
        file: `from ${(await import("node:path")).join((await import("node:os")).homedir(), ".claude", "statusline", "updates.json")}`,
        environment: "CLAUDE_STATUSLINE_UPDATES overrides the file",
      }[now.source];
      const other = now.mode === "auto" ? "notify" : "auto";
      console.log(`Updates: ${now.mode} (${where}). Change with: node "${process.argv[1]}" updates ${other}`);
      break;
    }
    case "check-updates": {
      const { checkUpdatesReport } = await import("../src/updateCheck.js");
      const report = checkUpdatesReport(undefined, { updateCommand: UPDATE_COMMAND });
      (report.ok ? console.log : console.error)(report.text);
      if (!report.ok) process.exit(1);
      break;
    }
    case "uninstall": {
      const harness = harnessFlag();
      if (harness) {
        const { uninstallHarness } = await import("../src/install.js");
        const r = uninstallHarness(harness);
        console.log(r.changed ? `Statusline removed from ${r.file}.` : r.reason);
        break;
      }
      const { uninstall } = await import("../src/install.js");
      const result = uninstall();
      if (result.changed) {
        console.log(`Statusline removed from ${result.settingsPath}.`);
        if (result.hookRemoved) console.log(`Skill hook removed.`);
      } else {
        console.log(result.reason);
      }
      break;
    }
    case "doctor": {
      const { runDoctor, explainSegments } = await import("../src/doctor.js");
      // `--explain` is its own answer rather than a column on the table: the
      // table is already 122 columns wide, and a sentence per segment would
      // either wrap it or be cut to uselessness.
      if (rest.includes("--explain")) {
        process.stdout.write(explainSegments() + "\n");
        break;
      }
      const out = await runDoctor({ json: rest.includes("--json") });
      process.stdout.write(out + "\n");
      break;
    }
    case "refresh": {
      const { runRefresh } = await import("../src/refresh.js");
      const [name, key] = rest;
      await runRefresh(name, key, process.cwd());
      break;
    }
    case "task-rows": {
      const { runTaskRows } = await import("../src/taskRows.js");
      const out = await runTaskRows();
      if (out) process.stdout.write(out + "\n");
      break;
    }
    case "note-skill": {
      const { runNoteSkill } = await import("../src/skillEvents.js");
      await runNoteSkill();
      break;
    }
    case "render":
    case undefined: {
      // Environment first, then the repository's own file, then the
      // default. A monorepo and a scratch repository do not want the same
      // bar, and neither wants to export a variable to say so.
      const { resolveSettings } = await import("../src/config.js");
      const settings = resolveSettings(process.cwd());
      const { flavor, asciiArrows } = settings;
      if (settings.separator) process.env.CLAUDE_STATUSLINE_SEPARATOR = settings.separator;
      if (settings.skillWindowMin) {
        process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = String(settings.skillWindowMin);
      }
      let out;
      try {
        if (process.env.CLAUDE_STATUSLINE_TEST_THROW === "1") {
          throw new Error("deliberate failure, for the exit-code test");
        }
        const { render } = await import("../src/render.js");
        out = await render({ flavor, asciiArrows });
      } catch {
        out = renderFallback();
      }
      process.stdout.write(out + "\n");
      break;
    }
    default:
      console.error(`Unknown command: ${subcommand}`);
      console.error(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  // Only the non-render subcommands reach this: a person typed them and is
  // waiting for an answer, so a failure belongs on stderr with an exit
  // code. `render` handles its own failure above and never gets here.
  if (subcommand === "render" || subcommand === undefined) {
    process.stdout.write(renderFallback() + "\n");
    process.exit(0);
  }
  console.error(err.message || String(err));
  process.exit(1);
});
