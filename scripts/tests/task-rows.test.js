import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderTaskRow, runTaskRows, taskTier } from "../../src/taskRows.js";
import { displayWidth } from "../../src/theme.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

const task = (over = {}) => ({
  id: "t1",
  name: "explore",
  type: "agent",
  description: "Finding the auth code",
  startTime: NOW - 135_000,
  model: "claude-haiku-4-5",
  contextWindowSize: 200000,
  tokenCount: 40000,
  ...over,
});

await test("a row names the task, its work, its context and its age", () => {
  const row = renderTaskRow(task(), { columns: 80, now: NOW });
  const text = strip(row.content);
  assert.equal(row.id, "t1");
  assert.match(text, /explore/);
  assert.match(text, /Finding the auth code/);
  assert.match(text, /20%/, "40k of 200k");
  assert.match(text, /40k/);
  assert.match(text, /2m/, "started a couple of minutes ago");
});

await test("the context bar uses the same ramp as the statusline", () => {
  const calm = strip(renderTaskRow(task({ tokenCount: 20000 }), { columns: 80, now: NOW }).content);
  const hot = strip(renderTaskRow(task({ tokenCount: 190000 }), { columns: 80, now: NOW }).content);
  assert.match(calm, /█/, "the safe band is solid");
  assert.match(hot, /▒/, "the critical band is not");
  assert.match(hot, /!/, "and carries the mark colour cannot lose");
});

await test("a task whose model has not resolved renders without a bar", () => {
  // `contextWindowSize` needs Claude Code v2.1.205 and is absent while a
  // task is still resolving. A row without it says less rather than
  // drawing an empty bar.
  const row = renderTaskRow(task({ contextWindowSize: undefined, tokenCount: undefined }), {
    columns: 80,
    now: NOW,
  });
  const text = strip(row.content);
  assert.match(text, /explore/);
  assert.doesNotMatch(text, /[█▓▒░]/);
});

await test("a task with no id is left to Claude Code", () => {
  assert.equal(renderTaskRow({ name: "nameless" }, { now: NOW }), null);
  assert.equal(renderTaskRow(null, { now: NOW }), null);
});

await test("one JSON line per row, and nothing at all with no tasks", async () => {
  const out = await runTaskRows({
    now: NOW,
    input: JSON.stringify({ columns: 100, tasks: [task(), task({ id: "t2", name: "review" })] }),
  });
  const lines = out.split("\n").filter(Boolean);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.ok(parsed.id);
    assert.equal(typeof parsed.content, "string");
  }

  assert.equal(await runTaskRows({ now: NOW, input: JSON.stringify({ tasks: [] }) }), "");
  assert.equal(await runTaskRows({ now: NOW, input: "{not json" }), "", "a broken tick is silent, not fatal");
});

await test("a row respects the width it was given", () => {
  const row = renderTaskRow(task({ description: "x".repeat(200) }), { columns: 60, now: NOW });
  const bar = strip(row.content).match(/[█▓▒░]+/)?.[0] ?? "";
  assert.ok(displayWidth(bar) <= 10, "the bar scales to the row's width, not the terminal's");
});

await test("elapsed time reads in whatever unit fits", () => {
  const secs = strip(renderTaskRow(task({ startTime: NOW - 20_000 }), { now: NOW }).content);
  const mins = strip(renderTaskRow(task({ startTime: NOW - 600_000 }), { now: NOW }).content);
  const hours = strip(renderTaskRow(task({ startTime: NOW - 5_400_000 }), { now: NOW }).content);
  assert.match(secs, /20s/);
  assert.match(mins, /10m/);
  assert.match(hours, /1h30m/);
});

// The tier a row shows. With several subagents in flight, these rows are the only place a person can
// see that the expensive agent is on the expensive model — a roster on disk says what was DECLARED,
// and the row says what is RUNNING.

await test("the row spells out the model and the effort it is running at", () => {
  const text = strip(renderTaskRow(task({ model: "claude-opus-5", effort: "xhigh" }), { columns: 120, now: NOW }).content);
  assert.match(text, /opus·xhigh/);
});

await test("the tier is read from an id, a display name or an object alike", () => {
  assert.equal(taskTier({ model: "claude-opus-5", effort: "xhigh" }).model, "opus");
  assert.equal(taskTier({ model: "Sonnet 5", effort: "high" }).model, "sonnet");
  assert.equal(taskTier({ model: { id: "claude-haiku-4-5" }, effort: { level: "low" } }).model, "haiku");
});

await test("colour is the projection of the tier, so each tier gets its own", () => {
  const colour = (m, e) => taskTier({ model: m, effort: e }).colour;
  assert.equal(colour("claude-opus-5", "xhigh"), "red");
  assert.equal(colour("claude-opus-5", "high"), "peach");
  assert.equal(colour("claude-sonnet-5", "high"), "yellow");
  assert.equal(colour("claude-sonnet-5", "medium"), "green");
  assert.equal(colour("claude-haiku-4-5", "low"), "teal");
});

await test("the name itself carries the tier colour, so a trimmed row still reads", () => {
  const row = renderTaskRow(task({ model: "claude-opus-5", effort: "xhigh" }), { columns: 120, now: NOW });
  // Catppuccin mocha red, the tier colour, applied to the first segment.
  assert.match(row.content, /^\x1b\[38;2;243;139;168m/);
});

await test("a task whose model has not resolved gets no tier rather than a guessed one", () => {
  assert.equal(taskTier({ effort: "high" }), null);
  const text = strip(renderTaskRow(task({ model: undefined }), { columns: 120, now: NOW }).content);
  assert.doesNotMatch(text, /opus|sonnet|haiku/);
});

await test("an unknown model family is not invented into a tier", () => {
  assert.equal(taskTier({ model: "some-other-model", effort: "high" }), null);
});

await test("a tier segment never pushes the row past its columns", () => {
  const row = renderTaskRow(task({ model: "claude-opus-5", effort: "xhigh" }), { columns: 80, now: NOW });
  assert.ok(displayWidth(strip(row.content)) <= 80, strip(row.content));
});
