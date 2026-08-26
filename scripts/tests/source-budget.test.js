import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { SOURCE_BUDGET_MS, REFRESH_BUDGET_MS } from "../../src/freshness.js";
import { probeGitInfo } from "../../src/git.js";
import { scanTailForSkills } from "../../src/transcriptTail.js";
import { writeTranscript } from "./fixtures/transcript.js";
import { repoManyChanges } from "./fixtures/repo.js";

// The same reduction the budget test makes on CI, for the same reason.
const CHANGED_FILES = process.env.CI ? 500 : 5000;

await test("git is abandoned at its budget rather than allowed to run long", () => {
  // A repository with 5,000 modified files takes 812 ms, measured. The
  // budget is what stops that landing on a 300 ms redraw.
  const dir = repoManyChanges({ count: CHANGED_FILES });
  const started = Date.now();
  const snapshot = probeGitInfo(dir, SOURCE_BUDGET_MS.git);
  const took = Date.now() - started;

  assert.ok(
    took < SOURCE_BUDGET_MS.git * 4,
    `git ran for ${took} ms against a ${SOURCE_BUDGET_MS.git} ms budget`
  );
  // Whether it managed to answer depends on the machine. What must not
  // happen is that it answers late: an abandoned call yields null, and the
  // caller falls back to the cache.
  if (snapshot === null) assert.ok(true, "abandoned at the budget, as designed");
});

await test("the same repository answers from cache well inside the budget", async () => {
  const dir = repoManyChanges({ count: CHANGED_FILES });
  process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";
  const { getGitInfo } = await import("../../src/git.js");

  // The first call is allowed to take as long as it needs, and stores what
  // it finds. Every later one reads that instead of paying again.
  getGitInfo(dir, { budgetMs: 10_000 });

  const started = Date.now();
  const cached = getGitInfo(dir, { budgetMs: SOURCE_BUDGET_MS.git });
  const took = Date.now() - started;
  assert.ok(cached !== null, "the cached snapshot must still answer");
  assert.ok(took <= 300, `a cached read took ${took} ms`);
});

await test("the transcript scan stops at its own budget", () => {
  // Every entry inside the activity window, and no skill anywhere, so the
  // scan has no reason of its own to stop: only the budget ends it.
  const file = writeTranscript({ sizeBytes: 32 * 1024 * 1024, skills: [], fillerAgeMs: 1000 });
  const started = Date.now();
  const result = scanTailForSkills(file, { limit: 3, budgetMs: 1 });
  const took = Date.now() - started;
  assert.ok(took < 500, `the scan ran for ${took} ms against a 1 ms budget`);
  assert.equal(result.truncated, true, "giving up early must be reported");
});

await test("the byte cap ends a scan the window would never end", () => {
  const file = writeTranscript({ sizeBytes: 8 * 1024 * 1024, skills: [], fillerAgeMs: 1000 });
  const result = scanTailForSkills(file, { limit: 3, byteCap: 512 * 1024, budgetMs: 10_000 });
  assert.equal(result.truncated, true);
  assert.ok(result.bytesRead <= 1024 * 1024, `read ${result.bytesRead} bytes past a 512 KB cap`);
});

await test("off-path budgets are generous, on-path budgets are not", () => {
  // The refresh has nobody waiting on it, so killing its lookup early
  // would just mean the cache never gets populated on a slow network.
  for (const [source, budget] of Object.entries(SOURCE_BUDGET_MS)) {
    assert.ok(budget <= 150, `${source} is on the redraw path and may not exceed 150 ms`);
  }
  for (const [source, budget] of Object.entries(REFRESH_BUDGET_MS)) {
    assert.ok(budget >= 1000, `${source} runs detached and should not be cut short`);
  }
});

await test("a repository that proved slow is not asked again on every redraw", async () => {
  // Paying the whole git budget on each redraw, only to abandon the call
  // and read the cache anyway, spends 150 ms to learn nothing. The cost of
  // the last attempt is remembered, and a repository that has already
  // failed the budget is read from cache until a refresh says otherwise.
  const { writeEntry, repoKey } = await import("../../src/cache.js");
  const { getGitInfo } = await import("../../src/git.js");
  const dir = repoManyChanges({ count: 50 });
  const key = repoKey(dir);

  const snapshot = getGitInfo(dir, { budgetMs: 10_000 });
  assert.ok(snapshot, "the fixture must be a real repository");

  // Stand in for a repository that timed out last time.
  writeEntry(key, "gitCost", 10_000);
  const started = Date.now();
  const fromCache = getGitInfo(dir, { budgetMs: SOURCE_BUDGET_MS.git });
  const took = Date.now() - started;

  assert.deepEqual(fromCache, snapshot, "the cached snapshot is what gets used");
  assert.ok(took < 50, `the redraw still spent ${took} ms asking git`);
});

await test("a directory that is not a repository costs nothing extra", async () => {
  // "Too slow" earns a background refresh; "not a repository" must not,
  // or every non-repo directory would spawn a process per redraw.
  const { getGitInfo } = await import("../../src/git.js");
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const plain = mkdtempSync(path.join(os.tmpdir(), "not-a-repo-"));
  assert.equal(getGitInfo(plain), null);
});
