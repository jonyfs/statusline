import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { getActiveSkills, sddStepFor } from "../../src/skills.js";

const tmpFile = (name = "t.jsonl") =>
  path.join(mkdtempSync(path.join(os.tmpdir(), "skills-")), name);

const entry = (ts, skill) =>
  JSON.stringify({
    type: "assistant",
    ...(ts ? { timestamp: ts } : {}),
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
  });

await test("skills expire once they stop being used", () => {
  const file = tmpFile();
  const at = (iso) => Date.parse(iso);

  writeFileSync(
    file,
    [
      entry("2026-01-01T10:00:00.000Z", "old-skill"),
      entry("2026-01-01T12:00:00.000Z", "fresh-skill"),
    ].join("\n")
  );

  assert.deepEqual(
    getActiveSkills(file, 3, { now: at("2026-01-01T12:05:00.000Z") }),
    ["fresh-skill"],
    "a skill used two hours ago must not sit beside one used five minutes ago"
  );
  assert.deepEqual(
    getActiveSkills(file, 3, { now: at("2026-01-01T13:00:00.000Z") }),
    [],
    "every skill expires once the window passes"
  );
  assert.deepEqual(
    getActiveSkills(file, 3, { now: at("2026-01-01T10:10:00.000Z") }),
    ["old-skill"],
    "each skill is judged against the moment it was invoked"
  );
});

await test("skills survive out-of-order and timestamp-less transcript entries", () => {
  // Real transcripts are only roughly chronological: one session had 16
  // out-of-order stamps and 90 entries with none in its last 400 lines.
  // Stopping at the first old entry would hide every skill behind it.
  const file = tmpFile();
  writeFileSync(
    file,
    [
      entry("2026-01-01T12:00:00.000Z", "wanted"),
      JSON.stringify({ type: "bridge-session" }),
      entry("2026-01-01T09:00:00.000Z", "stray-old-entry"),
      entry(null, "no-timestamp"),
    ].join("\n")
  );

  const got = getActiveSkills(file, 5, { now: Date.parse("2026-01-01T12:05:00.000Z") });
  assert.ok(got.includes("wanted"), `an old entry must not hide newer ones: ${JSON.stringify(got)}`);
  assert.ok(got.includes("no-timestamp"), "an entry with no timestamp must be kept");
  assert.ok(!got.includes("stray-old-entry"), "the out-of-window entry must still be dropped");
});

await test("a missing or unreadable transcript yields no skills, not a crash", () => {
  assert.deepEqual(getActiveSkills(undefined), []);
  assert.deepEqual(getActiveSkills(path.join(os.tmpdir(), "does-not-exist-12345.jsonl")), []);
});

await test("the activity scan's skills are reused instead of a second walk", () => {
  // The activity pass walks the same tail with the same window and collects
  // the skills on the way past them. Reading the file again cost a second
  // walk over a transcript that can be megabytes.
  const missing = path.join(os.tmpdir(), "no-such-transcript.jsonl");
  assert.deepEqual(getActiveSkills(missing, 3, { scanned: ["alpha", "beta"] }), ["alpha", "beta"]);
  assert.deepEqual(getActiveSkills(missing, 1, { scanned: ["alpha", "beta"] }), ["alpha"]);
  assert.deepEqual(getActiveSkills(missing, 3, {}), [], "with nothing scanned it still asks the file");
});

// specs/007-speckit-step-indicator FR-003/FR-006/SC-003
await test("every installed speckit-* skill maps to a readable, non-raw label", () => {
  const installed = readdirSync(path.join(process.cwd(), ".claude", "skills")).filter((n) =>
    n.startsWith("speckit-")
  );
  assert.ok(installed.length > 0, "expected at least one installed speckit-* skill to check against");
  for (const name of installed) {
    const label = sddStepFor(name);
    assert.ok(label, `expected a label for ${name}`);
    assert.notEqual(label, name, `label for ${name} must not be the raw skill id`);
  }
});

await test("known speckit-* skills map to their intended step label", () => {
  assert.equal(sddStepFor("speckit-specify"), "Specifying");
  assert.equal(sddStepFor("speckit-plan"), "Planning");
  assert.equal(sddStepFor("speckit-implement"), "Implementing");
});

await test("an unmapped speckit-* skill falls back to a formatted name, not null or raw", () => {
  assert.equal(sddStepFor("speckit-made-up-future-skill"), "Made up future skill");
});

await test("a non-speckit skill has no SDD step", () => {
  assert.equal(sddStepFor("superpowers:brainstorming"), null);
  assert.equal(sddStepFor(undefined), null);
});
