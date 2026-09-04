import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { scanTailForSkills, scanTail } from "../../src/transcriptTail.js";
import { getActiveSkillsTrueCount } from "../../src/skills.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

const tmpFile = (name = "t.jsonl") => path.join(mkdtempSync(path.join(os.tmpdir(), "skills-complete-")), name);

const entry = (skill) =>
  JSON.stringify({
    type: "assistant",
    timestamp: new Date(NOW).toISOString(),
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
  });

// FR-002/SC-001 (User Story 1): the true count is not capped at what the
// scan happened to examine.
await test("scanTailForSkills reports the true count past the display limit", () => {
  const names = Array.from({ length: 19 }, (_, i) => `skill-${i}`);
  const file = tmpFile();
  writeFileSync(file, names.map(entry).join("\n") + "\n");

  const result = scanTailForSkills(file, { limit: 5, now: NOW + 1000 });
  assert.equal(result.skills.length, 5, "the display list is still capped");
  assert.equal(result.trueCount, 19, "the true count is not");
});

await test("getActiveSkillsTrueCount reflects more skills than SKILLS_SHOWN", () => {
  const out = stripAnsi(
    renderPayload(fullPayload(), {
      sources: {
        ...gitSources(),
        getActiveSkills: () => ["a", "b", "c", "d", "e"],
        getActiveSkillsTrueCount: () => 19,
      },
      trackChanges: false,
      now: NOW,
      ...WIDE,
    })
  );
  assert.match(out, /a, b, c, d, e \+14/, "hidden count reflects the true total, not the display cap");
});

await test("getActiveSkillsTrueCount uses scannedTrueCount when given, else the scanned array's length", () => {
  assert.equal(
    getActiveSkillsTrueCount(undefined, { scanned: ["a", "b"], scannedTrueCount: 19 }),
    19,
    "an explicit scannedTrueCount wins"
  );
  assert.equal(
    getActiveSkillsTrueCount(undefined, { scanned: ["a", "b", "c"] }),
    3,
    "with no scannedTrueCount, the scanned array's own length is the answer"
  );
  assert.equal(getActiveSkillsTrueCount(undefined, {}), 0, "no transcript, no scan, no count");
});

// FR-003 (User Story 2): a skill invoked inside a nested block (as a
// subagent/delegated invocation might appear) is still counted.
await test("a skill nested inside another block's content is still found", () => {
  const file = tmpFile();
  const nested = JSON.stringify({
    type: "assistant",
    timestamp: new Date(NOW).toISOString(),
    message: {
      content: [
        {
          type: "tool_result",
          content: [{ type: "tool_use", name: "Skill", input: { skill: "delegated-skill" } }],
        },
      ],
    },
  });
  writeFileSync(file, nested + "\n");

  const result = scanTailForSkills(file, { limit: 5, now: NOW + 1000 });
  assert.ok(result.skills.includes("delegated-skill"), "a nested skill invocation must be counted");
});

await test("scanTail also finds a nested skill invocation", () => {
  const file = tmpFile();
  const nested = JSON.stringify({
    type: "assistant",
    timestamp: new Date(NOW).toISOString(),
    message: {
      content: [
        {
          type: "tool_result",
          content: [{ type: "tool_use", name: "Skill", input: { skill: "delegated-skill" } }],
        },
      ],
    },
  });
  writeFileSync(file, nested + "\n");

  const result = scanTail(file, { limit: 5, now: NOW + 1000 });
  assert.ok(result.skills.includes("delegated-skill"));
  assert.equal(result.skillsTrueCount, 1);
});

// FR-006: dedup-by-name behaviour is unchanged.
await test("a skill invoked three times still counts once", () => {
  const file = tmpFile();
  writeFileSync(file, [entry("repeat-me"), entry("repeat-me"), entry("repeat-me")].join("\n") + "\n");

  const result = scanTailForSkills(file, { limit: 5, now: NOW + 1000 });
  assert.deepEqual(result.skills, ["repeat-me"]);
  assert.equal(result.trueCount, 1);
});
