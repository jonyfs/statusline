import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { clipAnsi, harnessAgentRows, alignTaskRows } from "../../src/taskRows.js";
import { gateRows } from "../../src/gateRows.js";
import { GLYPHS } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";

// The rows printed after the bar (subagents, Copilot agents, git gates):
// NO_COLOR, and the cut that keeps a row inside the width under Copilot.

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const agents = [
  { id: "a", name: "explore", description: "look around the repository for every caller", startTime: NOW - 60_000, model: "gpt-5", tokenCount: 1000, contextWindowSize: 200_000 },
  { id: "b", name: "plan", description: "draft the plan", startTime: NOW - 1000, model: "gpt-5" },
];
const gate = {
  pid: 1, hook: "pre-commit", worktree: "a-worktree-with-a-long-name", path: "/w",
  branch: "feature/long-branch-name", step: "gates.sh › a step with a long description", startedAt: NOW - 5000, state: "running",
};

async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// NO_COLOR (#5, #13) ----------------------------------------------------------

await test("NO_COLOR leaves no escape in Copilot agent rows, the +N more line included", () =>
  withEnv({ NO_COLOR: "1" }, () => {
    const rows = harnessAgentRows(agents, { columns: 30, now: NOW, cap: 1 });
    assert.equal(rows.length, 2);
    for (const row of rows) assert.ok(!row.includes("\x1b"), JSON.stringify(row));
  }));

await test("NO_COLOR leaves no escape in Claude Code task rows", () =>
  withEnv({ NO_COLOR: "1" }, () => {
    const rows = alignTaskRows(agents, { columns: 120, now: NOW });
    assert.ok(rows.length > 0);
    for (const row of rows) assert.ok(!row.content.includes("\x1b"), JSON.stringify(row.content));
  }));

await test("NO_COLOR leaves no escape in a gate row cut to the width", () =>
  withEnv({ NO_COLOR: "1" }, () => {
    const rows = gateRows([gate], { columns: 40, now: NOW, glyphs: GLYPHS.plain ?? GLYPHS });
    assert.ok(rows[0].endsWith("…"), JSON.stringify(rows[0]));
    assert.ok(!rows[0].includes("\x1b"), JSON.stringify(rows[0]));
  }));

await test("a cut row still closes its colour when colour is on", () =>
  withEnv({ NO_COLOR: "" }, () => {
    assert.ok(clipAnsi("\x1b[31mabcdefghij\x1b[0m", 5).endsWith("…\x1b[0m"));
  }));

// Grapheme clusters (#8) ------------------------------------------------------

await test("an emoji with VS16 is measured as two columns when a row is cut", () => {
  for (const columns of [3, 4, 5, 6]) {
    const out = stripAnsi(clipAnsi("ab⚠️cdefgh", columns));
    assert.ok(displayWidth(out) <= columns, `${columns}: ${JSON.stringify(out)} is ${displayWidth(out)} wide`);
  }
});

await test("a keycap is measured as one emoji when a row is cut", () => {
  const out = stripAnsi(clipAnsi("ab1️⃣cdefgh", 4));
  assert.ok(displayWidth(out) <= 4, JSON.stringify(out));
});

await test("a cut never splits a joined emoji or strips its combining marks", () => {
  const family = "\u{1f468}‍\u{1f469}‍\u{1f467}";
  for (const columns of [2, 3, 4, 5, 6, 7]) {
    const out = stripAnsi(clipAnsi(`a${family}bcdefghij`, columns));
    assert.ok(!/‍…$/.test(out), `${columns}: dangling joiner in ${JSON.stringify(out)}`);
    assert.ok(out === "a…" || out.startsWith(`a${family}`), `${columns}: split family in ${JSON.stringify(out)}`);
  }
  const accented = stripAnsi(clipAnsi("abé̂cdefgh", 3));
  assert.ok(accented === "ab…" || accented.startsWith("abé̂"), JSON.stringify(accented));
});

// The ellipsis's own width (#27) ----------------------------------------------

// Whether U+2026 counts as two columns under CLAUDE_STATUSLINE_AMBIGUOUS_WIDE
// is the width table's call (src/theme.js). Whichever way it measures, a cut
// row has to fit in the width by that same measure.
for (const wide of ["", "1"]) {
  await test(`a cut row fits its width with the ellipsis measured (ambiguous wide=${wide || "off"})`, () =>
    withEnv({ CLAUDE_STATUSLINE_AMBIGUOUS_WIDE: wide }, () => {
      for (const columns of [5, 10, 20]) {
        const out = stripAnsi(clipAnsi("\x1b[31m" + "x".repeat(40) + "\x1b[0m", columns));
        assert.ok(displayWidth(out) <= columns, `${columns}: ${displayWidth(out)}`);
      }
      const rows = gateRows([gate], { columns: 120, now: NOW, glyphs: GLYPHS.plain ?? GLYPHS });
      const cells = stripAnsi(rows[0]).split(" · ");
      // The worktree column pads to 28 and the step to 44; a cut cell keeps inside them.
      assert.ok(displayWidth(cells[1].trimEnd()) <= 28, JSON.stringify(cells[1]));
      assert.ok(displayWidth(cells[3].trimEnd()) <= 44, JSON.stringify(cells[3]));
    }));
}

await test("a gate cell is cut by columns, not characters", () => {
  const wideTree = { ...gate, worktree: "漢".repeat(20) };
  const rows = gateRows([wideTree], { columns: 200, now: NOW, glyphs: GLYPHS.plain ?? GLYPHS });
  const cells = stripAnsi(rows[0]).split(" · ");
  assert.ok(displayWidth(cells[1].trimEnd()) <= 28, `${displayWidth(cells[1])}: ${JSON.stringify(cells[1])}`);
});
