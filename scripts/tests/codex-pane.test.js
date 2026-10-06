import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync, existsSync, copyFileSync, utimesSync, chmodSync, rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { test, stripAnsi } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import {
  pointerDir,
  pointerName,
  writePointer,
  sweepPointers,
  listPointers,
  newestRolloutFor,
  resolveCodexSession,
} from "../../src/codexSession.js";
import { paneFrame, parsePaneArgs, nextPaneSession, runCodexPane, PANE_RESOLVE_EVERY_MS, PANE_TICK_MS } from "../../src/codexPane.js";
import { planCodexLaunch, findOnPath, TMUX_INSTALL_HINT } from "../../src/codexLaunch.js";
import { addCodexHook, removeCodexHook, hasCodexHook, isOurHookCommand } from "../../src/codexHooks.js";
import { installHarness, uninstallHarness, harnessStatus, buildCodexHookCommand } from "../../src/install.js";
import { harnessLine } from "../../src/doctor.js";

// specs/035-codex-pane: the bar in a tmux pane under Codex CLI.

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixture = (name) => path.join(FIXTURES, `codex-rollout-${name}.jsonl`);
const scratch = (tag = "x") => mkdtempSync(path.join(os.tmpdir(), `statusline-035-${tag}-`));
const PROJECT = "/Users/dev/projects/statusline";

/** A CODEX_HOME with rollouts at sessions/YYYY/MM/DD, each at its own mtime. */
function codexSessions(entries) {
  const home = scratch("codex");
  for (const { day, name, from, mtime, cwd } of entries) {
    const dir = path.join(home, "sessions", ...day.split("/"));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    let body = readFileSync(fixture(from), "utf8");
    if (cwd) body = body.split(PROJECT).join(cwd);
    writeFileSync(file, body);
    if (mtime) utimesSync(file, mtime / 1000, mtime / 1000);
  }
  return home;
}

// Item 2: the hook's pointer ------------------------------------------------------

await test("codex-hook writes a pointer for the session, atomically, and prints nothing", async () => {
  const home = makeHome();
  const input = { session_id: "01a0f9b6-af63", transcript_path: "/r/rollout-x.jsonl", cwd: PROJECT, hook_event_name: "SessionStart", model: "gpt-5.5", source: "startup" };
  const r = spawnSync(process.execPath, [CLI, "codex-hook"], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir, TMUX_PANE: "%7" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "", "Codex may read a hook's output as context");
  const dir = path.join(home.dir, ".claude", "statusline", "codex");
  assert.deepEqual(readdirSync(dir), ["01a0f9b6-af63.json"], "no temporary file is left behind");
  const p = JSON.parse(readFileSync(path.join(dir, "01a0f9b6-af63.json"), "utf8"));
  assert.equal(p.session_id, "01a0f9b6-af63");
  assert.equal(p.rollout, "/r/rollout-x.jsonl");
  assert.equal(p.cwd, PROJECT);
  assert.equal(p.tmux_pane, "%7");
  assert.equal(typeof p.written_at, "number");
});

await test("codex-hook takes nothing it cannot use, and never fails Codex", () => {
  const home = makeHome();
  for (const input of ["not json", "[]", JSON.stringify({ cwd: PROJECT })]) {
    const r = spawnSync(process.execPath, [CLI, "codex-hook"], { input, encoding: "utf8", env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir } });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
  assert.ok(!existsSync(path.join(home.dir, ".claude", "statusline", "codex")) || readdirSync(path.join(home.dir, ".claude", "statusline", "codex")).length === 0);
});

await test("a session id is a file name only after it is cleaned", () => {
  assert.equal(pointerName("01a0-ff_9"), "01a0-ff_9.json");
  const odd = pointerName("../../etc/passwd");
  assert.ok(!odd.includes("/") && !odd.includes(".."), odd);
  assert.match(odd, /^[A-Za-z0-9_-]+\.json$/);
});

