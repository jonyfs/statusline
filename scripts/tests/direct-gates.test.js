import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import {
  parseProcesses, scriptOf, gateMatcher, gatePatternsFrom, directRoots, collectRuns, probeGateRuns,
} from "../../src/gateRuns.js";
import { repoConfig } from "../../src/config.js";

// specs/036-direct-gates: gate scripts an agent runs by hand, outside any git
// hook, as rows of their own.

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const trees = [
  { path: "/r/main", branch: "main", head: "a".repeat(40) },
  { path: "/r/wt", branch: "side", head: "b".repeat(40) },
];

// What a gate script is ------------------------------------------------------------

await test("the script is the interpreter's script argument, or the command itself", () => {
  assert.equal(scriptOf("python3 .claude/scripts/gate-orcamento.py --x"), ".claude/scripts/gate-orcamento.py");
  assert.equal(scriptOf("/Users/x/.pyenv/versions/3.14.8/bin/python3 gate-demo.py"), "gate-demo.py");
  assert.equal(scriptOf("/Library/Frameworks/Python.framework/Versions/3.12/Resources/Python.app/Contents/MacOS/Python gate-x.py"), "gate-x.py");
  assert.equal(scriptOf("bash -e .claude/scripts/gates.sh --silencio"), ".claude/scripts/gates.sh");
  assert.equal(scriptOf("/usr/bin/env node scripts/gate-mockups.js"), "scripts/gate-mockups.js");
  assert.equal(scriptOf("npx tsx scripts/gate_x.ts"), "scripts/gate_x.ts");
  assert.equal(scriptOf(".claude/scripts/gates.sh"), ".claude/scripts/gates.sh");
  assert.equal(scriptOf("bash -c 'bash gates.sh'"), null, "an inline command is not a script; its child is");
  assert.equal(scriptOf("python3 -m gates"), null);
  assert.equal(scriptOf("vim gate-x.py"), "vim", "an editor open on a gate is not a gate");
  assert.equal(scriptOf("(Python)"), null, "caught mid-exec");
});

await test("default patterns: a gate- / gates. / gate_ basename, or a file in a gates/ directory", () => {
  const m = gateMatcher(null);
  for (const s of ["gates.sh", ".claude/scripts/gate-orcamento.py", "gate_x.ts", "/abs/gate.sh", "ci/gates/lint.sh", "Gate-X.py"]) assert.ok(m(s), s);
  for (const s of ["gatekeeper.sh", "vim", "scripts/check-x.sh", "/home/me/gates/repo/node_modules/.bin/vite", "agate-x.py", null]) assert.ok(!m(s), String(s));
});

await test("a repository's patterns replace the defaults, with simple globs; an empty list turns detection off", () => {
  const m = gateMatcher(["scripts/check-*.sh", "lint?.js"]);
  assert.ok(m("scripts/check-links.sh"));
  assert.ok(m("/abs/repo/scripts/check-links.sh"), "a pattern with a slash matches the end of the path");
  assert.ok(!m("scripts/sub/check-links.sh"), "* stays inside one directory");
  assert.ok(m("tools/lint1.js"), "a pattern without a slash matches the basename");
  assert.ok(!m("gates.sh"), "the defaults no longer apply");
  assert.ok(gateMatcher(["**/check.sh"])("a/b/c/check.sh"));
  const off = gateMatcher([]);
  assert.ok(!off("gates.sh"));
  assert.equal(gatePatternsFrom(undefined), null);
  assert.equal(gatePatternsFrom({ patterns: "x" }), null, "not a list: the defaults");
  assert.deepEqual(gatePatternsFrom({ patterns: [] }), []);
  assert.deepEqual(gatePatternsFrom({ patterns: ["a/*.sh", 3, ""] }), ["a/*.sh"]);
  assert.equal(gatePatternsFrom({ patterns: [3] }), null, "nothing usable: the defaults");
});

await test("the gates key is read from .statusline.json as a sixth key", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cfg-gates-"));
  writeFileSync(path.join(root, ".statusline.json"), JSON.stringify({ flavor: "nord", gates: { patterns: ["scripts/check-*.sh"] } }));
  assert.deepEqual(repoConfig(root), { flavor: "nord", gates: { patterns: ["scripts/check-*.sh"] } });
});

// Which processes are runs --------------------------------------------------------

