import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { WIDTHS, ansiAt, sha } from "./ansi-fixtures.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GOLDEN = JSON.parse(readFileSync(new URL("./fixtures/ansi-golden.json", import.meta.url), "utf8"));

await test("the ANSI output of the fixture is what it was before runs mode (SC-004)", () => {
  // Made by scripts/make-ansi-golden.js on the commit before feature 056.
  // Regenerate it only when a change is meant to move the default output.
  for (const width of WIDTHS) {
    assert.equal(sha(ansiAt(width)), GOLDEN[`${width}`], `${width} columns`);
    assert.equal(sha(ansiAt(width, { CLAUDE_STATUSLINE_ASCII: "1" })), GOLDEN[`${width}-ascii`], `${width} columns, ASCII`);
  }
});

await test("the switch off leaves the default output untouched, variable unset or set to ansi", () => {
  const run = (env) =>
    spawnSync(process.execPath, [path.join(ROOT, "bin", "cli.js")], {
      input: JSON.stringify({ model: { display_name: "Opus 5" }, cwd: ROOT }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1", COLUMNS: "100", ...env },
      cwd: ROOT,
    }).stdout;
  const base = run({ CLAUDE_STATUSLINE_OUTPUT: "" });
  assert.equal(run({ CLAUDE_STATUSLINE_OUTPUT: "ansi" }), base);
  assert.equal(run({ CLAUDE_STATUSLINE_OUTPUT: "something-else" }), base);
  assert.ok(base.includes("\x1b["), "it is still ANSI text");
});
