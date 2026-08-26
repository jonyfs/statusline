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
