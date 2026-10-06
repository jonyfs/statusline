import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
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

await test("a row names the model a subagent was dispatched to, not the one it was configured with", () => {
  // Real Copilot CLI 1.0.91 logs: every subagent was configured as gpt-5.6-luna
  // at low effort, while each assistant.message and tool.execution_start from
  // that agentId carried mai-code-1.1-flash, the model the work ran on (audit #12).
  const configured = [
    started(1, 125, { model: "gpt-5.6-luna" }),
    { type: "subagent.configured", agentId: "agent-1", timestamp: at(124), data: { model: "gpt-5.6-luna", reasoningEffort: "low" } },
  ];
  const before = copilotSessionActivity(eventsDir(configured), { now: NOW }).agents[0];
  assert.equal(before.model, "gpt-5.6-luna", "the configured model stands until the first dispatch");
  assert.equal(before.effort, "low");
  const events = [
    ...configured,
    { type: "assistant.message", agentId: "agent-1", timestamp: at(110), data: { model: "mai-code-1.1-flash" } },
    { type: "tool.execution_start", agentId: "agent-1", timestamp: at(100), data: { toolCallId: "t1", toolName: "view", toolTitle: "Viewing file", model: "mai-code-1.1-flash" } },
    // A late configured event does not take the row back to the configured model.
    { type: "subagent.configured", agentId: "agent-1", timestamp: at(90), data: { model: "gpt-5.6-luna", reasoningEffort: "low" } },
    // The root's own dispatches say nothing about the subagent.
    { type: "assistant.message", timestamp: at(80), data: { model: "claude-opus-4.5" } },
  ];
  const [agent] = copilotSessionActivity(eventsDir(events), { now: NOW }).agents;
  assert.equal(agent.model, "mai-code-1.1-flash");
  assert.equal(agent.effort, null, "the configured effort was set for a model the agent is not running on");
  const out = render(copilot(events));
  assert.match(out, /mai-code-1\.1-flash/);
  assert.doesNotMatch(out, /gpt-5\.6-luna/);
});

await test("a dispatch to the configured model keeps the configured effort", () => {
  const events = [
    started(1, 60, { model: "gpt-5.6-luna" }),
    { type: "subagent.configured", agentId: "agent-1", timestamp: at(59), data: { model: "gpt-5.6-luna", reasoningEffort: "low" } },
    { type: "assistant.message", agentId: "agent-1", timestamp: at(50), data: { model: "gpt-5.6-luna" } },
  ];
  const [agent] = copilotSessionActivity(eventsDir(events), { now: NOW }).agents;
  assert.equal(agent.model, "gpt-5.6-luna");
  assert.equal(agent.effort, "low");
});

await test("a resumed or restarted session leaves nothing from the last process running (audit #14)", () => {
  // A crash or a closed terminal writes no session.shutdown; the next
  // `copilot --resume` writes session.resume into the same log.
  for (const type of ["session.resume", "session.start"]) {
    const events = [
      { type: "session.start", data: {}, timestamp: at(8 * 3600) },
      { type: "assistant.turn_start", data: {}, timestamp: at(8 * 3600 - 1) },
      started(1, 8 * 3600 - 2),
      { type, data: {}, timestamp: at(300) },
    ];
    const activity = copilotSessionActivity(eventsDir(events), { now: NOW });
    assert.deepEqual(activity.agents, [], type);
    assert.equal(activity.working, false, `${type} closes the old process's turn`);
    // Work the resumed process starts is still drawn.
    const resumed = [...events, started(2, 100)];
    assert.deepEqual(copilotSessionActivity(eventsDir(resumed), { now: NOW }).agents.map((a) => a.id), ["agent-2"], type);
  }
});

await test("a shutdown also closes the root's open turn", () => {
  const events = [
    { type: "assistant.turn_start", data: {}, timestamp: at(300) },
    { type: "session.shutdown", data: {}, timestamp: at(200) },
  ];
  assert.equal(copilotSessionActivity(eventsDir(events), { now: NOW }).working, false);
});

