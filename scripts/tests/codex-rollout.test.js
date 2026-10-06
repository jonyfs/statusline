import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, appendFileSync, readFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { test, stripAnsi } from "../test-harness.js";
import {
  readRollout,
  rolloutPayload,
  rolloutActivity,
  readRolloutHead,
  ROLLOUT_TAIL_BYTES,
  ROLLOUT_HEAD_BYTES,
} from "../../src/codexRollout.js";
import { detectHarness } from "../../src/harness.js";
import { renderPayload } from "../../src/render.js";

// specs/035-codex-pane. The fixtures are real Codex rollouts from this
// machine with every prompt, answer, tool call and instruction removed: only
// the record kinds and the fields the adapter reads are left, and the cwd is
// a neutral path. plus: CLI 0.142.3 on a Plus plan (5-hour and weekly
// windows). free: 0.147.0 on the free plan (one 30-day window). 0160: 0.160.0,
// where every token_count carries `info: null`.

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixture = (name) => path.join(FIXTURES, `codex-rollout-${name}.jsonl`);
const scratch = () => mkdtempSync(path.join(os.tmpdir(), "statusline-035-"));
const NOW = Date.parse("2026-10-06T12:00:00Z");

const payloadOf = (file, opts = {}) => rolloutPayload(readRollout(file), { now: NOW, ...opts });

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
const draw = (payload, sources = {}) =>
  stripAnsi(
    renderPayload(payload, {
      sources: { ...NO_SOURCES, ...sources },
      trackChanges: false,
      now: NOW,
      maxWidth: 200,
      maxHeight: 10,
      layout: LAYOUT,
      samples: [],
    })
  );

// Item 1: the payload --------------------------------------------------------------

await test("a Plus rollout maps to the Claude payload: model, effort, context and both windows", () => {
  const p = payloadOf(fixture("plus"));
  assert.equal(p.cwd, "/Users/dev/projects/statusline");
  assert.equal(p.workspace.current_dir, "/Users/dev/projects/statusline");
  assert.equal(p.session_id, "codex-019efca1-bc29-7f00-ab6b-8ba1f778f721");
  assert.deepEqual(p.model, { id: "gpt-5.5", display_name: "gpt-5.5" });
  assert.deepEqual(p.effort, { level: "medium" });
  assert.equal(p.version, "0.142.3");
  assert.equal(p.context_window.context_window_size, 258400);
  // The last turn's tokens over the window, both Codex's own figures.
  assert.equal(Math.round(p.context_window.used_percentage * 100) / 100, Math.round((51557 / 258400) * 10000) / 100);
  assert.equal(p.context_window.total_input_tokens, 1029488);
  assert.equal(p.context_window.total_output_tokens, 8911);
  assert.deepEqual(p.rate_limits.five_hour, { used_percentage: 11, resets_at: 1782592693 });
  assert.deepEqual(p.rate_limits.seven_day, { used_percentage: 2, resets_at: 1783179493 });
  assert.equal(p.codex.plan_type, "plus");
  assert.equal(p.codex.cli_version, "0.142.3");
});

await test("the free plan's 30-day window is not drawn as a 5-hour or 7-day one", () => {
  const p = payloadOf(fixture("free"));
  assert.equal(p.rate_limits, undefined, "a 43200-minute window has no slot on the bar");
  assert.equal(Math.round(p.context_window.used_percentage), 34);
  assert.deepEqual(p.effort, { level: "high" });
});

await test("only 300 and 10080 minute windows map, whichever of primary or secondary carries them", () => {
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  const limits = (primary, secondary) =>
    JSON.stringify({ timestamp: "2026-10-06T11:00:00Z", type: "event_msg", payload: { type: "token_count", info: null, rate_limits: { primary, secondary } } });
  writeFileSync(file, limits({ used_percent: 40, window_minutes: 10080, resets_at: 1791900000 }, { used_percent: 9, window_minutes: 1440, resets_at: 1791800000 }) + "\n");
  const p = payloadOf(file);
  assert.deepEqual(p.rate_limits, { seven_day: { used_percentage: 40, resets_at: 1791900000 } });
});