await test("stale pointers and pointers to a deleted rollout are swept", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const dir = scratch("rollouts");
    const live = path.join(dir, "live.jsonl");
    writeFileSync(live, "");
    const now = Date.now();
    writePointer({ session_id: "live", transcript_path: live, cwd: PROJECT }, { now });
    writePointer({ session_id: "gone", transcript_path: path.join(dir, "gone.jsonl"), cwd: PROJECT }, { now });
    writePointer({ session_id: "old", transcript_path: live, cwd: PROJECT }, { now });
    const old = path.join(pointerDir(), "old.json");
    utimesSync(old, (now - 8 * 86400_000) / 1000, (now - 8 * 86400_000) / 1000);
    // Codex can run the hook before the rollout's first line exists.
    assert.equal(sweepPointers({ now }), 1, "a young pointer to a rollout not written yet stays");
    const gone = path.join(pointerDir(), "gone.json");
    utimesSync(gone, (now - 2 * 86400_000) / 1000, (now - 2 * 86400_000) / 1000);
    assert.equal(sweepPointers({ now }), 1);
    assert.deepEqual(listPointers().map((p) => p.session_id), ["live"]);
  });
});

// Item 2: resolution --------------------------------------------------------------

await test("without a pointer, the newest rollout whose cwd matches is the session", () => {
  const t = Date.now();
  const codexHome = codexSessions([
    { day: "2026/10/01", name: "rollout-a-aaa.jsonl", from: "plus", mtime: t - 60_000 },
    { day: "2026/10/02", name: "rollout-b-bbb.jsonl", from: "free", mtime: t - 30_000 },
    { day: "2026/10/02", name: "rollout-c-ccc.jsonl", from: "0160", mtime: t - 10_000, cwd: "/elsewhere" },
  ]);
  const found = newestRolloutFor(PROJECT, { codexHome });
  assert.match(found, /rollout-b-bbb\.jsonl$/);
  assert.equal(newestRolloutFor("/nowhere", { codexHome }), null);
  assert.equal(newestRolloutFor(PROJECT, { codexHome, since: t - 20_000 }), null, "older than the pane is not this session");
});

