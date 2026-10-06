import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, realpathSync, existsSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import {
  parseWorktrees, parseEtime, parseProcesses, hookOf, labelOf, stepOf, collectRuns,
  readGateRuns, probeGateRuns, GATE_ROW_CAP, GATES_REFRESH_AFTER_MS,
} from "../../src/gateRuns.js";
import { gateRows } from "../../src/gateRows.js";
import { renderPayload, GLYPHS } from "../../src/render.js";
import { repoKey, writeEntry } from "../../src/cache.js";
import { displayWidth } from "../../src/theme.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

// specs/031-git-gate-rows: the git hooks running in this repository's
// worktrees, as rows after the bar and a count on line 1.

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const HERE = "/work/barbershop-dev";
const run = (over = {}) => ({
  pid: 9001, hook: "pre-commit", worktree: "barbershop-dev", path: HERE,
  branch: "harness/gates", step: "gates.sh › review-cycle.test.sh",
  startedAt: NOW - 184_000, state: "running", ...over,
});
const render = (runs, opts = {}, payload = {}) =>
  stripAnsi(renderPayload(
    { ...fullPayload({ now: NOW }), cwd: HERE, workspace: { current_dir: HERE }, ...payload },
    { sources: { ...gitSources(), getCiStatus: () => null, getGateRuns: () => runs }, trackChanges: false, now: NOW, maxWidth: 160, maxHeight: 40, ...opts }
  ));

// Parsing ----------------------------------------------------------------------

await test("worktrees come from the porcelain list, prunable ones left out", () => {
  const text = [
    "worktree /r/main", "HEAD aaaaaaaaaaaa", "branch refs/heads/main", "",
    "worktree /r/wt", "HEAD bbbbbbbbbbbb", "detached", "",
    "worktree /tmp/gone", "HEAD cccccccccccc", "branch refs/heads/x", "prunable gitdir file points to non-existent location", "",
  ].join("\n");
  assert.deepEqual(parseWorktrees(text).map((w) => [w.path, w.branch, w.head]), [
    ["/r/main", "main", "aaaaaaaaaaaa"],
    ["/r/wt", null, "bbbbbbbbbbbb"],
  ]);
});

await test("elapsed time reads every form ps prints", () => {
  assert.equal(parseEtime("00:07"), 7);
  assert.equal(parseEtime("03:04"), 184);
  assert.equal(parseEtime("01:02:03"), 3723);
  assert.equal(parseEtime("2-01:00:00"), 2 * 86400 + 3600);
  assert.equal(parseEtime("garbage"), null);
});

// What counts as a gate --------------------------------------------------------

const procs = parseProcesses([
  "  100     1     10:00 -zsh",
  "  200   100     03:05 git commit -m wip",
  "  201   200     03:04 bash /r/main/.githooks/pre-commit",
  "  202   201     03:04 bash .claude/scripts/gates.sh",
  "  203   202     03:01 bash .claude/scripts/review-cycle.test.sh",
  "  204   203     00:02 bash .claude/scripts/review-cycle.test.sh",
  "  205   201     03:04 npm run -s lint",
  "  300   100     00:30 bash /r/main/.githooks/pre-commit",
  "  400   100     00:50 git push",
  "  401   400     00:49 /bin/sh .git/hooks/pre-push",
  "  402   401     00:49 npx tsx scripts/check-links.ts",
].join("\n"));
const byPid = new Map(procs.map((p) => [p.pid, p]));

await test("a gate is a hook script whose parent is git, not the same script run by hand", () => {
  assert.deepEqual(hookOf(byPid.get(201), byPid), { name: "pre-commit", script: "/r/main/.githooks/pre-commit" });
  assert.equal(hookOf(byPid.get(401), byPid).name, "pre-push");
  assert.equal(hookOf(byPid.get(300), byPid), null, "run by hand from a shell");
  assert.equal(hookOf(byPid.get(202), byPid), null, "a child of the hook is not a hook");
});

await test("a step names scripts by file and commands by their words", () => {
  assert.equal(labelOf("bash .claude/scripts/gates.sh"), "gates.sh");
  assert.equal(labelOf("npm run -s lint"), "npm run lint");
  assert.equal(labelOf("npx tsx scripts/check-links.ts"), "check-links.ts");
  assert.equal(labelOf("sleep 30"), "sleep 30");
});

await test("the step follows the newest child down, skipping a subshell, or lists side-by-side work", () => {
  assert.equal(stepOf(401, procs), "check-links.ts");
  assert.equal(stepOf(202, procs), "review-cycle.test.sh");
  assert.equal(stepOf(201, procs), "gates.sh · npm run lint", "the hook started two things at once");
  const chain = parseProcesses(["1 0 01:00 git commit", "2 1 01:00 bash .git/hooks/pre-commit", "3 2 01:00 bash gates.sh", "4 3 00:30 bash review-cycle.test.sh", "5 4 00:30 bash review-cycle.test.sh"].join("\n"));
  assert.equal(stepOf(2, chain), "gates.sh › review-cycle.test.sh");
  assert.equal(stepOf(5, chain), null, "nothing under it");
  const midExec = parseProcesses(["1 0 01:00 git commit", "2 1 01:00 bash .git/hooks/pre-commit", "3 2 01:00 bash gates.sh", "4 3 00:01 (Python)"].join("\n"));
  assert.equal(stepOf(2, midExec), "gates.sh", "a process caught mid-exec has no name yet");
  assert.equal(labelOf("(Python)"), null);
});