await test("a 0.160 rollout with info null has the window size but no invented percentage", () => {
  const p = payloadOf(fixture("0160"));
  assert.equal(p.context_window.context_window_size, 258400);
  assert.equal(p.context_window.used_percentage, undefined);
  assert.deepEqual(p.effort, { level: "low" });
  assert.equal(p.version, "0.160.0");
});

await test("the payload is recognised as Codex's, and only the marker decides it", () => {
  assert.equal(detectHarness(payloadOf(fixture("plus")), {}), "codex");
  assert.equal(detectHarness({ model: { display_name: "x" } }, {}), "claude");
  assert.equal(detectHarness({ codex: "not an object" }, {}), "claude");
});

await test("the session duration is wall-clock time since Codex created the session, as Claude reports it", () => {
  const p = payloadOf(fixture("0160"), { now: Date.parse("2026-10-01T23:34:54.433Z") });
  assert.equal(p.cost.total_duration_ms, 30 * 60 * 1000);
});

// Item 1: working or idle ------------------------------------------------------

await test("a finished turn is idle and an open one is working", () => {
  assert.equal(rolloutActivity(readRollout(fixture("plus"))).working, false);
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  const lines = readFileSync(fixture("plus"), "utf8").trim().split("\n");
  const lastStart = lines.map((l) => JSON.parse(l)).findLastIndex((r) => r.payload?.type === "task_started");
  writeFileSync(file, lines.slice(0, lastStart + 3).join("\n") + "\n");
  const activity = rolloutActivity(readRollout(file));
  assert.equal(activity.working, true);
  assert.deepEqual(activity.skills, []);
  assert.equal(activity.todos, null);
  appendFileSync(file, JSON.stringify({ timestamp: "2026-10-06T11:00:00Z", type: "event_msg", payload: { type: "turn_aborted", reason: "interrupted" } }) + "\n");
  assert.equal(rolloutActivity(readRollout(file)).working, false, "Esc in Codex ends the turn too");
});

// Item 1: bounded reads ----------------------------------------------------------

await test("a long rollout is read from its head and tail only, never whole", () => {
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  const lines = readFileSync(fixture("plus"), "utf8").trim().split("\n");
  // A session_meta line as big as the real ones, with base instructions.
  const meta = JSON.parse(lines[0]);
  meta.payload.base_instructions = "x".repeat(120_000);
  const filler = JSON.stringify({ timestamp: "2026-06-25T02:40:00Z", type: "response_item", payload: { type: "message", content: "y".repeat(4000) } });
  const body = [JSON.stringify(meta), ...lines.slice(1, 10), ...Array(3000).fill(filler), ...lines.slice(10)];
  writeFileSync(file, body.join("\n") + "\n");
  const state = readRollout(file);
  assert.ok(state.bytesRead <= ROLLOUT_HEAD_BYTES + ROLLOUT_TAIL_BYTES, `read ${state.bytesRead} bytes of a ${state.size} byte file`);
  assert.ok(state.size > ROLLOUT_HEAD_BYTES + ROLLOUT_TAIL_BYTES);
  const p = rolloutPayload(state, { now: NOW });
  assert.equal(p.session_id, "codex-019efca1-bc29-7f00-ab6b-8ba1f778f721", "the head still gives the session");
  assert.equal(p.model.id, "gpt-5.5", "the tail still gives the turn context");
  assert.equal(p.rate_limits.five_hour.used_percentage, 11);
});

