#!/usr/bin/env node
/**
 * Cross-platform smoke test. Run on Linux, macOS and Windows:
 *
 *   npm test
 *
 * This file is only the runner: it imports every `scripts/tests/*.test.js`
 * in name order and reports the tally. The cases themselves live one per
 * concern, so a change to the git parser and a change to the width guard
 * do not edit the same file.
 *
 * Nothing here touches ~/.claude/settings.json. Install and uninstall are
 * exercised against a throwaway HOME built by tests/fixtures/home.js.
 */

// The renderer reads COLUMNS and LINES now, so a suite that inherited them
// would pass or fail by the size of the window it was run in. Pin them, and
// let the cases that care about size pass their own.
process.env.COLUMNS = process.env.CLAUDE_STATUSLINE_TEST_COLUMNS || "200";
process.env.LINES = process.env.CLAUDE_STATUSLINE_TEST_LINES || "40";

// Clock faces and reset labels derive from LOCAL time, so a case that
// asserts against a rendered bar passes in one timezone and fails in
// another. `scripts/generate-previews.js` pins this for the same reason;
// the suite needs it too, and it has to happen before any Date exists.
process.env.TZ = "UTC";

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summary } from "./test-harness.js";

const testDir = fileURLToPath(new URL("./tests/", import.meta.url));

console.log(`\nstatusline smoke test — ${process.platform} / node ${process.version}\n`);

const files = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.js"))
  .sort();

for (const name of files) {
  console.log(`${name}`);
  await import(pathToFileURL(path.join(testDir, name)).href);
}

process.exit(summary() === 0 ? 0 : 1);
