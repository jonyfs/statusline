#!/usr/bin/env node
/**
 * Writes `scripts/tests/fixtures/ansi-golden.json`: the sha256 of the ANSI
 * output of the composer fixture at each width. Run it on the commit that
 * must stay the reference, before a change that must not move the default
 * output (specs/056-runs-output-contract, SC-004).
 */
import { writeFileSync } from "node:fs";
import { WIDTHS, ansiAt, sha } from "./tests/ansi-fixtures.js";

const out = {};
for (const w of WIDTHS) {
  out[`${w}`] = sha(ansiAt(w));
  out[`${w}-ascii`] = sha(ansiAt(w, { CLAUDE_STATUSLINE_ASCII: "1" }));
}
writeFileSync(new URL("./tests/fixtures/ansi-golden.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${Object.keys(out).length} hashes`);
