#!/usr/bin/env node
import { render } from "../src/render.js";
import { install, uninstall } from "../src/install.js";

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

async function main() {
  switch (subcommand) {
    case "install": {
      const result = install({
        registerHook: !rest.includes("--no-hook"),
        refreshInterval: !rest.includes("--no-refresh-interval"),
        taskRows: !rest.includes("--no-task-rows"),
      });
      console.log(`Statusline installed.`);
      console.log(`  Settings file: ${result.settingsPath}`);
      console.log(`  Backup saved:  ${result.backupPath}`);
      console.log(`  Command:       ${result.command}`);
      console.log(`  Skill hook:    ${result.hookRegistered ? "registered (PostToolUse: Skill)" : "skipped"}`);
      console.log(`  Refresh every: ${result.refreshInterval ? `${result.refreshInterval}s` : "only on events"}`);
      console.log(`  Task rows:     ${result.taskRows ? "styled by this plugin" : "left to Claude Code"}`);
      if (result.alreadyInstalled) console.log(`  (was already installed — safe to run again)`);
      break;
    }
    case "uninstall": {
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
      const { runDoctor } = await import("../src/doctor.js");
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
        out = await render({ flavor, asciiArrows });
      } catch {
        out = renderFallback();
      }
      process.stdout.write(out + "\n");
      break;
    }
    default:
      console.error(`Unknown command: ${subcommand}`);
      console.error(`Usage: statusline-plugin <install|uninstall|render|doctor>`);
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
