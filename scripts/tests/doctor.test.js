import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { buildReport, formatReport } from "../../src/doctor.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const NOW = Date.parse("2026-08-25T12:00:00.000Z");

const probe = {
  ...gitSources({ changed: 2 }),
  getRemoteUrl: () => "https://github.com/owner/repo",
  getPrInfo: () => ({ number: 4, state: "OPEN", isDraft: false, url: "https://x/y/pull/4" }),
  getActiveSkills: () => ["alpha"],
  getRtkSavings: () => 50,
  getDirUrl: () => null,
};

const payload = fullPayload({
  cwd: "/tmp/project",
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: Math.floor(NOW / 1000) + 3600 },
    seven_day: { used_percentage: 60, resets_at: Math.floor(NOW / 1000) + 2 * 86400 },
  },
});

await test("every segment on the line appears in the report", () => {
  // SC-007: nothing on screen may be missing from the diagnostic.
  const report = buildReport(payload, { now: NOW, live: false, probe });
  const keys = report.segments.map((s) => s.key);
  // Feature 002 merged effort with the output style, and the two reset
  // countdowns into one segment, so the names moved.
  for (const key of [
    "dir", "branch", "worktree", "upstream", "pr", "skills", "model",
    "effortStyle", "context", "fiveHour", "sevenDay", "resetMerged", "rtk",
  ]) {
    assert.ok(keys.includes(key), `${key} is missing from the report`);
  }
});

await test("each row carries value, source, age and cost", () => {
  const report = buildReport(payload, { now: NOW, live: false, probe });
  for (const row of report.segments) {
    assert.equal(typeof row.value, "string");
    assert.equal(typeof row.source, "string");
    assert.equal(typeof row.ageMs, "number");
    assert.equal(typeof row.tookMs, "number");
    assert.equal(typeof row.fresh, "boolean");
    assert.ok(row.ageMs >= 0, "an age is never negative");
  }
});

await test("an absent segment says why, and the reasons are distinguishable", () => {
  // FR-017: "not applicable here" and "the source failed" are different
  // answers, and a blank cell says neither.
  const report = buildReport({}, {
    now: NOW,
    live: false,
    probe: {
      ...emptySources,
      getRtkSavings: () => {
        throw new Error("rtk exploded");
      },
    },
  });
  const by = Object.fromEntries(report.segments.map((s) => [s.key, s]));

  assert.equal(by.branch.rendered, false);
  assert.match(by.branch.reason, /not a git repository/);

  assert.equal(by.skills.rendered, false);
  assert.match(by.skills.reason, /activity window/);

  assert.equal(by.rtk.rendered, false);
  assert.match(by.rtk.reason, /source failed: rtk exploded/, "a failure must not read like an absence");

  for (const row of report.segments) {
    if (!row.rendered) assert.ok(row.reason && row.reason.length > 0, `${row.key} has no reason`);
  }
});

await test("a cached segment reports the cached reading and a live probe separately", () => {
  // The renderer never waits on `gh`. A single column would have to claim
  // the live result is what the line shows, which it is not.
  const report = buildReport(payload, { now: NOW, live: true, probe });
  const pr = report.segments.find((s) => s.key === "pr");
  // The probe returns gh's shape and the renderer normalizes it, so the
  // diagnostic reports the normalized review state rather than gh's wording.
  assert.match(pr.value, /^#4 open/, "the cached reading is what the line shows");
  assert.match(pr.value, /\(gh\)/, "and the diagnostic says which source answered");
  assert.ok("live" in pr, "the live probe must be reported alongside it");
  assert.equal(typeof pr.liveTookMs, "number");

  const context = report.segments.find((s) => s.key === "context");
  assert.equal("live" in context, false, "a payload segment has nothing to probe");
});

await test("the report states the redraw cost and each rendered row's width", () => {
  const report = buildReport(payload, { now: NOW, live: false, probe });
  assert.equal(typeof report.elapsedMs, "number");
  assert.equal(report.budgets.redrawMs, 300);
  assert.ok(report.rows.length >= 3);
  // The diagnostic renders at the terminal's width, like the bar does, so
  // that is what its rows are measured against.
  const limit = Number(process.env.COLUMNS) || 120;
  for (const row of report.rows) {
    assert.ok(row.width > 0 && row.width <= limit, `row ${row.row} is ${row.width} columns`);
  }
});

await test("the table form prints one line per segment", () => {
  const report = buildReport(payload, { now: NOW, live: false, probe });
  const text = formatReport(report);
  for (const row of report.segments) {
    assert.ok(text.includes(row.key), `${row.key} is missing from the printed table`);
  }
});

await test("--json parses, and doctor exits 0 whatever it found", () => {
  const r = spawnSync(process.execPath, [CLI, "doctor", "--json"], {
    input: "{}",
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1" },
  });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(Array.isArray(parsed.segments));
  assert.ok(parsed.segments.length >= 15);
});
