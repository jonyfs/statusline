/**
 * What an arrangement is allowed to do, and what it is not.
 *
 * The three fields it may set are covered here one at a time, and so is
 * every way the contract says a file can be wrong. The point of the last
 * group is that none of them is an error: a bar that refuses to draw
 * because somebody mistyped a segment name is worse than one that draws the
 * default and says what it ignored.
 */

import { test } from "../test-harness.js";
import { resolveArrangement, placementsForLine, activeKeys } from "../../src/arrangement.js";
import { SEGMENTS } from "../../src/segments.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const find = (resolved, key) => resolved.placements.find((p) => p.key === key);

await test("no arrangement returns the registry unchanged", () => {
  for (const arrangement of [null, undefined, { version: 1 }, { version: 1, segments: {} }]) {
    const resolved = resolveArrangement(SEGMENTS, arrangement);
    assert(resolved.placements.length === SEGMENTS.length, "lost a segment");
    assert(resolved.ignored.length === 0, "ignored something from an empty arrangement");
    for (const row of SEGMENTS) {
      const p = find(resolved, row.key);
      assert(p.line === row.line, `${row.key} moved line`);
      assert(p.order === row.order, `${row.key} moved within its line`);
      assert(p.on === true, `${row.key} is off by default`);
    }
  }
});

await test("on: false removes a segment whatever its priority", () => {
  // Context carries the highest priority on the bar, so if anything survives
  // being switched off it is this one.
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { context: { on: false }, rtk: { on: false } },
  });
  assert(find(resolved, "context").on === false, "context stayed on");
  assert(find(resolved, "rtk").on === false, "rtk stayed on");
  assert(!activeKeys(resolved).includes("context"), "context is still active");
  assert(placementsForLine(resolved, 4).every((p) => p.key !== "context"), "context is still on line 4");
});

await test("line and order override the registry", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { skills: { line: 1, order: 5 } },
  });
  const skills = find(resolved, "skills");
  assert(skills.line === 1, "skills did not move to line 1");
  assert(skills.order === 5, "skills did not take its new order");
  assert(placementsForLine(resolved, 1)[0].key === "skills", "skills is not first on line 1");
  assert(placementsForLine(resolved, 2).every((p) => p.key !== "skills"), "skills is still on line 2");
});

await test("priority and colour never come from the arrangement", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { priority: 100, colour: "ramp", on: true } },
  });
  const registryRow = SEGMENTS.find((s) => s.key === "rtk");
  const rtk = find(resolved, "rtk");
  assert(rtk.priority === registryRow.priority, "priority was overridden");
  assert(rtk.colour === registryRow.colour, "colour was overridden");
});

await test("alignment does come from the arrangement, and only as left or right", () => {
  const good = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { align: "right" } },
  });
  assert(find(good, "rtk").align === "right", "the segment did not move to the right edge");
  assert(good.ignored.length === 0, "a valid alignment was reported as ignored");

  const bad = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { align: "centre", on: false } },
  });
  const registryRow = SEGMENTS.find((s) => s.key === "rtk");
  assert(find(bad, "rtk").align === registryRow.align, "an unknown alignment was applied");
  assert(find(bad, "rtk").on === false, "the good switch beside it was dropped");
  assert(bad.ignored.some((i) => i.what === "align"), "the bad alignment was not reported");
});

await test("an unknown segment key is ignored and named", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { notASegment: { on: false }, rtk: { on: false } },
  });
  const entry = resolved.ignored.find((i) => i.key === "notASegment");
  assert(entry, "the unknown key was not reported");
  assert(entry.reason === "no such segment", "the reason was not the one the contract names");
  assert(find(resolved, "rtk").on === false, "the valid entry beside it was dropped too");
});

await test("an unknown version drops the file whole", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 2,
    segments: { rtk: { on: false } },
  });
  assert(find(resolved, "rtk").on === true, "an entry from an unknown version was applied");
  const entry = resolved.ignored.find((i) => i.what === "version");
  assert(entry && entry.value === 2, "the version was not reported");
  assert(resolved.origin === "default", "the origin did not fall back");
});

await test("a line outside 1..4 drops that field only", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { line: 9, order: 5, on: false } },
  });
  const rtk = find(resolved, "rtk");
  const registryRow = SEGMENTS.find((s) => s.key === "rtk");
  assert(rtk.line === registryRow.line, "the bad line was applied");
  assert(rtk.order === 5, "the good order beside it was dropped");
  assert(rtk.on === false, "the good switch beside it was dropped");
  assert(resolved.ignored.some((i) => i.what === "line" && i.key === "rtk"), "the bad line was not reported");
});

await test("a non-numeric order drops that field only", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { order: "first", line: 2 } },
  });
  const rtk = find(resolved, "rtk");
  const registryRow = SEGMENTS.find((s) => s.key === "rtk");
  assert(rtk.order === registryRow.order, "the bad order was applied");
  assert(rtk.line === 2, "the good line beside it was dropped");
  assert(resolved.ignored.some((i) => i.what === "order" && i.key === "rtk"), "the bad order was not reported");
});

await test("a non-boolean on is refused", () => {
  const resolved = resolveArrangement(SEGMENTS, {
    version: 1,
    segments: { rtk: { on: "no" } },
  });
  assert(find(resolved, "rtk").on === true, "a string was treated as a switch");
  assert(resolved.ignored.some((i) => i.what === "on" && i.key === "rtk"), "the bad switch was not reported");
});

await test("a file that is not an object is refused without throwing", () => {
  for (const bad of ["", 7, [], "not json at all"]) {
    const resolved = resolveArrangement(SEGMENTS, bad);
    assert(resolved.placements.length === SEGMENTS.length, "the default was not returned");
    assert(resolved.ignored.length === 1, "the refusal was not reported once");
  }
});

await test("segments given the same order resolve deterministically", () => {
  const arrangement = {
    version: 1,
    segments: { branch: { line: 1, order: 10 }, dir: { line: 1, order: 10 } },
  };
  const first = placementsForLine(resolveArrangement(SEGMENTS, arrangement), 1).map((p) => p.key);
  const second = placementsForLine(resolveArrangement(SEGMENTS, arrangement), 1).map((p) => p.key);
  assert(JSON.stringify(first) === JSON.stringify(second), "two resolutions disagreed");
  // dir comes before branch in the registry, so the tie breaks that way.
  assert(first.indexOf("dir") < first.indexOf("branch"), "the tie did not break on registry order");
});

await test("the origin is carried through, and falls back when the file is refused", () => {
  const good = resolveArrangement(SEGMENTS, { version: 1, name: "mine" }, "user");
  assert(good.origin === "user", "the origin was lost");
  assert(good.name === "mine", "the name was lost");
  const bad = resolveArrangement(SEGMENTS, { version: 3 }, "user");
  assert(bad.origin === "default", "a refused file kept its origin");
});
