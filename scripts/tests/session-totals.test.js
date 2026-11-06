import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { buildReport } from "../../src/doctor.js";
import { emptyTotals, foldLine, advanceTotals, summarize, outputPerMinute, getSessionTotals, modelFamily } from "../../src/sessionTotals.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

// specs/073-session-totals: what the session has spent, read as it is written.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const MIN = 60_000;

const turn = ({ model = "claude-fable-5-1", input = 10, output = 100, read = 1000, write = 50, tools = [], sidechain = false } = {}) =>
  JSON.stringify({
    type: "assistant",
    isSidechain: sidechain,
    message: {
      model,
      usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: write },
      content: [{ type: "text", text: "x" }, ...tools.map((name) => ({ type: "tool_use", name, id: "t", input: {} }))],
    },
  });

await test("a turn folds its four counts, its model and its tool uses; other lines are skipped", () => {
  const t = emptyTotals();
  foldLine(t, turn({ tools: ["Bash", "Bash", "Read"] }));
  foldLine(t, JSON.stringify({ type: "user", message: { content: "hi" } }));
  foldLine(t, "{not json");
  foldLine(t, turn({ model: "claude-sonnet-5-5", output: 300, sidechain: true }));
  assert.equal(t.turns, 2);
  assert.equal(t.input + t.output + t.cacheRead + t.cacheWrite, 10 + 100 + 1000 + 50 + 10 + 300 + 1000 + 50);
  assert.deepEqual(t.tools, { Bash: 2, Read: 1 });
  assert.deepEqual(t.byModel, { "claude-fable-5-1": 100, "claude-sonnet-5-5": 300 });
  assert.equal(t.agentTokens, 10 + 300 + 1000 + 50, "a sidechain turn is a subagent's");
});

await test("the reader keeps an offset, waits for a partial line, reads subagent files, and starts over after a rewrite", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "totals-"));
  const file = path.join(dir, "s1.jsonl");
  writeFileSync(file, turn() + "\n" + turn({ output: 200 }) + "\n");
  const t = emptyTotals();
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW });
  assert.equal(t.turns, 2);
  const offset = t.offset;
  // A line still being written is not an entry yet.
  appendFileSync(file, turn({ output: 5 }).slice(0, 40));
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW + MIN });
  assert.equal(t.turns, 2);
  assert.equal(t.offset, offset);
  appendFileSync(file, turn({ output: 5 }).slice(40) + "\n");
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW + 2 * MIN });
  assert.equal(t.turns, 3);
  // Subagents beside the transcript.
  mkdirSync(path.join(dir, "s1", "subagents"), { recursive: true });
  writeFileSync(path.join(dir, "s1", "subagents", "agent-abc.jsonl"), turn({ model: "claude-sonnet-5-5", output: 400 }) + "\n");
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW + 3 * MIN });
  assert.equal(t.agentTokens, 10 + 400 + 1000 + 50);
  assert.equal(t.turns, 4);
  // The same bytes are never counted twice.
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW + 4 * MIN });
  assert.equal(t.turns, 4);
  // A rewritten, shorter file is read from zero.
  writeFileSync(file, turn() + "\n");
  advanceTotals(t, { transcriptPath: file, sessionId: "s1", now: NOW + 5 * MIN });
  assert.equal(t.turns, 5);
  assert.equal(t.offset, Buffer.byteLength(turn() + "\n"));
});

await test("a redraw reads at most its budget and catches up on the next", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "totals-"));
  const file = path.join(dir, "s2.jsonl");
  const lines = Array.from({ length: 50 }, () => turn()).join("\n") + "\n";
  writeFileSync(file, lines);
  const t = emptyTotals();
  advanceTotals(t, { transcriptPath: file, sessionId: "s2", now: NOW, budget: 1000 });
  assert.ok(t.turns > 0 && t.turns < 50, `read ${t.turns} of 50 in one step`);
  advanceTotals(t, { transcriptPath: file, sessionId: "s2", now: NOW + MIN, budget: 1_000_000 });
  assert.equal(t.turns, 50);
});

await test("the output rate needs a minute of span and a rise; the 200k time accrues between redraws that saw the flag", () => {
  const t = emptyTotals();
  advanceTotals(t, { now: NOW });
  assert.equal(outputPerMinute(t), null);
  t.output = 1500;
  advanceTotals(t, { now: NOW + 30_000 });
  assert.equal(outputPerMinute(t), null, "thirty seconds is not a minute");
  t.output = 3000;
  advanceTotals(t, { now: NOW + 2 * MIN });
  assert.equal(Math.round(outputPerMinute(t)), 1500);
  advanceTotals(t, { now: NOW + 3 * MIN, exceeds200k: true });
  assert.equal(t.over200kMs, 0, "the first sighting starts the clock");
  advanceTotals(t, { now: NOW + 5 * MIN, exceeds200k: true });
  assert.equal(t.over200kMs, 2 * MIN);
  advanceTotals(t, { now: NOW + 9 * MIN, exceeds200k: false });
  advanceTotals(t, { now: NOW + 10 * MIN, exceeds200k: true });
  assert.equal(t.over200kMs, 2 * MIN, "the gap below the threshold does not count");
});

