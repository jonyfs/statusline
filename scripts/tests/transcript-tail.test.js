import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { test } from "../test-harness.js";
import { readTailLines, scanTailForSkills } from "../../src/transcriptTail.js";
import { writeTranscript } from "./fixtures/transcript.js";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");

await test("a large transcript is read from the tail, not from end to end", () => {
  const file = writeTranscript({ sizeBytes: 8 * 1024 * 1024, skills: ["tail-skill"], now: NOW });
  const size = statSync(file).size;
  const result = scanTailForSkills(file, { limit: 3, now: NOW });

  assert.deepEqual(result.skills, ["tail-skill"]);
  assert.ok(
    result.bytesRead < size / 4,
    `read ${result.bytesRead} of ${size} bytes; the point is to read a fraction`
  );
});

await test("cost does not grow with the size of the transcript", () => {
  // FR-002. The old implementation read the whole file, so this ratio was
  // the ratio of the file sizes.
  const small = writeTranscript({ sizeBytes: 512 * 1024, skills: ["s"], now: NOW });
  const large = writeTranscript({ sizeBytes: 16 * 1024 * 1024, skills: ["s"], now: NOW });

  const readOf = (f) => scanTailForSkills(f, { limit: 3, now: NOW }).bytesRead;
  assert.equal(readOf(small) < 1024 * 1024, true);
  assert.equal(
    readOf(large) < 1024 * 1024,
    true,
    "a 16 MB transcript must not cost more than a small one"
  );
});

await test("the partial first line of a chunk is discarded, not parsed", () => {
  // Any chunk that does not start at byte 0 begins mid-line. Parsing that
  // fragment would either throw or, worse, half-succeed.
  const file = writeTranscript({ sizeBytes: 2 * 1024 * 1024, padBytes: 400, skills: ["x"], now: NOW });
  const { lines } = readTailLines(file, { enough: (acc) => acc.length >= 500 });
  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line), `a partial line reached the parser: ${line.slice(0, 40)}`);
  }
});

await test("the byte cap stops the walk and says so", () => {
  const file = writeTranscript({ sizeBytes: 4 * 1024 * 1024, skills: [], now: NOW });
  const result = scanTailForSkills(file, { limit: 3, now: NOW, byteCap: 128 * 1024 });
  assert.equal(result.truncated, true, "hitting the cap must be reported, not hidden");
  assert.ok(result.bytesRead <= 512 * 1024);
});

await test("truncated is false when the scan simply found nothing", () => {
  // "No skills recently" and "the scan gave up" are different answers, and
  // the diagnostic has to tell them apart (FR-017).
  const file = writeTranscript({ sizeBytes: 64 * 1024, skills: [], now: NOW });
  const result = scanTailForSkills(file, { limit: 3, now: NOW });
  assert.deepEqual(result.skills, []);
  assert.equal(result.truncated, false);
});

await test("skills outside the window are dropped, newest are kept in order", () => {
  const file = writeTranscript({
    sizeBytes: 256 * 1024,
    skills: ["older", "newer"],
    now: NOW,
  });
  const result = scanTailForSkills(file, { limit: 3, now: NOW });
  assert.deepEqual(result.skills, ["newer", "older"], "most recent first");

  const later = scanTailForSkills(file, { limit: 3, now: NOW + 60 * 60 * 1000 });
  assert.deepEqual(later.skills, [], "an hour later, nothing is inside a 30-minute window");
});

await test("a missing file is empty, not an exception", () => {
  const result = scanTailForSkills("/does/not/exist.jsonl", { now: NOW });
  assert.deepEqual(result.skills, []);
  assert.equal(result.bytesRead, 0);
});
