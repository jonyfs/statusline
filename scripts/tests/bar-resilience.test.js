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
  const { rmSync } = await import("node:fs");
  const repo = mkdtempSync(pathMod.join(os.tmpdir(), "sl-079-git-"));
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "one");
  const home = makeHome();
  await withHome(home, async () => {
    const now = Date.now();
    assert.equal(getGitInfo(repo, { now })?.branch, "main");
    const key = repoKey(repo);
    const ranAt = readEntry(key, "gitReuse").at;
    // Inside the window with HEAD and the index unchanged: the snapshot is reused,
    // so a new untracked file is not seen yet and git did not run.
    writeFileSync(pathMod.join(repo, "untracked.txt"), "x");
    const reused = getGitInfo(repo, { now: now + 2_000 });
    assert.equal(reused?.branch, "main");
    assert.equal(reused?.untracked, 0, "the reused snapshot is the earlier one");
    assert.equal(readEntry(key, "gitReuse").at, ranAt, "git was not run again");
    // A branch switch rewrites HEAD: seen on the very next redraw.
    git("checkout", "-q", "-b", "feature");
    assert.equal(getGitInfo(repo, { now: now + 4_000 })?.branch, "feature");
    // Past the window, git runs again and sees the untracked file.
    const later = getGitInfo(repo, { now: now + 4_000 + GIT_REUSE_MS });
    assert.equal(later.untracked, 1, "the edit shows after the window");
    assert.equal(gitSignature(pathMod.join(os.tmpdir())), null, "no repository, no reuse");
    // An empty commit and a soft reset touch neither HEAD nor the index, but
    // both append to the reflog, so the signature still moves.
    const before = gitSignature(repo);
    await new Promise((r) => setTimeout(r, 15));
    git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "two");
    const afterEmpty = gitSignature(repo);
    assert.notEqual(afterEmpty, before, "an empty commit moves the signature");
    await new Promise((r) => setTimeout(r, 15));
    git("reset", "-q", "--soft", "HEAD~1");
    assert.notEqual(gitSignature(repo), afterEmpty, "a soft reset moves the signature");
    // A linked worktree: .git is a file naming its own git directory.
    const wt = pathMod.join(repo, "..", pathMod.basename(repo) + "-wt");
    git("worktree", "add", "-q", "-b", "side", wt);
    try {
      const sig = gitSignature(wt);
      assert.match(sig, /worktrees/, "the worktree's own git directory");
      execFileSync("git", ["-C", wt, "checkout", "-q", "-b", "side2"], { stdio: "pipe" });
      assert.notEqual(gitSignature(wt), sig, "a checkout in the worktree moves its signature");
      const bogus = mkdtempSync(pathMod.join(os.tmpdir(), "sl-079-bogus-"));
      try {
        writeFileSync(pathMod.join(bogus, ".git"), "not a gitdir line\n");
        assert.equal(gitSignature(bogus), null, "a malformed .git file means no reuse");
      } finally {
        rmSync(bogus, { recursive: true, force: true });
      }
    } finally {
      rmSync(wt, { recursive: true, force: true });
    }
  });
  rmSync(repo, { recursive: true, force: true });
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

await test("with CLAUDE_STATUSLINE_NERD_WIDTH=2 every Nerd icon counts two columns and no line passes the width (FR-018, SC-006)", async () => {
  const { renderPayload } = await import("../../src/render.js");
  const { fullPayload, emptySources } = await import("./fixtures/sources.js");
  const saved = process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
  try {
    process.env.CLAUDE_STATUSLINE_NERD_WIDTH = "2";
    assert.equal(displayWidth("\u{F0150}\u{F492}"), 4, "plane 15 and BMP icons, two each");
    assert.equal(displayWidth("ab"), 2, "ordinary text unchanged");
    const src = { ...emptySources, getHelpPage: () => "/x/help/index.html" };
    for (let width = 60; width <= 300; width += 20) {
      process.env.CLAUDE_STATUSLINE_NERD_WIDTH = "2";
      const out = stripAll(renderPayload(fullPayload(), { sources: src, trackChanges: false, maxWidth: width, maxHeight: 40 }));
      assert.match(out, /\u{F0150} /u, "each icon is followed by the space that gives it its second cell");
      // What the terminal advances: one cell per icon and one for its space.
      delete process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
      for (const line of out.split("\n")) assert.ok(displayWidth(line) <= width, `${displayWidth(line)} > ${width}: ${line}`);
    }
    process.env.CLAUDE_STATUSLINE_NERD_WIDTH = "2";
    process.env.CLAUDE_STATUSLINE_NERD_WIDTH = "3";
    assert.equal(displayWidth("\u{F0150}"), 1, "any other value is ignored");
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
    else process.env.CLAUDE_STATUSLINE_NERD_WIDTH = saved;
  }
});

