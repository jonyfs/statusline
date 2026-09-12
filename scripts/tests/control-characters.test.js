import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { plainText } from "../../src/text.js";
import { renderPayload } from "../../src/render.js";
import { alignTaskRows } from "../../src/taskRows.js";
import { PALETTES } from "../../src/theme.js";

const LAYOUT = { arrangement: null, origin: "default", path: null, error: null };
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

/** A value carrying every way a string can stop being text. */
const HOSTILE = "antes\u001b[2J\r\n\tdepois\u0000\u0007\u009b2J\u007f";

/**
 * What the bar emits on purpose: SGR colour, and a well-formed OSC 8 link
 * whose payload contains neither a BEL nor a newline. Anything left after
 * removing those and the line breaks is a control character the bar did not
 * mean to write.
 */
function leakedControls(output) {
  const ours = output.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07\n]*\x07/g, "");
  return [...ours].filter((c) => c.codePointAt(0) < 32 && c !== "\n");
}

await test("the boundary removes control characters and keeps printable text", () => {
  assert.equal(plainText("antes\ndepois"), "antes depois", "a newline separates two words");
  assert.equal(plainText("a\u001b[2Jb"), "a [2Jb", "the escape goes and the rest is inert text");
  assert.equal(plainText("a\u009b2Jb"), "a 2Jb", "the C1 introducer counts as an escape too");
  assert.equal(plainText("a\u0000\u0007\u007fb"), "a b", "NUL, BEL and DEL go");
  assert.equal(plainText("  a   b  "), "a b", "runs of whitespace collapse");
  assert.equal(plainText(" \r\n\u0000"), null, "nothing printable left is nothing");
  assert.equal(plainText(42), null, "and a non-string was never text");
  assert.equal(plainText("中文 ok"), "中文 ok", "wide characters are printable and stay");
  assert.equal(plainText("configuração"), "configuração", "so do accents");
  assert.equal(plainText("\u{F08EA} ok"), "\u{F08EA} ok", "and so do the Nerd Font glyphs");
});

// The contract with Claude Code is three lines. A newline in any value the bar
// draws decided how many there were, and a width guard that measures lines one
// at a time then measured a 340-column line as if it fit in 120.
await test("a value cannot decide how many lines the bar has", () => {
  const clean = renderPayload(
    { session_id: "s", workspace: { current_dir: "/tmp" }, model: { display_name: "Opus 5" } },
    { maxWidth: 140, maxHeight: 40, trackChanges: false, layout: LAYOUT }
  );
  const expected = clean.split("\n").filter((l) => l.trim()).length;

  const fields = {
    "model.display_name": { model: { display_name: HOSTILE } },
    session_name: { session_name: HOSTILE },
    "agent.name": { agent: { name: HOSTILE } },
    "worktree.name": { worktree: { name: HOSTILE } },
    "effort.level": { effort: { level: HOSTILE } },
    "output_style.name": { output_style: { name: HOSTILE } },
  };
  for (const [name, extra] of Object.entries(fields)) {
    const out = renderPayload(
      { session_id: "s", workspace: { current_dir: "/tmp" }, ...extra },
      { maxWidth: 140, maxHeight: 40, trackChanges: false, layout: LAYOUT }
    );
    assert.equal(
      out.split("\n").filter((l) => l.trim()).length,
      expected,
      `${name} changed the number of lines on the bar`
    );
    assert.deepEqual(leakedControls(out), [], `${name} leaked a control character to the terminal`);
  }
});

// `\x1b[2J` in a value clears the reader's screen, and a half-written OSC 8
// sequence swallows the text after it into a hyperlink. The bar writes its own
// escapes on purpose; a value's escapes are not the bar's, and nothing
// downstream can tell them apart.
await test("a subagent row draws no escape it did not write itself", () => {
  const fields = {
    description: { id: "a", description: HOSTILE },
    label: { id: "a", description: "ok", label: HOSTILE },
    name: { id: "a", name: HOSTILE, description: "ok" },
    status: { id: "a", description: "ok", status: HOSTILE },
  };
  for (const [name, task] of Object.entries(fields)) {
    const rows = alignTaskRows([task], { columns: 200, palette: PALETTES.mocha, now: NOW });
    assert.equal(rows.length, 1, `${name} produced ${rows.length} rows`);
    assert.deepEqual(leakedControls(rows[0].content), [], `${name} leaked a control character`);
    assert.doesNotMatch(rows[0].content, /\n/, `${name} put a newline inside a row`);
  }
});
