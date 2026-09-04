import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { findViolations } from "../check-english-strings.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";
import { renderTaskRow } from "../../src/taskRows.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

/**
 * FR-001–FR-003: every tool-authored string the statusline can emit (segment
 * labels, CLI help/doctor text) must be English. The regression check itself
 * (scripts/check-english-strings.js) is the enforcement mechanism; this test
 * proves it currently passes and stays wired into the suite (FR-007).
 */
await test("no non-English tool-authored strings in src/ or bin/cli.js", () => {
  const violations = findViolations();
  assert.deepEqual(violations, [], `found: ${JSON.stringify(violations)}`);
});

/**
 * FR-004: pass-through data (branch names, task titles, commit messages)
 * must render unchanged regardless of language, since it is not
 * tool-authored text.
 */
await test("a non-English branch name renders unchanged", () => {
  const out = stripAnsi(
    renderPayload(fullPayload(), {
      sources: gitSources({ branch: "correção-de-bug" }),
      trackChanges: false,
      now: NOW,
      maxWidth: 400,
      maxHeight: 40,
    })
  );
  assert.ok(out.includes("correção-de-bug"), "branch name must appear unchanged in the rendered line");
});

await test("a non-English task description renders unchanged", () => {
  const row = renderTaskRow(
    {
      id: "t1",
      name: "explore",
      type: "agent",
      description: "Corrigindo o bug de autenticação",
      startTime: NOW - 60_000,
    },
    { columns: 80, now: NOW }
  );
  const text = row.content.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(text, /Corrigindo o bug de autenticação/);
});
