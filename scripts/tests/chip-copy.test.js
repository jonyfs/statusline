import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload, gather, renderReadings } from "../../src/render.js";
import { displayWidth, renderRow, PALETTES } from "../../src/theme.js";
import { formatDuration, shortCountdown } from "../../src/tokens.js";
import { abbreviateBranch, cutMiddle, DEFAULT_BRANCH_PREFIXES } from "../../src/names.js";
import { plainText } from "../../src/text.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const FIGURE_SPACE = " ";
const opts = { ...RENDER_OPTIONS, maxWidth: 360, maxHeight: 40 };
const pool = (payload = PAYLOAD) =>
  renderReadings(gather(payload, { ...SOURCES }, { now: FIXED_NOW * 1000 }), payload, { ...opts, asPool: true });
const chip = (key, payload) => pool(payload).find((e) => e.key === key);
const draw = (payload = PAYLOAD, extra = {}) =>
  renderPayload(payload, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 360, maxHeight: 40, ...extra });

const withPct = (pct) => ({
  ...PAYLOAD,
  context_window: { used_percentage: pct },
  rate_limits: { ...PAYLOAD.rate_limits, five_hour: { used_percentage: pct, resets_at: FIXED_NOW + 7740 } },
});

await test("long and short forms of the chips", () => {
  const forms = (key) => {
    const c = chip(key);
    return [c.text.trim(), ...(c.variants ?? []).map((v) => v.trim())];
  };
  const g = GLYPHS.nerd;
  const trackAt = (pct) => [0, 1, 2, 3, 4].map((i) => {
    const edge = i === 0 ? "Start" : i === 4 ? "End" : "Mid";
    return g[`track${pct >= (i + 0.5) * 20 ? "Full" : "Empty"}${edge}`];
  }).join("");
  assert.deepEqual(forms("context"), [
    `${g.context} ${trackAt(46)} ${FIGURE_SPACE}46%`,
    `${g.context} ${FIGURE_SPACE}46%`,
  ]);
  assert.deepEqual(forms("rtk"), [`${g.rtk} rtk 81% saved`, `${g.rtk} 81%`]);
  assert.deepEqual(forms("pr"), [
    `${g.pr} PR #128 ${g.reviewApproved} approved`,
    `${g.pr} #128 ${g.reviewApproved}`,
  ]);
  // 62% used with 57% of the window gone is five points ahead: ok, no note.
  assert.deepEqual(forms("fiveHour"), [
    `${g.timer} 5h ${trackAt(62)} ${FIGURE_SPACE}62% ${g.reset} 2h09`,
    `${g.timer} 5h ${FIGURE_SPACE}62% ${g.reset} 2h09`,
    `${g.timer} 5h ${FIGURE_SPACE}62%`,
  ]);
});

await test("a width that fits keeps the long form and a tight one steps down to the short", () => {
  const wide = strip(draw(PAYLOAD, { maxWidth: 360 }));
  assert.ok(/rtk 81% saved/.test(wide));
  const tight = strip(draw(PAYLOAD, { maxWidth: 90 }));
  for (const line of tight.split("\n")) assert.ok(displayWidth(line) <= 90, `${displayWidth(line)} wide`);
});

await test("the words the bar writes are lowercase", () => {
  const text = strip(draw(PAYLOAD));
  // Names from data are as sent; acronyms and units keep their case.
  const allowed = new Set(["PR", "MR", "CI", "AIC", "UTC", "NORMAL", "Opus", "Sonnet", "Haiku", "PR"]);
  const own = text.match(/\b[A-Z][a-z]+\b/g) ?? [];
  const stray = own.filter((w) => !allowed.has(w) && !["Opus"].includes(w));
  assert.deepEqual([...new Set(stray)], [], "capitalised words the bar wrote itself");
});

await test("a percentage keeps its width from one digit to three", () => {
  const widthOf = (pct) => {
    const c = chip("context", withPct(pct));
    return displayWidth(c.text);
  };
  assert.equal(widthOf(5), widthOf(50));
  // 100 is critical and carries the alert glyph, which takes the place of the
  // figure space a two-digit figure has, so a three-digit one is one wider.
  assert.ok(widthOf(100) <= widthOf(50) + 1, `${widthOf(100)} against ${widthOf(50)}`);
  const five = chip("context", withPct(5)).text;
  assert.ok(five.includes(`${FIGURE_SPACE}${FIGURE_SPACE}5%`));
  assert.ok(!chip("context", withPct(100)).text.includes(FIGURE_SPACE));
});

await test("durations drop the zero hour and the trailing m", () => {
  assert.equal(formatDuration(45 * 60_000), "45m");
  assert.equal(formatDuration(60 * 60_000), "1h00");
  assert.equal(formatDuration((2 * 60 + 9) * 60_000), "2h09");
  assert.equal(formatDuration(26 * 60 * 60_000), "26h00");
  const now = 1_000_000_000_000;
  assert.equal(shortCountdown((now + (2 * 60 + 9) * 60_000) / 1000, now), "2h09");
  assert.equal(shortCountdown((now + 45 * 60_000) / 1000, now), "45m");
  assert.equal(shortCountdown((now + 3 * 86400_000 + 3600_000) / 1000, now), "3d");
});