await test("doctor names the terminal's font when it can, and the icon width rule (FR-018)", async () => {
  const { iconStatus, terminalFont } = await import("../../src/doctor.js");
  const read = () => "theme = x\nfont-family = Hack Nerd Font Mono\n";
  const font = terminalFont({ TERM_PROGRAM: "ghostty" }, { home: "/h", read });
  assert.equal(font, "Hack Nerd Font Mono");
  assert.equal(terminalFont({ TERM_PROGRAM: "iTerm.app" }, { home: "/h", read }), null, "only a terminal whose config is known");
  assert.match(iconStatus({}, { font }).line, /font Hack Nerd Font Mono; icons counted 1 column, as a Nerd Font Mono draws them \(set CLAUDE_STATUSLINE_NERD_WIDTH=2 if icons overlap\)/);
  assert.match(iconStatus({ CLAUDE_STATUSLINE_NERD_WIDTH: "2" }, { font: null }).line, /icons counted 2 columns/);
  assert.match(iconStatus({ CLAUDE_STATUSLINE_NERD_WIDTH: "wide" }, { font: null }).line, /"wide" ignored/);
  assert.doesNotMatch(iconStatus({ CLAUDE_STATUSLINE_ICONS: "plain" }, { font }).line, /columns/, "only the Nerd tier has the rule");
});

await test("a margin narrows the line and never widens a tiny window (FR-011)", async () => {
  const { terminalFor } = await import("../../src/layout.js");
  const none = () => null;
  assert.equal(terminalFor("claude", { env: { COLUMNS: "12", CLAUDE_STATUSLINE_WIDTH_MARGIN: "2" }, platform: "darwin", readTty: none }).columns, 12);
  assert.equal(terminalFor("claude", { env: { COLUMNS: "21", CLAUDE_STATUSLINE_WIDTH_MARGIN: "4" }, platform: "darwin", readTty: none }).columns, 20);
  // Claude Code with no COLUMNS but a terminal: the terminal, rows unset.
  assert.deepEqual(terminalFor("claude", { env: {}, platform: "darwin", readTty: () => ({ columns: 117, rows: 40 }) }), { columns: 117, rows: Infinity, source: "tty" });
});

