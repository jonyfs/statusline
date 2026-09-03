/**
 * The bar under an arrangement, end to end.
 *
 * These go through `renderPayload` rather than the internals, because the
 * promise being tested is the one a person meets: they write a file, the bar
 * redraws, and what they asked for is what they get. The most important case
 * is the last kind — that with no file at all, nothing about the output
 * moved.
 */

import { test, stripAnsi } from "../test-harness.js";
import { displayWidth } from "../../src/theme.js";
import { renderPayload } from "../../src/render.js";
import { PAYLOAD, SOURCES, FIXED_NOW, SAMPLES } from "../composer-fixture.js";
import { PRESETS } from "../composer-presets.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };

/** The bar as text, for one arrangement, at one width. */
function draw(arrangement, { width = 200, sources = SOURCES } = {}) {
  return stripAnsi(
    renderPayload(PAYLOAD, {
      sources: { ...sources },
      trackChanges: false,
      now: FIXED_NOW * 1000,
      samples: SAMPLES,
      maxWidth: width,
      maxHeight: 40,
      layout: arrangement
        ? { arrangement, origin: "test", path: null, error: null }
        : NO_ARRANGEMENT,
    })
  );
}

const lines = (text) => text.split("\n");

await test("with no arrangement the bar is what it always was", () => {
  const withNothing = draw(null);
  const withEmpty = draw({ version: 1, segments: {} });
  assert(withNothing === withEmpty, "an empty arrangement changed the bar");
  assert(lines(withNothing).length === 4, "the bar no longer draws four lines");
  assert(/rtk 81% saved/.test(withNothing), "the savings segment is missing from the baseline");
});

await test("a segment switched off leaves the bar", () => {
  const before = draw(null);
  const after = draw({ version: 1, segments: { rtk: { on: false } } });
  assert(/rtk 81% saved/.test(before), "the baseline has no savings segment to remove");
  assert(!/rtk 81% saved/.test(after), "the savings segment survived being switched off");
  assert(/Context 46%/.test(after), "something else was removed along with it");
});

await test("a segment switched off leaves whatever its priority", () => {
  // Context carries the highest priority on the bar. If anything ignores an
  // off switch, it is this.
  const after = draw({ version: 1, segments: { context: { on: false } } });
  assert(!/Context 46%/.test(after), "the highest-priority segment ignored being switched off");
});

await test("a segment moved to another line renders there", () => {
  const after = lines(draw({ version: 1, segments: { skills: { line: 3, order: 5 } } }));
  assert(after.some((l) => /Opus 5/.test(l) && /speckit-implement/.test(l)), "skills did not land beside the model");
  assert(!after.some((l) => /speckit-implement/.test(l) && /working/.test(l)), "skills is still on its old line");
});

await test("the line a segment left still renders", () => {
  const after = lines(draw({ version: 1, segments: { skills: { line: 3, order: 5 } } }));
  assert(after.some((l) => /working/.test(l)), "line 2 disappeared when its first segment left");
  assert(after.length === 4, `the bar drew ${after.length} lines instead of four`);
});

await test("a line emptied by an arrangement is dropped rather than drawn blank", () => {
  const after = lines(draw({
    version: 1,
    segments: { skills: { on: false }, todo: { on: false }, activity: { on: false } },
  }));
  assert(after.length === 3, `the bar drew ${after.length} lines instead of three`);
  assert(after.every((l) => l.trim().length), "a blank line was drawn");
});

await test("a segment holds its position when a neighbour has nothing to say", () => {
  const withCi = lines(draw(null))[0];
  const withoutCi = lines(draw(null, { sources: { ...SOURCES, getCiStatus: () => null } }))[0];
  const order = (line) => ["statusline", "004-statusline", "PR #128"].filter((t) => line.includes(t));
  assert(
    JSON.stringify(order(withCi)) === JSON.stringify(order(withoutCi)),
    "the surviving segments changed order when the CI tick disappeared"
  );
  assert(/CI/.test(withCi) && !/CI/.test(withoutCi), "the test did not actually remove the CI tick");
});

await test("everything on one line still fits or drops, and never wraps", () => {
  const oneLine = PRESETS.find((p) => p.id === "oneLine");
  for (const width of [60, 80, 120, 200]) {
    const drawn = lines(draw(oneLine.arrangement, { width }));
    assert(drawn.length === 1, `${width} columns drew ${drawn.length} lines`);
    // Columns, not code units: an astral Nerd Font glyph is one column and
    // two code units, so `String.length` would fail a line that fits.
    assert(
      displayWidth(drawn[0]) <= width + 1,
      `${width} columns produced a ${displayWidth(drawn[0])}-column line`
    );
  }
});

await test("every preset draws something at every offered width", () => {
  for (const preset of PRESETS) {
    for (const width of [80, 120, 160]) {
      const drawn = lines(draw(preset.arrangement, { width }));
      assert(drawn.length >= 1 && drawn[0].trim().length, `${preset.id} drew nothing at ${width}`);
      for (const line of drawn) {
        assert(
          displayWidth(line) <= width + 1,
          `${preset.id} drew ${displayWidth(line)} columns at ${width}`
        );
      }
    }
  }
});

await test("an arrangement that turns everything off draws nothing", () => {
  const everything = {};
  for (const key of [
    "dir", "projectDir", "repo", "branch", "worktree", "conflicts", "worktreeState",
    "linesChanged", "pr", "ci", "skills", "todo", "activity", "model",
    "effort", "context", "fiveHour", "burnRate", "projection", "sevenDay",
    "resetMerged", "duration", "rtk",
  ]) {
    everything[key] = { on: false };
  }
  const drawn = draw({ version: 1, segments: everything });
  assert(drawn.trim() === "", "something was drawn on a bar with every segment off");
});

await test("an arrangement the resolver refuses leaves the bar at its default", () => {
  const baseline = draw(null);
  for (const bad of [
    { version: 2, segments: { rtk: { on: false } } },
    { version: 1, segments: { notASegment: { on: false } } },
    "not an object",
  ]) {
    assert(draw(bad) === baseline, `a bad arrangement changed the bar: ${JSON.stringify(bad)}`);
  }
});