await test("a reset is introduced by the reset glyph, in each tier", () => {
  assert.ok(chip("fiveHour").text.includes(GLYPHS.nerd.reset));
  assert.ok(!chip("fiveHour").text.includes("·"));
  assert.equal(GLYPHS.plain.reset.length, 1);
  assert.equal(displayWidth(GLYPHS.emoji.reset), 2);
  const before = process.env.CLAUDE_STATUSLINE_ICONS;
  process.env.CLAUDE_STATUSLINE_ICONS = "emoji";
  try {
    assert.ok(chip("fiveHour").text.includes(GLYPHS.emoji.reset));
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_ICONS;
    else process.env.CLAUDE_STATUSLINE_ICONS = before;
  }
});

await test("model and effort sit on one background", () => {
  const p = pool();
  assert.equal(p.find((e) => e.key === "model").color, p.find((e) => e.key === "effort").color);
  assert.ok(chip("effort"), "effort keeps its own key");
});

await test("branch prefixes are abbreviated and a long name is cut in the middle", () => {
  assert.equal(abbreviateBranch("feature/login", DEFAULT_BRANCH_PREFIXES), "f/login");
  assert.equal(abbreviateBranch("fix/typo", DEFAULT_BRANCH_PREFIXES), "x/typo");
  assert.equal(abbreviateBranch("main", DEFAULT_BRANCH_PREFIXES), "main");
  assert.equal(abbreviateBranch("feature/", DEFAULT_BRANCH_PREFIXES), "feature/", "a bare prefix is left");
  assert.equal(abbreviateBranch("hotfix/a", { "hotfix/": "" }), "a", "an empty value removes the prefix");
  const cut = cutMiddle("f/004-statusline-redesign-research-notes", 28);
  assert.ok(displayWidth(cut) <= 28, `${displayWidth(cut)}`);
  assert.ok(cut.includes("…") && cut.startsWith("f/004") && cut.endsWith("notes"), cut);
  assert.equal(cutMiddle("short", 28), "short");
});

await test("a left-cut directory begins with …/", () => {
  const out = strip(renderPayload({ cwd: `/tmp/${"d".repeat(130)}` }, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 80, maxHeight: 40 }));
  assert.match(out.split("\n")[0], /…\/d+/);
});

await test("the figure is bold and the reset quiet, and the markup adds no columns", () => {
  const out = draw(PAYLOAD);
  assert.ok(out.includes("\x1b[1m"), "bold on the figures");
  assert.ok(out.includes("\x1b[22m"), "and off again");
  const before = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    assert.ok(!/\x1b\[(?!4:4m|24m)[0-9;]*m/.test(draw(PAYLOAD)), "no colour or weight under NO_COLOR");
  } finally {
    if (before === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = before;
  }
  assert.equal(displayWidth("\u0001ab\u0003"), 2);
  assert.ok(!/[\u0001-\u0006]/.test(chip("context").text), "the pool carries plain text");
});

await test("data cannot carry the markers", () => {
  assert.ok(!/[\u0001-\u0006]/.test(plainText("a\u0001b\u0002c\u0003d\u0005e\u0006f")));
});

import { parsePorcelainV2 } from "../../src/git.js";
import { colourDepth, styledUnderline } from "../../src/theme.js";

await test("a status read counts staged and removed files", () => {
  const text = ["# branch.head main", "1 M. N... 100644 100644 100644 a b f1", "1 .D N... 100644 100644 000000 a b f2", "1 D. N... 100644 000000 000000 a b f3", "? new"].join("\0");
  const git = parsePorcelainV2(text);
  assert.equal(git.changed, 3);
  assert.equal(git.staged, 2, "M. and D. are in the index");
  assert.equal(git.removed, 2, "D in either column");
  assert.equal(git.untracked, 1);
});

await test("TERM=xterm-256color with COLORTERM unset is 256 colours, except where truecolor is known", () => {
  assert.equal(colourDepth({ TERM: "xterm-256color" }), "256");
  assert.equal(colourDepth({ TERM: "xterm-256color", WT_SESSION: "1" }), "truecolor");
  assert.equal(colourDepth({ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }), "truecolor");
  assert.equal(colourDepth({ TERM: "xterm-256color", COLORTERM: "truecolor" }), "truecolor");
  assert.equal(colourDepth({ TERM: "xterm" }), "truecolor");
});

await test("the dotted underline has an opt-out", () => {
  assert.equal(styledUnderline({ KITTY_WINDOW_ID: "1" }), true);
  assert.equal(styledUnderline({ KITTY_WINDOW_ID: "1", CLAUDE_STATUSLINE_UNDERLINE: "0" }), false);
});

await test("block mode pads every line to the widest, on mantle", () => {
  const before = process.env.CLAUDE_STATUSLINE_BLOCK;
  process.env.CLAUDE_STATUSLINE_BLOCK = "1";
  try {
    const out = renderPayload(PAYLOAD, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 300, maxHeight: 40, trailingRows: false });
    const widths = out.split("\n").map((l) => displayWidth(l));
    assert.equal(new Set(widths).size, 1, `every line is ${widths.join(", ")} wide`);
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_BLOCK;
    else process.env.CLAUDE_STATUSLINE_BLOCK = before;
  }
});

