import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { install, uninstall, checkInstall, unsupportedNode } from "../../src/install.js";
import { update } from "../../src/update.js";

// specs/024-install-update. Every case here runs in a throwaway HOME or a
// throwaway repository: the review that found these failures once wrote to
// a real settings file by forgetting exactly that.

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));

const thirdPartyHook = {
  matcher: "Bash",
  hooks: [{ type: "command", command: "/usr/local/bin/someone-elses-tool" }],
};

// --- a pair of real repositories, so the update is tested against git itself

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
  GIT_CONFIG_NOSYSTEM: "1",
};
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();

function repos() {
  const base = mkdtempSync(path.join(os.tmpdir(), "statusline-update-"));
  const origin = path.join(base, "origin");
  const clone = path.join(base, "clone");
  execFileSync("git", ["init", "-q", "-b", "main", origin], { env: GIT_ENV });
  writeFileSync(path.join(origin, "file.txt"), "one\n");
  git(origin, "add", ".");
  git(origin, "commit", "-q", "-m", "one");
  execFileSync("git", ["clone", "-q", origin, clone], { env: GIT_ENV });
  const commit = (message) => {
    writeFileSync(path.join(origin, "file.txt"), `${message}\n`);
    git(origin, "commit", "-q", "-am", message);
    return git(origin, "rev-parse", "HEAD");
  };
  return { origin, clone, commit, head: (dir) => git(dir, "rev-parse", "HEAD") };
}

const noInstall = () => ({ status: 0 });

// Story 1 -----------------------------------------------------------------

await test("update fast-forwards a clean clone and then installs from the new code", () => {
  const r = repos();
  const target = r.commit("two");
  let installedAt = null;
  const result = update({ root: r.clone, runInstall: () => ((installedAt = r.head(r.clone)), { status: 0 }) });
  assert.equal(result.ok, true, result.reason);
  assert.equal(r.head(r.clone), target);
  assert.equal(installedAt, target, "the install ran before the pull finished");
  assert.notEqual(result.before, result.after);
});

await test("update on a current clone says so and still installs", () => {
  const r = repos();
  let installs = 0;
  const result = update({ root: r.clone, runInstall: () => (installs++, { status: 0 }) });
  assert.equal(result.ok, true);
  assert.equal(result.current, true);
  assert.equal(installs, 1);
});

await test("update refuses a clone with local edits, and pulls nothing", () => {
  const r = repos();
  const before = r.head(r.clone);
  r.commit("two");
  writeFileSync(path.join(r.clone, "file.txt"), "edited\n");
  let installs = 0;
  const result = update({ root: r.clone, runInstall: () => (installs++, { status: 0 }) });
  assert.equal(result.ok, false);
  assert.match(result.reason, /file\.txt/);
  assert.match(result.reason, /git -C "[^"]+" stash/);
  assert.equal(r.head(r.clone), before);
  assert.equal(installs, 0);
});

await test("update refuses a diverged history and runs nothing destructive", () => {
  const r = repos();
  r.commit("two");
  writeFileSync(path.join(r.clone, "other.txt"), "local\n");
  git(r.clone, "add", ".");
  git(r.clone, "commit", "-q", "-m", "local");
  const localHead = r.head(r.clone);
  const result = update({ root: r.clone, runInstall: noInstall });
  assert.equal(result.ok, false);
  assert.match(result.reason, /diverged|fast-forward/i);
  assert.equal(r.head(r.clone), localHead, "the local commit must survive");
});

await test("update outside a git clone names the clone command", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-not-a-clone-"));
  const result = update({ root: dir, runInstall: noInstall });
  assert.equal(result.ok, false);
  assert.match(result.reason, /git clone https:\/\/github\.com\/jonyfs\/statusline\.git/);
});

await test("an install that fails after a good pull says the code moved but settings did not", () => {
  const r = repos();
  r.commit("two");
  const result = update({ root: r.clone, runInstall: () => ({ status: 3 }) });
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 3);
  assert.match(result.reason, /updated.*settings/i);
});

