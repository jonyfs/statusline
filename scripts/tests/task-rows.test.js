import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderTaskRow, runTaskRows, taskTier } from "../../src/taskRows.js";
import { displayWidth } from "../../src/theme.js";
import { appendSkillEvent, readSkillEvents } from "../../src/skillEvents.js";
import { makeHome, withHome } from "./fixtures/home.js";

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

// The rows are a table, and a table that does not line up is a list of
// strings. Columns are sized across the whole tick, not per row.
await test("the columns line up across a tick's rows", async () => {
  const out = await runTaskRows({
    now: NOW,
    input: JSON.stringify({
      columns: 200,
      tasks: [
        { id: "a", name: "pr-shepherd", description: "Setting up base-commit hook sandbox", model: "claude-opus-5", effort: "high", startTime: NOW - 60_000, tokenCount: 198_000, contextWindowSize: 1_000_000 },
        { id: "b", name: "explore", description: "Locating money.ts", model: "claude-haiku-4-5", startTime: NOW - 95_000, tokenCount: 9_000, contextWindowSize: 200_000 },
      ],
    }),
  });
  const rows = out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));
  const columnStarts = (row) => {
    const at = [];
    let i = -1;
    while ((i = row.indexOf(" \u00b7 ", i + 1)) !== -1) at.push(i);
    return at;
  };
  assert.deepEqual(columnStarts(rows[0]), columnStarts(rows[1]), "every separator falls in the same column");
});

// A column no row filled costs nothing: it is dropped rather than padded to
// a gap that reads as a missing value.
await test("a column no row uses is not drawn", async () => {
  const out = await runTaskRows({
    now: NOW,
    input: JSON.stringify({
      columns: 200,
      tasks: [
        { id: "a", name: "same", description: "first piece of work", startTime: NOW - 60_000 },
        { id: "b", name: "same", description: "second piece of work", startTime: NOW - 95_000 },
      ],
    }),
  });
  const rows = out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));
  // Both share a name, so both lead with the description and the name column
  // is empty on every row. One separator remains, before the age.
  for (const row of rows) {
    assert.equal((row.match(/ \u00b7 /g) || []).length, 1, `one separator, got: ${row}`);
  }
});

// The skills say what the agent is doing and the tier says what it costs.
// The first is read with the name, so it sits between them.
await test("an agent's skills sit between its name and its tier", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    appendSkillEvent("s1", "humanizer", { now: NOW, agentId: "a" });
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        session_id: "s1",
        columns: 200,
        tasks: [{ id: "a", name: "explore", description: "Locating money.ts", model: "claude-opus-5", effort: "high", startTime: NOW - 60_000 }],
      }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.ok(
      row.indexOf("humanizer") > row.indexOf("Locating money.ts") &&
        row.indexOf("humanizer") < row.indexOf("opus"),
      `expected name, skills, tier in that order: ${row}`
    );
  });
});

// `local_agent` is what an ad-hoc Task arrives as, the same word for every
// one of them. It is a column spent saying the caller did not name an agent
// type, which the reader can see from the fact that no name is there.
await test("the placeholder name an unnamed Task arrives with is dropped", async () => {
  const out = await runTaskRows({
    now: NOW,
    input: JSON.stringify({
      columns: 200,
      tasks: [
        { id: "a", name: "local_agent", description: "Fechar os achados do PR 59", startTime: NOW - 60_000 },
        { id: "b", name: "pr-shepherd", description: "Setting up the gate sandbox", startTime: NOW - 95_000 },
      ],
    }),
  });
  const rows = out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));
  assert.doesNotMatch(rows[0], /local_agent/, "the placeholder is not a name");
  assert.match(rows[0], /Fechar os achados do PR 59/, "the row leads with the work instead");
  assert.match(rows[1], /pr-shepherd/, "a real agent type still earns its column");
  assert.match(rows[1], /Setting up the gate sandbox/);
});

// With nothing else to say, the placeholder is still better than a blank row.
await test("a placeholder with no description still names the row", async () => {
  const out = await runTaskRows({
    now: NOW,
    input: JSON.stringify({ columns: 200, tasks: [{ id: "a", name: "local_agent", startTime: NOW - 60_000 }] }),
  });
  const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
  assert.match(row, /local_agent/, "no description means the placeholder is all there is");
});

// Thirty minutes answers "which skills are still shaping this session". An
// agent is bounded, so the honest filter is whether it is still running —
// which the caller applies by looking up only the ids on the current tick.
// Windowing on top of that dropped the skills of any agent past its first
// half hour, which is exactly the long run where knowing matters most.
await test("an agent that has run for hours keeps the skills it started with", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    appendSkillEvent("s1", "humanizer", { now: NOW - 3 * 60 * 60 * 1000, agentId: "a" });
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        session_id: "s1",
        columns: 200,
        tasks: [{ id: "a", name: "explore", description: "Consertar o offline do PR 58", startTime: NOW - 3 * 60 * 60 * 1000 }],
      }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.match(row, /humanizer/, "three hours in, the skill is still what it is running");
    assert.match(row, /3h00m/, "and the row agrees about how long that has been");
  });
});

// The session's own list is still windowed: a skill it used three hours ago
// is not what is shaping it now.
await test("the session's own skill list stays windowed", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s1", "humanizer", { now: NOW - 3 * 60 * 60 * 1000 });
    assert.deepEqual(readSkillEvents("s1", { now: NOW }), []);
  });
});
