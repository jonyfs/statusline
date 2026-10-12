import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload, gather, renderReadings } from "../../src/render.js";
import { iconTier } from "../../src/config.js";
import { displayWidth } from "../../src/theme.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

const withEnv = (vars, fn) => {
  const before = {};
  for (const k of Object.keys(vars)) {
    before[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
};

const render = (extra = {}, width = 200) =>
  renderPayload(PAYLOAD, {
    sources: SOURCES,
    trackChanges: false,
    layout: NO_ARRANGEMENT,
    maxWidth: width,
    maxHeight: 40,
    ...extra,
  });

// The committed extract of emoji-data.txt: every Emoji_Presentation=Yes range.
const EMOJI_PRESENTATION = (() => {
  const text = readFileSync(new URL("../unicode-16.0.0/emoji-data.extract.txt", import.meta.url), "utf8");
  const ranges = [];
  for (const line of text.split("\n")) {
    const m = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*Emoji_Presentation/.exec(line);
    if (m) ranges.push([parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)]);
  }
  return (cp) => ranges.some(([a, b]) => cp >= a && cp <= b);
})();

const REJECTED = ["⚡", "☕", "⏭", "⚠", "\u{1F321}", "⌨", "\u{1F5D3}", "⏱", "\u{1F4C5}", "\u{1F4C6}"];

await test("the emoji column has the keys of the other two", () => {
  assert.deepEqual(Object.keys(GLYPHS.emoji).sort(), Object.keys(GLYPHS.nerd).sort());
});

await test("every emoji is one codepoint with Emoji_Presentation=Yes", () => {
  for (const [key, glyph] of Object.entries(GLYPHS.emoji)) {
    const points = [...glyph];
    assert.equal(points.length, 1, `${key} is one codepoint, not ${points.length}`);
    assert.ok(EMOJI_PRESENTATION(points[0].codePointAt(0)), `${key} U+${points[0].codePointAt(0).toString(16)} is text-presentation`);
    assert.equal(displayWidth(glyph), 2, `${key} measures two columns`);
  }
});

await test("the look-alikes are rejected by name", () => {
  const used = new Set(Object.values(GLYPHS.emoji).map((e) => e.replace(/️/g, "")));
  for (const r of REJECTED) assert.ok(!used.has(r), `${r} is in the emoji column`);
});

await test("the tier follows CLAUDE_STATUSLINE_ICONS, and ASCII wins", () => {
  assert.equal(iconTier({ env: {} }).tier, "nerd");
  assert.equal(iconTier({ env: { CLAUDE_STATUSLINE_ICONS: "emoji" } }).tier, "emoji");
  assert.equal(iconTier({ env: { CLAUDE_STATUSLINE_ICONS: "plain" } }).tier, "plain");
  assert.equal(iconTier({ env: { CLAUDE_STATUSLINE_ICONS: "emoji" }, asciiArrows: true }).tier, "plain");
  const odd = iconTier({ env: { CLAUDE_STATUSLINE_ICONS: "pictures" } });
  assert.equal(odd.tier, "nerd");
  assert.equal(odd.unknown, "pictures");
});

await test("the emoji tier draws the emoji of each key", () => {
  withEnv({ CLAUDE_STATUSLINE_ICONS: "emoji" }, () => {
    const out = strip(render({}, 360));
    for (const key of ["dir", "repo", "worktree", "model", "context", "duration", "allowAll", "fast"]) {
      assert.ok(out.includes(GLYPHS.emoji[key]), `${key} ${GLYPHS.emoji[key]} is on the bar`);
    }
    assert.ok(!/[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]/u.test(out.replace(/\u{E0B0}/gu, "")), "no Nerd Font glyph is left");
  });
});

await test("the nerd tier is unchanged when the variable is unset", () => {
  withEnv({ CLAUDE_STATUSLINE_ICONS: undefined }, () => {
    const out = strip(render());
    assert.ok(out.includes(GLYPHS.nerd.dir));
    assert.ok(!out.includes(GLYPHS.emoji.dir));
  });
});

await test("ASCII overrides the emoji tier", () => {
  withEnv({ CLAUDE_STATUSLINE_ICONS: "emoji" }, () => {
    const out = strip(render({ asciiArrows: true }));
    assert.ok(out.includes(GLYPHS.plain.dir));
    assert.ok(!out.includes(GLYPHS.emoji.dir));
  });
});

await test("the band marks are coloured circles in the emoji tier", () => {
  withEnv({ CLAUDE_STATUSLINE_ICONS: "emoji" }, () => {
    const warn = strip(render({}).replace(/x/g, "x"));
    assert.ok(warn.includes("\u{1F7E1}"), "warn is yellow");
    const hot = { ...PAYLOAD, rate_limits: { ...PAYLOAD.rate_limits, five_hour: { used_percentage: 97, resets_at: FIXED_NOW + 7740 } } };
    const out = strip(renderPayload(hot, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 200, maxHeight: 40 }));
    assert.ok(out.includes("\u{1F534}"), "critical is red");
  });
});

await test("the emoji tier fits at 80, 120 and 200 columns, in both width settings", () => {
  for (const ambiguous of [undefined, "1"]) {
    withEnv({ CLAUDE_STATUSLINE_ICONS: "emoji", CLAUDE_STATUSLINE_AMBIGUOUS_WIDE: ambiguous }, () => {
      for (const width of [80, 120, 200]) {
        for (const line of strip(render({}, width)).split("\n")) {
          assert.ok(displayWidth(line) <= width, `${width} cols, ambiguous=${ambiguous}: ${displayWidth(line)} wide`);
        }
      }
    });
  }
});

await test("event emoji are drawn in the nerd tier only when asked for", () => {
  const conflicts = { ...PAYLOAD };
  const plainOut = withEnv({ CLAUDE_STATUSLINE_EVENT_EMOJI: undefined }, () => strip(render()));
  const eventOut = withEnv({ CLAUDE_STATUSLINE_EVENT_EMOJI: "1" }, () => strip(render()));
  void conflicts;
  assert.ok(!plainOut.includes("\u{1F4A5}"));
  assert.ok(eventOut.includes("\u{1F4A5}"), "conflicts are 💥 when asked for");
  assert.ok(eventOut.includes(GLYPHS.nerd.dir), "nothing else changes");
});

await test("the pool still carries one entry per segment in the emoji tier", () => {
  withEnv({ CLAUDE_STATUSLINE_ICONS: "emoji" }, () => {
    const pool = renderReadings(gather(PAYLOAD, { ...SOURCES }, { now: FIXED_NOW * 1000 }), PAYLOAD, {
      ...RENDER_OPTIONS, maxWidth: 360, maxHeight: 40, asPool: true,
    });
    assert.ok(pool.length >= 30);
  });
});

import { iconStatus } from "../../src/doctor.js";

await test("doctor says which tier is in force and names a value it does not know", () => {
  assert.match(iconStatus({}).line, /^icons: nerd \(default\)/);
  assert.match(iconStatus({ CLAUDE_STATUSLINE_ICONS: "emoji" }).line, /^icons: emoji \(from CLAUDE_STATUSLINE_ICONS\)/);
  assert.match(iconStatus({ CLAUDE_STATUSLINE_ICONS: "emoji", CLAUDE_STATUSLINE_ASCII: "1" }).line, /^icons: plain \(from CLAUDE_STATUSLINE_ASCII\)/);
  assert.match(iconStatus({ CLAUDE_STATUSLINE_ICONS: "pictures" }).line, /unknown "pictures"/);
});
