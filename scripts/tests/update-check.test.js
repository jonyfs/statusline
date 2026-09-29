import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import {
  readBehaviour,
  writeBehaviour,
  classify,
  pendingCommits,
  runUpdateCheck,
  updateCheckDue,
  maybeStartUpdateCheck,
  updateNotice,
  updatesLine,
  checkUpdatesReport,
  countsText,
  CHECK_INTERVAL_MS,
} from "../../src/updateCheck.js";
import { update } from "../../src/update.js";
import { renderPayload } from "../../src/render.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G } from "./glyphs.js";

// specs/026-update-check. Every repository here is a temporary one built for
// the case, and the suite's HOME is a temporary directory: nothing reaches the
// network, and nothing touches the clone that runs the suite.

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const NOW = Date.parse("2026-09-29T12:00:00.000Z");

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
  const base = mkdtempSync(path.join(os.tmpdir(), "statusline-updatecheck-"));
  const origin = path.join(base, "origin");
  const clone = path.join(base, "clone");
  execFileSync("git", ["init", "-q", "-b", "main", origin], { env: GIT_ENV });
  writeFileSync(path.join(origin, "file.txt"), "one\n");
  git(origin, "add", ".");
  git(origin, "commit", "-q", "-m", "feat: the first one");
  execFileSync("git", ["clone", "-q", origin, clone], { env: GIT_ENV });
  let n = 0;
  const commit = (subject) => {
    writeFileSync(path.join(origin, "file.txt"), `${++n}\n`);
    git(origin, "commit", "-q", "-am", subject);
  };
  return { origin, clone, commit, head: (dir) => git(dir, "rev-parse", "--short", "HEAD") };
}

const NOTIFY = { CLAUDE_STATUSLINE_UPDATES: "notify" };
const AUTO = { CLAUDE_STATUSLINE_UPDATES: "auto" };
const quietApply = (root) => update({ root, runInstall: () => ({ status: 0 }) });

// Foundational --------------------------------------------------------------

await test("the behaviour defaults to auto, reads the file, and yields to the environment", () => {
  assert.deepEqual(readBehaviour({ env: {} }), { mode: "auto", source: "default" });
  writeBehaviour("notify");
  assert.deepEqual(readBehaviour({ env: {} }), { mode: "notify", source: "file" });
  assert.deepEqual(readBehaviour({ env: { CLAUDE_STATUSLINE_UPDATES: "off" } }), { mode: "off", source: "environment" });
  writeFileSync(path.join(os.homedir(), ".claude", "statusline", "updates.json"), '{"mode":"sometimes"}');
  assert.equal(readBehaviour({ env: {} }).mode, "auto", "an unknown value falls back to the default");
  assert.throws(() => writeBehaviour("sometimes"), /auto, notify, off/);
  writeBehaviour("auto");
});

await test("commits are classified by their prefix", () => {
  assert.equal(classify("feat: a thing"), "feature");
  assert.equal(classify("feat(025): a thing"), "feature");
  assert.equal(classify("feat!: a breaking thing"), "feature");
  assert.equal(classify("fix: a bug"), "fix");
  assert.equal(classify("fix(install): a bug"), "fix");
  for (const s of ["docs: words", "chore: 1.20.0", "Merge feat/x: y", "a free sentence", "", null]) {
    assert.equal(classify(s), "other", String(s));
  }
});

await test("pending commits are read after a fetch, and the clone is not touched", () => {
  const r = repos();
  const before = r.head(r.clone);
  r.commit("fix: one");
  r.commit(`docs: ${"x".repeat(100)}`);
  r.commit("feat: two \x1b[31mred");
  const found = pendingCommits(r.clone);
  assert.equal(found.ok, true, found.error);
  assert.deepEqual(found.commits.map((c) => c.type), ["feature", "other", "fix"]);
  assert.equal(found.commits[0].subject, "feat: two [31mred", "control characters are cleaned");
  assert.ok(found.commits[1].subject.length <= 72, "long subjects are cut");
  assert.equal(r.head(r.clone), before);
});

await test("an unreachable upstream fails quietly within the limit", () => {
  const r = repos();
  git(r.clone, "remote", "set-url", "origin", path.join(os.tmpdir(), "statusline-no-such-repo"));
  const found = pendingCommits(r.clone, { timeoutMs: 5000 });
  assert.equal(found.ok, false);
  assert.match(found.error, /fetch failed/);
});

await test("a check is due with none recorded or after 24 hours, not before", () => {
  assert.equal(updateCheckDue(null, NOW), true);
  assert.equal(updateCheckDue({ checkedAt: NOW - CHECK_INTERVAL_MS + 1000 }, NOW), false);
  assert.equal(updateCheckDue({ checkedAt: NOW - CHECK_INTERVAL_MS }, NOW), true);
});

