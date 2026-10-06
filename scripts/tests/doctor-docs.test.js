import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { buildReport, formatReport, flavorStatus } from "../../src/doctor.js";
import { SEGMENTS } from "../../src/segments.js";
import { PALETTES } from "../../src/theme.js";
import { emptySources } from "./fixtures/sources.js";

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const README = readFileSync(fileURLToPath(new URL("../../README.md", import.meta.url)), "utf8");

/** A HOME with a `.claude` directory and, optionally, a settings.json body. */
function bareHome(settingsText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-doctor-home-"));
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
  if (settingsText !== undefined) writeFileSync(path.join(dir, ".claude", "settings.json"), settingsText);
  return dir;
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    input: "{}",
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1", ...env },
  });
}

// Finding #19: with no settings.json the install line vanished, so the one
// question doctor is first asked ("is it installed?") got no answer at all.
await test("doctor says the plugin is not installed when settings.json is missing", () => {
  const home = bareHome();
  const r = runCli(["doctor"], { HOME: home, USERPROFILE: home });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /install: this plugin is not in settings\.json/);
});

await test("doctor names an unreadable settings.json instead of staying silent", () => {
  const home = bareHome("{ not json");
  const r = runCli(["doctor"], { HOME: home, USERPROFILE: home });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /install: ~\/\.claude\/settings\.json could not be read: /);
});

// Finding #21: the README's count drifted from the registry once already.
const WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const toNumber = (word) => word.toLowerCase().split("-").reduce((sum, part) => sum + (WORDS[part] ?? NaN), 0);

await test("the README's default segment count matches the registry", () => {
  const m = README.match(/The default puts ([a-z-]+) segments on ([a-z-]+) lines/i);
  assert.ok(m, "the sentence giving the default count is missing from the README");
  assert.equal(toNumber(m[1]), SEGMENTS.length, `README says ${m[1]}, the registry has ${SEGMENTS.length}`);
  assert.equal(toNumber(m[2]), new Set(SEGMENTS.map((s) => s.line)).size);
});

// Finding #22: `--help` was an unknown command with exit 1, and the usage
// line left out every install flag.
for (const flag of ["--help", "-h", "help"]) {
  await test(`${flag} prints the usage to stdout and exits 0`, () => {
    const r = runCli([flag]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Usage: node /);
    for (const option of ["--harness copilot|codex", "--no-hook", "--no-refresh-interval", "--no-task-rows"]) {
      assert.ok(r.stdout.includes(option), `${option} is missing from the usage`);
    }
  });
}

await test("an unknown command still fails, with the same usage on stderr", () => {
  const r = runCli(["frobnicate"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown command: frobnicate/);
  assert.match(r.stderr, /--no-task-rows/);
});

// Finding #23: "Infinity rows" and a default 120 columns were printed as if
// they had been measured.
await test("doctor says when the terminal size was assumed rather than read", () => {
  const saved = { COLUMNS: process.env.COLUMNS, LINES: process.env.LINES };
  delete process.env.COLUMNS;
  delete process.env.LINES;
  try {
    const report = buildReport({}, { live: false, probe: emptySources });
    assert.equal(report.terminal.rows, null, "JSON cannot carry Infinity; it became null silently");
    assert.equal(report.terminal.columnsSource, "default");
    assert.equal(report.terminal.rowsSource, "unset");
    const text = formatReport(report);
    assert.doesNotMatch(text, /Infinity/);
    assert.match(text, /terminal: 120 columns \(COLUMNS not set, using the default\), rows unknown \(LINES not set, every line drawn\)/);
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
});

await test("doctor reports a measured terminal size plainly", () => {
  const report = buildReport({}, { live: false, probe: emptySources });
  assert.equal(report.terminal.columnsSource, "COLUMNS");
  assert.match(formatReport(report), new RegExp(`terminal: ${process.env.COLUMNS} columns, ${process.env.LINES} rows`));
});

// Finding #24: a mistyped flavor fell back to mocha without a word, and the
// README listed four of the six.
await test("the README's flavor row lists every palette", () => {
  const row = README.split("\n").find((l) => l.startsWith("| `CLAUDE_STATUSLINE_FLAVOR`"));
  assert.ok(row, "the flavor row is missing");
  for (const name of Object.keys(PALETTES)) assert.ok(row.includes(`\`${name}\``), `${name} is missing from the row`);
});

await test("doctor names the active flavor and where it came from", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "statusline-flavor-"));
  assert.equal(flavorStatus(cwd, {}).line, "flavor: mocha (default)");
  assert.equal(
    flavorStatus(cwd, { CLAUDE_STATUSLINE_FLAVOR: "nord" }).line,
    "flavor: nord (from CLAUDE_STATUSLINE_FLAVOR)"
  );
  writeFileSync(path.join(cwd, ".statusline.json"), JSON.stringify({ flavor: "latte" }));
  assert.equal(flavorStatus(cwd, {}).line, "flavor: latte (from .statusline.json)");
});

await test("doctor warns when the flavor name is unknown", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "statusline-flavor-"));
  const status = flavorStatus(cwd, { CLAUDE_STATUSLINE_FLAVOR: "dracula" });
  assert.equal(status.known, false);
  assert.equal(status.line, 'flavor: unknown "dracula" (from CLAUDE_STATUSLINE_FLAVOR), using mocha');
});
