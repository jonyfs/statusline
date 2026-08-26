import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { getActiveSkills } from "../../src/skills.js";

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
