import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { test, stripAnsi } from "../test-harness.js";
import { readRollout, rolloutPayload, windowLabel } from "../../src/codexRollout.js";
import { renderPayload } from "../../src/render.js";
import { buildReport } from "../../src/doctor.js";
import { emptySources } from "./fixtures/sources.js";

// specs/037-codex-windows. A Codex window that is neither 300 nor 10080
// minutes gets a chip under the label its length gives it, and a credit
// balance gets one too. Claude Code and Copilot send neither field.

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const NOW = Date.parse("2026-10-06T12:00:00Z");
const NOW_S = NOW / 1000;
const DAY = 86400;

const NO_SOURCES = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getCiStatus: () => null,
  getActiveSkills: () => [],
  getActiveSkillsTrueCount: () => 0,
  subagentActivity: () => [],
  getSessionActivity: () => null,
  getRtkSavings: () => null,
  getDirUrl: () => null,
  maybeStartUpdateCheck: () => false,
  getUpdateNotice: () => null,
  getGateRuns: () => null,
  isRepo: () => false,
  readTty: () => null,
  copilotSettings: () => ({}),
  getCopilotQuota: () => null,
};
const LAYOUT = { arrangement: null, origin: "default", path: null, error: null };
const draw = (payload, maxWidth = 200) =>
  stripAnsi(
    renderPayload(payload, {
      sources: NO_SOURCES,
      trackChanges: false,
      now: NOW,
      maxWidth,
      maxHeight: 10,
      layout: LAYOUT,
      samples: [],
    })
  );

/** A rollout holding one token_count with these limits, read as the pane reads it. */
function payloadWith(rateLimits) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-037-"));
  const file = path.join(dir, "rollout.jsonl");
  writeFileSync(
    file,
    JSON.stringify({ timestamp: "2026-10-06T11:00:00Z", type: "event_msg", payload: { type: "token_count", info: null, rate_limits: rateLimits } }) + "\n"
  );
  return rolloutPayload(readRollout(file), { now: NOW });
}

const window = (minutes, pct, resetsIn) => ({ used_percent: pct, window_minutes: minutes, resets_at: NOW_S + resetsIn });
const codex = (rateLimits) => ({ cwd: "/Users/dev/projects/statusline", codex: {}, rate_limits: rateLimits });

// US1 ----------------------------------------------------------------------

await test("a free-plan rollout draws its 30-day window, and no 5h or 7d chip", () => {
  const out = draw(rolloutPayload(readRollout(path.join(FIXTURES, "codex-rollout-free.jsonl")), { now: NOW }));
  assert.match(out, /30d 15%/);
  assert.doesNotMatch(out, /5h /);
  assert.doesNotMatch(out, /7d /);
});

await test("a 30-day reset more than a day out names the date", () => {
  const out = draw(payloadWith({ primary: window(43200, 8, 20 * DAY), secondary: null }));
  assert.match(out, /30d 8%.* · 26\/10 12:00/);
});

await test("a reset inside a day counts down", () => {
  const out = draw(payloadWith({ primary: window(43200, 99, 3 * 3600 + 20 * 60), secondary: null }));
  assert.match(out, /30d 99%.* · 3h20m/);
});

await test("a reset further out than the window is a wrong unit, shown as ?", () => {
  const out = draw(payloadWith({ primary: window(43200, 8, 40 * DAY), secondary: null }));
  assert.match(out, /30d 8%.* · \? /);
});

await test("a window at 100% says full", () => {
  const out = draw(payloadWith({ primary: window(43200, 100, 2 * DAY), secondary: null }));
  assert.match(out, /30d 100%.* full/);
});

await test("a narrow pane drops the reset before the chip", () => {
  const p = payloadWith({ primary: window(43200, 8, 20 * DAY), secondary: null });
  const out = draw({ ...p, context_window: { used_percentage: 20 } }, 40);
  assert.match(out, /30d 8%/);
  assert.doesNotMatch(out, /26\/10/);
});

// US2 ----------------------------------------------------------------------

