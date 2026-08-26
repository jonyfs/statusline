import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { buildReport, formatReport } from "../../src/doctor.js";
import { SEGMENTS } from "../../src/segments.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const NOW = Date.parse("2026-08-26T12:00:00.000Z");

const probe = {
  ...gitSources({ changed: 2 }),
  getRemoteUrl: () => "https://github.com/o/r",
  getPrInfo: () => null,
  getCiStatus: () => null,
  getSessionActivity: () => null,
  getActiveSkills: () => ["alpha"],
  getRtkSavings: () => 50,
  getDirUrl: () => null,
};

await test("the report covers every segment in the registry", () => {
  // The row set comes from the registry now, so a segment added there shows
  // up in the diagnostic without being listed in two places.
  const report = buildReport(fullPayload(), { now: NOW, live: false, probe });
  const reported = new Set(report.segments.map((s) => s.key));
  for (const segment of SEGMENTS) {
    assert.ok(reported.has(segment.key), `${segment.key} is missing from the report`);
  }
  assert.equal(report.segments.length, SEGMENTS.length);
});

await test("each row carries what the layout decided", () => {
  const report = buildReport(fullPayload(), { now: NOW, live: false, probe });
  for (const row of report.segments) {
    assert.equal(typeof row.priority, "number", `${row.key} has no priority`);
    assert.ok(row.line >= 1 && row.line <= 4);
    assert.ok(["left", "right"].includes(row.align));
    assert.ok(["identity", "ramp", "change"].includes(row.colour));
  }
});

await test("the report says how big the terminal is and how much history exists", () => {
  // Both answer a question a person actually asks: why is that segment
  // missing, and why is there no burn rate yet.
  const report = buildReport(fullPayload(), { now: NOW, live: false, probe });
  assert.equal(typeof report.terminal.columns, "number");
  assert.equal(typeof report.samples, "number");

  const text = formatReport(report);
  assert.match(text, /terminal: \d+ columns/);
  assert.match(text, /history: \d+ samples/);
});

await test("the printed table has a priority column", () => {
  const report = buildReport(fullPayload(), { now: NOW, live: false, probe });
  const text = formatReport(report);
  assert.match(text, /segment\s+line\s+pri/);
  assert.match(text, /context.*100/, "the highest priority is visible in the table");
});

await test("a right-aligned segment says so in its line column", () => {
  const report = buildReport(fullPayload(), { now: NOW, live: false, probe });
  const text = formatReport(report);
  const line = text.split("\n").find((l) => l.startsWith("resetMerged"));
  assert.match(line, /4→/, "the arrow marks the right-aligned group");
});

await test("every absent segment still says why", () => {
  const report = buildReport({}, {
    now: NOW,
    live: false,
    probe: { ...probe, getGitInfo: () => null, getActiveSkills: () => [] },
  });
  for (const row of report.segments) {
    if (!row.rendered) assert.ok(row.reason?.length > 0, `${row.key} is missing without a reason`);
  }
});

await test("--json still parses, with the new fields", () => {
  const r = spawnSync(process.execPath, [CLI, "doctor", "--json"], {
    input: "{}",
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1" },
  });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.terminal.columns > 0);
  assert.equal(typeof parsed.samples, "number");
  assert.ok(parsed.segments.every((s) => typeof s.priority === "number"));
});
