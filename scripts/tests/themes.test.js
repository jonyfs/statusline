import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { PALETTES, separatorFor } from "../../src/theme.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

await test("every palette defines every token the Catppuccin flavors do", () => {
  // A segment must never reference a colour that exists in one theme and
  // not another, or a theme switch turns into an invisible block.
  const required = Object.keys(PALETTES.mocha);
  for (const [name, palette] of Object.entries(PALETTES)) {
    const missing = required.filter((token) => !(token in palette));
    assert.deepEqual(missing, [], `${name} is missing ${missing.join(", ")}`);
  }
});

await test("Nord and Gruvbox ship, and neither is the default", () => {
  // The v4.0.0 amendment to Principle I allows palettes from outside
  // Catppuccin beside the four flavors, on the condition that Mocha stays
  // what the bar looks like when nobody has chosen.
  assert.ok(PALETTES.nord);
  assert.ok(PALETTES.gruvbox);

  const prev = process.env.CLAUDE_STATUSLINE_FLAVOR;
  delete process.env.CLAUDE_STATUSLINE_FLAVOR;
  try {
    const bare = renderPayload(fullPayload(), { sources: gitSources(), trackChanges: false, now: NOW });
    const mocha = renderPayload(fullPayload(), {
      sources: gitSources(),
      trackChanges: false,
      now: NOW,
      flavor: "mocha",
    });
    assert.equal(bare, mocha, "no choice means mocha");
  } finally {
    if (prev !== undefined) process.env.CLAUDE_STATUSLINE_FLAVOR = prev;
  }
});

await test("every theme renders every segment", () => {
  const payload = fullPayload({
    output_style: { name: "explanatory" },
    agent: { name: "reviewer" },
    context_window: { used_percentage: 90, total_input_tokens: 180000, context_window_size: 200000 },
    cost: { total_duration_ms: 3_600_000, total_lines_added: 10, total_lines_removed: 2 },
  });
  const sources = { ...gitSources({ changed: 3, conflicts: 1 }), getRtkSavings: () => 70 };

  for (const flavor of Object.keys(PALETTES)) {
    const out = renderPayload(payload, {
      flavor,
      sources,
      trackChanges: false,
      now: NOW,
      maxWidth: 400,
      maxHeight: 40,
    });
    const plain = stripAnsi(out);
    assert.match(plain, /Sonnet 5/, `${flavor} lost the model`);
    assert.match(plain, /Context/, `${flavor} lost the context figure`);
    assert.doesNotMatch(out, /undefined|NaN/, `${flavor} rendered a hole`);
  }
});

await test("the separator is Powerline by default, thin when asked, plain in ASCII mode", () => {
  assert.equal(separatorFor({}), "\u{E0B0}");
  assert.equal(separatorFor({ style: "thin" }), "\u{E0B1}");
  assert.equal(separatorFor({ asciiArrows: true }), "▸");
  assert.equal(
    separatorFor({ asciiArrows: true, style: "thin" }),
    "▸",
    "no Nerd Font beats a preference for a Nerd Font glyph"
  );
});

await test("the thin separator has to be asked for", () => {
  // Principle I, as amended: a plain separator is a declared fallback, never
  // the default. The Powerline arrow is what the design is.
  const prev = process.env.CLAUDE_STATUSLINE_SEPARATOR;
  delete process.env.CLAUDE_STATUSLINE_SEPARATOR;
  try {
    assert.equal(separatorFor({}), "\u{E0B0}");
  } finally {
    if (prev !== undefined) process.env.CLAUDE_STATUSLINE_SEPARATOR = prev;
  }
});

// NO_COLOR is a cross-tool convention, not this project's invention: set to
// anything non-empty it means the person asked every program on the machine
// not to colourise, and a bar that ignores it is one they cannot turn off
// without uninstalling it.
await test("NO_COLOR leaves the bar readable and free of escapes", () => {
  const sources = {
    ...gitSources(),
    getSessionActivity: () => ({ skills: [], skillsTrueCount: 0, todos: null, working: true }),
  };
  const draw = () =>
    renderPayload(fullPayload(), { sources, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });

  const coloured = draw();
  assert.match(coloured, /\x1b\[38;2;/, "colour is on by default");

  process.env.NO_COLOR = "1";
  try {
    const plain = draw();
    assert.doesNotMatch(plain, /\x1b\[/, "no colour, and nothing left half-set");
    // Principle X: colour is never the only carrier, so nothing is lost.
    assert.match(plain, /5h /, "the figures survive");
    assert.match(plain, /working|idle/, "and so does the state");
  } finally {
    delete process.env.NO_COLOR;
  }
});

// An empty value is not a request. The convention says non-empty.
await test("an empty NO_COLOR is not a request to drop colour", () => {
  process.env.NO_COLOR = "";
  try {
    const out = renderPayload(fullPayload(), { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });
    assert.match(out, /\x1b\[38;2;/);
  } finally {
    delete process.env.NO_COLOR;
  }
});
