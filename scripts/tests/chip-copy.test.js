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
  assert.deepEqual(forms("context"), [`${g.context} context ${FIGURE_SPACE}46%`, `${g.context} ${FIGURE_SPACE}46%`]);
  assert.deepEqual(forms("rtk"), [`${g.rtk} rtk 81% saved`, `${g.rtk} 81%`]);
  assert.deepEqual(forms("pr"), [
    `${g.pr} PR #128 ${g.reviewApproved} approved`,
    `${g.pr} #128 ${g.reviewApproved}`,
  ]);
  assert.deepEqual(forms("fiveHour"), [
    `${g.timer} 5h ${FIGURE_SPACE}62%▵ ${g.reset} 2h09`,
    `${g.timer} 5h ${FIGURE_SPACE}62%▵`,
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
  assert.equal(widthOf(50), widthOf(100));
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
  assert.ok(!/[\u0001-\u0003]/.test(chip("context").text), "the pool carries plain text");
});

await test("data cannot carry the markers", () => {
  assert.ok(!/[\u0001-\u0003]/.test(plainText("a\u0001b\u0002c\u0003d")));
});
