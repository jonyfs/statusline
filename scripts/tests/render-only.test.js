import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";
import { buildRenderOnly, closure, ENTRIES } from "../build-render-only.js";
import { fixturesDir, payloads, WIDTHS, plainRows, root } from "../host-fixtures.js";
import { CONTRACT } from "../../src/runs.js";

const out = path.join(mkdtempSync(path.join(os.tmpdir(), "render-only-")), "dist");
const { files } = buildRenderOnly(out);
const cli = path.join(out, "bin", "cli.js");
const allSrc = (dir) =>
  readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allSrc(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []));

await test("the closure is computed from the import graph and leaves out what the render never loads", () => {
  assert.ok(files.length > 20);
  for (const entry of ENTRIES) assert.ok(files.includes(entry), `${entry} is in the build`);
  for (const gone of ["src/install.js", "src/doctor.js", "src/codexLaunch.js", "src/codexPane.js"]) {
    assert.ok(!files.includes(gone), `${gone} is not`);
    assert.ok(!existsSync(path.join(out, gone)), `${gone} is not on disk`);
  }
  assert.ok(files.length < allSrc("src").length, "fewer modules than the whole source");
  assert.deepEqual(closure(), files, "the same closure on a second read");
});

await test("the build draws every shared fixture row as the full copy does (SC-001)", () => {
  for (const name of payloads()) {
    for (const width of WIDTHS) {
      const expected = readFileSync(path.join(fixturesDir, "expected", `${name}.${width}.txt`), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
      assert.equal(plainRows(name, width, { cli }).join("\n"), expected, `${name} at ${width} columns`);
    }
  }
});

await test("the build answers --version and --print-config with the contract", () => {
  const v = spawnSync(process.execPath, [cli, "--version", "--json"], { encoding: "utf8" });
  assert.equal(v.status, 0, v.stderr);
  assert.equal(JSON.parse(v.stdout).contract, CONTRACT);
  const c = spawnSync(process.execPath, [cli, "--print-config"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: os.tmpdir(), USERPROFILE: os.tmpdir() } });
  assert.equal(c.status, 0, c.stderr);
  assert.equal(JSON.parse(c.stdout).contract, CONTRACT);
});

await test("an import that does not resolve fails the build instead of shipping a broken copy", () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "render-only-base-"));
  mkdirSync(path.join(base, "src"), { recursive: true });
  writeFileSync(path.join(base, "src", "a.js"), 'import x from "./missing.js";\nexport default x;\n');
  assert.throws(() => closure([path.join("src", "a.js")], base), /missing\.js/);
});

await test("the usage text names only the commands the copy has", () => {
  const r = spawnSync(process.execPath, [cli, "help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  for (const gone of ["install", "uninstall", "doctor", "codex", "check-updates"]) {
    assert.ok(!new RegExp(`^  ${gone}\\b`, "m").test(r.stdout), `${gone} is not advertised`);
  }
  assert.match(r.stdout, /render/);
  assert.match(r.stdout, /--print-config/);
});

await test("a Copilot payload and the detached refresh run through the build", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "render-only-home-"));
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, COLUMNS: "100", CLAUDE_STATUSLINE_NO_REFRESH: "1" };
  const payload = readFileSync(path.join(root, "scripts", "tests", "fixtures", "copilot-payload.json"), "utf8");
  const r = spawnSync(process.execPath, [cli], { input: payload, encoding: "utf8", env, cwd: home });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length > 0);
  // A missing module prints the fallback chip and still exits 0 in the default mode.
  assert.ok(!/unavailable/.test(r.stdout), `the fallback was drawn: ${r.stdout}`);
  const runs = spawnSync(process.execPath, [cli, "--format", "runs"], { input: payload, encoding: "utf8", env, cwd: home });
  assert.equal(runs.status, 0, runs.stdout);
  assert.ok(JSON.parse(runs.stdout).lines.length > 0);
  const refresh = spawnSync(process.execPath, [cli, "refresh", "git", "0000000000000000"], { encoding: "utf8", env: { ...env, CLAUDE_STATUSLINE_NO_REFRESH: "" }, cwd: home });
  assert.equal(refresh.status, 0, refresh.stderr);
});

await test("VERSION names the version, the contract and the build", () => {
  const v = JSON.parse(readFileSync(path.join(out, "VERSION"), "utf8"));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(v.version, pkg.version);
  assert.equal(v.contract, CONTRACT);
  assert.equal(v.build, "render-only");
  assert.equal(v.modules, files.length);
});

await test("a command the build left out fails as a missing module and the render is untouched", () => {
  const r = spawnSync(process.execPath, [cli, "install"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /install\.js|Cannot find module/);
  const draw = plainRows("minimal", 100, { cli }).join("\n");
  assert.match(draw, /Opus 5\.5/);
});