await test("a session_meta line longer than the head cap still gives its id, cwd and start", () => {
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  const meta = {
    timestamp: "2026-10-06T10:00:00.000Z",
    type: "session_meta",
    payload: { id: "abc-123", timestamp: "2026-10-06T10:00:00.000Z", cwd: "/w/a \"quoted\" dir", cli_version: "0.160.1", base_instructions: "z".repeat(ROLLOUT_HEAD_BYTES + 10) },
  };
  writeFileSync(file, JSON.stringify(meta) + "\n");
  const head = readRolloutHead(file);
  assert.equal(head.id, "abc-123");
  assert.equal(head.cwd, '/w/a "quoted" dir');
  assert.equal(head.cliVersion, "0.160.1");
  assert.equal(head.timestamp, "2026-10-06T10:00:00.000Z");
});

await test("a second read with the state reads only what was appended, and waits for a whole line", () => {
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  copyFileSync(fixture("plus"), file);
  const first = readRollout(file);
  const record = JSON.stringify({
    timestamp: "2026-06-25T03:00:00Z",
    type: "event_msg",
    payload: { type: "token_count", info: null, rate_limits: { primary: { used_percent: 12, window_minutes: 300, resets_at: 1782592693 }, secondary: null } },
  });
  appendFileSync(file, record.slice(0, 40));
  const partial = readRollout(file, first);
  assert.equal(rolloutPayload(partial, { now: NOW }).rate_limits.five_hour.used_percentage, 11, "half a line is not a record");
  appendFileSync(file, record.slice(40) + "\n");
  const second = readRollout(file, partial);
  assert.ok(second.bytesRead <= record.length + 1, `read ${second.bytesRead} bytes for one appended line`);
  assert.equal(rolloutPayload(second, { now: NOW }).rate_limits.five_hour.used_percentage, 12);
  assert.equal(rolloutPayload(second, { now: NOW }).model.id, "gpt-5.5", "what was folded before is kept");
});

await test("a rollout that shrank is read again from scratch", () => {
  const dir = scratch();
  const file = path.join(dir, "rollout.jsonl");
  copyFileSync(fixture("plus"), file);
  const first = readRollout(file);
  copyFileSync(fixture("0160"), file);
  const again = readRollout(file, first);
  assert.equal(rolloutPayload(again, { now: NOW }).version, "0.160.0");
});

await test("a missing or broken rollout gives an empty state, never a throw", () => {
  const dir = scratch();
  assert.equal(readRollout(path.join(dir, "absent.jsonl")), null);
  const file = path.join(dir, "rollout.jsonl");
  writeFileSync(file, "not json\n{\"type\":\"turn_context\",\"payload\":7}\n{}\n");
  const state = readRollout(file);
  const p = rolloutPayload(state, { now: NOW });
  assert.equal(p.model, undefined);
  assert.equal(p.rate_limits, undefined);
  assert.equal(p.context_window, undefined);
});

// Item 1: through the real renderer ----------------------------------------------

await test("the real renderer draws a Codex rollout with Claude's segments", () => {
  const state = readRollout(fixture("plus"));
  const out = draw(rolloutPayload(state, { now: NOW }), { getSessionActivity: () => rolloutActivity(state) });
  assert.match(out, /gpt-5\.5/);
  assert.match(out, /medium/);
  assert.match(out, /Context 20%/);
  assert.match(out, /5h 11%/);
  assert.match(out, /7d 2%/);
  assert.match(out, /idle/);
  assert.doesNotMatch(out, /Claude/, "the default model name is Claude's, not Codex's");
});

await test("a window Codex does not report is absent, not ?%", () => {
  const out = draw(payloadOf(fixture("free")));
  assert.doesNotMatch(out, /5h /);
  assert.doesNotMatch(out, /7d /);
  assert.match(out, /Context 34%/);
});

await test("before the first turn the model chip says Codex, never Claude", () => {
  const out = draw({ cwd: "/Users/dev/projects/statusline", codex: {} });
  assert.match(out, /Codex/);
  assert.doesNotMatch(out, /Claude/);
});