// Rows that vanished while the work went on (causes 2 to 4 of the 1.27
// vanish audit). The two logs below are real Copilot CLI 1.0.92 sessions from
// 2026-10-06, cut to the event types and fields the reader looks at; nothing
// in them is made up. In session A, subagent "async-sleeper" (0dc10faf)
// started `sleep 60` with mode async, and Copilot wrote subagent.completed
// 1.3 s later while the sleep ran for another minute as a child of the
// copilot process. In session B the root resumed subagent "waker" (03116609)
// with write_agent after its completion, and it ran `sleep 30` with no second
// subagent.started or subagent.completed.
const sessionA = [
  {"type":"session.start","timestamp":"2026-10-06T15:10:35.789Z","data":{"copilotVersion":"1.0.92"}},
  {"type":"user.message","timestamp":"2026-10-06T15:10:39.283Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:10:39.364Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:10:45.280Z","data":{"toolCallId":"call_sw7p7TQ08bGIYLo21FHmkiEl","toolName":"task"}},
  {"type":"subagent.started","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:10:45.401Z","data":{"toolCallId":"call_sw7p7TQ08bGIYLo21FHmkiEl","agentName":"general-purpose","agentDisplayName":"sync-sleeper","agentDescription":"Run synchronous sleep command","model":"gpt-6-luna"}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:10:45.471Z","data":{"toolCallId":"call_sw7p7TQ08bGIYLo21FHmkiEl","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:10:45.500Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:10:45.502Z","data":{}},
  {"type":"user.message","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:10:47.257Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:10:47.268Z","data":{"toolCallId":"call_DQAwC1hngUvj1VetdDfyq7DL","toolName":"task"}},
  {"type":"assistant.turn_start","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:10:47.285Z","data":{}},
  {"type":"subagent.started","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:47.383Z","data":{"toolCallId":"call_DQAwC1hngUvj1VetdDfyq7DL","agentName":"general-purpose","agentDisplayName":"async-sleeper","agentDescription":"Start async sleep command","model":"gpt-6-luna"}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:10:47.441Z","data":{"toolCallId":"call_DQAwC1hngUvj1VetdDfyq7DL","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:10:47.457Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:10:47.459Z","data":{}},
  {"type":"user.message","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:48.514Z","data":{}},
  {"type":"assistant.turn_start","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:48.526Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:10:49.226Z","data":{"toolCallId":"call_sU4ucnRTNCNyO0McXTh3QkVz","toolName":"read_agent","arguments":{"agent_id":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b"}}},
  {"type":"tool.execution_start","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:51.467Z","data":{"toolCallId":"call_AjuYBsekDCCwAcDOTZ9mE3Tc","toolName":"bash","toolTitle":"Running command","arguments":{"command":"sleep 60","mode":"async","detach":false}}},
  {"type":"tool.execution_complete","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:51.803Z","data":{"toolCallId":"call_AjuYBsekDCCwAcDOTZ9mE3Tc","success":true,"result":{"content":"<command started in background with shellId: 0>"}}},
  {"type":"assistant.turn_end","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:51.819Z","data":{}},
  {"type":"assistant.turn_start","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:51.840Z","data":{}},
  {"type":"assistant.turn_end","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:53.038Z","data":{}},
  {"type":"subagent.completed","agentId":"0dc10faf-23de-4888-85bd-d961ef241135","timestamp":"2026-10-06T15:10:53.113Z","data":{"toolCallId":"call_DQAwC1hngUvj1VetdDfyq7DL","agentName":"general-purpose","agentDisplayName":"async-sleeper"}},
  {"type":"tool.execution_start","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:10:53.776Z","data":{"toolCallId":"call_Y4NjoATHNKwT8r24gzPBOUA9","toolName":"bash","toolTitle":"Running command","arguments":{"command":"sleep 40","mode":"sync"}}},
  {"type":"tool.execution_complete","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:11:33.986Z","data":{"toolCallId":"call_Y4NjoATHNKwT8r24gzPBOUA9","success":true,"result":{"content":"\n<shellId: 1 completed with exit code 0>"}}},
  {"type":"assistant.turn_end","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:11:33.998Z","data":{}},
  {"type":"assistant.turn_start","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:11:34.020Z","data":{}},
  {"type":"assistant.turn_end","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:11:35.608Z","data":{}},
  {"type":"subagent.completed","agentId":"8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b","timestamp":"2026-10-06T15:11:35.675Z","data":{"toolCallId":"call_sw7p7TQ08bGIYLo21FHmkiEl","agentName":"general-purpose","agentDisplayName":"sync-sleeper"}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:11:35.702Z","data":{"toolCallId":"call_sU4ucnRTNCNyO0McXTh3QkVz","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:11:35.707Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:11:35.710Z","data":{}},
  {"type":"system.notification","timestamp":"2026-10-06T15:11:35.743Z","data":{"kind":{"type":"agent_idle","agentId":"0dc10faf-23de-4888-85bd-d961ef241135"}}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:11:35.748Z","data":{"toolCallId":"81780575-bc3f-469f-82a2-2da8714ac624","toolName":"read_agent","arguments":{"agent_id":"0dc10faf-23de-4888-85bd-d961ef241135"}}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:11:35.749Z","data":{"toolCallId":"81780575-bc3f-469f-82a2-2da8714ac624","success":true}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:11:40.264Z","data":{"toolCallId":"call_JKzeKDWCGcO5necv2YLXURzB","toolName":"read_agent","arguments":{"agent_id":"0dc10faf-23de-4888-85bd-d961ef241135"}}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:11:40.316Z","data":{"toolCallId":"call_JKzeKDWCGcO5necv2YLXURzB","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:11:40.322Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:11:40.323Z","data":{}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:11:42.046Z","data":{}},
  {"type":"session.shutdown","timestamp":"2026-10-06T15:11:51.900Z","data":{"shutdownType":"routine"}},
];
const sessionB = [
  {"type":"session.start","timestamp":"2026-10-06T15:12:52.091Z","data":{"copilotVersion":"1.0.92"}},
  {"type":"user.message","timestamp":"2026-10-06T15:12:54.876Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:12:54.940Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:12:59.273Z","data":{"toolCallId":"call_vRnTLobo7Qy8TLjYIZZsVPoy","toolName":"task"}},
  {"type":"subagent.started","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:12:59.329Z","data":{"toolCallId":"call_vRnTLobo7Qy8TLjYIZZsVPoy","agentName":"general-purpose","agentDisplayName":"waker","agentDescription":"Start requested shell sleep","model":"gpt-6-luna"}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:12:59.355Z","data":{"toolCallId":"call_vRnTLobo7Qy8TLjYIZZsVPoy","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:12:59.368Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:12:59.370Z","data":{}},
  {"type":"user.message","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:00.232Z","data":{}},
  {"type":"assistant.turn_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:00.238Z","data":{}},
  {"type":"tool.execution_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:03.647Z","data":{"toolCallId":"call_ry2gM2jFVee5088o3C5xIKjd","toolName":"bash","toolTitle":"Running command","arguments":{"command":"sleep 20","mode":"async"}}},
  {"type":"tool.execution_complete","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:03.853Z","data":{"toolCallId":"call_ry2gM2jFVee5088o3C5xIKjd","success":true,"result":{"content":"<command started in background with shellId: 0>"}}},
  {"type":"assistant.turn_end","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:03.857Z","data":{}},
  {"type":"assistant.turn_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:03.859Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:13:04.147Z","data":{"toolCallId":"call_Nwz5DZxK9y9UUiuGOMCVtrEx","toolName":"bash","toolTitle":"Running command","arguments":{"command":"rtk sleep 45","mode":"sync"}}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:13:04.275Z","data":{"toolCallId":"call_Nwz5DZxK9y9UUiuGOMCVtrEx","success":false}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:13:04.283Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:13:04.285Z","data":{}},
  {"type":"assistant.turn_end","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:05.378Z","data":{}},
  {"type":"subagent.completed","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:05.412Z","data":{"toolCallId":"call_vRnTLobo7Qy8TLjYIZZsVPoy","agentName":"general-purpose","agentDisplayName":"waker"}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:13:07.481Z","data":{"toolCallId":"call_8Lf3ZrEpHUx5oI0E3LrhAdVb","toolName":"write_agent","arguments":{"agent_id":"03116609-d920-409e-88ea-9a23ded85198"}}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:13:07.577Z","data":{"toolCallId":"call_8Lf3ZrEpHUx5oI0E3LrhAdVb","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:13:07.586Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:13:07.589Z","data":{}},
  {"type":"user.message","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:08.332Z","data":{}},
  {"type":"assistant.turn_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:08.341Z","data":{}},
  {"type":"tool.execution_start","timestamp":"2026-10-06T15:13:08.924Z","data":{"toolCallId":"call_flvWL9F3JHhOyLvpsj77DX2e","toolName":"read_agent","arguments":{"agent_id":"03116609-d920-409e-88ea-9a23ded85198"}}},
  {"type":"tool.execution_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:09.794Z","data":{"toolCallId":"call_tkxlbdAkOpxDg35rs9mrhuwJ","toolName":"bash","toolTitle":"Running command","arguments":{"command":"sleep 30","mode":"sync"}}},
  {"type":"tool.execution_complete","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:39.932Z","data":{"toolCallId":"call_tkxlbdAkOpxDg35rs9mrhuwJ","success":true,"result":{"content":"\n<shellId: 2 completed with exit code 0>"}}},
  {"type":"assistant.turn_end","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:39.936Z","data":{}},
  {"type":"assistant.turn_start","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:39.938Z","data":{}},
  {"type":"assistant.turn_end","agentId":"03116609-d920-409e-88ea-9a23ded85198","timestamp":"2026-10-06T15:13:41.237Z","data":{}},
  {"type":"tool.execution_complete","timestamp":"2026-10-06T15:13:41.344Z","data":{"toolCallId":"call_flvWL9F3JHhOyLvpsj77DX2e","success":true}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:13:41.353Z","data":{}},
  {"type":"assistant.turn_start","timestamp":"2026-10-06T15:13:41.355Z","data":{}},
  {"type":"assistant.turn_end","timestamp":"2026-10-06T15:13:44.673Z","data":{}},
  {"type":"session.shutdown","timestamp":"2026-10-06T15:13:44.907Z","data":{"shutdownType":"routine"}},
];

/** The log as it stood at `iso`: a log holds nothing from the future. */
const replay = (events, iso) => eventsDir(events.filter((e) => e.timestamp <= iso));
const activityAt = (events, iso, opts = {}) => copilotSessionActivity(replay(events, iso), { now: Date.parse(iso), ...opts });
const ASYNC = "0dc10faf-23de-4888-85bd-d961ef241135";
const SYNC = "8bdb224e-4ebc-4ebe-9ed1-2adcd229e02b";
const WAKER = "03116609-d920-409e-88ea-9a23ded85198";

await test("a subagent that went idle with a background command still running keeps its row (cause 2)", () => {
  const before = activityAt(sessionA, "2026-10-06T15:10:52.000Z");
  assert.deepEqual(before.agents.map((a) => [a.id, a.status]), [[SYNC, "running"], [ASYNC, "running"]]);

  // 15:11:00: the subagent is idle, its sleep 60 has 51 s to go.
  const during = activityAt(sessionA, "2026-10-06T15:11:00.000Z");
  const row = during.agents.find((a) => a.id === ASYNC);
  assert.ok(row, "the row survives subagent.completed");
  assert.equal(row.status, "background");
  assert.equal(row.label, "background: sleep 60");
  assert.equal(row.startTime, Date.parse("2026-10-06T15:10:51.803Z"), "its age counts from the command");
  const out = stripAnsi(
    renderPayload({ ...fixture, transcript_path: replay(sessionA, "2026-10-06T15:11:00.000Z") }, { sources: emptySources, trackChanges: false, now: Date.parse("2026-10-06T15:11:00.000Z"), ...WIDE }),
  );
  assert.match(out, /background: sleep 60/);

  // A caller that can list processes decides: alive keeps it, gone drops it.
  const alive = activityAt(sessionA, "2026-10-06T15:11:00.000Z", { shellAlive: (s) => s.command === "sleep 60" });
  assert.ok(alive.agents.some((a) => a.id === ASYNC && a.status === "background"));
  assert.equal(alive.working, true, "a command known to be running is work");
  const gone = activityAt(sessionA, "2026-10-06T15:11:00.000Z", { shellAlive: () => false });
  assert.ok(!gone.agents.some((a) => a.id === ASYNC));

  // With nobody to ask, the row lasts the 120 s Copilot's own panel keeps an
  // idle agent, then goes: nothing in the log says when the command ends.
  const late = copilotSessionActivity(replay(sessionA, "2026-10-06T15:11:50.000Z"), { now: Date.parse("2026-10-06T15:12:54.000Z") });
  assert.ok(!late.agents.some((a) => a.id === ASYNC));

  // The sync sleep 40 came back "<shellId: 1 completed with exit code 0>":
  // that names a shell but leaves nothing running.
  const afterSync = activityAt(sessionA, "2026-10-06T15:11:40.000Z");
  assert.ok(!afterSync.agents.some((a) => a.id === SYNC), JSON.stringify(afterSync.agents));
});

await test("a background command's record closes on stop_bash, a shell_exit result or a shell_completed notification", () => {
  const upTo = sessionA.filter((e) => e.timestamp <= "2026-10-06T15:10:53.200Z");
  const t = "2026-10-06T15:10:55.000Z";
  const closers = [
    { type: "tool.execution_start", agentId: ASYNC, timestamp: t, data: { toolCallId: "stop-1", toolName: "stop_bash", arguments: { shellId: "0" } } },
    { type: "tool.execution_complete", agentId: ASYNC, timestamp: t, data: { toolCallId: "read-1", success: true, result: { content: "done", contents: [{ type: "shell_exit", shellId: "0" }] } } },
    { type: "system.notification", timestamp: t, data: { kind: { type: "shell_completed", shellId: "0", exitCode: 0 } } },
  ];
  const now = Date.parse("2026-10-06T15:10:56.000Z");
  assert.ok(copilotSessionActivity(eventsDir(upTo), { now }).agents.some((a) => a.id === ASYNC));
  for (const closer of closers) {
    const activity = copilotSessionActivity(eventsDir([...upTo, closer]), { now });
    assert.ok(!activity.agents.some((a) => a.id === ASYNC), closer.type);
  }
  const failed = { type: "subagent.failed", agentId: ASYNC, timestamp: t, data: { toolCallId: "call_DQAwC1hngUvj1VetdDfyq7DL" } };
  assert.ok(!copilotSessionActivity(eventsDir([...upTo, failed]), { now }).agents.some((a) => a.id === ASYNC), "a failed agent is gone for good");
});

await test("a subagent resumed by write_agent gets its row back for the new turn (cause 3)", () => {
  const dead = { shellAlive: () => false };
  // 15:13:06: idle, before write_agent. Its async sleep 20 is the only thing left.
  assert.deepEqual(activityAt(sessionB, "2026-10-06T15:13:06.000Z", dead).agents, []);
  assert.equal(activityAt(sessionB, "2026-10-06T15:13:06.000Z").agents[0]?.label, "background: sleep 20");
  for (const iso of ["2026-10-06T15:13:20.000Z", "2026-10-06T15:13:39.000Z"]) {
    const [row, ...rest] = activityAt(sessionB, iso, dead).agents;
    assert.equal(rest.length, 0, iso);
    assert.equal(row?.id, WAKER, iso);
    assert.equal(row.status, "running", iso);
    assert.equal(row.label, "Running command", iso);
    assert.equal(row.description, "Start requested shell sleep");
    assert.equal(row.startTime, Date.parse("2026-10-06T15:13:08.341Z"), "its age counts from the resumed turn");
  }
  // Inside the 2 ms between two turns of one interaction the row stays.
  assert.equal(activityAt(sessionB, "2026-10-06T15:13:39.937Z", dead).agents.length, 1);
  // The resumed turn ended at 15:13:41.237 and the session shut down at 44.907.
  assert.deepEqual(activityAt(sessionB, "2026-10-06T15:13:44.600Z", dead).agents, []);
});

await test("a resumed turn's end and the next turn's start 10 ms apart do not drop the row", () => {
  const base = Date.parse("2026-10-06T15:13:00.000Z");
  const iso = (ms) => new Date(base + ms).toISOString();
  const events = [
    { type: "subagent.started", agentId: "agent-r", timestamp: iso(0), data: { toolCallId: "call-r", agentName: "general-purpose", agentDescription: "Resumable" } },
    { type: "assistant.turn_end", agentId: "agent-r", timestamp: iso(1000), data: {} },
    { type: "subagent.completed", agentId: "agent-r", timestamp: iso(1050), data: { toolCallId: "call-r" } },
    { type: "assistant.turn_start", agentId: "agent-r", timestamp: iso(5000), data: {} },
    { type: "assistant.turn_end", agentId: "agent-r", timestamp: iso(60_000), data: {} },
    { type: "assistant.turn_start", agentId: "agent-r", timestamp: iso(60_010), data: {} },
  ];
  const between = copilotSessionActivity(eventsDir(events.slice(0, 5)), { now: base + 60_005 });
  assert.equal(between.agents.length, 1);
  assert.equal(between.agents[0].startTime, base + 5000);
  const next = copilotSessionActivity(eventsDir(events), { now: base + 90_000 });
  assert.equal(next.agents[0]?.startTime, base + 5000, "the same resume, not a new one");
});

/** Agent-tagged tool output, the bulk of a busy log, about `bytes` long. */
function padding(agent, bytes, from) {
  const line = (i) =>
    JSON.stringify({ type: "tool.execution_complete", agentId: agent, timestamp: new Date(from + i).toISOString(), data: { toolCallId: `pad-${i}`, success: true, result: { content: "x".repeat(16 * 1024) } } }) + "\n";
  const one = line(0).length;
  return Array.from({ length: Math.ceil(bytes / one) }, (_, i) => line(i)).join("");
}

await test("a subagent whose start scrolled out of the 2 MB tail keeps its row (cause 4)", () => {
  const start = NOW - 600_000;
  const head = [started(1, 600)];
  const lines = (events) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const file = (dir) => path.join(dir, "events.jsonl");

  // Running: the bar saw the start, then 2.2 MB of the agent's own output.
  const dir = sessionDir(lines(head));
  assert.equal(copilotSessionActivity(dir, { now: NOW }).agents.length, 1);
  appendFileSync(file(dir), padding("agent-1", 2.2 * 1024 * 1024, start + 1000));
  const running = copilotSessionActivity(dir, { now: NOW });
  assert.deepEqual(running.agents.map((a) => [a.id, a.description]), [["agent-1", "Brief number 1"]]);

  // The same, then the completion: no row.
  appendFileSync(file(dir), lines([ended(1, 10)]));
  assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).agents, []);

  // A resume past the tail still ends the old process's work.
  const resumed = sessionDir(lines(head));
  copilotSessionActivity(resumed, { now: NOW });
  appendFileSync(file(resumed), padding("agent-1", 2.2 * 1024 * 1024, start + 1000));
  appendFileSync(file(resumed), lines([{ type: "session.resume", data: {}, timestamp: at(5) }]));
  assert.deepEqual(copilotSessionActivity(resumed, { now: NOW }).agents, []);

  // Without the sidecar the reader does what it did before: the last 2 MB.
  const plain = sessionDir(lines(head));
  appendFileSync(file(plain), padding("agent-1", 2.2 * 1024 * 1024, start + 1000));
  assert.deepEqual(copilotSessionActivity(plain, { now: NOW, sidecar: false }).agents, []);
});

await test("the sidecar never describes a different file, and a half-written line is read once", () => {
  const file = (dir) => path.join(dir, "events.jsonl");
  const dir = eventsDir([started(1, 100), started(2, 90)]);
  assert.equal(copilotSessionActivity(dir, { now: NOW }).agents.length, 2);
  // Written over in place, longer than before: the old state must not leak in.
  writeFileSync(file(dir), [started(3, 80), started(4, 70), started(5, 60)].map((e) => JSON.stringify(e)).join("\n") + "\n");
  assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).agents.map((a) => a.id), ["agent-3", "agent-4", "agent-5"]);
  // Shrunk: read again from the start.
  writeFileSync(file(dir), JSON.stringify(started(6, 50)) + "\n");
  assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).agents.map((a) => a.id), ["agent-6"]);

  // A line caught half-written counts once it is whole, and only once.
  const skill = JSON.stringify({ type: "skill.invoked", timestamp: at(10), data: { name: "halfway" } });
  appendFileSync(file(dir), skill.slice(0, 20));
  assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).skills, []);
  appendFileSync(file(dir), skill.slice(20) + "\n");
  assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).skills, ["halfway"]);
  appendFileSync(file(dir), JSON.stringify({ type: "skill.invoked", timestamp: at(5), data: { name: "next" } }) + "\n");
  const after = copilotSessionActivity(dir, { now: NOW });
  assert.deepEqual(after.skills, ["next", "halfway"]);
  assert.equal(after.skillsTrueCount, 2);
});

await test("an unreadable sidecar falls back to reading the tail", () => {
  const dir = eventsDir([started(1, 100)]);
  copilotSessionActivity(dir, { now: NOW });
  const key = createHash("sha256").update(dir).digest("hex").slice(0, 16);
  const store = path.join(os.homedir(), ".claude", "statusline", "cache", `${key}.copilot-events.json`);
  assert.ok(existsSync(store), "the first read leaves a sidecar");
  for (const garbage of ["{not json", JSON.stringify({ schema: 1, offset: 0, ino: "x", state: { subagents: "no" } })]) {
    writeFileSync(store, garbage);
    assert.deepEqual(copilotSessionActivity(dir, { now: NOW }).agents.map((a) => a.id), ["agent-1"]);
  }
});
