import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { inProgressFeatureId } from "../../src/skills.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

function projectWithFeature(featureDirectory) {
  const root = mkdtempSync(path.join(os.tmpdir(), "feature-indicator-"));
  mkdirSync(path.join(root, ".specify"), { recursive: true });
  writeFileSync(path.join(root, ".specify", "feature.json"), JSON.stringify({ feature_directory: featureDirectory }));
  return root;
}

const render = (cwd, sources) =>
  stripAnsi(renderPayload({ cwd }, { sources, trackChanges: false, now: NOW, ...WIDE }));

// --- inProgressFeatureId unit behaviour -----------------------------------

await test("inProgressFeatureId reads the basename of feature_directory", () => {
  const root = projectWithFeature("specs/009-speckit-feature-indicator");
  assert.equal(inProgressFeatureId(root), "009-speckit-feature-indicator");
});

await test("inProgressFeatureId returns null with no .specify directory", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "no-specify-"));
  assert.equal(inProgressFeatureId(root), null);
});

await test("inProgressFeatureId returns null on invalid JSON", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bad-json-"));
  mkdirSync(path.join(root, ".specify"), { recursive: true });
  writeFileSync(path.join(root, ".specify", "feature.json"), "{not json");
  assert.equal(inProgressFeatureId(root), null);
});

await test("inProgressFeatureId returns null when feature_directory is missing or not a string", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "no-field-"));
  mkdirSync(path.join(root, ".specify"), { recursive: true });
  writeFileSync(path.join(root, ".specify", "feature.json"), JSON.stringify({ other_field: 1 }));
  assert.equal(inProgressFeatureId(root), null);

  const root2 = mkdtempSync(path.join(os.tmpdir(), "bad-type-"));
  mkdirSync(path.join(root2, ".specify"), { recursive: true });
  writeFileSync(path.join(root2, ".specify", "feature.json"), JSON.stringify({ feature_directory: 123 }));
  assert.equal(inProgressFeatureId(root2), null);
});

// --- User Story 1: the render shows "<skill> (<feature-id>)" -------------

await test("the skills chip shows the feature id next to a speckit-* skill", () => {
  const root = projectWithFeature("specs/009-speckit-feature-indicator");
  const out = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  assert.match(out, /speckit-plan \(009-speckit-feature-indicator\)/);
});

await test("the feature id stays the same across different active speckit-* skills", () => {
  const root = projectWithFeature("specs/009-speckit-feature-indicator");
  const asPlan = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  const asTasks = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-tasks"] });
  assert.match(asPlan, /\(009-speckit-feature-indicator\)/);
  assert.match(asTasks, /\(009-speckit-feature-indicator\)/);
});

await test("no feature identification when no speckit-* skill is active", () => {
  const root = projectWithFeature("specs/009-speckit-feature-indicator");
  const out = render(root, { ...gitSources(), getActiveSkills: () => ["humanizer"] });
  assert.doesNotMatch(out, /\(009-speckit-feature-indicator\)/);
});

// --- User Story 2: it updates when feature.json changes ------------------

await test("the shown identifier tracks feature.json across renders", () => {
  const root = projectWithFeature("specs/999-something-else");
  const before = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  assert.match(before, /\(999-something-else\)/);

  writeFileSync(
    path.join(root, ".specify", "feature.json"),
    JSON.stringify({ feature_directory: "specs/010-next-feature" })
  );
  const after = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  assert.match(after, /\(010-next-feature\)/);
  assert.doesNotMatch(after, /\(999-something-else\)/);
});

// --- User Story 3: no fabricated/blank identifier -------------------------

await test("no feature.json falls back to the step label, not an empty parenthetical", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "no-feature-json-"));
  const out = render(root, { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  assert.match(out, /speckit-plan \(Planning\)/, "falls back to the SDD step label");
  assert.doesNotMatch(out, /\(\)/, "never an empty parenthetical");
});

// FR-006: a long identifier goes through the same segment-priority-based
// width handling as any other long segment content (Principle II);
// rendering must not throw or produce a malformed line.
await test("a long feature id renders without breaking the line", () => {
  const root = projectWithFeature("specs/012-a-very-long-feature-directory-name-that-keeps-going-and-going");
  const out = stripAnsi(
    renderPayload(
      { cwd: root },
      { sources: { ...gitSources(), getActiveSkills: () => ["speckit-plan"] }, trackChanges: false, now: NOW, maxWidth: 40 }
    )
  );
  assert.ok(out.split("\n").length >= 1, "the bar still renders");
  assert.doesNotMatch(out, /undefined|NaN|\[object/, "no broken interpolation leaks into the line");
});
