import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderTaskRow, runTaskRows } from "../../src/taskRows.js";
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
