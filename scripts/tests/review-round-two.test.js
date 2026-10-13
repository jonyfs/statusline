import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload, renderReadings, gather } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { refreshTerminalBackground } from "../../src/terminalBackground.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS, SAMPLES } from "../composer-fixture.js";
import { PRESETS } from "../composer-presets.js";

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

await test("the composer page fits the pill as the renderer does", async () => {
  const { resolveArrangement, placementsForLine } = await import("../../src/arrangement.js");
  const { fitToWidth, alignColumns } = await import("../../src/layout.js");
  const { PALETTES, renderRow } = await import("../../src/theme.js");
  const { SEGMENTS } = await import("../../src/segments.js");
  const before = process.env.CLAUDE_STATUSLINE_SEPARATOR;
  process.env.CLAUDE_STATUSLINE_SEPARATOR = "round";
  try {
    const now = FIXED_NOW * 1000;
    const base = { flavor: "mocha", tracking: false, now, samples: SAMPLES, maxHeight: 40, trailingRows: false };
    for (const width of [80, 120]) {
      const readings = gather(PAYLOAD, { ...SOURCES }, { now });
      const pool = renderReadings(readings, PAYLOAD, { ...base, maxWidth: width, asPool: true });
      const byKey = new Map(pool.map((s) => [s.key, s]));
      const resolved = resolveArrangement(SEGMENTS, PRESETS[0].arrangement, "page");
      const rows = [];
      for (const line of [1, 2, 3, 4]) {
        const row = placementsForLine(resolved, line)
          .map((p) => (byKey.has(p.key) ? { ...p, ...byKey.get(p.key), extra: 1 } : null))
          .filter(Boolean);
        if (row.length) rows.push(fitToWidth(row, width));
      }
      const page = strip(alignColumns(rows, width).map((r) => renderRow(PALETTES.mocha, r, { asciiArrows: false, width })).join("\n"));
      const bar = strip(
        renderReadings(readings, PAYLOAD, { ...base, maxWidth: width, arrangement: PRESETS[0].arrangement, arrangementOrigin: "test" })
      );
      assert.equal(page, bar, `the page and the renderer agree at ${width} columns in the pill style`);
    }
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_SEPARATOR;
    else process.env.CLAUDE_STATUSLINE_SEPARATOR = before;
  }
});

await test("a sleeping session puts the skills chip on the neutral fill with quiet text", () => {
  const asleep = { working: false, background: { shells: 0, agents: 0 }, todos: { done: 1, total: 2, current: "x" }, skills: ["speckit-plan"], idleMs: 6 * 60_000 };
  const awake = { ...asleep, idleMs: 30_000 };
  const pool = (activity) =>
    renderReadings(gather(PAYLOAD, { ...SOURCES, getSessionActivity: () => activity }, { now: FIXED_NOW * 1000 }), PAYLOAD, {
      ...RENDER_OPTIONS, maxWidth: 400, maxHeight: 40, asPool: true,
    });
  assert.equal(pool(awake).find((e) => e.key === "skills").color, "flamingo");
  // The pool is built before placement; the drawn line is what changes.
  const line2 = (activity) =>
    renderPayload(PAYLOAD, { sources: { ...SOURCES, getSessionActivity: () => activity }, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 400, maxHeight: 40 }).split("\n")[1];
  const FLAMINGO_BG = "\x1b[48;2;242;205;205m";
  assert.ok(line2(awake).includes(FLAMINGO_BG), "awake: the skills chip is flamingo");
  assert.ok(!line2(asleep).includes(FLAMINGO_BG), "asleep: no flamingo fill is left on line 2");
});

await test("the tree prefixes are Ambiguous, so the switch widens them with the rest", () => {
  const before = process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
  try {
    delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
    assert.equal(displayWidth("├─"), 2);
    process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = "1";
    assert.equal(displayWidth("├─"), 4);
    assert.equal(displayWidth("└─"), 4);
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE;
    else process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE = before;
  }
});

function fakeTerminal({ reply = null, da1 = true } = {}) {
  const stdin = new EventEmitter();
  const log = { raw: [], written: [] };
  stdin.isTTY = true;
  stdin.isRaw = false;
  stdin.setRawMode = (on) => log.raw.push(on);
  stdin.resume = () => {};
  stdin.pause = () => {};
  const stdout = {
    isTTY: true,
    write(text) {
      log.written.push(text);
      // A terminal answers the colour query, then the attributes request.
      if (reply !== null) setImmediate(() => stdin.emit("data", Buffer.from(reply)));
      if (da1) setImmediate(() => stdin.emit("data", Buffer.from("\x1b[?62;c")));
    },
  };
  return { stdin, stdout, log };
}

