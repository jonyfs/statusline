import assert from "node:assert/strict";
import os from "node:os";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { GLYPHS, gather, renderReadings } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const cp = (n) => String.fromCodePoint(n);
const opts = { ...RENDER_OPTIONS, maxWidth: 360, maxHeight: 40 };
const pool = (payload = PAYLOAD) =>
  renderReadings(gather(payload, { ...SOURCES }, { now: FIXED_NOW * 1000 }), payload, { ...opts, asPool: true });
const textOf = (entries, key) => entries.find((e) => e.key === key)?.text ?? null;

const NERD = {
  dir: 0xf4d4, home: 0xf02dc, repo: 0xf401, worktree: 0xe5fb,
  effortLow: 0xf0875, effortMedium: 0xf029a, effortHigh: 0xf0874,
  fast: 0xf140b, timer: 0xf051f, duration: 0xf520, rtk: 0xf1679,
  pr: 0xf407, prDraft: 0xf4dd, prMerged: 0xf419, prClosed: 0xf4dc,
  reviewApproved: 0xf4a4, reviewComments: 0xf442, reviewRequested: 0xf441,
  push: 0xf431, pull: 0xf433, conflict: 0xf40c, removed: 0xf458,
};

const PLAIN = {
  home: "⌂", repo: "⊡", worktree: "⎇", removed: "-", untracked: "?",
  prDraft: "⇄", prMerged: "⇄", prClosed: "⇄",
  reviewApproved: "✓", reviewComments: "✉", reviewRequested: "⊛",
};

await test("the nerd and plain tables have the same keys", () => {
  assert.deepEqual(Object.keys(GLYPHS.nerd).sort(), Object.keys(GLYPHS.plain).sort());
});

await test("every codepoint the review chose is in the table", () => {
  for (const [key, code] of Object.entries(NERD)) {
    assert.equal(GLYPHS.nerd[key], cp(code), `${key} is U+${code.toString(16).toUpperCase()}`);
  }
  assert.equal(GLYPHS.nerd.untracked, "?", "untracked is text");
});

await test("the plain substitutes are the ones the review names", () => {
  for (const [key, glyph] of Object.entries(PLAIN)) assert.equal(GLYPHS.plain[key], glyph, key);
});

await test("every new nerd glyph is one column, with and without Ambiguous wide", () => {
  const before = process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  try {
    for (const wide of ["", "1"]) {
      if (wide) process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = wide;
      else delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
      for (const key of Object.keys(NERD)) assert.equal(displayWidth(GLYPHS.nerd[key]), 1, `nerd.${key} wide=${wide}`);
      for (const key of Object.keys(PLAIN)) assert.equal(displayWidth(GLYPHS.plain[key]), 1, `plain.${key} wide=${wide}`);
    }
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
    else process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = before;
  }
});

await test("the preview extractor has an outline for every private-use glyph in the table", () => {
  const glyphs = JSON.parse(readFileSync(new URL("../../src/preview/glyphs.json", import.meta.url), "utf8")).glyphs;
  const missing = [];
  for (const [key, glyph] of Object.entries(GLYPHS.nerd)) {
    const code = glyph.codePointAt(0);
    const private_ = (code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xffffd);
    if (!private_) continue;
    const hex = code.toString(16).toUpperCase().padStart(4, "0");
    if (!glyphs[hex]) missing.push(`${key} U+${hex}`);
  }
  assert.deepEqual(missing, []);
});

await test("the directory, repository and worktree chips lead with their glyphs", () => {
  const p = pool();
  assert.ok(textOf(p, "dir").trimStart().startsWith(GLYPHS.nerd.dir));
  assert.ok(textOf(p, "repo").trimStart().startsWith(GLYPHS.nerd.repo));
  assert.ok(textOf(p, "worktree").trimStart().startsWith(GLYPHS.nerd.worktree));
});

await test("the home directory gets the house", () => {
  const home = os.homedir();
  const payload = { ...PAYLOAD, cwd: home, workspace: { ...PAYLOAD.workspace, current_dir: home } };
  assert.ok(textOf(pool(payload), "dir").trimStart().startsWith(GLYPHS.nerd.home));
});

await test("a pull request draws its state and its review", () => {
  const withReview = (review_state) => ({ ...PAYLOAD, pr: { ...PAYLOAD.pr, review_state } });
  const icon = (state) => textOf(pool(withReview(state)), "pr").trimStart();
  assert.ok(icon("approved").startsWith(GLYPHS.nerd.pr));
  assert.ok(icon("approved").includes(GLYPHS.nerd.reviewApproved));
  assert.ok(icon("draft").startsWith(GLYPHS.nerd.prDraft));
  assert.ok(icon("merged").startsWith(GLYPHS.nerd.prMerged));
  assert.ok(icon("closed").startsWith(GLYPHS.nerd.prClosed));
  assert.ok(icon("commented").includes(GLYPHS.nerd.reviewComments));
  assert.ok(icon("review_required").includes(GLYPHS.nerd.reviewRequested));
});

await test("effort draws the glyph of its level, and the high one for the rest", () => {
  const effort = (level) => textOf(pool({ ...PAYLOAD, effort: { level } }), "effort");
  assert.ok(effort("low").includes(GLYPHS.nerd.effortLow));
  assert.ok(effort("medium").includes(GLYPHS.nerd.effortMedium));
  assert.ok(effort("high").includes(GLYPHS.nerd.effortHigh));
  assert.ok(effort("xhigh").includes(GLYPHS.nerd.effortHigh));
});

await test("untracked files are counted with a question mark", () => {
  const p = textOf(pool(), "worktreeState");
  assert.ok(p.includes("? "), `state was ${JSON.stringify(p)}`);
  assert.ok(!p.includes(GLYPHS.nerd.added), "the added box is not used for untracked");
});