await test("no background check starts with refresh disabled, updates off, or a fresh result", () => {
  assert.equal(maybeStartUpdateCheck({ now: NOW, env: { CLAUDE_STATUSLINE_NO_REFRESH: "1" } }), false);
  assert.equal(maybeStartUpdateCheck({ now: NOW, env: { CLAUDE_STATUSLINE_UPDATES: "off" } }), false);
});

// Story 1: notify ------------------------------------------------------------

await test("notify records improvements and fixes as ready and changes nothing", () => {
  const r = repos();
  const before = r.head(r.clone);
  r.commit("feat: a");
  r.commit("fix: b");
  r.commit("fix: c");
  const v = runUpdateCheck({ root: r.clone, now: NOW, env: NOTIFY });
  assert.equal(v.outcome, "ready");
  assert.deepEqual(v.arrived, { features: 1, fixes: 2 });
  assert.equal(r.head(r.clone), before);
});

await test("only docs and chores pending, or nothing pending, is current", () => {
  const r = repos();
  assert.equal(runUpdateCheck({ root: r.clone, now: NOW, env: NOTIFY }).outcome, "current");
  r.commit("docs: words");
  r.commit("chore: 1.2.3");
  assert.equal(runUpdateCheck({ root: r.clone, now: NOW, env: NOTIFY }).outcome, "current");
});

await test("the ready notice counts, leaves out zeros, and never shows a subject", () => {
  assert.equal(countsText({ features: 1, fixes: 2 }), "1 feature, 2 fixes");
  assert.equal(countsText({ features: 0, fixes: 1 }), "1 fix");
  const n = updateNotice({ outcome: "ready", arrived: { features: 2, fixes: 0 }, pending: [{ subject: "feat: secret" }] }, "s1", { mode: "notify" });
  assert.equal(n.text, "update ready · 2 features");
  assert.equal(updateNotice({ outcome: "current" }, "s1", { mode: "notify" }), null);
  assert.equal(updateNotice({ outcome: "ready", arrived: { fixes: 1 } }, "s1", { mode: "off" }), null);
});

await test("the bar draws the notice on line 1 with its icon", () => {
  const sources = { ...emptySources, getUpdateNotice: () => ({ state: "ready", text: "update ready · 1 fix" }) };
  const out = stripAnsi(renderPayload(fullPayload({ now: NOW }), { sources, trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40 }));
  assert.match(out.split("\n")[0], new RegExp(`${G.updateReady} update ready · 1 fix`, "u"));
  const none = stripAnsi(renderPayload(fullPayload({ now: NOW }), { sources: emptySources, trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40 }));
  assert.doesNotMatch(none, /update/);
});

// Story 2: auto ----------------------------------------------------------------

await test("auto fast-forwards a clean clone and records what arrived", () => {
  const r = repos();
  r.commit("fix: b");
  const target = r.head(r.origin);
  const v = runUpdateCheck({ root: r.clone, now: NOW, env: AUTO, applyUpdate: quietApply });
  assert.equal(v.outcome, "updated", JSON.stringify(v));
  assert.deepEqual(v.arrived, { features: 0, fixes: 1 });
  assert.equal(r.head(r.clone), target);
});

await test("auto refuses local edits and a diverged history, and touches nothing", () => {
  const edited = repos();
  edited.commit("fix: b");
  const before = edited.head(edited.clone);
  writeFileSync(path.join(edited.clone, "file.txt"), "mine\n");
  const v1 = runUpdateCheck({ root: edited.clone, now: NOW, env: AUTO, applyUpdate: quietApply });
  assert.equal(v1.outcome, "blocked");
  assert.equal(v1.blockedBy, "local edits");
  assert.equal(edited.head(edited.clone), before);
  assert.equal(readFileSync(path.join(edited.clone, "file.txt"), "utf8"), "mine\n");

  const diverged = repos();
  diverged.commit("fix: b");
  writeFileSync(path.join(diverged.clone, "local.txt"), "local\n");
  git(diverged.clone, "add", ".");
  git(diverged.clone, "commit", "-q", "-m", "local work");
  const local = diverged.head(diverged.clone);
  const v2 = runUpdateCheck({ root: diverged.clone, now: NOW, env: AUTO, applyUpdate: quietApply });
  assert.equal(v2.outcome, "blocked");
  assert.equal(v2.blockedBy, "history diverged");
  assert.equal(diverged.head(diverged.clone), local);
});

