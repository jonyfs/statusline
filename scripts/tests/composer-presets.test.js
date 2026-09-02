/**
 * The preset table's own rules.
 *
 * Every assertion here is about the set rather than about any one design:
 * that each entry is complete enough for the page to argue with, that the
 * ids are unique so a choice can be recorded by name, and that every
 * arrangement is one the resolver actually accepts.
 */

import { test } from "../test-harness.js";
import { PRESETS, preset, presets } from "../composer-presets.js";
import { resolveArrangement } from "../../src/arrangement.js";
import { SEGMENTS } from "../../src/segments.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

await test("every preset carries an id, a label and the three sentences", () => {
  for (const p of PRESETS) {
    assert(typeof p.id === "string" && p.id.length, "a preset has no id");
    assert(typeof p.label === "string" && p.label.length, `${p.id} has no label`);
    for (const field of ["optimisesFor", "givesUp", "forWhom"]) {
      assert(
        typeof p[field] === "string" && p[field].length > 10,
        `${p.id} has no ${field}`
      );
    }
  }
});

await test("every preset carries a conflicts list and an arrangement", () => {
  for (const p of PRESETS) {
    assert(Array.isArray(p.conflicts), `${p.id} has no conflicts array`);
    assert(p.arrangement && typeof p.arrangement === "object", `${p.id} has no arrangement`);
    assert(p.arrangement.version === 1, `${p.id} does not name version 1`);
  }
});

await test("preset ids are unique", () => {
  const seen = new Set();
  for (const p of PRESETS) {
    assert(!seen.has(p.id), `duplicate preset id ${p.id}`);
    seen.add(p.id);
  }
});

await test("presets() and preset() agree with the table", () => {
  assert(presets().length === PRESETS.length, "presets() lost an entry");
  for (const p of PRESETS) {
    assert(preset(p.id) === p, `preset(${p.id}) did not return its own row`);
  }
  assert(preset("no-such-preset") === undefined, "preset() invented a row");
});

await test("every preset's arrangement resolves with nothing ignored", () => {
  for (const p of PRESETS) {
    const resolved = resolveArrangement(SEGMENTS, p.arrangement);
    assert(
      resolved.ignored.length === 0,
      `${p.id} was partly ignored: ${JSON.stringify(resolved.ignored)}`
    );
  }
});

await test("every preset leaves at least one segment on", () => {
  for (const p of PRESETS) {
    const resolved = resolveArrangement(SEGMENTS, p.arrangement);
    assert(resolved.placements.some((s) => s.on), `${p.id} turns everything off`);
  }
});

await test("oneLine is the only preset that names a principle conflict", () => {
  const conflicted = PRESETS.filter((p) => p.conflicts.length).map((p) => p.id);
  assert(
    conflicted.length === 0 || (conflicted.length === 1 && conflicted[0] === "oneLine"),
    `unexpected conflicts: ${conflicted.join(", ")}`
  );
  const one = preset("oneLine");
  if (one) {
    assert(one.conflicts.length === 1, "oneLine should name exactly one principle");
    assert(/Principle II/.test(one.conflicts[0]), "oneLine should name Principle II");
  }
});
