/**
 * specs/079-bar-resilience: the width rules, the pinned chip at the edge of
 * the room, the glyph sharing allow-list, the Nerd width switch, and the
 * state written only when it changes.
 */
import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { fitToWidth, rowWidth } from "../../src/layout.js";
import { runTaskRows } from "../../src/taskRows.js";
import { displayWidth } from "../../src/theme.js";
import { makeHome, withHome } from "./fixtures/home.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const stripAll = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

const seg = (key, text, priority, extra = {}) => ({ key, text, priority, color: "neutral", ...extra });

await test("a pinned chip yields when it cannot fit beside the most important chip, so the row never overflows (FR-012)", () => {
  const model = seg("model", " Opus 5 (1M context) ", 92);
  const help = seg("help", " ? ", 40, { pinned: true });
  const row = [model, help];
  // Room for the model alone, not for both.
  const width = rowWidth([model]) + 1;
  const fitted = fitToWidth(row, width);
  assert.ok(rowWidth(fitted) <= width, `row is ${rowWidth(fitted)} columns in ${width}`);
  assert.deepEqual(
    fitted.map((s) => s.key),
    ["model"],
    "the help chip gives way; the most important chip stays"
  );
  // With room for both, the pinned chip is still drawn and the others make room.
  const roomy = rowWidth(row);
  assert.deepEqual(fitToWidth([seg("rtk", " 27% saved ", 72), ...row], roomy).map((s) => s.key), ["model", "help"]);
});

await test("agent rows take the window's width from COLUMNS when the payload carries none (FR-013)", async () => {
  const task = (id, name) => ({
    id,
    name,
    type: "agent",
    description: "Finding the auth code in a long description that has room to grow on a wide window",
    startTime: NOW - 135_000,
    model: "claude-haiku-4-5",
    contextWindowSize: 200000,
    tokenCount: 40000,
  });
  // The rows shed columns to fit (Claude Code cuts what still overflows), so
  // the width shows in what survives: the token count is shed at 80 columns.
  const text = (out) => out.split("\n").filter(Boolean).map((l) => stripAll(JSON.parse(l).content)).join("\n");
  const home = makeHome();
  const saved = process.env.COLUMNS;
  try {
    await withHome(home, async () => {
      const input = JSON.stringify({ tasks: [task("t1", "explore"), task("t2", "review")] });
      process.env.COLUMNS = "160";
      const wide = text(await runTaskRows({ now: NOW, input }));
      delete process.env.COLUMNS;
      const narrow = text(await runTaskRows({ now: NOW, input }));
      assert.doesNotMatch(narrow, /40k/, "without COLUMNS the rows fit 80 and shed the token count");
      assert.match(wide, /40k/, "with COLUMNS=160 the rows keep it");
      assert.ok(Math.max(...wide.split("\n").map(displayWidth)) <= 160);
    });
  } finally {
    if (saved === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = saved;
  }
});
