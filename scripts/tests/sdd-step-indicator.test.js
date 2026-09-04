import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

// A cwd with no `.specify/feature.json`, so these step-label cases stay
// isolated from specs/009-speckit-feature-indicator's fallback-chain
// behaviour (a real feature.json would take precedence over the step
// label, which is exactly what that feature intends — see its own tests).
const NO_FEATURE_JSON_CWD = mkdtempSync(path.join(os.tmpdir(), "sdd-step-"));

const render = (payload, sources) =>
  stripAnsi(renderPayload({ cwd: NO_FEATURE_JSON_CWD, ...payload }, { sources, trackChanges: false, now: NOW, ...WIDE }));

// FR-001/FR-002 (User Story 1): a step label shows next to an active speckit skill.
await test("a speckit-* skill's step label appears on the skills chip", () => {
  const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => ["speckit-plan"] });
  assert.match(out, /speckit-plan \(Planning\)/);
});

// Acceptance Scenario 4: no speckit-* skill active means no step label.
await test("no step label when no speckit-* skill is active", () => {
  const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => ["humanizer"] });
  assert.match(out, /humanizer/);
  assert.doesNotMatch(out, /\(.*ing\)/);
});

// FR-005: the most recently active skill (index 0) wins when several speckit-* skills overlap.
await test("the most recently active speckit-* skill's step wins", () => {
  const out = render(fullPayload(), {
    ...gitSources(),
    getActiveSkills: () => ["speckit-tasks", "speckit-plan"],
  });
  assert.match(out, /\(Writing tasks\)/);
  assert.doesNotMatch(out, /\(Planning\)/);
});

// User Story 2: no separate expiry logic; the label simply follows getActiveSkills's output.
await test("no skills active means no skills chip at all, and no step label", () => {
  const out = render(fullPayload(), { ...gitSources(), getActiveSkills: () => [] });
  assert.doesNotMatch(out, /\(.*ing\)/);
});