const PS = parseProcesses([
  "  100     1     10:00 -zsh",
  // An agent's Bash tool running gates.sh, which runs a gate, which runs a tool.
  "  110   100     02:00 /bin/zsh -c bash .claude/scripts/gates.sh",
  "  111   110     02:00 bash .claude/scripts/gates.sh",
  "  112   111     00:40 python3 .claude/scripts/gate-orcamento.py",
  // A gate run on its own, elsewhere.
  "  120   100     00:30 python3 .claude/scripts/gate-x.py",
  // The same gates.sh inside a pre-commit: the hook's row already covers it.
  "  200   100     03:05 git commit -m wip",
  "  201   200     03:04 bash .githooks/pre-commit",
  "  202   201     03:04 bash .claude/scripts/gates.sh",
  "  203   202     03:01 python3 .claude/scripts/gate-hexagono.py",
  // Another repository's gate.
  "  300   100     01:00 bash scripts/gates.sh",
].join("\n"));

await test("the roots are matching scripts with no matching ancestor and no hook above them", () => {
  const roots = directRoots(PS, gateMatcher(null)).map((p) => p.pid);
  assert.deepEqual(roots, [111, 120, 300]);
  assert.deepEqual(directRoots(PS, gateMatcher([])), [], "detection off");
});

const cwds = { 111: "/r/main", 120: "/r/wt/sub", 201: "/r/main", 300: "/elsewhere/repo" };
const collect = (over = {}) => collectRuns({ worktrees: trees, procs: PS, cwdOf: (pid) => cwds[pid] ?? null, now: NOW, ...over });

await test("a direct run reads like a hook row, with gate in the hook column and nested gates in one row", () => {
  const runs = collect();
  assert.deepEqual(runs.map((r) => [r.pid, r.hook, r.worktree, r.branch, r.step, r.state]), [
    [201, "pre-commit", "main", "main", "gates.sh › gate-hexagono.py", "running"],
    [111, "gate", "main", "main", "gates.sh › gate-orcamento.py", "running"],
    [120, "gate", "wt", "side", "gate-x.py", "running"],
  ]);
  assert.equal(runs[1].startedAt, NOW - 120_000);
  assert.equal(runs[1].kind, "direct");
  assert.ok(!runs.some((r) => r.pid === 202 || r.pid === 203), "nothing inside the hook is a row of its own");
  assert.ok(!runs.some((r) => r.pid === 300), "another repository's gate is not this one's");
});

await test("a repository's patterns pick what counts, and an empty list leaves only the hooks", () => {
  const custom = parseProcesses(["  1 0 01:00 -zsh", "  2 1 00:10 bash scripts/check-links.sh", "  3 1 00:10 bash scripts/gates.sh"].join("\n"));
  const runs = collectRuns({ worktrees: trees, procs: custom, cwdOf: () => "/r/main", now: NOW, gatePatterns: ["scripts/check-*.sh"] });
  assert.deepEqual(runs.map((r) => [r.pid, r.hook, r.step]), [[2, "gate", "check-links.sh"]]);
  assert.deepEqual(collect({ gatePatterns: [] }).map((r) => r.pid), [201]);
});

await test("a gates.lock held by a direct run keeps its own row and is not shown twice", () => {
  const lockOf = (t) => (t.path === "/r/main" ? { pid: 111, mtimeMs: NOW - 100_000 } : null);
  const runs = collect({ lockOf, isAlive: (p) => p === 111 });
  const mains = runs.filter((r) => r.worktree === "main" && r.hook !== "pre-commit");
  assert.equal(mains.length, 1, JSON.stringify(runs));
  assert.deepEqual([mains[0].pid, mains[0].hook, mains[0].step], [111, "gates.sh", "gate-orcamento.py"], "the lock row, as before");
  // The holder deeper in the run (a gate that takes the lock itself) is the same run too.
  const deep = collect({ lockOf: (t) => (t.path === "/r/main" ? { pid: 112, mtimeMs: NOW } : null), isAlive: (p) => p === 112 });
  assert.equal(deep.filter((r) => r.worktree === "main" && r.hook !== "pre-commit").length, 1, JSON.stringify(deep));
});

await test("a direct gates.sh standing at another run's lock is waiting", () => {
  const lockOf = (t) => (t.path === "/r/main" ? { pid: 202, mtimeMs: NOW } : null);
  const runs = collect({ lockOf, isAlive: (p) => p === 202 });
  const direct = runs.find((r) => r.pid === 111);
  assert.equal(direct.state, "waiting");
  assert.equal(direct.step, null);
  assert.equal(runs.find((r) => r.pid === 120).state, "running", "a lone gate does not take the lock");
});

// The probe -------------------------------------------------------------------------

