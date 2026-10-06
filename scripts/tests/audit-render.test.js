/**
 * Regressions from the 2026-10 audit that live in the renderer
 * (specs/032-audit-fixes). Each case names the finding it pins.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import * as render from "../../src/render.js";
const { renderPayload, gather, GLYPHS } = render;
const hereOf = (...args) => render.hereOf(...args);
import { collectRuns, parseProcesses } from "../../src/gateRuns.js";
import { displayWidth } from "../../src/theme.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const LIMIT = 120;

const lineOne = (out) => stripAnsi(out).split("\n")[0];

// #1 -------------------------------------------------------------------------

const busy = {
  ...gitSources({ changed: 1, ahead: 3, behind: 2 }),
  getRemoteUrl: () => "https://github.com/owner/repo",
  getPrInfo: () => ({ number: 42, state: "OPEN", isDraft: false, url: "https://github.com/owner/repo/pull/42" }),
  getCiStatus: () => ({ status: "completed", conclusion: "failure", workflow: "CI" }),
};
const renderDir = (name, maxWidth = LIMIT) =>
  renderPayload({ cwd: `/tmp/${name}` }, { sources: busy, trackChanges: false, now: NOW, maxWidth, maxHeight: 40 });

await test("#1 a long directory gives up its own columns before the PR and CI are shed", () => {
  const line = lineOne(renderDir("d".repeat(90)));
  assert.match(line, /PR #42/, `the PR survived: ${JSON.stringify(line)}`);
  assert.match(line, /CI/, "and the CI chip");
  assert.match(line, /…d+/, "because the directory was cut from the left");
  assert.ok(displayWidth(line) <= LIMIT, `line 1 is ${displayWidth(line)} columns`);
});

await test("#1 a directory wider than the line is shortened, never dropped in favour of the branch", () => {
  const line = lineOne(renderDir("e".repeat(130)));
  assert.match(line, /…e+/, `the directory is still there: ${JSON.stringify(line)}`);
  assert.match(line, /main/, "beside the branch");
  assert.ok(displayWidth(line) <= LIMIT, `line 1 is ${displayWidth(line)} columns`);
});

await test("#1 a short directory is left alone", () => {
  assert.match(lineOne(renderDir("short")), /short .*PR #42/);
});

// #27 (the trimFromLeft half) ------------------------------------------------

await test("#27 a cut directory reserves the ellipsis's measured width, Ambiguous-wide included", () => {
  process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = "1";
  try {
    const out = renderPayload({ cwd: `/tmp/${"f".repeat(60)}` }, { sources: emptySources, trackChanges: false, now: NOW, maxWidth: 30, maxHeight: 40 });
    const line = lineOne(out);
    assert.ok(line.includes("…"), "the label was shortened");
    assert.ok(displayWidth(line) <= 30, `line 1 is ${displayWidth(line)} columns`);
  } finally {
    delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  }
});

// #2 -------------------------------------------------------------------------

await test("#2 a 7-day reset in milliseconds reads as unknown, not as a confident date", () => {
  const payload = fullPayload({
    now: NOW,
    rate_limits: {
      five_hour: { used_percentage: 20, resets_at: Math.floor(NOW / 1000) + 3600 },
      seven_day: { used_percentage: 40, resets_at: NOW + 3 * 86400 * 1000 },
    },
  });
  const out = stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 }));
  const chip = out.split("\n").find((l) => l.includes("7d 40%"));
  assert.ok(chip, "the 7-day chip is drawn");
  assert.match(chip, /7d 40% · \? /, `the reset is '?': ${JSON.stringify(chip)}`);
});

// #3 -------------------------------------------------------------------------

const withRepo = (repo) =>
  renderPayload(
    { cwd: "/tmp/statusline", workspace: { current_dir: "/tmp/statusline", repo } },
    { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40 }
  );

await test("#3 a repo identity that is not text renders nothing rather than [object Object]", () => {
  const out = stripAnsi(withRepo({ host: "github.com", owner: { x: 1 }, name: "r" }));
  assert.doesNotMatch(out, /object Object/);
  assert.doesNotMatch(out, /https:\/\/github\.com\/\[object/);
});

await test("#3 control characters in the repo identity add no lines and no escapes", () => {
  const clean = withRepo({ host: "github.com", owner: "a", name: "r" });
  const dirty = withRepo({ host: "github.com", owner: "a\nb", name: "r\u001b[31m" });
  assert.equal(dirty.split("\n").length, clean.split("\n").length, "the bar keeps its line count");
  assert.ok(!dirty.includes("\u001b[31m"), "the payload's escape does not reach the terminal");
  assert.match(stripAnsi(dirty), /a b\/r \[31m/, "what is printable survives");
});

// #4 -------------------------------------------------------------------------

await test("#4 the branch link encodes the branch name, keeping its slashes", () => {
  const out = renderPayload(
    { cwd: "/tmp/statusline" },
    {
      sources: { ...gitSources({ branch: "fix/#12 50%" }), getRemoteUrl: () => "https://github.com/o/r" },
      trackChanges: false,
      now: NOW,
      maxWidth: 200,
      maxHeight: 40,
    }
  );
  assert.ok(out.includes("\x1b]8;;https://github.com/o/r/tree/fix/%2312%2050%25\x07"), "encoded per path segment");
});

// #6 and #28 -------------------------------------------------------------------

await test("#6 a run stores its worktree's resolved path", () => {
  const procs = parseProcesses(["1 0 00:10 git commit", "2 1 00:10 bash .githooks/pre-commit"].join("\n"));
  const runs = collectRuns({
    worktrees: [{ path: "/tmp/r", real: "/private/tmp/r", branch: "main" }],
    procs,
    cwdOf: () => "/private/tmp/r",
    now: NOW,
  });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].path, "/private/tmp/r");
  assert.equal(runs[0].worktree, "r");
});

await test("#6 the session's worktree is found through a symlinked cwd", () => {
  // Creating a symlink on Windows needs a privilege a test runner rarely has.
  if (process.platform === "win32") return;
  const base = realpathSync(mkdtempSync(path.join(os.tmpdir(), "statusline-here-")));
  const realTree = path.join(base, "real", "r");
  mkdirSync(path.join(realTree, "sub"), { recursive: true });
  symlinkSync(path.join(base, "real"), path.join(base, "link"));
  const viaLink = path.join(base, "link", "r", "sub");
  const runs = [{ pid: 1, path: realTree }];
  assert.equal(hereOf(runs, viaLink), realTree, "a cwd under a symlink still matches");
  // And the other way round: a cache written before runs stored the resolved
  // path, holding the symlinked one, against a resolved cwd.
  assert.equal(hereOf([{ pid: 1, path: path.join(base, "link", "r") }], path.join(realTree, "sub")), path.join(base, "link", "r"));
  assert.equal(hereOf(runs, path.join(base, "real", "rr")), null, "a sibling sharing a prefix is not inside");
});

await test("#28 on Windows, git's forward slashes and drive-letter case still match the payload cwd", () => {
  const runs = [{ pid: 1, path: "C:/work/repo" }, { pid: 2, path: "C:/work/repo-wt" }];
  assert.equal(hereOf(runs, "c:\\work\\repo\\src", { platform: "win32" }), "C:/work/repo");
  assert.equal(hereOf(runs, "C:\\Work\\Repo-WT", { platform: "win32" }), "C:/work/repo-wt");
  assert.equal(hereOf(runs, "D:\\work\\repo", { platform: "win32" }), null);
});

// #7 -------------------------------------------------------------------------

await test("#7 a switched-off gates segment never reads or refreshes the gate cache", () => {
  let calls = 0;
  const sources = { ...gitSources(), getCiStatus: () => null, getGateRuns: () => (calls++, []) };
  const layout = { arrangement: { version: 1, segments: { gates: { on: false } } }, origin: "test", path: null, error: null };
  renderPayload({ cwd: "/tmp/statusline" }, { sources, layout, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });
  assert.equal(calls, 0, "the probe was not asked");
  const readings = gather({ cwd: "/tmp/statusline" }, { ...emptySources, ...sources }, { now: NOW, off: new Set(["gates"]) });
  assert.equal(calls, 0);
  assert.equal(readings.gates.value, null);
  renderPayload({ cwd: "/tmp/statusline" }, { sources, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });
  assert.equal(calls, 1, "and is asked again once the segment is on");
});

// #25 ------------------------------------------------------------------------

await test("#25 the CI running mark is the progress clock the evidence sheet shows", () => {
  // specs/031-git-gate-rows/glyph-evidence.png: F0996 draws a clock, F0997 a
  // download arrow.
  assert.equal(GLYPHS.nerd.ciRunning.codePointAt(0), 0xf0996);
});

// #26 ------------------------------------------------------------------------

// East Asian Ambiguous code points in U+2000-U+2BFF, from the Unicode 16
// EastAsianWidth table. Hard-coded rather than taken from `displayWidth`, which
// only knows the characters someone remembered to list (#26).
const AMBIGUOUS_RANGES = [
  [0x2010, 0x2010], [0x2013, 0x2016], [0x2018, 0x2019], [0x201c, 0x201d], [0x2020, 0x2022], [0x2024, 0x2027],
  [0x2030, 0x2030], [0x2032, 0x2033], [0x2035, 0x2035], [0x203b, 0x203b], [0x203e, 0x203e], [0x2074, 0x2074],
  [0x207f, 0x207f], [0x2081, 0x2084], [0x20ac, 0x20ac], [0x2103, 0x2103], [0x2105, 0x2105], [0x2109, 0x2109],
  [0x2113, 0x2113], [0x2116, 0x2116], [0x2121, 0x2122], [0x2126, 0x2126], [0x212b, 0x212b], [0x2153, 0x2154],
  [0x215b, 0x215e], [0x2160, 0x216b], [0x2170, 0x2179], [0x2189, 0x2189], [0x2190, 0x2199], [0x21b8, 0x21b9],
  [0x21d2, 0x21d2], [0x21d4, 0x21d4], [0x21e7, 0x21e7], [0x2200, 0x2200], [0x2202, 0x2203], [0x2207, 0x2208],
  [0x220b, 0x220b], [0x220f, 0x220f], [0x2211, 0x2211], [0x2215, 0x2215], [0x221a, 0x221a], [0x221d, 0x2220],
  [0x2223, 0x2223], [0x2225, 0x2225], [0x2227, 0x222c], [0x222e, 0x222e], [0x2234, 0x2237], [0x223c, 0x223d],
  [0x2248, 0x2248], [0x224c, 0x224c], [0x2252, 0x2252], [0x2260, 0x2261], [0x2264, 0x2267], [0x226a, 0x226b],
  [0x226e, 0x226f], [0x2282, 0x2283], [0x2286, 0x2287], [0x2295, 0x2295], [0x2299, 0x2299], [0x22a5, 0x22a5],
  [0x22bf, 0x22bf], [0x2312, 0x2312], [0x2460, 0x24e9], [0x24eb, 0x254b], [0x2550, 0x2573], [0x2580, 0x258f],
  [0x2592, 0x2595], [0x25a0, 0x25a1], [0x25a3, 0x25a9], [0x25b2, 0x25b3], [0x25b6, 0x25b7], [0x25bc, 0x25bd],
  [0x25c0, 0x25c1], [0x25c6, 0x25c8], [0x25cb, 0x25cb], [0x25ce, 0x25d1], [0x25e2, 0x25e5], [0x25ef, 0x25ef],
  [0x2605, 0x2606], [0x2609, 0x2609], [0x260e, 0x260f], [0x261c, 0x261c], [0x261e, 0x261e], [0x2640, 0x2640],
  [0x2642, 0x2642], [0x2660, 0x2661], [0x2663, 0x2665], [0x2667, 0x266a], [0x266c, 0x266d], [0x266f, 0x266f],
  [0x269e, 0x269f], [0x26bf, 0x26bf], [0x26c6, 0x26cd], [0x26cf, 0x26d3], [0x26d5, 0x26e1], [0x26e3, 0x26e3],
  [0x26e8, 0x26e9], [0x26eb, 0x26f1], [0x26f4, 0x26f4], [0x26f6, 0x26f9], [0x26fb, 0x26fc], [0x26fe, 0x26ff],
  [0x273d, 0x273d], [0x2776, 0x277f], [0x2b56, 0x2b59],
];

await test("#26 every no-Nerd-Font glyph is East Asian Narrow by the Unicode table", () => {
  for (const [name, glyph] of Object.entries(GLYPHS.plain)) {
    for (const ch of glyph) {
      const cp = ch.codePointAt(0);
      const hex = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
      assert.ok((cp >= 0x21 && cp <= 0x7e) || (cp >= 0x2000 && cp <= 0x2bff), `${name} (${hex}) is outside the checked blocks`);
      assert.ok(!AMBIGUOUS_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi), `${name} (${hex}) is East Asian Ambiguous`);
    }
  }
});
