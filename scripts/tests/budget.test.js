import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { writeTranscript } from "./fixtures/transcript.js";
import { repoManyChanges } from "./fixtures/repo.js";

// SC-001 measures 100 renders against an 80 MB transcript in a repository
// with 5,000 modified files. That is a real measurement of the thing being
// promised, and it is what runs locally and in quickstart.md.
//
// On CI it runs at a tenth of that. Nine matrix combinations each writing
// 160 MB of transcripts and 10,000 files would dominate the run and
// eventually flake on the Windows runner, and CI's job here is to catch a
// regression, not to publish the headline number. The reduction is stated
// rather than silent, so nobody reads a CI pass as the full measurement.
const CI = Boolean(process.env.CI);
const RUNS = Number(process.env.CLAUDE_STATUSLINE_BUDGET_RUNS || (CI ? 10 : 100));
const TRANSCRIPT_MB = Number(process.env.CLAUDE_STATUSLINE_BUDGET_MB || (CI ? 8 : 80));
const CHANGED_FILES = Number(process.env.CLAUDE_STATUSLINE_BUDGET_FILES || (CI ? 500 : 5000));
const BUDGET_MS = 300;

if (CI) {
  console.log(
    `      (CI: ${RUNS} runs, ${TRANSCRIPT_MB} MB transcript, ${CHANGED_FILES} changed files; ` +
      `the full SC-001 measurement is 100 / 80 MB / 5,000 and runs locally)`
  );
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function timeRenders(payload, runs = RUNS) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const started = Date.now();
    renderPayload(payload, { trackChanges: false });
    times.push(Date.now() - started);
  }
  return times;
}

// The refresh must not be spawned from a test run: the point is to measure
// the redraw, and a detached process would also touch the real cache.
process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";

await test(`${RUNS} renders against a ${TRANSCRIPT_MB} MB transcript stay under ${BUDGET_MS} ms at p95`, () => {
  // SC-001. 80 MB is the size of the largest real transcript found on the
  // reference machine, and the repository has 5,000 modified files, which
  // is where `git status` costs 812 ms and the cache earns its place.
  const transcript = writeTranscript({ sizeBytes: TRANSCRIPT_MB * 1024 * 1024, skills: ["budget-skill"] });
  const repo = repoManyChanges({ count: CHANGED_FILES });
  const payload = { cwd: repo, transcript_path: transcript, session_id: "budget-test" };

  // One warm-up render, because the first one in a large repository pays
  // for the cache that every later one reads.
  renderPayload(payload, { trackChanges: false });

  const times = timeRenders(payload);
  const p95 = percentile(times, 95);
  assert.ok(
    p95 <= BUDGET_MS,
    `p95 was ${p95} ms over ${RUNS} runs (max ${Math.max(...times)} ms), budget is ${BUDGET_MS} ms`
  );
});

await test("an eight-hour session costs about what a fresh one costs", () => {
  // SC-002: the point of the tail read is that session age stops mattering.
  const small = writeTranscript({ sizeBytes: 1024 * 1024, skills: ["s"] });
  const large = writeTranscript({ sizeBytes: TRANSCRIPT_MB * 1024 * 1024, skills: ["s"] });
  const runs = Math.min(RUNS, 40);

  const median = (times) => percentile(times, 50);
  const smallMs = median(timeRenders({ transcript_path: small, session_id: "small" }, runs));
  const largeMs = median(timeRenders({ transcript_path: large, session_id: "large" }, runs));

  // Both are normally single-digit milliseconds, where a ratio is noise, so
  // the assertion is on the absolute gap as well.
  assert.ok(
    largeMs <= smallMs * 1.2 + 20,
    `large-session render was ${largeMs} ms against ${smallMs} ms for a fresh one`
  );
});