/** A rollout whose session_meta says when it started, at the given mtime. */
function startedRollout(codexHome, id, startedAt, mtime, cwd = PROJECT) {
  const dir = path.join(codexHome, "sessions", "2026", "10", "06");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-2026-10-06T00-00-00-${id}.jsonl`);
  const iso = new Date(startedAt).toISOString();
  const meta = { timestamp: iso, type: "session_meta", payload: { id, timestamp: iso, cwd, cli_version: "0.160.1" } };
  const turn = { timestamp: iso, type: "turn_context", payload: { model: `gpt-${id}`, effort: "low", cwd } };
  writeFileSync(file, JSON.stringify(meta) + "\n" + JSON.stringify(turn) + "\n");
  utimesSync(file, mtime / 1000, mtime / 1000);
  return file;
}

await test("two live sessions in one directory: the scan takes the one that started after the pane, whichever was written last", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const codexHome = scratch("codex");
    const since = Date.parse("2026-10-06T09:00:00Z");
    const t = Date.now();
    // aaaa started before the pane and is still being written; bbbb is the pane's.
    const older = startedRollout(codexHome, "aaaa", Date.parse("2026-10-06T08:00:00Z"), t - 1000);
    const mine = startedRollout(codexHome, "bbbb", Date.parse("2026-10-06T10:00:00Z"), t - 5000);
    const env = { CODEX_HOME: codexHome };
    assert.equal(resolveCodexSession({ cwd: PROJECT, since, env })?.rollout, mine, "aaaa has the newer mtime and is still not this pane's");
    utimesSync(mine, (t + 1000) / 1000, (t + 1000) / 1000);
    assert.equal(resolveCodexSession({ cwd: PROJECT, since, env })?.rollout, mine);
    utimesSync(older, (t + 2000) / 1000, (t + 2000) / 1000);
    assert.equal(resolveCodexSession({ cwd: PROJECT, since, env })?.rollout, mine, "no switching back when aaaa writes again");
    // With nothing started after the pane, the newest written one stands in.
    const only = scratch("codex");
    const lone = startedRollout(only, "cccc", Date.parse("2026-10-06T08:00:00Z"), t);
    assert.equal(newestRolloutFor(PROJECT, { codexHome: only, since }), lone);
  });
});

await test("the pane keeps a session it found by scanning unless the scan finds one that started later", () => {
  const codexHome = scratch("codex");
  const t = Date.now();
  const a = startedRollout(codexHome, "aaaa", Date.parse("2026-10-06T10:00:00Z"), t);
  const b = startedRollout(codexHome, "bbbb", Date.parse("2026-10-06T08:00:00Z"), t);
  const c = startedRollout(codexHome, "cccc", Date.parse("2026-10-06T11:00:00Z"), t);
  const scan = (rollout) => ({ rollout, source: "scan", sessionId: null });
  assert.equal(nextPaneSession(scan(a), scan(b)).rollout, a, "a session that started earlier is someone else's");
  assert.equal(nextPaneSession(scan(a), scan(a)).rollout, a);
  assert.equal(nextPaneSession(scan(a), scan(c)).rollout, c, "Codex's /new starts a later session in the same pane");
  assert.equal(nextPaneSession(scan(a), { rollout: b, source: "pointer", sessionId: "bbbb" }).rollout, b, "a pointer is exact and always wins");
  assert.equal(nextPaneSession(scan(path.join(codexHome, "gone.jsonl")), scan(b)).rollout, b, "a rollout that is gone is not kept");
  assert.equal(nextPaneSession(null, scan(b)).rollout, b);
  assert.equal(nextPaneSession(scan(a), null).rollout, a, "nothing found keeps what is on screen");
});

await test("resolution prefers the flag, then the pointer for Codex's tmux pane, then the cwd", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const t = Date.now();
    const codexHome = codexSessions([{ day: "2026/10/02", name: "rollout-z-scan.jsonl", from: "plus", mtime: t - 1000 }]);
    const env = { CODEX_HOME: codexHome };
    const dir = scratch("ptr");
    const mine = path.join(dir, "mine.jsonl");
    const other = path.join(dir, "other.jsonl");
    writeFileSync(mine, "");
    writeFileSync(other, "");
    writePointer({ session_id: "mine", transcript_path: mine, cwd: PROJECT }, { now: t - 5000, env: { TMUX_PANE: "%3" } });
    writePointer({ session_id: "other", transcript_path: other, cwd: PROJECT }, { now: t - 1000, env: { TMUX_PANE: "%9" } });

    assert.equal(resolveCodexSession({ rollout: "/given.jsonl", cwd: PROJECT, env }).rollout, "/given.jsonl");
    let r = resolveCodexSession({ codexPane: "%3", cwd: PROJECT, env });
    assert.deepEqual([r.rollout, r.source], [mine, "pointer"]);
    r = resolveCodexSession({ cwd: PROJECT, env });
    assert.deepEqual([r.rollout, r.source], [other, "pointer"], "the newest pointer for this directory");
    r = resolveCodexSession({ session: "mine", cwd: PROJECT, env });
    assert.equal(r.rollout, mine);
    r = resolveCodexSession({ cwd: PROJECT, env, since: t + 1 });
    assert.equal(r, null, "nothing written since the pane started");
    r = resolveCodexSession({ cwd: "/somewhere/else", env });
    assert.equal(r, null);
  });
  const empty = makeHome();
  await withHome(empty, () => {
    const codexHome = codexSessions([{ day: "2026/10/02", name: "rollout-z-scan.jsonl", from: "plus" }]);
    const r = resolveCodexSession({ cwd: PROJECT, env: { CODEX_HOME: codexHome } });
    assert.equal(r.source, "scan");
    assert.match(r.rollout, /rollout-z-scan\.jsonl$/);
  });
});

await test("a pointer without a rollout path finds the rollout by its session id", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const codexHome = codexSessions([{ day: "2026/10/02", name: "rollout-2026-10-02T10-00-00-abc-123.jsonl", from: "plus" }]);
    writePointer({ session_id: "abc-123", transcript_path: null, cwd: "/does/not/matter" }, { now: Date.now() });
    const r = resolveCodexSession({ session: "abc-123", cwd: PROJECT, env: { CODEX_HOME: codexHome } });
    assert.match(r.rollout, /abc-123\.jsonl$/);
  });
});

// Item 3: the pane ----------------------------------------------------------------

await test("a frame repaints in place: home, each line cleared to its end, the rest cleared, no newline at the end", () => {
  const frame = paneFrame(["one", "two"]);
  assert.equal(frame, "\x1b[H" + "one\x1b[K\r\ntwo\x1b[K" + "\x1b[J");
  assert.ok(!frame.endsWith("\n"), "a newline at the bottom of a 3-row pane scrolls it");
});

await test("the pane's flags are read as separate values", () => {
  const a = parsePaneArgs(["--cwd", "/a b", "--pid", "42", "--codex-pane", "%3", "--since", "1000", "--rollout", "/r.jsonl", "--once"]);
  assert.deepEqual(a, { cwd: "/a b", pid: 42, codexPane: "%3", since: 1000, rollout: "/r.jsonl", session: null, once: true });
  assert.equal(parsePaneArgs([]).pid, null);
  assert.ok(PANE_RESOLVE_EVERY_MS >= 1000);
});

const paneEnv = (home) => ({ ...process.env, HOME: home.dir, USERPROFILE: home.dir, CLAUDE_STATUSLINE_UPDATES: "off", CLAUDE_STATUSLINE_NO_REFRESH: "1" });

await test("codex-pane --once draws the real bar from a rollout at the given width", () => {
  const home = makeHome();
  const r = spawnSync(process.execPath, [CLI, "codex-pane", "--once", "--rollout", fixture("plus"), "--cwd", os.tmpdir()], {
    encoding: "utf8",
    env: { ...paneEnv(home), COLUMNS: "160", LINES: "3" },
  });
  assert.equal(r.status, 0, r.stderr);
  const out = stripAnsi(r.stdout);
  assert.match(out, /gpt-5\.5/);
  assert.match(out, /5h 11%/);
  assert.ok(out.trimEnd().split("\n").length <= 3, out);
});

await test("the pane exits on its own when the process it watches is gone", async () => {
  const home = makeHome();
  const dead = spawnSync(process.execPath, ["-e", "process.exit(0)"]).pid;
  const started = Date.now();
  const r = spawnSync(process.execPath, [CLI, "codex-pane", "--rollout", fixture("plus"), "--pid", String(dead), "--cwd", os.tmpdir()], {
    encoding: "utf8",
    env: { ...paneEnv(home), COLUMNS: "120", LINES: "3" },
    timeout: 15_000,
  });
  assert.equal(r.status, 0, r.stderr || String(r.error));
  assert.ok(Date.now() - started < 10_000);
  assert.match(r.stdout, /\x1b\[\?25h/, "the cursor is shown again");
});

await test("Ctrl-C leaves the pane cleanly: cursor back, no stack trace, exit 0", async () => {
  // Windows has no SIGINT to deliver: kill() there ends the process outright.
  // The pane is not supported on Windows anyway (the codex wrapper says so).
  if (process.platform === "win32") return;
  const home = makeHome();
  const child = spawn(process.execPath, [CLI, "codex-pane", "--rollout", fixture("plus"), "--cwd", os.tmpdir()], {
    env: { ...paneEnv(home), COLUMNS: "120", LINES: "3" },
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (out.includes("gpt-5.5")) {
        clearInterval(check);
        resolve();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 8000);
  });
  child.kill("SIGINT");
  const code = await new Promise((resolve) => child.on("exit", (c) => resolve(c)));
  assert.equal(code, 0, err);
  assert.equal(err, "");
  assert.match(out, /gpt-5\.5/);
  assert.match(out, /\x1b\[\?25h/);
});

// Item 3: the running loop ----------------------------------------------------------
//
// FR-008 and SC-001: an append repaints (working turns idle), a resize
// refits, and a new session is picked up. Each case waits on output with a
// deadline, never a fixed sleep. Skipped on Windows, where the pane is not
// offered. The re-resolve case waits up to PANE_RESOLVE_EVERY_MS, so it runs
// alongside the others rather than after them.

const LOOP = process.platform !== "win32";
const until = async (check, ms, every = 25) => {
  const t0 = Date.now();
  for (;;) {
    const v = await check();
    if (v) return Date.now() - t0;
    if (Date.now() - t0 > ms) return null;
    await new Promise((r) => setTimeout(r, every));
  }
};

/** A spawned pane with piped stdout, read as it goes. */
function startPane(args, env) {
  const child = spawn(process.execPath, [CLI, "codex-pane", ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  const pane = { child, out: "", err: "" };
  child.stdout.on("data", (d) => (pane.out += d));
  child.stderr.on("data", (d) => (pane.err += d));
  /** Ms until `re` matches output written after byte `from`, or null past `ms`. */
  pane.waitFor = (re, from, ms) => until(() => re.test(stripAnsi(pane.out.slice(from))), ms);
  pane.stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  return pane;
}

/** The plus fixture cut just after its last task_started: a turn is running. */
function workingRollout() {
  const file = path.join(scratch("loop"), "rollout.jsonl");
  const lines = readFileSync(fixture("plus"), "utf8").trim().split("\n");
  const lastStart = lines.map((l) => JSON.parse(l)).findLastIndex((r) => r.payload?.type === "task_started");
  writeFileSync(file, lines.slice(0, lastStart + 3).join("\n") + "\n");
  return file;
}
const TASK_COMPLETE = JSON.stringify({ timestamp: "2026-10-06T11:00:00Z", type: "event_msg", payload: { type: "task_complete" } }) + "\n";

// Started first and awaited last: Codex's /new writes a new pointer from the
// same tmux pane, and the pane must move to it on its next lookup.
const resolveCase = !LOOP
  ? null
  : (async () => {
      const home = makeHome();
      const dir = scratch("resolve");
      const a = path.join(dir, "rollout-a.jsonl");
      const b = path.join(dir, "rollout-b.jsonl");
      const body = readFileSync(fixture("plus"), "utf8");
      writeFileSync(a, body);
      writeFileSync(b, body.split("gpt-5.5").join("gpt-next"));
      const ptrDir = path.join(home.dir, ".claude", "statusline", "codex");
      mkdirSync(ptrDir, { recursive: true });
      const pointer = (id, rollout, at) =>
        writeFileSync(path.join(ptrDir, `${id}.json`), JSON.stringify({ session_id: id, rollout, cwd: dir, tmux_pane: "%42", event: "SessionStart", written_at: at }) + "\n");
      pointer("sess-a", a, Date.now() - 1000);
      const pane = startPane(["--codex-pane", "%42", "--cwd", dir], { ...paneEnv(home), COLUMNS: "160", LINES: "3" });
      try {
        const first = await pane.waitFor(/gpt-5\.5/, 0, 8000);
        if (first === null) return { error: `the pane never drew session A: ${pane.err || stripAnsi(pane.out)}` };
        const from = pane.out.length;
        pointer("sess-b", b, Date.now());
        const took = await pane.waitFor(/gpt-next/, from, PANE_RESOLVE_EVERY_MS + PANE_TICK_MS + 2000);
        return { took };
      } finally {
        await pane.stop();
      }
    })().catch((err) => ({ error: err.message }));

await test("the running pane repaints when the rollout grows: working turns idle when the turn ends", async () => {
  if (!LOOP) return;
  const home = makeHome();
  const file = workingRollout();
  const pane = startPane(["--rollout", file, "--cwd", os.tmpdir()], { ...paneEnv(home), COLUMNS: "160", LINES: "3" });
  try {
    assert.notEqual(await pane.waitFor(/working/, 0, 8000), null, pane.err || stripAnsi(pane.out));
    const from = pane.out.length;
    appendFileSync(file, TASK_COMPLETE);
    const took = await pane.waitFor(/idle/, from, 2500);
    assert.notEqual(took, null, `no idle frame within 2.5 s: ${stripAnsi(pane.out.slice(from))}`);
  } finally {
    await pane.stop();
  }
});

await test("without fs.watch the tick alone repaints, and a resize refits the bar at once", async () => {
  if (!LOOP) return;
  // In process, with fs.watch taken away: the tick is what the pane relies on
  // where a watch misses events. A sleeping child stands in for Codex; the
  // pane ends when it does.
  const file = workingRollout();
  const codex = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  const out = new EventEmitter();
  out.columns = 50;
  out.rows = 3;
  out.text = "";
  out.write = (s) => {
    out.text += s;
    return true;
  };
  const noWatch = () => ({ close() {}, on() {} });
  const lastFrame = () => stripAnsi(out.text.slice(out.text.lastIndexOf("\x1b[H")));
  const running = runCodexPane(["--rollout", file, "--cwd", os.tmpdir(), "--pid", String(codex.pid)], { out, env: { ...process.env, COLUMNS: "", LINES: "" }, watch: noWatch });
  try {
    assert.notEqual(await until(() => /working/.test(lastFrame()), 5000), null, lastFrame());
    assert.doesNotMatch(lastFrame(), /medium/, "50 columns shed the effort chip");
    appendFileSync(file, TASK_COMPLETE);
    const took = await until(() => /idle/.test(lastFrame()), PANE_TICK_MS + 1500);
    assert.notEqual(took, null, `the tick did not repaint: ${lastFrame()}`);
    // A resize repaints now, not at the next periodic redraw.
    out.columns = 160;
    const before = out.text.length;
    out.emit("resize");
    assert.ok(out.text.length > before, "the resize wrote a frame synchronously");
    assert.match(lastFrame(), /medium/, "the bar refits to 160 columns");
  } finally {
    codex.kill("SIGKILL");
    assert.equal(await running, 0);
  }
});

await test("in a real tmux pane, a resize redraws the bar at the new width", async () => {
  if (!LOOP) return;
  const tmux = findOnPath("tmux", process.env, process.platform);
  if (!tmux) return; // tmux is optional: CI without it covers resize in process above
  const home = makeHome();
  const sock = `statusline-035-${process.pid}-${Date.now()}`;
  const run = (...args) => spawnSync(tmux, ["-L", sock, "-f", "/dev/null", ...args], { encoding: "utf8", env: { ...paneEnv(home), TMUX: "", TMUX_PANE: "" } });
  const capture = () => run("capture-pane", "-p", "-t", "loop").stdout ?? "";
  try {
    const started = run("new-session", "-d", "-s", "loop", "-x", "50", "-y", "3", "--", process.execPath, CLI, "codex-pane", "--rollout", fixture("plus"), "--cwd", os.tmpdir());
    assert.equal(started.status, 0, started.stderr);
    assert.notEqual(await until(() => /gpt-5\.5/.test(capture()), 8000, 50), null, capture());
    assert.doesNotMatch(capture(), /medium/, "50 columns shed the effort chip");
    // Right after the first frame, so the periodic redraw is seconds away
    // and only the resize handler can explain a new frame in time.
    const resized = run("resize-window", "-t", "loop", "-x", "160", "-y", "3");
    assert.equal(resized.status, 0, resized.stderr);
    const took = await until(() => /medium/.test(capture()), 2500, 50);
    assert.notEqual(took, null, `no redraw at 160 columns: ${capture()}`);
    assert.ok(capture().split("\n").every((l) => l.length <= 160));
  } finally {
    // tmux does not unlink its socket on kill-server, so every run would
    // leave one behind in the tmux temp directory.
    const socketPath = run("display-message", "-p", "#{socket_path}").stdout?.trim();
    run("kill-server");
    try {
      if (socketPath) rmSync(socketPath, { force: true });
    } catch {
      // already gone
    }
  }
});

await test("a new session from Codex's tmux pane is picked up within one lookup", async () => {
  if (!LOOP) return;
  const r = await resolveCase;
  assert.equal(r.error, undefined, r.error);
  assert.notEqual(r.took, null, `the pane did not switch to session B within ${PANE_RESOLVE_EVERY_MS + PANE_TICK_MS + 2000} ms`);
});

// Item 4: the wrapper ---------------------------------------------------------------

const BASE = { cwd: "/w/p q", cliPath: "/c/cli.js", nodePath: "/n/node", pid: 4242, now: 1000, tmuxPath: "/usr/bin/tmux", platform: "darwin" };

await test("inside tmux the wrapper splits a 3-line pane under Codex's and runs Codex with the args untouched", () => {
  const args = ["--model", "gpt-5.5", "a b; rm -rf $HOME"];
  const plan = planCodexLaunch({ ...BASE, args, env: { TMUX: "/tmp/tmux-1/default,1,0", TMUX_PANE: "%5" } });
  assert.equal(plan.kind, "split");
  assert.deepEqual(plan.split, [
    "split-window", "-v", "-d", "-l", "3", "-t", "%5", "-P", "-F", "#{pane_id}", "-c", "/w/p q", "--",
    "/n/node", "/c/cli.js", "codex-pane", "--cwd", "/w/p q", "--pid", "4242", "--codex-pane", "%5", "--since", "1000",
  ]);
  assert.deepEqual(plan.codex, { command: "codex", args });
  // The pane gets the tmux server's environment, so a CODEX_HOME exported
  // after the server started is handed over.
  const withHome = planCodexLaunch({ ...BASE, args, env: { TMUX: "x", TMUX_PANE: "%5", CODEX_HOME: "/c h", CLAUDE_STATUSLINE_FLAVOR: "latte", SECRET: "no" } });
  const e = withHome.split.flatMap((a, i, all) => (a === "-e" ? [all[i + 1]] : []));
  assert.deepEqual(e, ["CLAUDE_STATUSLINE_FLAVOR=latte", "CODEX_HOME=/c h"]);
});

await test("outside tmux the wrapper starts a tmux session that runs itself, so the split happens inside", () => {
  const args = ["resume", "--last"];
  const plan = planCodexLaunch({ ...BASE, args, env: {} });
  assert.equal(plan.kind, "session");
  assert.deepEqual(plan.session, ["new-session", "-s", "codex-4242", "-c", "/w/p q", "--", "/n/node", "/c/cli.js", "codex", ...args]);
});

await test("without tmux the wrapper says how to install it and starts Codex alone", () => {
  const plan = planCodexLaunch({ ...BASE, tmuxPath: null, args: ["x"], env: {} });
  assert.equal(plan.kind, "no-tmux");
  assert.match(plan.message, /tmux/);
  assert.match(TMUX_INSTALL_HINT, /brew install tmux/);
  assert.match(TMUX_INSTALL_HINT, /apt install tmux/);
  assert.deepEqual(plan.codex, { command: "codex", args: ["x"] });
});

await test("on Windows the pane is not offered: tmux does not run there natively", () => {
  const plan = planCodexLaunch({ ...BASE, platform: "win32", args: [], env: {} });
  assert.equal(plan.kind, "unsupported");
  assert.match(plan.message, /WSL/);
  assert.equal(plan.codex, null, "no shell is used to find codex.cmd, so nothing is started");
});

await test("tmux is found on PATH without running a shell", () => {
  const dir = scratch("path");
  const bin = path.join(dir, "tmux");
  writeFileSync(bin, "#!/bin/sh\n");
  chmodSync(bin, 0o755);
  assert.equal(findOnPath("tmux", { PATH: ["/nonexistent", dir].join(path.delimiter) }, "darwin"), bin);
  assert.equal(findOnPath("tmux", { PATH: "/nonexistent" }, "darwin"), null);
});

await test("the wrapper with no tmux on PATH starts the codex it finds, args intact", () => {
  if (process.platform === "win32") return;
  const home = makeHome();
  const dir = scratch("fakecodex");
  const out = path.join(dir, "args.json");
  const fake = path.join(dir, "codex");
  writeFileSync(fake, `#!${process.execPath}\nrequire("fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.argv.slice(2)));\nprocess.exit(3);\n`);
  chmodSync(fake, 0o755);
  const r = spawnSync(process.execPath, [CLI, "codex", "--model", "a b; echo hi"], {
    encoding: "utf8",
    env: { HOME: home.dir, USERPROFILE: home.dir, PATH: dir, CLAUDE_STATUSLINE_UPDATES: "off" },
  });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /tmux/);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), ["--model", "a b; echo hi"]);
});

