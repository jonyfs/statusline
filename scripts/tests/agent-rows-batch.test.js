import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";
import { renderTaskRow, runTaskRows, alignTaskRows, finishedSummaryRow } from "../../src/taskRows.js";
import { emptyTotals, advanceTotals, summarize } from "../../src/sessionTotals.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/077-agent-rows: the share, the queue, the band, the finished.

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const task = (over = {}) => ({ id: "t1", name: "explore", type: "agent", description: "Finding the auth code", startTime: NOW - 135_000, model: "claude-haiku-4-5", contextWindowSize: 200000, tokenCount: 40000, status: "running", ...over });
const turn = (o = 100, agentId = null) => JSON.stringify({ type: "assistant", ...(agentId ? { agentId } : {}), message: { model: "m", usage: { input_tokens: 10, output_tokens: o, cache_read_input_tokens: 1000, cache_creation_input_tokens: 50 }, content: [] } });

await test("the totals keep each subagent's tokens by its id, from its file or its entries", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agents-"));
  const file = path.join(dir, "s.jsonl");
  writeFileSync(file, turn(100) + "\n" + JSON.stringify({ type: "assistant", isSidechain: true, agentId: "side1", message: { model: "m", usage: { input_tokens: 1, output_tokens: 9, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, content: [] } }) + "\n");
  mkdirSync(path.join(dir, "s", "subagents"), { recursive: true });
  writeFileSync(path.join(dir, "s", "subagents", "agent-abc.jsonl"), turn(400) + "\n");
  const t = advanceTotals(emptyTotals(), { transcriptPath: file, sessionId: "s", now: NOW });
  assert.deepEqual(summarize(t).agentTotals, { side1: 10, abc: 1460 });
});

await test("a pending task reads queued, and the share cell says the agent's part of the session", () => {
  const queued = strip(renderTaskRow(task({ status: "pending" }), { columns: 100, now: NOW }).content);
  assert.match(queued, /queued/);
  const rows = alignTaskRows([task()], { columns: 120, now: NOW, shareByAgent: new Map([["t1", 18]]) });
  assert.match(strip(rows[0].content), /18% of session/);
  const narrow = alignTaskRows([task()], { columns: 60, now: NOW, shareByAgent: new Map([["t1", 18]]) });
  assert.doesNotMatch(strip(narrow[0].content), /of session/, "the share is the first cell width sheds");
});

await test("two or more finished agents collapse into one row carried by the first, one keeps its own", async () => {
  const done = [task({ id: "a", name: "explore", status: "completed" }), task({ id: "b", name: "code-review", status: "completed" }), task({ id: "c", name: "tests", status: "failed" })];
  const row = finishedSummaryRow(done, { columns: 80 });
  assert.equal(row.id, "a");
  assert.match(strip(row.content), /✗ 3 done, 1 failed · explore, code-review, tests/);
  const home = makeHome();
  await withHome(home, async () => {
    const out = await runTaskRows({ now: NOW, input: JSON.stringify({ session_id: "s9", columns: 120, tasks: [task({ id: "r", status: "running" }), ...done.slice(0, 2)] }) });
    const rows = out.split("\n").map((l) => JSON.parse(l));
    const byId = Object.fromEntries(rows.map((r) => [r.id, strip(r.content)]));
    assert.match(byId.r, /Finding the auth code/);
    assert.match(byId.a, /✓ 2 done · explore, code-review/);
    assert.equal(byId.b, "", "the second finished row comes off");
    const single = await runTaskRows({ now: NOW, input: JSON.stringify({ session_id: "s10", columns: 120, tasks: [done[0]] }) });
    assert.match(strip(single), /completed/);
    assert.doesNotMatch(strip(single), /done ·/);
  });
});