await test("a window is named by its length alone", () => {
  assert.equal(windowLabel(43200), "30d");
  assert.equal(windowLabel(1440), "1d");
  assert.equal(windowLabel(120), "2h");
  assert.equal(windowLabel(45), "45m");
});

await test("5h and 7d keep their chips beside another window, and the chip shows primary", () => {
  const p = payloadWith({ primary: window(1440, 9, 3600), secondary: window(10080, 40, 2 * DAY) });
  assert.deepEqual(Object.keys(p.rate_limits).sort(), ["other_windows", "seven_day"]);
  const out = draw(p);
  assert.match(out, /1d 9%/);
  assert.match(out, /7d 40%/);
  const two = draw(payloadWith({ primary: window(1440, 9, 3600), secondary: window(43200, 3, 9 * DAY) }));
  assert.match(two, /1d 9%/);
  assert.doesNotMatch(two, /30d/);
});

await test("a window with an unusable length or percentage is dropped", () => {
  for (const bad of [
    { used_percent: 5, window_minutes: 0 },
    { used_percent: 5, window_minutes: -60 },
    { used_percent: 5, window_minutes: 1.5 },
    { used_percent: 5, window_minutes: "43200" },
    { window_minutes: 43200 },
    { used_percent: Number.NaN, window_minutes: 43200 },
  ]) {
    const p = payloadWith({ primary: bad, secondary: null });
    assert.equal(p.rate_limits?.other_windows, undefined, JSON.stringify(bad));
  }
});

await test("doctor names every other window, and why the chip is absent elsewhere", () => {
  const p = payloadWith({ primary: window(1440, 9, 3600), secondary: window(43200, 3, 9 * DAY) });
  const report = buildReport(p, { now: NOW, live: false, probe: { ...emptySources, getSessionActivity: () => null } });
  const row = (r, key) => r.segments.find((s) => s.key === key);
  assert.match(row(report, "codexWindow").value, /^1d 9% · .*, 30d 3% · /);
  const claude = buildReport({ cwd: "/tmp" }, { now: NOW, live: false, probe: emptySources });
  assert.equal(row(claude, "codexWindow").reason, "Codex CLI only");
  assert.equal(row(claude, "codexCredits").reason, "Codex CLI only");
});

// US3 ----------------------------------------------------------------------

await test("a credit balance is drawn as Codex writes it", () => {
  const p = payloadWith({ primary: null, secondary: null, credits: { has_credits: true, unlimited: false, balance: " 12.5 " } });
  assert.deepEqual(p.rate_limits.credits, { balance: "12.5" });
  assert.match(draw(p), /credits 12\.5 /);
});

await test("no credits, unlimited credits, or a balance that is not a number draw nothing", () => {
  for (const credits of [
    { has_credits: false, unlimited: false, balance: null },
    { has_credits: true, unlimited: true, balance: "5" },
    { has_credits: true, unlimited: false, balance: "lots" },
    { has_credits: true, unlimited: false, balance: null },
    { has_credits: true, unlimited: false, balance: 12 },
  ]) {
    const p = payloadWith({ primary: null, secondary: null, credits });
    assert.equal(p.rate_limits?.credits, undefined, JSON.stringify(credits));
    assert.doesNotMatch(draw(p), /credits/);
  }
});

// FR-007 -------------------------------------------------------------------

await test("a Claude Code payload draws neither chip", () => {
  const out = draw({
    cwd: "/Users/dev/projects/statusline",
    rate_limits: { five_hour: { used_percentage: 43, resets_at: NOW_S + 3600 }, seven_day: { used_percentage: 79, resets_at: NOW_S + 2 * DAY } },
  });
  assert.match(out, /5h 43%/);
  assert.match(out, /7d 79%/);
  assert.doesNotMatch(out, /30d|credits/);
});

await test("a Codex payload built by hand renders the chip the same way", () => {
  const out = draw(codex({ other_windows: [{ label: "30d", window_minutes: 43200, used_percentage: 8.4, resets_at: NOW_S + 20 * DAY }] }));
  assert.match(out, /30d 8%/);
});
