import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "../test-harness.js";
import { isPassive, cacheRoot, stateRoot, canWrite } from "../../src/paths.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "bin", "cli.js");
const RECORDER = path.join(ROOT, "scripts", "tests", "fixtures", "passive-recorder.mjs");

/** The `git` commands a passive render may run: reads only, and `status` never takes the index lock. */
const READ_ONLY_GIT = new Set(["status", "remote"]);
function assertReadOnlyGit(child) {
  assert.equal(path.basename(child.file), "git", `child: ${JSON.stringify(child)}`);
  const args = child.args.filter((a) => a !== "--no-optional-locks");
  assert.ok(READ_ONLY_GIT.has(args[0]), `not a read-only git command: ${JSON.stringify(child)}`);
  if (args[0] === "status") assert.ok(child.args.includes("--no-optional-locks"), "status without --no-optional-locks");
  if (args[0] === "remote") assert.equal(args[1], "get-url", "only remote get-url");
}

/** Renders once with the recorder loaded; returns what it started and wrote. */
function record(env, payload = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), "passive-home-"));
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "passive-log-")), "record.jsonl");
  const input = JSON.stringify({
    session_id: "passive-1",
    cwd: ROOT,
    model: { display_name: "Opus 5" },
    context_window: { used_percentage: 40 },
    ...payload,
  });
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(RECORDER).href, CLI], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      PASSIVE_RECORD_FILE: log,
      COLUMNS: "100",
      CLAUDE_STATUSLINE_UPDATES: "off",
      CLAUDE_STATUSLINE_DEBUG: "0",
      ...env,
    },
    cwd: ROOT,
  });
  const entries = existsSync(log)
    ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const files = (dir) => {
    const out = [];
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const p = path.join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else out.push(p);
      }
    };
    if (existsSync(dir)) walk(dir);
    return out;
  };
  return { r, home, entries, files, children: entries.filter((e) => e.kind === "child"), writes: entries.filter((e) => e.kind === "write") };
}

await test("the paths follow the two variables and nothing else", () => {
  assert.equal(isPassive({}), false);
  assert.equal(isPassive({ CLAUDE_STATUSLINE_PASSIVE: "1" }), true);
  assert.equal(isPassive({ CLAUDE_STATUSLINE_PASSIVE: "true" }), false);
  assert.equal(cacheRoot({ CLAUDE_STATUSLINE_CACHE_DIR: "relative/dir" }), null);
  assert.equal(cacheRoot({ CLAUDE_STATUSLINE_CACHE_DIR: path.resolve("/tmp/x") }), path.resolve("/tmp/x"));
  assert.equal(canWrite({}), true);
  assert.equal(canWrite({ CLAUDE_STATUSLINE_PASSIVE: "1" }), false);
  assert.equal(canWrite({ CLAUDE_STATUSLINE_PASSIVE: "1", CLAUDE_STATUSLINE_CACHE_DIR: path.resolve("/tmp/x") }), true);
  assert.equal(stateRoot({ CLAUDE_STATUSLINE_CACHE_DIR: path.resolve("/tmp/x") }), path.resolve("/tmp/x"));
  assert.match(stateRoot({}), /\.claude[\\/]statusline$/);
});

await test("a passive render with no cache directory starts only read-only git and writes nothing (SC-001, SC-002)", () => {
  const run = record({ CLAUDE_STATUSLINE_PASSIVE: "1" });
  assert.equal(run.r.status, 0, run.r.stderr);
  assert.ok(run.r.stdout.length > 0, "it still draws a bar");
  assert.deepEqual(run.writes, [], `writes: ${JSON.stringify(run.writes)}`);
  assert.deepEqual(run.files(run.home), [], "nothing under the home directory");
  assert.ok(run.children.length > 0, "the recorder saw the git read");
  for (const c of run.children) assertReadOnlyGit(c);
  rmSync(run.home, { recursive: true, force: true });
});

await test("a passive render with a cache directory writes only inside it", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "passive-cache-"));
  const run = record({ CLAUDE_STATUSLINE_PASSIVE: "1", CLAUDE_STATUSLINE_CACHE_DIR: dir });
  assert.equal(run.r.status, 0, run.r.stderr);
  assert.ok(run.writes.length > 0, "it did write its cache");
  for (const w of run.writes) {
    assert.ok(w.path.startsWith(dir), `outside the cache directory: ${w.path}`);
  }
  assert.deepEqual(run.files(run.home), [], "the home directory is untouched");
  assert.ok(run.files(dir).some((f) => /cache[\\/][^\\/]+\.json$/.test(f)), "a cache entry is there");
  assert.ok(run.files(dir).some((f) => /state[\\/]passive-1\.json$/.test(f)), "the session state is there");
  for (const c of run.children) assertReadOnlyGit(c);
});