await test("an update whose install fails is recorded as failed", () => {
  const r = repos();
  r.commit("feat: a");
  const v = runUpdateCheck({ root: r.clone, now: NOW, env: AUTO, applyUpdate: (root) => update({ root, runInstall: () => ({ status: 3 }) }) });
  assert.equal(v.outcome, "failed");
});

await test("an update or a failure is news for the first session only", () => {
  const value = { outcome: "updated", arrived: { features: 1, fixes: 2 }, shownTo: null };
  const first = updateNotice(value, "s1", { mode: "auto" });
  assert.equal(first.text, "statusline updated · 1 feature, 2 fixes");
  assert.equal(first.firstShowing, true);
  assert.ok(updateNotice({ ...value, shownTo: "s1" }, "s1", { mode: "auto" }), "the same session keeps seeing it");
  assert.equal(updateNotice({ ...value, shownTo: "s1" }, "s2", { mode: "auto" }), null, "a later session does not");
  assert.equal(updateNotice({ outcome: "failed", shownTo: "s1" }, "s2", { mode: "auto" }), null);
  const blocked = { outcome: "blocked", blockedBy: "local edits", shownTo: "s1" };
  assert.equal(updateNotice(blocked, "s2", { mode: "auto" }).text, "update blocked · local edits", "a block stays while it lasts");
});

await test("install says the update behaviour and how to change it", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "statusline-updatecheck-home-"));
  const out = spawnSync(process.execPath, [CLI, "install"], {
    env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_STATUSLINE_UPDATES: "" },
    encoding: "utf8",
  });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /Updates:\s+auto \(change with: node ".+cli\.js" updates notify\)/);
});

// Story 3: choose and check ------------------------------------------------------

const cli = (args, extraEnv = {}) => {
  const home = mkdtempSync(path.join(os.tmpdir(), "statusline-updatecheck-home-"));
  return {
    home,
    run: (a = args, env = extraEnv) =>
      spawnSync(process.execPath, [CLI, ...a], { env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_STATUSLINE_UPDATES: "", ...env }, encoding: "utf8" }),
  };
};

await test("updates prints the behaviour and its source, and sets it", () => {
  const c = cli(["updates"]);
  assert.match(c.run().stdout, /Updates: auto \(default\)/);
  const set = c.run(["updates", "notify"]);
  assert.equal(set.status, 0, set.stderr);
  assert.equal(JSON.parse(readFileSync(path.join(c.home, ".claude", "statusline", "updates.json"), "utf8")).mode, "notify");
  assert.match(c.run().stdout, /Updates: notify \(from .+updates\.json\)/);
  const bad = c.run(["updates", "sometimes"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /auto, notify, off/);
  assert.match(c.run(["updates"], { CLAUDE_STATUSLINE_UPDATES: "off" }).stdout, /off \(CLAUDE_STATUSLINE_UPDATES overrides the file\)/);
});

await test("check-updates lists what is pending and changes nothing", () => {
  const r = repos();
  const before = r.head(r.clone);
  r.commit("fix: one");
  r.commit("docs: two");
  r.commit("feat: three");
  const report = checkUpdatesReport(r.clone, { updateCommand: "node cli.js update" });
  assert.equal(report.ok, true);
  assert.match(report.text, /^1 feature, 1 fix waiting \(\w+ to \w+\):/);
  assert.match(report.text, /  feat: three\n  fix: one\nRun: node cli\.js update$/);
  assert.doesNotMatch(report.text, /docs: two/);
  assert.equal(r.head(r.clone), before);
  const current = repos();
  assert.match(checkUpdatesReport(current.clone).text, /^Up to date/);
});

await test("doctor's updates line says the behaviour, when, and what", () => {
  const auto = { mode: "auto", source: "default" };
  assert.equal(updatesLine(null, auto, NOW), "updates: auto (default), never checked");
  assert.equal(updatesLine({ checkedAt: NOW - 3 * 3_600_000, ok: true, outcome: "current" }, auto, NOW), "updates: auto (default), checked 3h ago: up to date");
  assert.equal(
    updatesLine({ checkedAt: NOW - 20 * 3_600_000, ok: true, outcome: "ready", arrived: { features: 1, fixes: 2 } }, { mode: "notify", source: "file" }, NOW),
    "updates: notify, checked 20h ago: 1 feature, 2 fixes ready"
  );
  assert.equal(updatesLine({ checkedAt: NOW, ok: true, outcome: "blocked", blockedBy: "local edits" }, auto, NOW), "updates: auto (default), checked under an hour ago: blocked by local edits");
  assert.equal(updatesLine(null, { mode: "off", source: "file" }, NOW), "updates: off, not checking");
});
