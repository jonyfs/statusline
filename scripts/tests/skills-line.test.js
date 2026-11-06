import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { scanTail } from "../../src/transcriptTail.js";
import { countMcpServers } from "../../src/mcp.js";
import { buildReport } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

// specs/075-skills-line: how long, how it ended, in which mode, with what connected.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const MIN = 60_000;
const at = (ms) => new Date(NOW - ms).toISOString();
const skillCall = (id, skill, ago) => JSON.stringify({ type: "assistant", timestamp: at(ago), message: { content: [{ type: "tool_use", id, name: "Skill", input: { skill } }] } });
const result = (id, ago, error = false) => JSON.stringify({ type: "user", timestamp: at(ago), message: { content: [{ type: "tool_result", tool_use_id: id, is_error: error, content: "x" }] } });
const mode = (m) => JSON.stringify({ type: "permission-mode", permissionMode: m });

await test("the scan pairs each Skill call with its result and reads the newest permission mode", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "skills-"));
  const file = path.join(dir, "t.jsonl");
  writeFileSync(file, [mode("default"), skillCall("a", "review", 20 * MIN), result("a", 15 * MIN, true), mode("auto"), skillCall("b", "ship", 12 * MIN), ""].join("\n"));
  const scan = scanTail(file, { now: NOW, windowMs: 60 * MIN });
  assert.equal(scan.permissionMode, "auto");
  assert.deepEqual(scan.skillRuns.map((r) => [r.skill, r.finished, r.error]), [["ship", false, null], ["review", true, true]]);
  assert.equal(scan.skillRuns[0].startedAt, NOW - 12 * MIN);
  assert.equal(scan.skillRuns[1].endedAt, NOW - 15 * MIN);
});

await test("the MCP count joins the user's, the project's and the local servers, minus the disabled", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "mcp-home-"));
  const cwd = mkdtempSync(path.join(os.tmpdir(), "mcp-cwd-"));
  writeFileSync(path.join(home, ".claude.json"), JSON.stringify({
    mcpServers: { github: {}, slack: {} },
    projects: { [cwd]: { mcpServers: { local: {} }, disabledMcpjsonServers: ["noisy"], disabledMcpServers: ["slack"] } },
  }));
  writeFileSync(path.join(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { playwright: {}, noisy: {} } }));
  assert.deepEqual(countMcpServers(cwd, { homedir: home }), { count: 3, names: ["github", "local", "playwright"] });
  assert.equal(countMcpServers(mkdtempSync(path.join(os.tmpdir(), "mcp-empty-")), { homedir: mkdtempSync(path.join(os.tmpdir(), "mcp-nohome-")) }), null);
});

const activity = (over = {}) => ({
  skills: ["ship", "review"],
  skillsTrueCount: 2,
  todos: null,
  working: true,
  background: { shells: 0, agents: 0 },
  idleMs: 0,
  awaiting: false,
  skillRuns: [
    { skill: "ship", startedAt: NOW - 12 * MIN, endedAt: null, finished: false, error: null },
    { skill: "review", startedAt: NOW - 20 * MIN, endedAt: NOW - 15 * MIN, finished: true, error: false },
  ],
  permissionMode: "auto",
  ...over,
});
const sources = (act, over = {}) => ({ ...emptySources, getSessionActivity: () => act, getActiveSkills: () => act.skills, getActiveSkillsTrueCount: () => act.skillsTrueCount, ...over });
const payload = () => ({ ...fullPayload({ now: NOW }), transcript_path: "/tmp/t.jsonl", session_id: "s" });
const raw = (src, width = 300) => renderPayload(payload(), { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 });
const render = (src, width) => stripAnsi(raw(src, width));

await test("the running skill is emphasised with its duration, the last finished one carries its outcome, and the session count follows", () => {
  const out = render(sources(activity(), { getSkillSessionCount: () => 7 }));
  // The join is the thin separator glyph between two spaces in the Nerd tier.
  assert.match(out, /ship 12m[\s\uE0B5]+✓ review · 7 used/);
  assert.match(raw(sources(activity())), /\x1b\[1mship\x1b\[22m|\x1b\[1mship/, "the running skill is bold");
  const failed = render(sources(activity({ skillRuns: [{ skill: "review", startedAt: NOW - 20 * MIN, endedAt: NOW - 15 * MIN, finished: true, error: true }] })));
  assert.match(failed, /✗ review/);
  const same = render(sources(activity(), { getSkillSessionCount: () => 2 }));
  assert.doesNotMatch(same, /used/);
});

await test("the permission mode draws plan, auto and bypass, and nothing in the default mode", () => {
  assert.match(render(sources(activity())), / auto /);
  assert.match(render(sources(activity({ permissionMode: "plan" }))), / plan /);
  assert.match(render(sources(activity({ permissionMode: "bypassPermissions" }))), / bypass /);
  const plain = render(sources(activity({ permissionMode: "default" })));
  assert.doesNotMatch(plain, / auto | plan | bypass /);
});

await test("the MCP count draws before the vim mode, and the background count stays on the activity chip", () => {
  const out = render(sources(activity({ background: { shells: 1, agents: 1 } }), { getMcpServers: () => ({ count: 4, names: ["a", "b", "c", "d"] }) }));
  assert.match(out, /mcp 4/);
  assert.match(out, /working · 2 bg/);
  assert.doesNotMatch(render(sources(activity(), { getMcpServers: () => null })), /mcp/);
});

await test("the doctor names the mode and the servers", () => {
  const report = buildReport(payload(), { now: NOW, live: false, probe: sources(activity(), { getMcpServers: () => ({ count: 2, names: ["github", "slack"] }) }) });
  const by = Object.fromEntries(report.segments.map((s) => [s.key, s]));
  assert.equal(by.permissionMode.value, "auto");
  assert.match(by.mcp.value, /2: github, slack/);
});

// A server's name comes from a file the repository can ship: never a control sequence.
await test("an MCP server's name is sanitised and capped", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "mcp-home-"));
  const cwd = mkdtempSync(path.join(os.tmpdir(), "mcp-cwd-"));
  writeFileSync(path.join(cwd, ".mcp.json"), JSON.stringify({ mcpServers: { ["evil\u001b[2Jx".padEnd(80, "y")]: {} } }));
  writeFileSync(path.join(home, ".claude.json"), "{}");
  const r = countMcpServers(cwd, { homedir: home });
  assert.equal(r.count, 1);
  assert.doesNotMatch(r.names[0], /[\u0000-\u001f]/);
  assert.ok(r.names[0].length <= 40);
});

await test("a request copy repeating the Skill call does not hide the answer's own run", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "skills-"));
  const file = path.join(dir, "t.jsonl");
  const blob = JSON.stringify({ type: "api-request-blob", timestamp: null, message: { content: [{ type: "tool_use", id: "a", name: "Skill", input: { skill: "review" } }] } });
  writeFileSync(file, [skillCall("a", "review", 20 * MIN), result("a", 15 * MIN), blob, ""].join("\n"));
  const scan = scanTail(file, { now: NOW, windowMs: 60 * MIN });
  assert.deepEqual(scan.skillRuns.map((r) => [r.skill, r.finished, r.startedAt]), [["review", true, NOW - 20 * MIN]]);
});
