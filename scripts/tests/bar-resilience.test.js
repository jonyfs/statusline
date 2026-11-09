/**
 * specs/079-bar-resilience: the width rules, the pinned chip at the edge of
 * the room, the glyph sharing allow-list, the Nerd width switch, and the
 * state written only when it changes.
 */
import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { fitToWidth, rowWidth } from "../../src/layout.js";
import { runTaskRows } from "../../src/taskRows.js";
import { displayWidth } from "../../src/theme.js";
import { makeHome, withHome } from "./fixtures/home.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const stripAll = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

const seg = (key, text, priority, extra = {}) => ({ key, text, priority, color: "neutral", ...extra });

await test("a pinned chip yields when it cannot fit beside the most important chip, so the row never overflows (FR-012)", () => {
  const model = seg("model", " Opus 5 (1M context) ", 92);
  const help = seg("help", " ? ", 40, { pinned: true });
  const row = [model, help];
  // Room for the model alone, not for both.
  const width = rowWidth([model]) + 1;
  const fitted = fitToWidth(row, width);
  assert.ok(rowWidth(fitted) <= width, `row is ${rowWidth(fitted)} columns in ${width}`);
  assert.deepEqual(
    fitted.map((s) => s.key),
    ["model"],
    "the help chip gives way; the most important chip stays"
  );
  // With room for both, the pinned chip is still drawn and the others make room.
  const roomy = rowWidth(row);
  assert.deepEqual(fitToWidth([seg("rtk", " 27% saved ", 72), ...row], roomy).map((s) => s.key), ["model", "help"]);
});

await test("agent rows take the window's width from COLUMNS when the payload carries none (FR-013)", async () => {
  const task = (id, name) => ({
    id,
    name,
    type: "agent",
    description: "Finding the auth code in a long description that has room to grow on a wide window",
    startTime: NOW - 135_000,
    model: "claude-haiku-4-5",
    contextWindowSize: 200000,
    tokenCount: 40000,
  });
  // The rows shed columns to fit (Claude Code cuts what still overflows), so
  // the width shows in what survives: the token count is shed at 80 columns.
  const text = (out) => out.split("\n").filter(Boolean).map((l) => stripAll(JSON.parse(l).content)).join("\n");
  const home = makeHome();
  const saved = process.env.COLUMNS;
  try {
    await withHome(home, async () => {
      const input = JSON.stringify({ tasks: [task("t1", "explore"), task("t2", "review")] });
      process.env.COLUMNS = "160";
      const wide = text(await runTaskRows({ now: NOW, input }));
      delete process.env.COLUMNS;
      const narrow = text(await runTaskRows({ now: NOW, input }));
      assert.doesNotMatch(narrow, /40k/, "without COLUMNS the rows fit 80 and shed the token count");
      assert.match(wide, /40k/, "with COLUMNS=160 the rows keep it");
      assert.ok(Math.max(...wide.split("\n").map(displayWidth)) <= 160);
    });
  } finally {
    if (saved === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = saved;
  }
});

await test("a quiet repository is not asked again within the reuse window, and a branch switch is still seen at once (FR-006)", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const pathMod = await import("node:path");
  const { getGitInfo, gitSignature, GIT_REUSE_MS } = await import("../../src/git.js");
  const { readEntry, repoKey } = await import("../../src/cache.js");
  const repo = mkdtempSync(pathMod.join(os.tmpdir(), "sl-079-git-"));
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "one");
  const home = makeHome();
  await withHome(home, async () => {
    const now = Date.now();
    assert.equal(getGitInfo(repo, { now })?.branch, "main");
    const key = repoKey(repo);
    const ranAt = readEntry(key, "gitSig").at;
    // Inside the window with HEAD and the index unchanged: the snapshot is reused,
    // so a new untracked file is not seen yet and git did not run.
    writeFileSync(pathMod.join(repo, "untracked.txt"), "x");
    const reused = getGitInfo(repo, { now: now + 2_000 });
    assert.equal(reused?.branch, "main");
    assert.equal(reused?.untracked, 0, "the reused snapshot is the earlier one");
    assert.equal(readEntry(key, "gitSig").at, ranAt, "git was not run again");
    // A branch switch rewrites HEAD: seen on the very next redraw.
    git("checkout", "-q", "-b", "feature");
    assert.equal(getGitInfo(repo, { now: now + 4_000 })?.branch, "feature");
    // Past the window, git runs again and sees the untracked file.
    const later = getGitInfo(repo, { now: now + 4_000 + GIT_REUSE_MS });
    assert.equal(later.untracked, 1, "the edit shows after the window");
    assert.equal(gitSignature(pathMod.join(os.tmpdir())), null, "no repository, no reuse");
  });
});

