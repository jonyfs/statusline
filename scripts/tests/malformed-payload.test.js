import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { alignTaskRows, elapsed } from "../../src/taskRows.js";
import { formatResetCountdown } from "../../src/tokens.js";
import { PALETTES, displayWidth } from "../../src/theme.js";

const LAYOUT = { arrangement: null, origin: "default", path: null, error: null };
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

function render(payload) {
  return strip(
    renderPayload(payload, { maxWidth: 200, maxHeight: 40, trackChanges: false, layout: LAYOUT })
  );
}

// Claude Code sends well-typed payloads. This is about what reaches the bar
// when something upstream changes shape: an object interpolates as the
// literal `[object Object]` and a boolean as `true`, both of which render as
// confident, meaningless text in a place a reader trusts. It has happened
// here once already, when a refresh wrapped a numeric value in a branch
// object and the bar showed `[object Object]` for the rtk savings for a day.
await test("a payload field of the wrong type never reaches the bar as text", () => {
  const fields = {
    "model.display_name": (v) => ({ model: { display_name: v } }),
    "model.id": (v) => ({ model: { id: v } }),
    "effort.level": (v) => ({ effort: { level: v } }),
    "output_style.name": (v) => ({ output_style: { name: v } }),
    "agent.name": (v) => ({ agent: { name: v } }),
    session_name: (v) => ({ session_name: v }),
    "workspace.project_dir": (v) => ({ workspace: { project_dir: v, current_dir: "/tmp" } }),
    "workspace.git_worktree": (v) => ({ workspace: { git_worktree: v, current_dir: "/tmp" } }),
    "worktree.name": (v) => ({ worktree: { name: v } }),
    "worktree.original_branch": (v) => ({ worktree: { name: "wt", original_branch: v } }),
  };
  const wrong = { object: { a: 1 }, array: [1, 2], boolean: true, number: 42 };

  for (const [name, build] of Object.entries(fields)) {
    for (const [kind, value] of Object.entries(wrong)) {
      const out = render(build(value));
      assert.doesNotMatch(out, /\[object Object\]/, `${name} as ${kind} leaked an object`);
      assert.doesNotMatch(out, /\btrue\b|\bfalse\b/, `${name} as ${kind} leaked a boolean`);
    }
  }
});

// `workspace.repo` is the exception that proves the rule: it is *meant* to be
// an object (`{host, owner, name}`) and is read structurally, not printed. A
// guard that treated it as text silently removed the repository from line 1 —
// caught by "repository identity comes from the payload, and git remote is not
// called" in payload-segments.test.js, which owns that case and needs a real
// repository to assert it. Nothing is re-asserted here.

await test("an agent name of the wrong type does not become [object Object]", () => {
  const rows = alignTaskRows([{ id: "a", name: { z: 3 }, description: "Fix the parser" }], {
    columns: 200,
    palette: PALETTES.mocha,
    now: NOW,
  });
  assert.doesNotMatch(strip(rows[0].content), /\[object Object\]/);
  assert.match(strip(rows[0].content), /Fix the parser/, "the brief still names the row");
});

// Three cells all stating a quantity that cannot exist: `-10%` beside an
// empty bar, and `-100` tokens. An impossible count is an unknown count.
await test("an impossible token count is unknown, not negative", () => {
  const rows = alignTaskRows(
    [{ id: "a", description: "x", tokenCount: -100, contextWindowSize: 1000 }],
    { columns: 200, palette: PALETTES.mocha, now: NOW }
  );
  const row = strip(rows[0].content);
  assert.doesNotMatch(row, /-\d+%/, "a negative percentage is not a reading");
  assert.doesNotMatch(row, /-100/, "nor is a negative token count");
});

// `bar()` clamps to 0-100; the figure beside it has to agree, or a task over
// its own window reads as `500%` against a bar that stops at full.
await test("a task past its own window reads as full, not as 500%", () => {
  const rows = alignTaskRows(
    [{ id: "a", description: "x", tokenCount: 5000, contextWindowSize: 1000 }],
    { columns: 200, palette: PALETTES.mocha, now: NOW }
  );
  assert.match(strip(rows[0].content), /100%/);
  assert.doesNotMatch(strip(rows[0].content), /500%/);
});

// A timestamp in seconds is a perfectly finite number, and subtracting it
// from a millisecond clock yields about fifty-five years — which the
// formatter rendered as a confident `488076h00m`.
await test("a start time in the wrong unit is unknown, not fifty-five years", () => {
  assert.equal(elapsed(Math.floor(NOW / 1000), NOW), null, "seconds where milliseconds were meant");
  assert.equal(elapsed(0, NOW), null, "the epoch is not a plausible start");
  assert.equal(elapsed(-5, NOW), null, "nor is a negative");
  assert.equal(elapsed(NOW - 3_840_000, NOW), "1h04m", "a real age still reads");
});

// Both windows this formats are bounded by their own names: five hours and
// seven days. Further out is a unit mismatch, not a longer window.
await test("a reset further out than any window it describes is unknown", () => {
  const seconds = Math.floor(NOW / 1000);
  assert.equal(formatResetCountdown(NOW, NOW), null, "milliseconds where seconds were meant");
  assert.equal(formatResetCountdown(seconds + 31 * 86400, NOW), null, "past any window it names");
  assert.equal(formatResetCountdown(seconds + 1320, NOW), "resets in 0h22m", "a real reset still reads");
  assert.equal(formatResetCountdown(seconds + 3 * 86400, NOW), "resets in 3d 0h", "and so does a seven-day one");
});

// The substitute set exists because the Nerd Font is absent, so it cannot be
// filled with private use area codepoints. What it must not contain is emoji:
// every one is two columns wide where the glyph it stands in for is one, so
// the substitute set drew a different bar from the real one rather than the
// same bar in plainer clothes. Checked in both ambiguity modes, because a
// terminal configured for East Asian text has to measure the same widths.
await test("the no-Nerd-Font glyph set is one column wide, with no emoji", async () => {
  const { GLYPHS } = await import("../../src/render.js");
  const entries = Object.entries(GLYPHS.plain);
  assert.ok(entries.length >= 20, "the substitute set should cover the bar");

  for (const [name, glyph] of entries) {
    for (const ch of glyph) {
      const cp = ch.codePointAt(0);
      assert.ok(cp < 0x1f000, `${name} uses an emoji (U+${cp.toString(16).toUpperCase()})`);
      assert.ok(
        cp < 0xe000 || cp > 0xf8ff,
        `${name} uses a private use area codepoint, which is the font this set exists without`
      );
    }
    assert.equal(displayWidth(glyph), 1, `${name} must measure one column`);
  }
});
