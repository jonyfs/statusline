import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { linesToRender, terminalHeight } from "../../src/layout.js";

await test("every line while there is room", () => {
  assert.deepEqual(linesToRender(40), [1, 2, 3]);
  assert.deepEqual(linesToRender(3), [1, 2, 3]);
  assert.deepEqual(linesToRender(Infinity), [1, 2, 3]);
});

await test("skills go first, then any arranged line 4, then the place", () => {
  // Line 3 is the last one standing: it carries the limits whose consequence
  // you cannot undo, and since the merge of 2026-09-07 the model with them.
  assert.deepEqual(linesToRender(2), [1, 3]);
  assert.deepEqual(linesToRender(1), [3]);
  // An arrangement can create line 4; it sheds before the place does.
  assert.deepEqual(linesToRender(3, [1, 2, 3, 4]), [1, 3, 4]);
  assert.deepEqual(linesToRender(2, [1, 2, 3, 4]), [1, 3]);
});

await test("a line already absent is not counted as one to shed", () => {
  // With no skills, line 2 never existed. Two rows should then still show
  // both lines rather than shedding one anyway.
  assert.deepEqual(linesToRender(3, [1, 3]), [1, 3]);
  assert.deepEqual(linesToRender(1, [1, 3]), [3]);
});

await test("everything returns when the rows do", () => {
  // Shedding is a response to the window, not a mode the bar gets stuck in.
  const shed = linesToRender(1);
  assert.deepEqual(shed, [3]);
  assert.deepEqual(linesToRender(40), [1, 2, 3], "the next redraw at full height shows them all again");
});

await test("an unknown height renders everything", () => {
  // Before v2.1.153 Claude Code did not set LINES. Unlimited is the safe
  // unknown: it is what this project did when it could not read the value.
  const prev = process.env.LINES;
  delete process.env.LINES;
  try {
    assert.equal(terminalHeight(), Infinity);
    assert.deepEqual(linesToRender(terminalHeight()), [1, 2, 3]);
  } finally {
    if (prev !== undefined) process.env.LINES = prev;
  }
});

await test("zero rows still renders the line that matters", () => {
  // A terminal that reports no room is a terminal reporting something odd.
  // One line of truth beats zero lines and a blank bar.
  assert.deepEqual(linesToRender(0), [3]);
});

// An arrangement can empty a line, and it can move a segment onto a line
// that would otherwise be empty. Neither changes the order lines are shed
// in: shedding answers the window, and the window does not know or care
// which segments a person chose to put where.
await test("shedding an arranged bar follows the same order", async () => {
  const { renderPayload } = await import("../../src/render.js");
  const { PAYLOAD, SOURCES, FIXED_NOW, SAMPLES } = await import("../composer-fixture.js");
  const { stripAnsi } = await import("../test-harness.js");

  const drawAt = (height, arrangement) =>
    stripAnsi(
      renderPayload(PAYLOAD, {
        sources: { ...SOURCES },
        trackChanges: false,
        now: FIXED_NOW * 1000,
        samples: SAMPLES,
        maxWidth: 200,
        maxHeight: height,
        layout: { arrangement, origin: "test", path: null, error: null },
      })
    ).split("\n");

  // With the skills line emptied, two rows exist rather than three, and
  // neither is shed to make room for a line that is not there.
  const emptied = { version: 1, segments: { skills: { on: false }, todo: { on: false }, activity: { on: false } } };
  assert.equal(drawAt(3, emptied).length, 2, "a bar with two lines shed one anyway");
  assert.ok(drawAt(3, emptied).some((l) => /Opus 5/.test(l)), "the model was shed while there was room");

  // Line 3 is the last one standing, whatever the arrangement did above it:
  // it carries the limits, and it carries the model since the merge.
  const oneRow = drawAt(1, emptied);
  assert.equal(oneRow.length, 1, "more than one line survived a one-row window");
  assert.ok(/Context 46%/.test(oneRow[0]), "the line carrying the limits was not the survivor");
});