await test("an idle session writes its state only when it changes; a working one still moves the spinner a frame a redraw (FR-003)", async () => {
  const { trackChanges } = await import("../../src/changeTracker.js");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const { stateRoot } = await import("../../src/paths.js");
  const home = makeHome();
  await withHome(home, async () => {
    const id = `t079-${process.pid}`;
    const t0 = 1_800_000_000_000;
    const first = trackChanges(id, { branch: "main" }, { now: t0, animating: false });
    const file = fs.readdirSync(stateRoot(), { recursive: true }).map(String).find((f) => f.includes(id));
    assert.ok(file, "the first redraw writes the state");
    const full = pathMod.join(stateRoot(), file);
    fs.utimesSync(full, new Date(1_000_000), new Date(1_000_000));
    const second = trackChanges(id, { branch: "main" }, { now: t0 + 2_000, animating: false });
    assert.equal(fs.statSync(full).mtimeMs, 1_000_000, "idle and unchanged: nothing written");
    assert.equal(first.frame, second.frame, "an idle spinner stands still");
    const working = trackChanges(id, { branch: "main" }, { now: t0 + 4_000, animating: true });
    assert.equal(working.frame, (second.frame + 1) % 4, "a working session advances one frame a redraw");
    fs.utimesSync(full, new Date(1_000_000), new Date(1_000_000));
    trackChanges(id, { branch: "feature" }, { now: t0 + 6_000, animating: false });
    assert.notEqual(fs.statSync(full).mtimeMs, 1_000_000, "a change is written");
  });
});

await test("within a tier a glyph has one meaning, outside the shared groups the tier declares (FR-015, FR-016)", async () => {
  const { GLYPHS, SHARED_GLYPHS } = await import("../../src/render.js");
  for (const [tier, glyphs] of Object.entries(GLYPHS)) {
    const groups = SHARED_GLYPHS[tier] ?? [];
    const groupOf = new Map();
    groups.forEach((g, i) => g.forEach((k) => groupOf.set(k, i)));
    const byGlyph = new Map();
    for (const [key, glyph] of Object.entries(glyphs)) byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), key]);
    for (const [glyph, keys] of byGlyph) {
      if (keys.length < 2) continue;
      const ids = new Set(keys.map((k) => groupOf.get(k)));
      assert.ok(!ids.has(undefined) && ids.size === 1, `${tier}: ${JSON.stringify(glyph)} means ${keys.join(", ")}`);
    }
    for (const group of groups) for (const k of group) assert.ok(k in glyphs, `${tier}: shared group names ${k}, which the tier lacks`);
  }
  // The four the audit found, each with a picture of its own now.
  assert.notEqual(GLYPHS.nerd.timer, GLYPHS.nerd.cacheWarmHalf);
  assert.notEqual(GLYPHS.nerd.mcp, GLYPHS.nerd.from);
  assert.notEqual(GLYPHS.emoji.timer, GLYPHS.emoji.cacheWarm);
  assert.notEqual(GLYPHS.emoji.unavailable, GLYPHS.emoji.prClosed);
  assert.notEqual(GLYPHS.plain.help, GLYPHS.plain.untracked);
});

await test("new glyphs keep their tier's width: one column in nerd and plain, two in emoji (FR-017)", async () => {
  const { GLYPHS } = await import("../../src/render.js");
  for (const [tier, key, cols] of [["nerd", "timer", 1], ["nerd", "mcp", 1], ["plain", "help", 1], ["emoji", "cacheWarm", 2], ["emoji", "unavailable", 2]]) {
    assert.equal(displayWidth(GLYPHS[tier][key]), cols, `${tier}.${key}`);
  }
});