// Item 5: install --pane ------------------------------------------------------------

const ORCA = { type: "command", command: "/bin/sh '/x/orca.sh'", timeout: 10 };
const hooksFile = (home) => path.join(home, "hooks.json");
const codexEnv = (home) => ({ CODEX_HOME: home, COPILOT_HOME: path.join(os.tmpdir(), "statusline-no-copilot-035"), PATH: "" });

await test("the hook goes after every existing SessionStart group, so Codex's trust keys stay put", () => {
  const before = JSON.stringify({ hooks: { SessionStart: [{ hooks: [ORCA] }], Stop: [{ hooks: [ORCA] }] } }, null, 2) + "\n";
  const cmd = '"/n/node" "/c/bin/cli.js" codex-hook';
  const r = addCodexHook(before, cmd);
  assert.equal(r.state, "added");
  const parsed = JSON.parse(r.text);
  assert.deepEqual(parsed.hooks.SessionStart[0], { hooks: [ORCA] }, "index 0 is still the other tool's");
  assert.deepEqual(parsed.hooks.SessionStart[1], { hooks: [{ type: "command", command: cmd, timeout: 10 }] });
  assert.deepEqual(parsed.hooks.Stop, [{ hooks: [ORCA] }]);
  assert.equal(addCodexHook(r.text, cmd).state, "present");
  assert.equal(addCodexHook(r.text, '"/n/node" "/moved/bin/cli.js" codex-hook').state, "updated");
  assert.ok(hasCodexHook(r.text));
  const removed = removeCodexHook(r.text);
  assert.equal(removed.removed, 1);
  assert.equal(removed.text, before, "the rest comes back byte for byte");
  assert.ok(isOurHookCommand('node "/anywhere/statusline-plugin/bin/cli.js" codex-hook'));
  assert.ok(!isOurHookCommand("other codex-hook-runner"));
});