await test("inside Claude Code the footer's 4 columns of padding come off COLUMNS, so the help chip is not the part cut", async () => {
  const { terminalFor, CLAUDE_FOOTER_INSET } = await import("../../src/layout.js");
  const none = () => null;
  const host = { COLUMNS: "143", LINES: "78", CLAUDE_PROJECT_DIR: "/p" };
  assert.equal(CLAUDE_FOOTER_INSET, 4);
  assert.deepEqual(terminalFor("claude", { env: host, platform: "darwin", readTty: none }), { columns: 139, rows: 78, source: "COLUMNS", inset: 4 });
  // The margin stacks on top of the inset.
  assert.equal(terminalFor("claude", { env: { ...host, CLAUDE_STATUSLINE_WIDTH_MARGIN: "3" }, platform: "darwin", readTty: none }).columns, 136);
  // A tiny window is never widened, and 20 columns stay when there are more.
  assert.equal(terminalFor("claude", { env: { ...host, COLUMNS: "12" }, platform: "darwin", readTty: none }).columns, 12);
  assert.equal(terminalFor("claude", { env: { ...host, COLUMNS: "22" }, platform: "darwin", readTty: none }).columns, 20);
  // Run by hand (no CLAUDE_PROJECT_DIR), COLUMNS is the room: unchanged.
  assert.equal(terminalFor("claude", { env: { COLUMNS: "143" }, platform: "darwin", readTty: none }).columns, 143);
  // Copilot keeps its own rule.
  assert.equal(terminalFor("copilot", { env: host, platform: "darwin", readTty: none }).columns, 143);
  const { terminalReport, terminalLine } = await import("../../src/doctor.js");
  assert.match(terminalLine(terminalReport("claude", { env: host, platform: "darwin", readTty: none })), /139 columns \(.*less 4 for Claude Code's footer padding\)/);
});

await test("a pinned chip that yields keeps the shorter text the fit chose (FR-012)", () => {
  const model = seg("model", " Opus 5 (1M context) ", 92);
  const pinned = seg("help", " a long pinned label ", 95, { pinned: true, variants: [" p "] });
  const width = rowWidth([model]) + 2;
  const fitted = fitToWidth([model, pinned], width);
  assert.ok(rowWidth(fitted) <= width, `row is ${rowWidth(fitted)} columns in ${width}`);
});

await test("doctor names the smaller-width rule and the margin", async () => {
  const { terminalLine } = await import("../../src/doctor.js");
  assert.match(
    terminalLine({ columns: 140, columnsSource: "min(tty,COLUMNS)", margin: 3, rows: 20 }),
    /140 columns \(the smaller of COLUMNS and \/dev\/tty, which disagree; less a margin of 3 \(CLAUDE_STATUSLINE_WIDTH_MARGIN\)\), 20 rows/
  );
});

await test("the Ghostty font is the first of its list, after any reset, with control characters removed", async () => {
  const { terminalFont } = await import("../../src/doctor.js");
  const pathMod = await import("node:path");
  const only = (want, text) => (p) => {
    if (p !== want) throw new Error("ENOENT");
    return text;
  };
  const xdg = pathMod.join("/x", "ghostty", "config");
  assert.equal(terminalFont({ TERM: "xterm-ghostty", XDG_CONFIG_HOME: "/x" }, { home: "/h", read: only(xdg, "font-family = A\nfont-family = B\n") }), "A");
  assert.equal(terminalFont({ TERM_PROGRAM: "ghostty" }, { home: "/h", read: only(pathMod.join("/h", ".config", "ghostty", "config"), 'font-family = A\nfont-family = ""\nfont-family = C\n') }), "C");
  const mac = pathMod.join("/h", "Library", "Application Support", "com.mitchellh.ghostty", "config");
  const cleaned = terminalFont({ TERM_PROGRAM: "ghostty" }, { home: "/h", read: only(mac, "font-family = Mac\u001b[31mRed\n") });
  assert.ok(cleaned.startsWith("Mac") && !/[\u0000-\u001f]/.test(cleaned), `no control characters: ${JSON.stringify(cleaned)}`);
});

await test("agent rows fall back to 80 when COLUMNS is not a width (FR-013)", async () => {
  const saved = process.env.COLUMNS;
  const home = makeHome();
  try {
    await withHome(home, async () => {
      const task = { id: "t1", name: "explore", type: "agent", description: "Finding the auth code in a long description that has room to grow on a wide window", startTime: NOW - 135_000, model: "claude-haiku-4-5", contextWindowSize: 200000, tokenCount: 40000 };
      const input = JSON.stringify({ tasks: [task] });
      delete process.env.COLUMNS;
      const unset = await runTaskRows({ now: NOW, input });
      for (const bad of ["abc", "0", "12.5"]) {
        process.env.COLUMNS = bad;
        assert.equal(await runTaskRows({ now: NOW, input }), unset, `COLUMNS=${bad}`);
      }
    });
  } finally {
    if (saved === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = saved;
  }
});

await test("CLAUDE_STATUSLINE_DEBUG=1 writes the width inputs, and a terminal that cannot be read does not fail the redraw (FR-010)", async () => {
  const { renderPayload } = await import("../../src/render.js");
  const { emptySources } = await import("./fixtures/sources.js");
  const { stateRoot } = await import("../../src/paths.js");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const home = makeHome();
  const saved = process.env.CLAUDE_STATUSLINE_DEBUG;
  try {
    await withHome(home, async () => {
      process.env.CLAUDE_STATUSLINE_DEBUG = "1";
      const failing = () => {
        throw new Error("ENXIO");
      };
      const out = renderPayload({}, { sources: { ...emptySources, readTty: failing }, trackChanges: false });
      assert.ok(out.length > 0, "the bar still draws");
      const record = JSON.parse(fs.readFileSync(pathMod.join(stateRoot(), "debug-last-env.json"), "utf8"));
      assert.equal(record.tty, null);
      assert.ok(["COLUMNS", "default", "tty", "min(tty,COLUMNS)"].includes(record.chosen.source));
    });
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_STATUSLINE_DEBUG;
    else process.env.CLAUDE_STATUSLINE_DEBUG = saved;
  }
});

await test("the compile cache lives in the plugin's own state directory, private (FR-004)", async () => {
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const pathMod = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const cli = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
  const home = makeHome();
  const env = { ...process.env, HOME: home.dir, USERPROFILE: home.dir };
  delete env.CLAUDE_STATUSLINE_PASSIVE;
  delete env.XDG_STATE_HOME;
  spawnSync(process.execPath, [cli, "render"], { input: "{}", env, encoding: "utf8" });
  if (typeof (await import("node:module")).enableCompileCache !== "function") return; // older Node: nothing to check
  // Wherever the child put its state, it is under this throwaway home and not in the system temp folder.
  const found = fs.readdirSync(home.dir, { recursive: true }).map(String).filter((f) => f.endsWith("compile-cache"));
  assert.equal(found.length, 1, `compile-cache under the home: ${JSON.stringify(found)}`);
  const dir = pathMod.join(home.dir, found[0]);
  if (process.platform !== "win32") assert.equal(fs.statSync(dir).mode & 0o777, 0o700, "private to the user");
});

await test("under NERD_WIDTH=2 the space goes on the finished output only: agent rows get it, and the right-aligned chip still meets the edge (FR-018)", async () => {
  const { renderPayload } = await import("../../src/render.js");
  const { fullPayload, emptySources } = await import("./fixtures/sources.js");
  const { padNerdIcons } = await import("../../src/theme.js");
  const saved = process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
  const home = makeHome();
  try {
    process.env.CLAUDE_STATUSLINE_NERD_WIDTH = "2";
    assert.equal(padNerdIcons("a\u{F40C}bc"), "a\u{F40C} bc", "icons padded, Powerline separators not");
    // An agent row at 90 % draws the critical mark: it gets its space too.
    await withHome(home, async () => {
      const task = { id: "t1", name: "explore", type: "agent", description: "Busy", startTime: NOW - 135_000, model: "claude-haiku-4-5", contextWindowSize: 200000, tokenCount: 180000 };
      const out = await runTaskRows({ now: NOW, input: JSON.stringify({ columns: 160, tasks: [task] }) });
      const content = stripAll(JSON.parse(out.split("\n")[0]).content);
      assert.match(content, /\u{F40C} /u, "the critical mark has the space after it");
    });
    // The help chip is pinned to the right edge: measured as the terminal
    // advances (icon one cell, its space one), the last line is the full width.
    const width = 140;
    const src = { ...emptySources, getHelpPage: () => "/x/help/index.html" };
    const drawn = stripAll(renderPayload(fullPayload(), { sources: src, trackChanges: false, maxWidth: width, maxHeight: 40 }));
    delete process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
    const last = drawn.split("\n").pop();
    assert.ok(displayWidth(last) <= width, `no wider than the window: ${displayWidth(last)}`);
    assert.ok(displayWidth(last.trimEnd()) >= width - 2, `the help chip reaches the edge: ${displayWidth(last.trimEnd())} of ${width}`);
    // Only the separator that closes the chip may follow it, as in help-page.test.js.
    assert.match(last.trimEnd(), /\u{F059}\s*[\uE0B0-\uE0BF>]?$/u, "the help glyph is the last thing on the line");
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_STATUSLINE_NERD_WIDTH;
    else process.env.CLAUDE_STATUSLINE_NERD_WIDTH = saved;
  }
});