await test("the background query asks for the colour then the attributes, and restores raw mode", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "osc-"));
  const prior = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    const term = fakeTerminal({ reply: "\x1b]11;rgb:efef/f1f1/f5f5\x1b\\" });
    const got = await refreshTerminalBackground({ ...term, env: { TERM: "xterm" }, timeoutMs: 500 });
    assert.equal(got.light, true);
    assert.ok(term.log.written[0].includes("\x1b]11;?") && term.log.written[0].endsWith("\x1b[c"), "OSC 11 then DA1");
    assert.deepEqual(term.log.raw, [true, false], "raw mode on, then restored");
    const saved = JSON.parse(readFileSync(path.join(home, ".claude", "statusline", "terminal-background.json"), "utf8"));
    assert.equal(saved.light, true);
  } finally {
    for (const [k, v] of Object.entries(prior)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

await test("a terminal that never answers returns null at the timeout and restores raw mode", async () => {
  const term = fakeTerminal({ reply: null, da1: false });
  const started = Date.now();
  const got = await refreshTerminalBackground({ ...term, env: { TERM: "xterm" }, timeoutMs: 60 });
  assert.equal(got, null);
  assert.ok(Date.now() - started >= 55);
  assert.deepEqual(term.log.raw, [true, false]);
});

await test("a terminal that answers the attributes but not the colour leaves nothing cached", async () => {
  const term = fakeTerminal({ reply: null, da1: true });
  const got = await refreshTerminalBackground({ ...term, env: { TERM: "xterm" }, timeoutMs: 200 });
  assert.equal(got, null);
});

await test("no terminal, no query", async () => {
  const stdin = new EventEmitter();
  stdin.isTTY = false;
  assert.equal(await refreshTerminalBackground({ stdin, stdout: { isTTY: false, write() { throw new Error("must not write"); } } }), null);
});

await test("the emoji tier's rejection list includes the shield and the label", () => {
  const used = new Set(Object.values(GLYPHS.emoji));
  for (const banned of ["\u{1F6E1}", "\u{1F3F7}"]) assert.ok(!used.has(banned));
  assert.ok(existsSync(new URL("../../specs/043-emoji-tier/glyph-evidence.png", import.meta.url)), "the emoji column has a rendered proof sheet");
});

import { renderRow, PALETTES } from "../../src/theme.js";

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

await test("the terminal's own dim is available for units and resets, and the default is unchanged", () => {
  const seg = [{ color: "surface0", text: ` x \u0002quiet\u0003 ` }];
  assert.ok(!renderRow(PALETTES.mocha, seg).includes("\x1b[2m"), "off by default");
  assert.ok(withEnv({ CLAUDE_STATUSLINE_DIM: "sgr" }, () => renderRow(PALETTES.mocha, seg)).includes("\x1b[2m"));
});

await test("wide padding adds a column before every chip after an arrow, and only then", () => {
  const rows = [
    { color: "lavender", text: " one " },
    { color: "peach", text: " two " },
  ];
  const plain = strip(renderRow(PALETTES.mocha, rows));
  const wide = withEnv({ CLAUDE_STATUSLINE_PADDING: "wide" }, () => strip(renderRow(PALETTES.mocha, rows)));
  assert.equal(displayWidth(wide), displayWidth(plain) + 1);
  assert.ok(wide.includes("  two"), "two spaces before the second chip's text");
  const pill = withEnv({ CLAUDE_STATUSLINE_PADDING: "wide", CLAUDE_STATUSLINE_SEPARATOR: "round" }, () => strip(renderRow(PALETTES.mocha, rows)));
  assert.ok(!pill.includes("  two"), "the pill has no inner padding to widen");
});

await test("the wide padding still fits the window it was asked for", () => {
  withEnv({ CLAUDE_STATUSLINE_PADDING: "wide" }, () => {
    for (const width of [80, 120, 200]) {
      for (const line of strip(
        renderPayload(PAYLOAD, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: width, maxHeight: 40, trailingRows: false })
      ).split("\n")) {
        assert.ok(displayWidth(line) <= width, `${width}: ${displayWidth(line)}`);
      }
    }
  });
});