const FAKE_TREES = "worktree /fake/main\nHEAD 1111111\nbranch refs/heads/main\n\nworktree /fake/wt\nHEAD 2222222\nbranch refs/heads/side\n";
const FAKE_PS = [
  "  1     0   10:00 /sbin/launchd",
  "  50    1   01:00 vim notes.md",
  "  60    1   00:20 python3 .claude/scripts/gate-x.py",
].join("\n");

await test("the probe asks lsof only about hooks and matching scripts, and places the direct run", () => {
  const asked = [];
  const exec = (cmd, args) => {
    if (cmd === "git") return FAKE_TREES;
    if (cmd === "ps") return FAKE_PS;
    if (cmd === "lsof") {
      asked.push(args[args.indexOf("-p") + 1]);
      return "p60\nfcwd\nn/fake/wt\n";
    }
    throw new Error(`unexpected ${cmd}`);
  };
  const result = probeGateRuns("/fake/main", 5_000, { now: NOW, exec, platform: "darwin", previous: [], gatePatterns: null });
  assert.equal(result.state, "found");
  assert.deepEqual(asked, ["60"]);
  assert.deepEqual(result.value.runs.map((r) => [r.hook, r.worktree, r.step]), [["gate", "wt", "gate-x.py"]]);
  // Patterns off: nothing to ask.
  asked.length = 0;
  const off = probeGateRuns("/fake/main", 5_000, { now: NOW, exec, platform: "darwin", previous: [], gatePatterns: [] });
  assert.deepEqual(off.value.runs, []);
  assert.deepEqual(asked, []);
});

await test("lsof exiting 1 with a direct run's directory still places it; silent is a failed probe", () => {
  const fail = (stdout) => (cmd) => {
    if (cmd === "git") return FAKE_TREES;
    if (cmd === "ps") return FAKE_PS;
    throw Object.assign(new Error("Command failed"), { status: 1, stdout });
  };
  const ok = probeGateRuns("/fake/main", 5_000, { now: NOW, exec: fail("p60\nfcwd\nn/fake/main\n"), platform: "darwin", previous: [], gatePatterns: null });
  assert.equal(ok.value.runs[0].worktree, "main");
  const silent = probeGateRuns("/fake/main", 5_000, { now: NOW, exec: fail(""), platform: "darwin", previous: [], gatePatterns: null });
  assert.equal(silent.state, "failed");
});

await test("a real sh gate-demo.sh in a linked worktree is found by the probe", async () => {
  if (process.platform === "win32") return; // Windows reads only the locks (research R5)
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "statusline-direct-gate-")));
  const main = path.join(root, "main");
  const wt = path.join(root, "wt");
  const git = (args, cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, stdio: "ignore" });
  mkdirSync(main);
  git(["init", "-q"], main);
  git(["commit", "-q", "--allow-empty", "-m", "init"], main);
  git(["worktree", "add", "-q", wt, "-b", "side"], main);
  writeFileSync(path.join(wt, "gate-demo.sh"), "sleep 30\nexit 0\n");
  const child = spawn("sh", ["gate-demo.sh"], { cwd: wt, detached: true, stdio: "ignore" });
  try {
    let runs = [];
    for (let i = 0; i < 40 && !runs.find((r) => r.pid === child.pid)?.step; i++) {
      await new Promise((r) => setTimeout(r, 250));
      runs = probeGateRuns(main, 5_000, { previous: [], gatePatterns: null }).value?.runs ?? [];
    }
    const found = runs.find((r) => r.pid === child.pid);
    assert.ok(found, JSON.stringify(runs));
    assert.equal(found.hook, "gate");
    assert.equal(found.worktree, "wt");
    assert.equal(found.branch, "side");
    assert.equal(found.step, "gate-demo.sh › sleep 30");
  } finally {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
});

await test("test files of the gates are not gates, and runner flags with values are skipped", () => {
  const m = gateMatcher();
  for (const f of ["scripts/tests/gate-rows.test.js", "gate_x_test.py", "gate.spec.ts", "gates/test_gate.py"]) assert.equal(m(f), false, f);
  assert.equal(m("gate-orcamento.py"), true);
  assert.equal(scriptOf("node -r ./gate-setup.js app.js"), "app.js");
  assert.equal(scriptOf("node --require ./hook.js gate.js"), "gate.js");
  assert.equal(scriptOf("python3 -W ignore gate-x.py"), "gate-x.py");
  assert.equal(scriptOf("node --import=tsx gate.ts"), "gate.ts", "the --flag=value form is one token");
});