// Attribution, waiting and locks ------------------------------------------------

const trees = [
  { path: "/r/main", branch: "main", head: "a".repeat(40) },
  { path: "/r/wt", branch: null, head: "b".repeat(40) },
];

await test("each run belongs to the worktree it runs in, by working directory first", () => {
  const runs = collectRuns({
    worktrees: trees,
    procs,
    cwdOf: (pid) => ({ 201: "/r/main", 401: "/r/wt/sub" })[pid] ?? null,
    now: NOW,
  });
  assert.deepEqual(runs.map((r) => [r.hook, r.worktree, r.branch, r.state]), [
    ["pre-commit", "main", "main", "running"],
    ["pre-push", "wt", "bbbbbbb", "running"],
  ]);
  assert.equal(runs[0].startedAt, NOW - 184_000);
  assert.equal(runs[0].step, "gates.sh · npm run lint");
});

await test("without a working directory, an absolute hook path names the worktree; otherwise nothing", () => {
  const runs = collectRuns({ worktrees: trees, procs, now: NOW });
  assert.deepEqual(runs.map((r) => r.worktree), ["main"], "the relative .git/hooks path cannot be placed");
  const other = collectRuns({ worktrees: [{ path: "/elsewhere", branch: "x" }], procs, cwdOf: () => "/r/main", now: NOW });
  assert.deepEqual(other, [], "a hook in another repository is not this repository's gate");
});

await test("a run whose gates.sh stands at another run's lock is waiting; a dead holder is ignored", () => {
  const two = parseProcesses([
    "10 1 05:00 git commit", "11 10 05:00 bash .githooks/pre-commit", "12 11 05:00 bash .claude/scripts/gates.sh", "13 12 01:00 bash gate-x.sh",
    "20 1 00:20 git commit", "21 20 00:20 bash .githooks/pre-commit", "22 21 00:20 bash .claude/scripts/gates.sh",
  ].join("\n"));
  const lockOf = (t) => (t.path === "/r/main" ? { pid: 12, mtimeMs: NOW - 300_000 } : null);
  const runs = collectRuns({ worktrees: trees, procs: two, cwdOf: () => "/r/main", lockOf, isAlive: (p) => p === 12, now: NOW });
  assert.deepEqual(runs.map((r) => [r.pid, r.state, r.step]), [[11, "running", "gates.sh › gate-x.sh"], [21, "waiting", null]]);
  const stale = collectRuns({ worktrees: trees, procs: two, cwdOf: () => "/r/main", lockOf, isAlive: () => false, now: NOW });
  assert.ok(stale.every((r) => r.state === "running"), "a lock whose holder is gone holds nothing");
});

await test("a held lock no hook accounts for is a run of its own, aged by the lock", () => {
  const runs = collectRuns({
    worktrees: trees,
    procs: [],
    lockOf: (t) => (t.path === "/r/wt" ? { pid: 77, mtimeMs: NOW - 60_000 } : null),
    isAlive: (p) => p === 77,
    now: NOW,
  });
  assert.deepEqual(runs.map((r) => [r.hook, r.worktree, r.startedAt, r.step]), [["gates.sh", "wt", NOW - 60_000, null]]);
});

// The redraw's side ------------------------------------------------------------

await test("the redraw reads the cache, drops runs whose process ended, and has nothing before a refresh", () => {
  const prev = process.env.CLAUDE_STATUSLINE_NO_REFRESH;
  process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";
  try {
    const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-gates-read-"));
    assert.equal(readGateRuns(dir, { now: NOW }), null, "no answer yet");
    writeEntry(repoKey(dir), "gates", { runs: [run({ pid: 1 }), run({ pid: 2 })] }, { now: NOW - 1000 });
    assert.deepEqual(readGateRuns(dir, { now: NOW, isAlive: (p) => p === 2 }).map((r) => r.pid), [2]);
    assert.ok(GATES_REFRESH_AFTER_MS >= 5_000, "a refresh lists every process, so it is spaced out");
    assert.equal(readGateRuns(path.join(dir, "missing"), { now: NOW }), null, "a directory that does not exist");
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_NO_REFRESH;
    else process.env.CLAUDE_STATUSLINE_NO_REFRESH = prev;
  }
});

// Rendering --------------------------------------------------------------------

await test("each run is a row after the bar, this worktree marked, and line 1 counts them", () => {
  const out = render([run(), run({ pid: 9002, worktree: "barbershop-056", path: "/work/barbershop-056", branch: "056-tema", step: "npm test", startedAt: NOW - 48_000 })]);
  const lines = out.split("\n");
  assert.match(lines[0], /2 gates · here 3m/);
  const rows = lines.slice(-2);
  assert.match(rows[0], new RegExp(`${GLYPHS.nerd.gateRunning} pre-commit .*\\* barbershop-dev .*harness/gates .*gates\\.sh › review-cycle\\.test\\.sh .*3m`));
  assert.match(rows[1], /  barbershop-056 .*056-tema .*npm test .*48s/);
});