await test("the hook runs through a bare node when a shell finds one, so a Node upgrade does not break it", () => {
  // Codex trusts a hook by its command text. A version-pinned interpreter
  // (nvm's, Homebrew's Cellar) disappears on the next Node upgrade: the hook
  // then fails on every session start, and the reinstall that fixes it
  // changes the text, so Codex asks to trust it again.
  const cmd = buildCodexHookCommand();
  assert.match(cmd, /codex-hook$/);
  assert.ok(isOurHookCommand(cmd));
  if (spawnSync("node", ["--version"], { stdio: "ignore" }).status !== 0) return;
  assert.match(cmd, /^node "/, cmd);
  if (process.execPath !== "node") assert.ok(!cmd.includes(process.execPath), cmd);
});

await test("a hooks.json that is not JSON is refused before anything is written", () => {
  const home = scratch("codexhome");
  writeFileSync(hooksFile(home), "{ not json");
  const r = installHarness("codex", { env: codexEnv(home), pane: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /hooks\.json/);
  assert.ok(!existsSync(path.join(home, "config.toml")), "config.toml was not touched either");
});

await test("install --pane registers the hook with a backup, says Codex asks to trust it, and uninstall takes only ours", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const codexHome = scratch("codexhome");
    const theirs = JSON.stringify({ hooks: { SessionStart: [{ hooks: [ORCA] }] } }, null, 2) + "\n";
    writeFileSync(hooksFile(codexHome), theirs);
    const r = installHarness("codex", { env: codexEnv(codexHome), pane: true });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.pane.hook, "added");
    assert.ok(r.pane.backupPath && existsSync(r.pane.backupPath));
    assert.equal(readFileSync(r.pane.backupPath, "utf8"), theirs);
    assert.ok(r.notes.some((n) => /trust/i.test(n)), r.notes.join("\n"));
    const parsed = JSON.parse(readFileSync(hooksFile(codexHome), "utf8"));
    assert.equal(parsed.hooks.SessionStart.length, 2);
    assert.match(parsed.hooks.SessionStart[1].hooks[0].command, /codex-hook$/);

    // A plain reinstall keeps it; --no-pane takes it out.
    assert.equal(installHarness("codex", { env: codexEnv(codexHome) }).pane.hook, "kept");
    const [status] = harnessStatus({ env: codexEnv(codexHome) });
    assert.equal(status.pane.hook, true);
    assert.equal(status.pane.tmux, null);

    const u = uninstallHarness("codex", { env: codexEnv(codexHome) });
    assert.equal(u.hookRemoved, true);
    assert.equal(readFileSync(hooksFile(codexHome), "utf8"), theirs);
  });
});