import { parseOsc11, isLight, cachedBackgroundIsLight, terminalId } from "../../src/terminalBackground.js";
import { terminalFlavor } from "../../src/config.js";
import { colourStatus } from "../../src/doctor.js";

await test("an OSC 11 reply is read in two and four digit channels", () => {
  assert.deepEqual(parseOsc11("\x1b]11;rgb:ffff/ffff/ffff\x07"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseOsc11("\x1b]11;rgb:1e/1e/2e\x1b\\"), { r: 30, g: 30, b: 46 });
  assert.equal(parseOsc11("nothing"), null);
  assert.equal(isLight({ r: 239, g: 241, b: 245 }), true);
  assert.equal(isLight({ r: 30, g: 30, b: 46 }), false);
});

await test("a remembered terminal background picks latte only after COLORFGBG and for the same terminal", () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = require_fs();
  const home = mkdtempSync(path.join(os.tmpdir(), "bg-"));
  mkdirSync(path.join(home, ".claude", "statusline"), { recursive: true });
  const env = { TERM_PROGRAM: "iTerm.app", TERM: "xterm-256color" };
  writeFileSync(path.join(home, ".claude", "statusline", "terminal-background.json"), JSON.stringify({ light: true, terminal: terminalId(env) }));
  // `os.homedir()` reads USERPROFILE on Windows and HOME elsewhere.
  const before = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    assert.equal(cachedBackgroundIsLight(env), true);
    assert.equal(terminalFlavor(env), "latte");
    assert.equal(terminalFlavor({ ...env, COLORFGBG: "15;0" }), null, "COLORFGBG says dark and goes first");
    assert.equal(cachedBackgroundIsLight({ TERM_PROGRAM: "WezTerm" }), null, "another terminal does not reuse it");
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
function require_fs() {
  return { mkdtempSync, mkdirSync, writeFileSync };
}

await test("tmux keeps truecolor when COLORTERM is unset, and doctor says why", () => {
  assert.equal(colourDepth({ TERM: "tmux-256color", TMUX: "/tmp/tmux-1/default,1,0" }), "truecolor");
  assert.equal(colourDepth({ TERM: "tmux-256color", COLORTERM: "256color" }), "256");
  assert.match(colourStatus({ TERM: "tmux-256color", TMUX: "x" }).line, /TMUX is set/);
  assert.match(colourStatus({ TERM: "xterm-256color" }).line, /^colour: 256/);
});

await test("the pill style drops its leading pad and keeps one trailing column, 0 and 1", () => {
  const before = process.env.CLAUDE_STATUSLINE_SEPARATOR;
  process.env.CLAUDE_STATUSLINE_SEPARATOR = "round";
  try {
    const out = strip(renderRow(PALETTES.mocha, [{ color: "lavender", text: " main " }]));
    assert.ok(out.includes("\u{E0B6}main \u{E0B4}"), JSON.stringify(out));
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_SEPARATOR;
    else process.env.CLAUDE_STATUSLINE_SEPARATOR = before;
  }
});

await test("the hairline is an overline on line 1 and adds no line", () => {
  const before = process.env.CLAUDE_STATUSLINE_HAIRLINE;
  process.env.CLAUDE_STATUSLINE_HAIRLINE = "1";
  try {
    const out = renderPayload(PAYLOAD, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 200, maxHeight: 40, trailingRows: false });
    const lines = out.split("\n");
    assert.equal(lines.length, 3);
    assert.ok(lines[0].startsWith("\x1b[53m"));
    assert.ok(!lines[1].includes("\x1b[53m"));
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_HAIRLINE;
    else process.env.CLAUDE_STATUSLINE_HAIRLINE = before;
  }
});

await test("a sleeping session dims line 2 by colour, not only by word", () => {
  const asleep = { working: false, background: { shells: 0, agents: 0 }, todos: null, skills: ["speckit-plan"], idleMs: 6 * 60_000 };
  const awake = { ...asleep, idleMs: 60_000 };
  const draw = (activity) =>
    renderPayload(PAYLOAD, { sources: { ...SOURCES, getSessionActivity: () => activity }, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 300, maxHeight: 40 }).split("\n")[1];
  assert.notEqual(
    draw(asleep).replace(/sleeping|idle/, "").replace(/[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]/gu, ""),
    draw(awake).replace(/sleeping|idle/, "").replace(/[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]/gu, ""),
    "the colour sequences differ"
  );
});
