import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderPayload, GLYPHS } from "../../src/render.js";
import { PALETTES, renderRow, displayWidth, separatorStyle, separatorFor } from "../../src/theme.js";
import { rowWidth } from "../../src/layout.js";
import { preset } from "../composer-presets.js";
import { separatorStatus } from "../../src/doctor.js";
import { PAYLOAD, SOURCES } from "../composer-fixture.js";

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

const draw = (extra = {}, payload = PAYLOAD) =>
  renderPayload(payload, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 360, maxHeight: 40, ...extra });

const ARROW = "\u{E0B0}", THIN = "\u{E0B1}", PILL_END = "\u{E0B4}", PILL_MID = "\u{E0B5}", PILL_START = "\u{E0B6}", SLANT = "\u{E0BC}";

const two = (a, b) => [
  { color: a, text: " one " },
  { color: b, text: " two " },
];

await test("two chips on one background are joined by the thin arrow in the text colour", () => {
  const out = renderRow(PALETTES.mocha, two("lavender", "lavender"));
  assert.ok(out.includes(THIN));
  assert.ok(!out.slice(0, out.lastIndexOf(" two")).includes(ARROW), "no solid arrow between them");
  // the thin arrow's foreground is the text colour of the first chip (crust)
  assert.ok(out.includes("\x1b[38;2;17;17;27m\x1b[48;2;180;190;254m" + THIN));
});

await test("two chips on different backgrounds keep the solid arrow", () => {
  const out = renderRow(PALETTES.mocha, two("lavender", "peach"));
  assert.ok(out.includes(ARROW));
});

await test("each style draws its glyphs", () => {
  const style = (name) => withEnv({ CLAUDE_STATUSLINE_SEPARATOR: name }, () => renderRow(PALETTES.mocha, two("lavender", "peach")));
  assert.ok(style("arrow").includes(ARROW) && !style("arrow").includes(SLANT));
  assert.ok(style("slant").includes(SLANT) && !style("slant").includes(ARROW));
  const round = style("round");
  assert.ok(round.startsWith("\x1b[0m") || round.includes(PILL_START));
  assert.ok(round.includes(PILL_START) && round.includes(PILL_END) && !round.includes(ARROW));
  const thin = style("thin");
  assert.ok(thin.includes(THIN) && !thin.includes(ARROW));
  assert.ok(withEnv({ CLAUDE_STATUSLINE_SEPARATOR: "round" }, () => renderRow(PALETTES.mocha, two("lavender", "lavender"))).includes(PILL_MID));
});

await test("an unknown style draws the default and doctor names it", () => {
  withEnv({ CLAUDE_STATUSLINE_SEPARATOR: "wavy" }, () => {
    assert.equal(separatorStyle({}), "arrow");
    assert.equal(separatorFor({}), ARROW);
  });
  assert.match(separatorStatus({ CLAUDE_STATUSLINE_SEPARATOR: "wavy" }).line, /unknown "wavy"/);
  assert.match(separatorStatus({ CLAUDE_STATUSLINE_SEPARATOR: "slant" }).line, /^separator: slant/);
  assert.match(separatorStatus({}).line, /^separator: arrow \(default\)/);
});

await test("the plain tier, the emoji tier and NO_COLOR keep their separators", () => {
  assert.equal(separatorStyle({ asciiArrows: true }), "ascii");
  withEnv({ NO_COLOR: "1", CLAUDE_STATUSLINE_SEPARATOR: "round" }, () => assert.equal(separatorStyle({}), "thin"));
});

await test("line 3 is three groups with a blank column between them", () => {
  const out = strip(draw({}, PAYLOAD)).split("\n")[2];
  // identity -> gauges: `allow all` then two spaces before the context icon
  const afterAllowAll = out.slice(out.indexOf("allow all") + "allow all".length);
  assert.match(afterAllowAll, /^\s\S+\s{2}\S/, `the gap after the identity group: ${JSON.stringify(afterAllowAll.slice(0, 8))}`);
});

await test("group gaps are counted by the width guard", () => {
  const row = [
    { text: " a ", group: "identity" },
    { text: " b ", group: "gauges" },
    { text: " c ", group: "gauges" },
  ];
  const flat = row.map((s) => ({ ...s, group: undefined }));
  assert.equal(rowWidth(row), rowWidth(flat) + 1);
});

await test("a chip steps down to its icon before it is dropped", () => {
  const widths = [];
  for (let w = 120; w >= 60; w -= 10) widths.push(w);
  for (const w of widths) {
    for (const line of strip(draw({ maxWidth: w })).split("\n")) {
      assert.ok(displayWidth(line) <= w, `${w} columns: ${displayWidth(line)} wide`);
    }
  }
});

await test("the update chip is at the right edge, and gives up its words before it goes", () => {
  const withUpdate = { ...PAYLOAD };
  const line = strip(draw({ maxWidth: 200 }, withUpdate)).split("\n")[0];
  // The chip is its icon (specs/048): the sentence is in doctor.
  assert.ok(line.includes(GLYPHS.nerd.updateReady), "the update icon is on line 1");
  assert.ok(!/update ready/.test(line), "and the sentence is not");
  assert.equal(displayWidth(line), 200, "padded out to the right edge");
});

await test("the pill style fits at 80, 120 and 200 columns", () => {
  withEnv({ CLAUDE_STATUSLINE_SEPARATOR: "round" }, () => {
    for (const w of [80, 120, 200]) {
      for (const line of strip(draw({ maxWidth: w })).split("\n")) assert.ok(displayWidth(line) <= w, `${w}: ${displayWidth(line)}`);
    }
  });
});

await test("every style fits at 80 and 120 columns in both width settings", () => {
  for (const style of ["arrow", "slant", "thin", "round"]) {
    for (const wide of [undefined, "1"]) {
      withEnv({ CLAUDE_STATUSLINE_SEPARATOR: style, CLAUDE_STATUSLINE_AMBIGUOUS_WIDE: wide }, () => {
        for (const w of [80, 120]) {
          for (const line of strip(draw({ maxWidth: w })).split("\n")) {
            assert.ok(displayWidth(line) <= w, `${style} wide=${wide} ${w}: ${displayWidth(line)}`);
          }
        }
      });
    }
  }
});

await test("the compact preset is one line of five segments", () => {
  const p = preset("compact");
  const out = strip(
    renderPayload(PAYLOAD, {
      sources: SOURCES,
      trackChanges: false,
      layout: { arrangement: p.arrangement, origin: "preset", path: null, error: null },
      maxWidth: 120,
      maxHeight: 40,
      trailingRows: false,
    })
  );
  assert.equal(out.split("\n").length, 1);
  assert.ok(/statusline/.test(out) && /Opus 5/.test(out) && /context|46%/.test(out) && /5h/.test(out));
});