await test("a hooks.json install created is removed again when nothing else is in it", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const codexHome = scratch("codexhome");
    installHarness("codex", { env: codexEnv(codexHome), pane: true });
    assert.ok(existsSync(hooksFile(codexHome)));
    const off = installHarness("codex", { env: codexEnv(codexHome), pane: false });
    assert.equal(off.pane.hook, "removed");
    assert.ok(!existsSync(hooksFile(codexHome)));
  });
});

await test("doctor's Codex line says whether the pane is ready", () => {
  const base = { harness: "codex", home: "/h/.codex", configured: true, items: "current", colors: "ours", theme: null };
  assert.match(
    harnessLine({ ...base, pane: { hook: true, tmux: "/usr/bin/tmux", latest: { session_id: "abc", ageMs: 120_000 } } }),
    /pane: ready \(tmux \/usr\/bin\/tmux, SessionStart hook registered, last session abc 2m ago\)$/,
  );
  assert.match(harnessLine({ ...base, pane: { hook: false, tmux: null, latest: null } }), /pane: tmux not found; hook not registered \(install --harness codex --pane\)$/);
  assert.doesNotMatch(harnessLine(base), /pane/);
});

await test("the CLI takes --pane for Codex only and prints the trust note", () => {
  const home = makeHome();
  const codexHome = scratch("codexhome");
  const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir, ...codexEnv(codexHome) } });
  let r = run(["install", "--harness", "codex", "--pane"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Pane: +SessionStart hook added/);
  assert.match(r.stdout, /trust/i);
  assert.match(r.stdout, /cli\.js" codex/);
  r = run(["install", "--harness", "copilot", "--pane"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--pane is for Codex/);
  r = run(["uninstall", "--harness", "codex"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /SessionStart hook removed/);
});
