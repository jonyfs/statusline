#!/usr/bin/env node
/**
 * Writes `fixtures/host/expected/`: for each payload in `fixtures/host/payloads/`
 * and each width, the plain text of what the renderer draws, one file per pair,
 * from the runs form (specs/060-host-fixtures).
 *
 * The environment is pinned in `scripts/host-fixtures.js`, which the test uses
 * too, so a file here is a fact about the renderer and not about this machine.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fixturesDir, payloads, WIDTHS, plainRows } from "./host-fixtures.js";
import path from "node:path";

const out = path.join(fixturesDir, "expected");
mkdirSync(out, { recursive: true });
let n = 0;
for (const name of payloads()) {
  for (const width of WIDTHS) {
    writeFileSync(path.join(out, `${name}.${width}.txt`), plainRows(name, width).join("\n") + "\n");
    n += 1;
  }
}
console.log(`wrote ${n} files under ${path.relative(process.cwd(), out)}`);
