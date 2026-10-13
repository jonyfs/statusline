import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { resolvedConfig } from "../../src/printConfig.js";
import { CONTRACT } from "../../src/runs.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "bin", "cli.js");
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

/** Only what the test controls: a clean environment with a throwaway home. */
function envWith(extra = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), "print-config-"));
  return { home, env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, TERM: "xterm", COLORTERM: "truecolor", ...extra } };
}
const run = (args, extra) => {
  const { home, env } = envWith(extra);
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env, cwd: ROOT, input: "" });
  return { r, home };
};

await test("the default configuration, field by field (SC-001)", () => {
  const { env } = envWith();
  const c = resolvedConfig(ROOT, env);
  assert.equal(c.contract, CONTRACT);
  assert.equal(c.version, VERSION);
  assert.equal(c.flavor, "mocha");
  assert.equal(c.flavorSource, "default");
  assert.equal(c.ramp, "default");
  assert.equal(c.contrast, "normal");
  assert.equal(c.glyphs, "nerd");
  assert.equal(c.ascii, false);
  assert.equal(c.separator, "arrow");
  assert.equal(c.colourDepth, "truecolor");
  assert.deepEqual(c.layout.omitted, []);
  assert.equal(c.passive, false);
  assert.equal(c.cacheDir, null);
});

await test("the environment is honoured and named (SC-002)", () => {
  const { env } = envWith({
    CLAUDE_STATUSLINE_FLAVOR: "latte",
    CLAUDE_STATUSLINE_RAMP: "cvd",
    CLAUDE_STATUSLINE_CONTRAST: "high",
    CLAUDE_STATUSLINE_ICONS: "emoji",
    CLAUDE_STATUSLINE_SEPARATOR: "slant",
    CLAUDE_STATUSLINE_OMIT: "dir, branch",
    CLAUDE_STATUSLINE_PASSIVE: "1",
    CLAUDE_STATUSLINE_CACHE_DIR: path.resolve(os.tmpdir(), "x"),
  });
  const c = resolvedConfig(ROOT, env);
  assert.equal(c.flavor, "latte");
  assert.equal(c.flavorSource, "env");
  assert.equal(c.ramp, "cvd");
  assert.equal(c.contrast, "high");
  assert.equal(c.glyphs, "emoji");
  assert.deepEqual(c.layout.omitted, ["dir", "branch"]);
  assert.equal(c.passive, true);
  assert.equal(c.cacheDir, path.resolve(os.tmpdir(), "x"));
});

await test("ASCII wins over the glyph choice and sets the separator", () => {
  const { env } = envWith({ CLAUDE_STATUSLINE_ASCII: "1", CLAUDE_STATUSLINE_ICONS: "nerd" });
  const c = resolvedConfig(ROOT, env);
  assert.equal(c.glyphs, "plain");
  assert.equal(c.ascii, true);
  assert.equal(c.separator, "ascii");
});

await test("the command prints one object, exit 0, with no payload and no file (FR-004, SC-003)", () => {
  const { r, home } = run(["--print-config"], { CLAUDE_STATUSLINE_FLAVOR: "frappe" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().split("\n").length, 1);
  const c = JSON.parse(r.stdout);
  assert.equal(c.flavor, "frappe");
  assert.deepEqual(readdirSync(home), [], "nothing written under the home directory");
});

await test("print-config takes --cwd and the subcommand spelling", () => {
  const { r } = run(["print-config", "--cwd", ROOT]);
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).contract, CONTRACT);
});

await test("--version prints the version and the contract, as text or JSON (FR-003)", () => {
  const text = run(["--version"]).r.stdout.trim();
  assert.equal(text, `statusline ${VERSION} (contract ${CONTRACT})`);
  const json = JSON.parse(run(["--version", "--json"]).r.stdout);
  assert.deepEqual(json, { contract: CONTRACT, version: VERSION });
  assert.equal(run(["version"]).r.stdout.trim(), text);
});

await test("the contract number is the one a runs object carries", () => {
  const r = spawnSync(process.execPath, [CLI, "--format", "runs"], {
    input: "{}",
    encoding: "utf8",
    env: { ...envWith().env, CLAUDE_STATUSLINE_NO_REFRESH: "1", COLUMNS: "80" },
    cwd: ROOT,
  });
  assert.equal(JSON.parse(r.stdout).contract, JSON.parse(run(["--version", "--json"]).r.stdout).contract);
});
