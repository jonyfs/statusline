import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload, renderReadings, gather, harnessProbes } from "../../src/render.js";
import { copilotSessionActivity, AGENT_ROW_CAP } from "../../src/copilotEvents.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { displayWidth } from "../../src/theme.js";

// specs/030-copilot-agent-rows. Copilot CLI has no subagent row setting, so
// under Copilot the bar prints one row per running subagent after its lines,
// read from the session's events.jsonl.

const NOW = Date.parse("2026-10-05T12:00:00.000Z");
const WIDE = { maxWidth: 200, maxHeight: 40 };
const fixture = JSON.parse(readFileSync(new URL("./fixtures/copilot-payload.json", import.meta.url), "utf8"));
const realLog = readFileSync(new URL("./fixtures/copilot-subagent-events.jsonl", import.meta.url), "utf8");

function sessionDir(text) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-copilot-agents-"));
  writeFileSync(path.join(dir, "events.jsonl"), text);
  return dir;
}
const eventsDir = (events) => sessionDir(events.map((e) => JSON.stringify(e)).join("\n") + "\n");
const at = (secondsAgo) => new Date(NOW - secondsAgo * 1000).toISOString();
const render = (payload, opts = {}) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, ...WIDE, ...opts }));
const copilot = (events) => ({ ...fixture, transcript_path: eventsDir(events) });

/** A subagent's start, as Copilot CLI 1.0.91 writes it. */
const started = (n, secondsAgo, data = {}) => ({
  type: "subagent.started",
  agentId: `agent-${n}`,
  timestamp: at(secondsAgo),
  data: {
    toolCallId: `call-${n}`,
    agentName: "explore",
    agentDisplayName: `task-${n}`,
    agentDescription: `Brief number ${n}`,
    model: "claude-sonnet-4.5",
    executionMode: "background",
    ...data,
  },
});
const ended = (n, secondsAgo, type = "subagent.completed") => ({
  type,
  agentId: `agent-${n}`,
  timestamp: at(secondsAgo),
  data: { toolCallId: `call-${n}`, agentName: "explore", durationMs: 1000 },
});

await test("a started subagent runs until it completes or fails, and each running one gets a row", () => {
  const events = [
    { type: "assistant.turn_start", data: {}, timestamp: at(200) },
    started(1, 120),
    started(2, 90, { agentName: "code-review", agentDescription: "Review the diff" }),
    started(3, 80),
    ended(3, 40),
    started(4, 70),
    ended(4, 30, "subagent.failed"),
  ];
  const activity = copilotSessionActivity(eventsDir(events), { now: NOW });
  assert.deepEqual(activity.agents.map((a) => a.id), ["agent-1", "agent-2"]);
  const out = render(copilot(events));
  const lines = out.split("\n");
  const rows = lines.filter((l) => /Brief number|Review the diff/.test(l));
  assert.equal(rows.length, 2, out);
  assert.match(out, /Brief number 1/);
  assert.match(out, /code-review.*Review the diff/);
  assert.doesNotMatch(out, /Brief number 3|Brief number 4/);
  assert.match(lines.at(-1), /Review the diff/, "the rows follow the bar's lines");
});

await test("a row carries the agent's model, effort, current step, skills and age", () => {
  const events = [
    started(1, 125, { agentName: "explore", model: "gpt-5.6-luna" }),
    { type: "subagent.configured", agentId: "agent-1", timestamp: at(124), data: { model: "gpt-5.6-luna", reasoningEffort: "low" } },
    { type: "tool.execution_start", agentId: "agent-1", timestamp: at(100), data: { toolCallId: "t1", toolName: "grep", toolTitle: "Searching code" } },
    { type: "tool.execution_start", agentId: "agent-1", timestamp: at(50), data: { toolCallId: "t2", toolName: "view", toolTitle: "Viewing file" } },
    { type: "skill.invoked", agentId: "agent-1", timestamp: at(60), data: { name: "deep-dive" } },
  ];
  const [agent] = copilotSessionActivity(eventsDir(events), { now: NOW }).agents;
  assert.equal(agent.name, "explore");
  assert.equal(agent.description, "Brief number 1");
  assert.equal(agent.label, "Viewing file", "the latest step");
  assert.equal(agent.model, "gpt-5.6-luna");
  assert.equal(agent.effort, "low");
  assert.equal(agent.startTime, NOW - 125_000);
  assert.deepEqual(agent.skills, ["deep-dive"]);
  const out = render(copilot(events));
  assert.match(out, /gpt-5\.6-luna·low/, "a model outside Claude's families is named as reported");
  assert.match(out, /deep-dive/);
  assert.match(out, /Viewing file/);
  assert.match(out, /2m/);
});

await test("a Claude model on Copilot gets the tier it gets in Claude Code", () => {
  const events = [started(1, 30, { model: "claude-opus-4.5" }), { type: "subagent.configured", agentId: "agent-1", timestamp: at(29), data: { model: "claude-opus-4.5", reasoningEffort: "high" } }];
  const out = render(copilot(events));
  assert.match(out, /opus·high/);
});