await test("with no gate running the bar is exactly what it was", () => {
  const before = render(null);
  assert.equal(render([]), before);
  assert.doesNotMatch(before, /gate/);
});

await test("a waiting run says so, in its own icon and words", () => {
  const out = render([run({ state: "waiting", step: null })]);
  assert.match(out, new RegExp(`${GLYPHS.nerd.gateWaiting} pre-commit .*waiting for gates\\.lock`));
});

await test("under Copilot the gate rows follow the subagent rows", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/copilot-payload.json", import.meta.url), "utf8"));
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-gates-copilot-"));
  writeFileSync(path.join(dir, "events.jsonl"), JSON.stringify({ type: "subagent.started", agentId: "a1", timestamp: new Date(NOW - 30_000).toISOString(), data: { toolCallId: "c1", agentName: "explore", agentDescription: "Map the gates" } }) + "\n");
  const out = render([run()], {}, { ...fixture, cwd: HERE, workspace: { current_dir: HERE }, transcript_path: dir });
  const lines = out.split("\n");
  assert.match(lines.at(-2), /Map the gates/);
  assert.match(lines.at(-1), /pre-commit/);
});

await test("a short window drops the rows before any line of the bar, and keeps the count", () => {
  const barLines = render(null).split("\n").length;
  const out = render([run(), run({ pid: 2 })], { maxHeight: barLines + 1 });
  assert.equal(out.split("\n").length, barLines, out);
  assert.match(out, /2 gates/);
  assert.doesNotMatch(out, /pre-commit/);
  assert.equal(render([run(), run({ pid: 2 })], { maxHeight: barLines + 2 }).split("\n").length, barLines + 2, "back as soon as there is room");
});

await test(`past ${GATE_ROW_CAP} runs the rows stop and say how many more`, () => {
  const runs = Array.from({ length: GATE_ROW_CAP + 2 }, (_, i) => run({ pid: 100 + i, worktree: `wt-${i}`, path: `/work/wt-${i}` }));
  const lines = render(runs).split("\n");
  assert.equal(lines.filter((l) => /pre-commit/.test(l)).length, GATE_ROW_CAP);
  assert.match(lines.at(-1), /\+2 more/);
});

await test("the arrangement switching gates off takes the count and the rows", () => {
  const off = { arrangement: { version: 1, segments: { gates: { on: false } } }, origin: "test", path: null, error: null };
  const out = render([run()], { layout: off });
  assert.doesNotMatch(out, /gate|pre-commit/);
});

await test("rows fit the width, giving up the branch first, and plain mode has no Nerd Font glyph", () => {
  const rows = gateRows([run({ step: "a very long step name that keeps going and going and going" })], { columns: 70, now: NOW, here: HERE, glyphs: GLYPHS.plain });
  const text = stripAnsi(rows[0]);
  assert.ok(displayWidth(text) <= 70, text);
  assert.doesNotMatch(text, /harness\/gates/, "the branch went first");
  assert.match(text, new RegExp(`^${GLYPHS.plain.gateRunning} pre-commit`));
  assert.ok(![...text].some((c) => c.codePointAt(0) >= 0xe000 && c.codePointAt(0) <= 0xf8ff || c.codePointAt(0) >= 0xf0000));
});

// The probe, for real ------------------------------------------------------------

await test("a real pre-commit in a linked worktree is found, placed and named", async () => {
  if (process.platform === "win32") return; // Windows reads only the locks (research R5)
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "statusline-gates-real-")));
  const main = path.join(root, "main");
  const wt = path.join(root, "wt");
  const git = (args, cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, stdio: "ignore" });
  mkdirSync(main);
  git(["init", "-q"], main);
  git(["commit", "-q", "--allow-empty", "-m", "init"], main);
  git(["worktree", "add", "-q", wt, "-b", "side"], main);
  const hook = path.join(main, ".git", "hooks", "pre-commit");
  writeFileSync(hook, "#!/bin/sh\nsleep 30\n");
  chmodSync(hook, 0o755);
  const commit = spawn("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "x"], { cwd: wt, detached: true, stdio: "ignore" });
  try {
    let runs = [];
    // Until the hook has started its own child, the step is honestly unknown.
    for (let i = 0; i < 40 && !runs[0]?.step; i++) {
      await new Promise((r) => setTimeout(r, 250));
      runs = probeGateRuns(main, 5_000).value?.runs ?? [];
    }
    assert.equal(runs.length, 1, JSON.stringify(runs));
    assert.equal(runs[0].hook, "pre-commit");
    assert.equal(runs[0].worktree, "wt");
    assert.equal(runs[0].branch, "side");
    assert.equal(runs[0].step, "sleep 30");
    assert.equal(runs[0].state, "running");
  } finally {
    try {
      process.kill(-commit.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  assert.ok(existsSync(main));
});
