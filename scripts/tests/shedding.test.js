import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { linesToRender, terminalHeight } from "../../src/layout.js";

await test("four lines while there is room", () => {
  assert.deepEqual(linesToRender(40), [1, 2, 3, 4]);
  assert.deepEqual(linesToRender(4), [1, 2, 3, 4]);
  assert.deepEqual(linesToRender(Infinity), [1, 2, 3, 4]);
});

await test("skills go first, then the model, then the place", () => {
  // The order the owner chose on 2026-08-26. Line 4 is the last one
  // standing, because it is the only line carrying a limit whose
  // consequence you cannot undo.
  assert.deepEqual(linesToRender(3), [1, 3, 4]);
  assert.deepEqual(linesToRender(2), [1, 4]);
  assert.deepEqual(linesToRender(1), [4]);
});

await test("a line already absent is not counted as one to shed", () => {
  // With no skills, line 2 never existed. Three rows should then still show
  // all three lines rather than shedding the model as well.
  assert.deepEqual(linesToRender(3, [1, 3, 4]), [1, 3, 4]);
  assert.deepEqual(linesToRender(2, [1, 3, 4]), [1, 4]);
});

await test("everything returns when the rows do", () => {
  // Shedding is a response to the window, not a mode the bar gets stuck in.
  const shed = linesToRender(1);
  assert.deepEqual(shed, [4]);
  assert.deepEqual(linesToRender(40), [1, 2, 3, 4], "the next redraw at full height shows four again");
});

await test("an unknown height renders everything", () => {
  // Before v2.1.153 Claude Code did not set LINES. Unlimited is the safe
  // unknown: it is what this project did when it could not read the value.
  const prev = process.env.LINES;
  delete process.env.LINES;
  try {
    assert.equal(terminalHeight(), Infinity);
    assert.deepEqual(linesToRender(terminalHeight()), [1, 2, 3, 4]);
  } finally {
    if (prev !== undefined) process.env.LINES = prev;
  }
});

await test("zero rows still renders the line that matters", () => {
  // A terminal that reports no room is a terminal reporting something odd.
  // One line of truth beats zero lines and a blank bar.
  assert.deepEqual(linesToRender(0), [4]);
});