await test("a second passive render reads what the first stored", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "passive-cache-"));
  const first = record({ CLAUDE_STATUSLINE_PASSIVE: "1", CLAUDE_STATUSLINE_CACHE_DIR: dir });
  const second = record({ CLAUDE_STATUSLINE_PASSIVE: "1", CLAUDE_STATUSLINE_CACHE_DIR: dir });
  assert.equal(first.r.status, 0);
  assert.equal(second.r.status, 0);
  assert.ok(second.files(dir).length >= first.files(dir).length, "the directory is kept, not rebuilt");
});

await test("the cache directory works without passive mode, and the home directory stays empty", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "passive-cache-"));
  const run = record({ CLAUDE_STATUSLINE_CACHE_DIR: dir, CLAUDE_STATUSLINE_NO_REFRESH: "1" });
  assert.equal(run.r.status, 0, run.r.stderr);
  assert.deepEqual(run.files(run.home), []);
  assert.ok(run.files(dir).length > 0);
});

await test("without either variable the render writes where it always wrote (FR-007)", () => {
  const run = record({ CLAUDE_STATUSLINE_NO_REFRESH: "1" });
  assert.equal(run.r.status, 0, run.r.stderr);
  const files = run.files(run.home).map((f) => path.relative(run.home, f).split(path.sep).join("/"));
  assert.ok(files.some((f) => /^\.claude\/statusline\/cache\/.+\.json$/.test(f)), files.join(", "));
  assert.ok(files.some((f) => f === ".claude/statusline/state/passive-1.json"), files.join(", "));
  rmSync(run.home, { recursive: true, force: true });
});

await test("passive mode refuses a refresh and an update check at the source", async () => {
  const before = { ...process.env };
  try {
    process.env.CLAUDE_STATUSLINE_PASSIVE = "1";
    delete process.env.CLAUDE_STATUSLINE_NO_REFRESH;
    const { spawnRefresh } = await import("../../src/cache.js");
    const { maybeStartUpdateCheck } = await import("../../src/updateCheck.js");
    const { getOpenTabUrl } = await import("../../src/openTerminalTab.js");
    assert.equal(spawnRefresh("k", "git", ROOT), false);
    assert.equal(maybeStartUpdateCheck(), false);
    process.env.TERM_PROGRAM = "iTerm.app";
    assert.equal(getOpenTabUrl(ROOT), null, "no open-tab script is written");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
});

await test("a passive render does not start sqlite3 for the Copilot todo list", async () => {
  if (process.platform === "win32") return;
  const { readCopilotTodos } = await import("../../src/copilotTodos.js");
  const { writeFileSync, mkdirSync, chmodSync } = await import("node:fs");
  const bin = mkdtempSync(path.join(os.tmpdir(), "fake-sqlite-"));
  const marker = path.join(bin, "ran");
  writeFileSync(path.join(bin, "sqlite3"), `#!/bin/sh\necho ran > "${marker}"\necho '[]'\n`);
  chmodSync(path.join(bin, "sqlite3"), 0o755);
  const session = mkdtempSync(path.join(os.tmpdir(), "copilot-session-"));
  writeFileSync(path.join(session, "session.db"), "");
  mkdirSync(session, { recursive: true });
  const before = { ...process.env };
  try {
    process.env.PATH = `${bin}${path.delimiter}${before.PATH}`;
    process.env.CLAUDE_STATUSLINE_PASSIVE = "1";
    readCopilotTodos(session, { drivers: ["cli"], platform: "linux" });
    assert.equal(existsSync(marker), false, "passive mode ran sqlite3");
    delete process.env.CLAUDE_STATUSLINE_PASSIVE;
    // A slow runner can take longer than the 100 ms the reader allows to start a shell script.
    readCopilotTodos(session, { drivers: ["cli"], platform: "linux", timeout: 5000 });
    assert.equal(existsSync(marker), true, "the default mode still reads the list through sqlite3");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
});

await test("a render with a cache directory still reads what the hooks wrote under the home directory", async () => {
  const { readablePath } = await import("../../src/paths.js");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const home = mkdtempSync(path.join(os.tmpdir(), "passive-home-"));
  const dir = mkdtempSync(path.join(os.tmpdir(), "passive-cache-"));
  mkdirSync(path.join(home, ".claude", "statusline", "skills"), { recursive: true });
  writeFileSync(path.join(home, ".claude", "statusline", "skills", "s1.jsonl"), "{}\n");
  const before = { ...process.env };
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.CLAUDE_STATUSLINE_CACHE_DIR = dir;
    assert.equal(readablePath("skills", "s1.jsonl"), path.join(home, ".claude", "statusline", "skills", "s1.jsonl"));
    mkdirSync(path.join(dir, "skills"), { recursive: true });
    writeFileSync(path.join(dir, "skills", "s1.jsonl"), "{}\n");
    assert.equal(readablePath("skills", "s1.jsonl"), path.join(dir, "skills", "s1.jsonl"), "the cache directory wins when it has the file");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
});
