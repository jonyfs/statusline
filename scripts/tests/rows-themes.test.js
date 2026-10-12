import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { PALETTES, renderRow } from "../../src/theme.js";
import { contrastRatio } from "../../src/contrast.js";
import { renderPayload, GLYPHS } from "../../src/render.js";
import { alignTaskRows, renderTaskRow } from "../../src/taskRows.js";
import { gateRows } from "../../src/gateRows.js";
import { flavorStatus } from "../../src/doctor.js";
import { gaugeChip } from "../../src/ramp.js";
import { SOURCES, PAYLOAD } from "../composer-fixture.js";
import { SCENARIOS } from "../preview-fixtures.js";

const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const TOKENS = ["crust", "mantle", "base", "surface0", "surface1", "surface2", "text", "red", "peach", "yellow", "green", "sapphire", "blue", "lavender", "mauve", "flamingo", "teal", "pink"];

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

const pairs = (ansi) => {
  const out = [];
  let fg = null;
  let bg = null;
  const re = /\x1b\[([0-9;:]*)m|\x1b\]8;;[^\x07]*\x07|([^\x1b]+)/g;
  let m;
  while ((m = re.exec(ansi))) {
    if (m[2] !== undefined) {
      const text = m[2].replace(/[\u{E0B0}-\u{E0D4}▸]/gu, "").replace(/\s+/g, "");
      if (text && fg && bg) out.push({ fg, bg, text: m[2] });
    } else if (m[1] !== undefined) {
      const p = m[1].split(";");
      for (let i = 0; i < p.length; i++) {
        const n = Number(p[i]);
        if (n === 0 || m[1] === "") (fg = null), (bg = null);
        else if ((n === 38 || n === 48) && p[i + 1] === "2") {
          const hex = `#${[p[i + 2], p[i + 3], p[i + 4]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
          if (n === 38) fg = hex;
          else bg = hex;
          i += 4;
        }
      }
    }
  }
  return out;
};

const draw = (flavor, extra = {}) =>
  renderPayload(PAYLOAD, { flavor, sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 300, maxHeight: 40, ...extra });

await test("the new palettes define every token and are known to doctor", () => {
  for (const name of ["tokyonight", "rosepine", "dracula", "solarized", "onedark", "terminal"]) {
    for (const token of TOKENS) assert.ok(PALETTES[name][token], `${name} lacks ${token}`);
    assert.equal(flavorStatus("/does/not/exist", { CLAUDE_STATUSLINE_FLAVOR: name }).known, true, name);
  }
  assert.equal(Object.keys(PALETTES).length, 12);
});

await test("the terminal palette draws only the 16 ANSI colours", () => {
  const out = draw("terminal");
  assert.ok(!/\x1b\[(38|48);[25];/.test(out), "no truecolor or 256-colour sequence");
  assert.ok(/\x1b\[(4[0-7]|10[0-7])m/.test(out), "an ANSI background is drawn");
});

await test("high contrast draws pure black or white at 7:1", () => {
  withEnv({ CLAUDE_STATUSLINE_CONTRAST: "high" }, () => {
    const failures = [];
    for (const flavor of Object.keys(PALETTES).filter((name) => name !== "terminal")) {
      for (const p of pairs(draw(flavor))) {
        if (!["#000000", "#ffffff"].includes(p.fg) && !p.text.includes("%") ) continue;
        const r = contrastRatio(p.fg, p.bg);
        if (r < 7) failures.push(`${flavor} ${p.fg} on ${p.bg} ${r.toFixed(2)} "${p.text.trim()}"`);
      }
    }
    assert.deepEqual([...new Set(failures)], []);
  });
  const chip = withEnv({ CLAUDE_STATUSLINE_CONTRAST: "high" }, () => renderRow(PALETTES.latte, [{ color: "peach", text: " x " }]));
  assert.ok(chip.includes("\x1b[38;2;0;0;0m"), "black on peach");
});

await test("the cvd ramp is blue, yellow and red", () => {
  withEnv({ CLAUDE_STATUSLINE_RAMP: "cvd" }, () => {
    assert.equal(gaugeChip(10).icon, "blue");
    assert.equal(gaugeChip(70).color, "yellow");
    assert.equal(gaugeChip(95).color, "red");
  });
  assert.equal(gaugeChip(10).icon, "green", "unset leaves the default");
});

const task = (over) => ({
  id: "a1",
  name: "explore",
  description: "Map the repository",
  model: "claude-opus-5",
  effort: "xhigh",
  tokenCount: 40_000,
  contextWindowSize: 200_000,
  startTime: 1_787_000_000_000 - 120_000,
  ...over,
});

await test("an agent row leads with its brief and colours the model by family", () => {
  const NOW = 1_787_000_000_000;
  const rows = alignTaskRows(
    [
      task({ id: "o", model: "claude-opus-5", effort: "xhigh", description: "Brief opus" }),
      task({ id: "s", model: "claude-sonnet-5", effort: "high", description: "Brief sonnet" }),
      task({ id: "h", model: "claude-haiku-5", effort: "low", description: "Brief haiku" }),
    ],
    { columns: 200, now: NOW }
  );
  const text = rows.map((r) => strip(r.content));
  for (const [i, brief] of ["Brief opus", "Brief sonnet", "Brief haiku"].entries()) {
    assert.ok(text[i].trimStart().startsWith(brief), `row ${i} leads with ${brief}: ${JSON.stringify(text[i])}`);
  }
  const mocha = PALETTES.mocha;
  const fgOf = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
  };
  assert.ok(rows[0].content.includes(fgOf(mocha.mauve)), "opus is mauve");
  assert.ok(rows[1].content.includes(fgOf(mocha.lavender)), "sonnet is lavender");
  assert.ok(rows[2].content.includes(fgOf(mocha.teal)), "haiku is teal");
  assert.ok(!rows[0].content.includes(fgOf(mocha.red)), "xhigh no longer makes it red");
});

await test("a child agent follows its parent with a tree prefix", () => {
  const NOW = 1_787_000_000_000;
  const rows = alignTaskRows(
    [
      task({ id: "p", description: "Parent brief" }),
      task({ id: "c1", parentId: "p", description: "First child" }),
      task({ id: "c2", parentId: "p", description: "Last child" }),
    ],
    { columns: 200, now: NOW }
  );
  const text = rows.map((r) => strip(r.content));
  assert.ok(text[0].trimStart().startsWith("Parent brief"));
  assert.ok(text[1].trimStart().startsWith("\u251c\u2500 First child"), text[1]);
  assert.ok(text[2].trimStart().startsWith("\u2514\u2500 Last child"), text[2]);
});

await test("a gate row has an icon for its hook", () => {
  const g = GLYPHS.nerd;
  const run = (hook, state) => ({ hook, state, worktree: "wt", path: "/x", branch: "main", step: "lint", startedAt: 1_787_000_000_000 - 60_000 });
  const rows = gateRows([run("pre-commit", "running"), run("pre-push", "running"), run("pre-push", "waiting")], {
    columns: 160,
    glyphs: g,
    now: 1_787_000_000_000,
  }).map(strip);
  assert.ok(rows[0].includes(g.commit), rows[0]);
  assert.ok(rows[1].includes(g.push), rows[1]);
  assert.ok(rows[2].includes(g.gateWaiting), rows[2]);
});

import { readFileSync, existsSync, readdirSync } from "node:fs";

await test("the composer page offers the theme, the icon tier and the separator, and exports them", () => {
  const html = readFileSync(new URL("../../specs/004-statusline-redesign-research/composer.html", import.meta.url), "utf8");
  for (const needle of ['id="flavor"', 'id="separator-switch"', 'id="glyph-switch"', 'id="env"', "CLAUDE_STATUSLINE_FLAVOR", "CLAUDE_STATUSLINE_ICONS", "CLAUDE_STATUSLINE_SEPARATOR"]) {
    assert.ok(html.includes(needle), `${needle} is on the page`);
  }
  assert.ok(!html.includes('"terminal"') || !/FLAVORS = \[[^\]]*terminal/.test(html), "the terminal palette is not drawable on the page");
});

await test("the stale PNGs are gone and the generated images are there", () => {
  const dir = new URL("../../docs/images/", import.meta.url);
  const files = existsSync(dir) ? readdirSync(dir) : [];
  assert.deepEqual(files.sort(), ["bar.gif", "bar.png"]);
});