await test("the summary names the largest other model only when more than one answered", () => {
  const t = emptyTotals();
  foldLine(t, turn({ output: 800 }));
  assert.equal(summarize(t, { ownModel: "fable" }).mix, null);
  foldLine(t, turn({ model: "claude-sonnet-5-5", output: 150 }));
  foldLine(t, turn({ model: "claude-haiku-5-5", output: 50 }));
  const s = summarize(t, { ownModel: "fable" });
  assert.deepEqual(s.mix, { model: "claude-sonnet-5-5", pct: 15 });
  assert.equal(modelFamily(s.mix.model), "sonnet");
  assert.equal(s.toolCalls, 0);
  assert.equal(s.turns, 3);
});

await test("the probe keeps its state under the cache directory and answers null without a transcript", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "totals-"));
  const file = path.join(dir, "s3.jsonl");
  writeFileSync(file, turn({ tools: ["Bash"] }) + "\n");
  const env = { ...process.env, CLAUDE_STATUSLINE_CACHE_DIR: dir };
  const a = getSessionTotals({ transcriptPath: file, sessionId: "s3", now: NOW, env });
  assert.equal(a.toolCalls, 1);
  appendFileSync(file, turn({ tools: ["Edit"] }) + "\n");
  const b = getSessionTotals({ transcriptPath: file, sessionId: "s3", now: NOW + MIN, env });
  assert.equal(b.toolCalls, 2, "the second call continues from the saved offset");
  assert.equal(b.turns, 2);
  assert.equal(getSessionTotals({ transcriptPath: null, now: NOW, env }), null);
});

// The chips ------------------------------------------------------------------

const payload = (over = {}) => ({ ...fullPayload({ now: NOW }), transcript_path: "/tmp/x.jsonl", session_id: "s", ...over });
const sources = (totals) => ({ ...emptySources, getSessionTotals: () => totals });
const render = (p, src, width = 300) => stripAnsi(renderPayload(p, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 }));
const TOTALS = { total: 1_234_000, perMinute: 3100, agentTokens: 420_000, mix: { model: "claude-opus-5-5", pct: 20 }, turns: 42, toolCalls: 42, tools: [["Bash", 30], ["Read", 12]], over200kMs: 12 * MIN };

await test("line 3 sums the session's tokens with its rate, the subagents' share and the model mix, shedding right to left", () => {
  const out = render(payload(), sources(TOTALS));
  assert.match(out, /Σ 1\.2M · ↑3\.1k\/min · agents 420k · opus 20%/);
  const bare = render(payload(), sources({ ...TOTALS, perMinute: null, agentTokens: 0, mix: null }));
  assert.match(bare, /Σ 1\.2M /);
  assert.doesNotMatch(bare, /agents|↑|opus/);
  // Somewhere between the full line and the dropped chip the tails go first.
  const shortened = [130, 120, 110, 100, 90, 80].map((w) => render(payload(), sources(TOTALS), w)).find((o) => /Σ 1\.2M/.test(o) && !/opus 20%/.test(o));
  assert.ok(shortened, "a narrower line keeps the total and sheds the mix");
  assert.doesNotMatch(render(payload(), sources(null)), /Σ/);
});

await test("line 2 counts the tool calls, and the context chip says how long it has been past 200k", () => {
  const out = render(payload({ exceeds_200k_tokens: true }), sources(TOTALS));
  assert.match(out, /tools 42/);
  assert.match(out, /200k\+ · 12m/);
  assert.doesNotMatch(render(payload(), sources({ ...TOTALS, toolCalls: 0 })), /tools/);
  assert.doesNotMatch(render(payload({ exceeds_200k_tokens: true }), sources({ ...TOTALS, over200kMs: 20_000 })), /200k\+ ·/);
});

await test("Copilot's payload names no transcript, so the reader is asked for none, and the doctor describes both rows", () => {
  let seen = null;
  const src = { ...emptySources, getSessionTotals: (o) => { seen = o; return null; } };
  const { transcript_path, ...copilot } = payload();
  render({ ...copilot, ai_used: { total_nano_aiu: 0 } }, src);
  assert.equal(seen?.transcriptPath, null);
  const report = buildReport(payload(), { now: NOW, live: false, probe: sources(TOTALS) });
  const by = Object.fromEntries(report.segments.map((s) => [s.key, s]));
  assert.equal(by.sessionTokens.rendered, true);
  assert.match(by.sessionTokens.value, /42 turns/);
  assert.match(by.toolCalls.value, /Bash 30/);
});

await test("a passive render with nowhere to keep the offset reads nothing and draws no sum", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "totals-"));
  const file = path.join(dir, "s4.jsonl");
  writeFileSync(file, turn({ tools: ["Bash"] }) + "\n");
  const env = { ...process.env, CLAUDE_STATUSLINE_PASSIVE: "1" };
  delete env.CLAUDE_STATUSLINE_CACHE_DIR;
  assert.equal(getSessionTotals({ transcriptPath: file, sessionId: "s4", now: NOW, env }), null);
});
