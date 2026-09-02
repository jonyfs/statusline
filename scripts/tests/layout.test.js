import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import {
  terminalWidth,
  terminalHeight,
  fitToWidth,
  splitByAlignment,
  alignColumns,
  DEFAULT_WIDTH,
} from "../../src/layout.js";

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === null) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const seg = (key, priority, text, align = "left") => ({ key, priority, text, align, color: "yellow" });

await test("width comes from COLUMNS, and falls back when it is absent", () => {
  // Claude Code sets COLUMNS before running the command, as of v2.1.153.
  // Before that it does not, and 120 is what this project assumed for
  // everyone.
  withEnv({ COLUMNS: "97" }, () => assert.equal(terminalWidth(), 97));
  withEnv({ COLUMNS: null }, () => assert.equal(terminalWidth(), DEFAULT_WIDTH));
  withEnv({ COLUMNS: "not a number" }, () => assert.equal(terminalWidth(), DEFAULT_WIDTH));
  withEnv({ COLUMNS: "0" }, () => assert.equal(terminalWidth(), DEFAULT_WIDTH));
});

await test("height comes from LINES, and an absent one means unlimited", () => {
  withEnv({ LINES: "24" }, () => assert.equal(terminalHeight(), 24));
  withEnv({ LINES: null }, () => assert.equal(terminalHeight(), Infinity));
});

await test("a line that fits keeps everything", () => {
  const row = [seg("a", 90, " aaa "), seg("b", 50, " bbb ")];
  assert.deepEqual(fitToWidth(row, 200).map((s) => s.key), ["a", "b"]);
});

await test("what survives a narrow line is what the priority table says", () => {
  const row = [
    seg("dir", 96, " 📁 statusline "),
    seg("branch", 98, " ⎇ some-long-branch-name "),
    seg("state", 86, " ● 3  ✚ 7 "),
    seg("pr", 82, " PR #12 approved "),
    seg("rtk", 40, " 🦀 rtk 80% saved "),
  ];
  // Wide: everything.
  assert.equal(fitToWidth(row, 200).length, 5);
  // Narrow: the lowest priority goes first, whatever its position.
  const tight = fitToWidth(row, 60).map((s) => s.key);
  assert.ok(!tight.includes("rtk"), "the lowest priority is the first to go");
  assert.ok(tight.includes("branch") && tight.includes("dir"), "the top band survives");
  // Narrower still: the two top-band segments, still in position order
  // rather than priority order.
  const tighter = fitToWidth(row, 44).map((s) => s.key);
  assert.deepEqual(tighter, ["dir", "branch"], "in position order, not priority order");

  // Narrower than either pair: the single highest priority.
  assert.deepEqual(fitToWidth(row, 30).map((s) => s.key), ["branch"]);
});

await test("a segment never moves because a neighbour disappeared", () => {
  // Priority decides presence, position decides place. Mixing them would
  // make the bar rearrange itself as values change, which is the churn
  // Principle X exists to prevent.
  const row = [seg("a", 60, " aaaa "), seg("b", 99, " bbbb "), seg("c", 50, " cccc ")];
  assert.deepEqual(fitToWidth(row, 200).map((s) => s.key), ["a", "b", "c"]);
  assert.deepEqual(fitToWidth(row, 14).map((s) => s.key), ["a", "b"]);
  assert.deepEqual(fitToWidth(row, 7).map((s) => s.key), ["b"]);
});

await test("nothing fits: the highest priority still renders", () => {
  // A bar with nothing on it is worse than a bar with one thing on it that
  // overflows by a column.
  const row = [seg("a", 10, " a very long segment indeed "), seg("b", 99, " the important one ")];
  assert.deepEqual(fitToWidth(row, 4).map((s) => s.key), ["b"]);
});

await test("right-aligned segments are separated from the left group", () => {
  const row = [
    seg("dir", 96, " 📁 x "),
    seg("reset", 80, " 1h29m ", "right"),
    seg("branch", 98, " main "),
  ];
  const { left, right } = splitByAlignment(row);
  assert.deepEqual(left.map((s) => s.key), ["dir", "branch"]);
  assert.deepEqual(right.map((s) => s.key), ["reset"]);
});

await test("column alignment pads the first segment to the widest across lines", () => {
  const lines = [
    [seg("dir", 96, " statusline ")],
    [seg("model", 92, " Opus 5 ")],
  ];
  const aligned = alignColumns(lines, 200);
  const widths = aligned.map((l) => l[0].text.length);
  assert.equal(widths[0], widths[1], "the first boundary lines up down the bar");
});

await test("alignment yields when padding would break the width limit", () => {
  // D8 and the width limit can disagree, and the width limit is the one with
  // a consequence: a padded line that overflows wraps, and a wrapped bar
  // costs a whole terminal row.
  const lines = [
    [seg("a", 90, " a-very-wide-first-segment-here ")],
    [seg("b", 90, " b "), seg("c", 50, " cccccccccccccccccc ")],
  ];
  // Alignment only ever adds padding; making a line fit is fitToWidth's job.
  // So what this checks is that no padding was added where it would push a
  // line past the limit.
  const aligned = alignColumns(lines, 24);
  for (const [i, line] of aligned.entries()) {
    const before = lines[i].reduce((n, s) => n + s.text.length, 0);
    const after = line.reduce((n, s) => n + s.text.length, 0);
    assert.equal(after, before, `alignment padded a line that was already at ${before} columns`);
  }

  // With room, it pads.
  const roomy = alignColumns(lines, 200);
  assert.ok(
    roomy[1][0].text.length > lines[1][0].text.length,
    "given the width, the shorter first segment is padded to match"
  );
});

// Priority is not arrangeable, and this is why: what a narrow terminal drops
// has to stay a decision taken once in the registry, even on a bar somebody
// rearranged. Moving a low-priority segment onto a crowded line makes it the
// first thing to go there, not the last.
await test("an arranged bar still drops by priority", async () => {
  const { renderPayload } = await import("../../src/render.js");
  const { PAYLOAD, SOURCES, FIXED_NOW, SAMPLES } = await import("../composer-fixture.js");
  const { stripAnsi } = await import("../test-harness.js");

  const draw = (arrangement, width) =>
    stripAnsi(
      renderPayload(PAYLOAD, {
        sources: { ...SOURCES },
        trackChanges: false,
        now: FIXED_NOW * 1000,
        samples: SAMPLES,
        maxWidth: width,
        maxHeight: 40,
        layout: { arrangement, origin: "test", path: null, error: null },
      })
    );

  // rtk carries the lowest priority on the bar and context the highest.
  // Put both on line 3 and squeeze it: the savings figure goes first.
  const moved = { version: 1, segments: { rtk: { line: 3, order: 5 }, context: { line: 3, order: 6 } } };
  const roomy = draw(moved, 200);
  assert.ok(/rtk 81% saved/.test(roomy), "the savings figure is missing before the squeeze");
  assert.ok(/Context 46%/.test(roomy), "the context figure is missing before the squeeze");

  // Narrow enough that the four segments on that line cannot all fit: at 60
  // columns they still do, which is the whole point of measuring rather than
  // assuming.
  const tight = draw(moved, 36);
  assert.ok(/Context 46%/.test(tight), "the highest-priority segment was dropped");
  assert.ok(!/rtk 81% saved/.test(tight), "the lowest-priority segment survived a 60-column window");
});
