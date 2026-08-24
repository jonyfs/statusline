#!/usr/bin/env node
import { render } from "../src/render.js";
import { install, uninstall } from "../src/install.js";

const [, , subcommand] = process.argv;

async function main() {
  switch (subcommand) {
    case "install": {
      const result = install();
      console.log(`Statusline installed.`);
      console.log(`  Settings file: ${result.settingsPath}`);
      console.log(`  Backup saved:  ${result.backupPath}`);
      console.log(`  Command:       ${result.command}`);
      if (result.alreadyInstalled) console.log(`  (was already installed — safe to run again)`);
      break;
    }
    case "uninstall": {
      const result = uninstall();
      if (result.changed) {
        console.log(`Statusline removed from ${result.settingsPath}.`);
      } else {
        console.log(result.reason);
      }
      break;
    }
    case "render":
    case undefined: {
      const flavor = process.env.CLAUDE_STATUSLINE_FLAVOR || "mocha";
      const asciiArrows = process.env.CLAUDE_STATUSLINE_ASCII === "1";
      const out = await render({ flavor, asciiArrows });
      process.stdout.write(out + "\n");
      break;
    }
    default:
      console.error(`Unknown command: ${subcommand}`);
      console.error(`Usage: statusline-plugin <install|uninstall|render>`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