// Story 2 -----------------------------------------------------------------

await test("install reports the version and commit it installed", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    const result = install();
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    assert.equal(result.version, pkg.version);
    assert.match(result.commit ?? "", /^[0-9a-f]{7,}/);
  });
});

await test("a repeat install no longer claims to be current, and names the update", () => {
  const home = makeHome({});
  const env = { ...process.env, HOME: home.dir, USERPROFILE: home.dir };
  spawnSync(process.execPath, [CLI, "install"], { env, encoding: "utf8" });
  const second = spawnSync(process.execPath, [CLI, "install"], { env, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(second.stdout, /safe to run again/);
  assert.match(second.stdout, /Version:/);
  assert.match(second.stdout, /cli\.js" update|cli\.js update/);
});

// Story 3 -----------------------------------------------------------------

await test("Node older than 18 is named as unsupported; 18 and later are not", () => {
  assert.match(unsupportedNode("14.17.3") ?? "", /18/);
  assert.equal(unsupportedNode("18.0.0"), null);
  assert.equal(unsupportedNode("26.7.0"), null);
});

// Story 4 -----------------------------------------------------------------

await test("install removes this plugin's skill hook left by a clone at another path", async () => {
  const stale = {
    matcher: "Skill",
    hooks: [{ type: "command", command: '"/old/node" "/somewhere/else/statusline-plugin/bin/cli.js" note-skill' }],
  };
  const home = makeHome({ hooks: { PostToolUse: [thirdPartyHook, stale] } });
  await withHome(home, () => {
    install();
    const groups = home.read().hooks.PostToolUse;
    const skill = groups.filter((g) => (g.hooks || []).some((h) => /note-skill$/.test(h.command)));
    assert.equal(skill.length, 1, "exactly one skill hook");
    assert.ok(!skill[0].hooks[0].command.includes("/somewhere/else/"), "the stale path is gone");
    assert.ok(groups.some((g) => g.matcher === "Bash"), "another tool's hook survives");
  });
});

await test("settings are written through a rename and leave no temporary file", async () => {
  const home = makeHome({ theme: "dark" });
  await withHome(home, () => {
    install();
    uninstall();
    const leftovers = readdirSync(path.dirname(home.settingsPath)).filter((f) => f.includes(".tmp"));
    assert.deepEqual(leftovers, []);
    assert.equal(home.read().theme, "dark");
  });
});

// Story 5 -----------------------------------------------------------------

await test("doctor's install check flags an interpreter that no longer exists", () => {
  const settings = {
    statusLine: { type: "command", command: `"node" "${CLI}" render` },
    subagentStatusLine: { type: "command", command: `"/gone/node-v1/bin/node" "${CLI}" task-rows` },
    hooks: { PostToolUse: [{ matcher: "Skill", hooks: [{ type: "command", command: `"${process.execPath}" "${CLI}" note-skill` }] }] },
  };
  const checks = checkInstall(settings);
  const broken = checks.filter((c) => !c.ok);
  assert.equal(broken.length, 1, JSON.stringify(checks));
  assert.equal(broken[0].entry, "subagentStatusLine");
  assert.match(broken[0].problem, /\/gone\/node-v1\/bin\/node/);
  assert.ok(checks.find((c) => c.entry === "statusLine").ok, "a bare node is not checked as a path");
});

await test("doctor's install check passes a sound install", () => {
  const cmd = (sub) => `"${process.execPath}" "${CLI}" ${sub}`;
  const checks = checkInstall({
    statusLine: { type: "command", command: cmd("render") },
    subagentStatusLine: { type: "command", command: cmd("task-rows") },
    hooks: { PostToolUse: [{ matcher: "Skill", hooks: [{ type: "command", command: cmd("note-skill") }] }] },
  });
  assert.equal(checks.length, 3);
  assert.ok(checks.every((c) => c.ok), JSON.stringify(checks));
});
