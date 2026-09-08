/**
 * Every segment can be asked what it shows.
 *
 * A terminal cannot raise a tooltip — the statusline is printed once by a
 * process that exits, and nothing is listening when a pointer moves — so the
 * answer lives in the two places a reader can reach it: `doctor --explain`,
 * and the composer page, which is a browser and where hover works
 * (specs/019-explaining-a-segment, routes A and C).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { SEGMENTS, SEGMENT_ABOUT } from "../../src/segments.js";
import { explainSegments } from "../../src/doctor.js";

// The invariant that keeps this from drifting the way the README did: a
// segment added without a sentence fails here rather than shipping as the one
// thing on the bar that cannot explain itself.
await test("every segment has a description, and every description has a segment", () => {
  const keys = SEGMENTS.map((s) => s.key);
  const undescribed = keys.filter((k) => !SEGMENT_ABOUT[k]);
  assert.deepEqual(undescribed, [], `these segments cannot say what they show: ${undescribed}`);

  const orphans = Object.keys(SEGMENT_ABOUT).filter((k) => !keys.includes(k));
  assert.deepEqual(orphans, [], `these describe segments the registry does not have: ${orphans}`);
});

await test("a description says something the label does not", () => {
  for (const [key, text] of Object.entries(SEGMENT_ABOUT)) {
    assert.ok(text.length > 30, `${key} is too short to be an explanation`);
    assert.ok(/[.!]$/.test(text), `${key} is not a sentence`);
    assert.notEqual(text.toLowerCase(), key.toLowerCase(), `${key} only restates its own name`);
  }
});

await test("doctor --explain lists every segment, in the order the eye meets them", () => {
  const out = explainSegments();
  for (const { key } of SEGMENTS) {
    assert.ok(out.includes(key), `${key} is missing from the explanation`);
  }
  // Grouped by line, and the lines in order.
  const lines = [...out.matchAll(/^line (\d)$/gm)].map((m) => Number(m[1]));
  assert.deepEqual(lines, [...lines].sort((a, b) => a - b), "the lines are in order");
  assert.deepEqual(lines, [...new Set(lines)], "each line is announced once");
});

// Route A: the page is the tool rather than a project, so pointing at it
// carries none of what made the terminal links wrong (specs/020).
await test("the composer page carries the descriptions for hover", () => {
  const page = readFileSync(
    new URL("../../specs/004-statusline-redesign-research/composer.html", import.meta.url),
    "utf8"
  );
  assert.match(page, /label\.title = ABOUT\[placement\.key\]/, "the label carries it on hover");
  for (const { key } of SEGMENTS) {
    assert.ok(page.includes(`"${key}":`), `${key} has no description embedded in the page`);
  }
});