await test("a subagent's skills belong to its row, not to line 2", () => {
  const events = [
    { type: "skill.invoked", timestamp: at(100), data: { name: "root-skill" } },
    started(1, 90),
    { type: "skill.invoked", agentId: "agent-1", timestamp: at(60), data: { name: "agent-skill" } },
  ];
  const activity = copilotSessionActivity(eventsDir(events), { now: NOW });
  assert.deepEqual(activity.skills, ["root-skill"]);
  const lines = render(copilot(events)).split("\n");
  const row = lines.find((l) => /Brief number 1/.test(l));
  assert.match(row, /agent-skill/);
  assert.ok(!lines.filter((l) => l !== row).some((l) => /agent-skill/.test(l)), lines.join("\n"));
});

await test("line 2 follows the root's turns, and a running subagent alone means working", () => {
  // The root opened a turn; the subagent's own turn ending does not close it.
  const nested = [
    { type: "assistant.turn_start", data: {}, timestamp: at(300) },
    started(1, 290, { executionMode: "sync" }),
    { type: "assistant.turn_start", agentId: "agent-1", timestamp: at(280), data: {} },
    { type: "assistant.turn_end", agentId: "agent-1", timestamp: at(270), data: {} },
  ];
  assert.equal(copilotSessionActivity(eventsDir(nested), { now: NOW }).working, true);
  const quiet = [
    { type: "assistant.turn_start", data: {}, timestamp: at(300) },
    { type: "assistant.turn_end", data: {}, timestamp: at(250) },
    started(1, 240),
  ];
  assert.equal(copilotSessionActivity(eventsDir(quiet), { now: NOW }).working, true, "a background subagent is work");
  const done = [...quiet, ended(1, 200)];
  assert.equal(copilotSessionActivity(eventsDir(done), { now: NOW }).working, false);
});

await test("a session that shut down leaves no subagent running, and an unendable start draws nothing", () => {
  const events = [started(1, 300), { type: "session.shutdown", data: {}, timestamp: at(200) }, started(2, 100, { toolCallId: undefined })];
  assert.deepEqual(copilotSessionActivity(eventsDir(events), { now: NOW }).agents, []);
});

await test(`past ${AGENT_ROW_CAP} running subagents the rows stop and say how many more`, () => {
  const events = Array.from({ length: AGENT_ROW_CAP + 3 }, (_, i) => started(i + 1, 100 - i));
  const out = render(copilot(events));
  const rows = out.split("\n").filter((l) => /Brief number/.test(l));
  assert.equal(rows.length, AGENT_ROW_CAP, out);
  assert.match(out.split("\n").at(-1), /\+3 more/);
});

await test("the rows fit the bar's width", () => {
  const events = [started(1, 100, { agentDescription: "A very long brief ".repeat(10) })];
  const lines = renderPayload(copilot(events), { sources: emptySources, trackChanges: false, now: NOW, maxWidth: 80, maxHeight: 40 }).split("\n");
  const row = stripAnsi(lines.at(-1));
  assert.match(row, /A very long brief/);
  assert.ok(displayWidth(row) <= 80, `${displayWidth(row)} columns: ${row}`);
  assert.match(row, /\u2026$/, "cut with an ellipsis, since Copilot wraps rather than cuts");
});

await test("the doctor's rows and Claude Code's bar are unchanged", () => {
  const events = [started(1, 100)];
  const payload = copilot(events);
  const readings = gather(payload, harnessProbes({ ...emptySources, getSessionActivity: () => null }, "copilot"), { now: NOW });
  const rows = renderReadings(readings, payload, { tracking: false, now: NOW, ...WIDE, asRows: true });
  assert.ok(readings.agents.value.length === 1, "the reading is there for whoever wants it");
  assert.ok(rows.every((r) => !/Brief number/.test(stripAnsi(r.text))), "no agent rows in the per-line view");
  const claude = fullPayload({ now: NOW });
  const before = render(claude);
  assert.doesNotMatch(before, /Brief number/);
  assert.equal(render(claude), before);
});

await test("the real session log draws its explore subagent while it ran, and nothing after", () => {
  // Replayed as it stood at each moment: a log holds nothing from the future.
  const upTo = (iso) =>
    sessionDir(realLog.split("\n").filter((l) => l && JSON.parse(l).timestamp <= iso).join("\n") + "\n");
  const whileRunning = Date.parse("2026-10-06T02:41:43.050Z");
  const dir = upTo("2026-10-06T02:41:43.050Z");
  const running = copilotSessionActivity(dir, { now: whileRunning });
  assert.equal(running.agents.length, 1);
  assert.equal(running.agents[0].name, "explore");
  assert.equal(running.agents[0].label, "Viewing file");
  assert.equal(running.agents[0].effort, "low");
  assert.equal(running.working, true);
  const out = stripAnsi(renderPayload({ ...fixture, transcript_path: dir }, { sources: emptySources, trackChanges: false, now: whileRunning, ...WIDE }));
  assert.match(out.split("\n").at(-1), /explore.*Read text files via explore subagent/);
  const after = copilotSessionActivity(upTo("2026-10-06T02:41:45.000Z"), { now: Date.parse("2026-10-06T02:41:45.000Z") });
  assert.deepEqual(after.agents, []);
});
