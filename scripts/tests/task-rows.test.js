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
  // Sandboxed: `runTaskRows` writes the roster snapshot, and without a
  // fake HOME it writes into the real one — clobbering whatever a live
  // session had there.
  const home = makeHome();
  await withHome(home, async () => {
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
  // Sandboxed: `runTaskRows` writes the roster snapshot, and without a
  // fake HOME it writes into the real one — clobbering whatever a live
  // session had there.
  const home = makeHome();
  await withHome(home, async () => {
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
});

// A column no row filled costs nothing: it is dropped rather than padded to
// a gap that reads as a missing value.
await test("a column no row uses is not drawn", async () => {
  // Sandboxed: `runTaskRows` writes the roster snapshot, and without a
  // fake HOME it writes into the real one — clobbering whatever a live
  // session had there.
  const home = makeHome();
  await withHome(home, async () => {
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
});

// The owner's order, chosen from rendered examples: what it costs leads, then
// what is unusual about the task, then who it is, what it is running, and only
// then the brief.
await test("the tier leads the row and the skills come before the brief", async () => {
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
      row.indexOf("opus") < row.indexOf("explore") &&
        row.indexOf("explore") < row.indexOf("humanizer") &&
        row.indexOf("humanizer") < row.indexOf("Locating money.ts"),
      `expected tier, name, skills, brief in that order: ${row}`
    );
  });
});

// `local_agent` is what an ad-hoc Task arrives as, the same word for every
// one of them. It is a column spent saying the caller did not name an agent
// type, which the reader can see from the fact that no name is there.
await test("the placeholder name an unnamed Task arrives with is dropped", async () => {
  // Sandboxed: `runTaskRows` writes the roster snapshot, and without a
  // fake HOME it writes into the real one — clobbering whatever a live
  // session had there.
  const home = makeHome();
  await withHome(home, async () => {
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
});

// With nothing else to say, the placeholder is still better than a blank row.
await test("a placeholder with no description still names the row", async () => {
  // Sandboxed: `runTaskRows` writes the roster snapshot, and without a
  // fake HOME it writes into the real one — clobbering whatever a live
  // session had there.
  const home = makeHome();
  await withHome(home, async () => {
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({ columns: 200, tasks: [{ id: "a", name: "local_agent", startTime: NOW - 60_000 }] }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.match(row, /local_agent/, "no description means the placeholder is all there is");
  });
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

// The tick carries two sentences that answer different questions, and the row
// was showing only one. `description` is the brief an agent was given and does
// not change; `label` is the step it is on right now (specs/021-agent-rows).
await test("a row separates the brief from the step it is on", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 200,
        tasks: [
          { id: "a", name: "local_agent", description: "Fechar os nove achados do PR 67", label: "Staging all fixer changes", startTime: NOW - 60_000 },
        ],
      }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.match(row, /Fechar os nove achados do PR 67/, "the brief leads");
    assert.match(row, /Staging all fixer changes/, "and the step is beside it");
  });
});

await test("a step identical to the brief is not repeated", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        columns: 200,
        tasks: [{ id: "a", name: "explore", label: "Locating money.ts", startTime: NOW - 60_000 }],
      }),
    });
    const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
    assert.equal((row.match(/Locating money\.ts/g) || []).length, 1, "said once, not twice");
  });
});

await test("a status is shown only when it is not running", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const out = await runTaskRows({
      now: NOW,
      input: JSON.stringify({
        cwd: "/repos/here",
        columns: 200,
        tasks: [
          { id: "a", name: "same", description: "ordinary", status: "running", cwd: "/repos/here", startTime: NOW - 60_000 },
          { id: "b", name: "other", description: "elsewhere", status: "queued", cwd: "/repos/a-worktree", startTime: NOW - 60_000 },
        ],
      }),
    });
    const rows = out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));
    assert.doesNotMatch(rows[0], /running/, "running is what every row already looks like");
    assert.match(rows[1], /queued/);
  });
});

// A row that overflows is cut by Claude Code, not here, so the choice of what
// is lost has to be made before it goes out — the same reasoning the bar's
// priority table carries.
await test("a row sheds its least useful column rather than being cut", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const tasks = [
      { id: "a", name: "local_agent", description: "Fechar os nove achados do PR 67", label: "Staging all fixer changes for commit", model: "claude-sonnet-5", effort: "high", startTime: NOW - 3_840_000, tokenCount: 271_273, contextWindowSize: 1_000_000, tokenSamples: [271_273, 271_273] },
      { id: "b", name: "local_agent", description: "Resolver o conflito do PR 68", label: "Restoring review-debt.sh", model: "claude-sonnet-5", effort: "high", startTime: NOW - 2_820_000, tokenCount: 181_390, contextWindowSize: 1_000_000, tokenSamples: [169_000, 181_390] },
    ];
    const at = async (columns) => {
      const out = await runTaskRows({ now: NOW, input: JSON.stringify({ columns, tasks }) });
      return out.split("\n").filter(Boolean).map((l) => stripAnsi(JSON.parse(l).content));
    };

    const wide = await at(200);
    assert.match(wide[0], /271k/, "with room, the token count is there");
    assert.match(wide[0], /1h04m/, "and so is the age");

    const narrow = await at(110);
    for (const row of narrow) {
      assert.ok(displayWidth(row) <= 110, `a row was ${displayWidth(row)} columns: ${row}`);
    }
    assert.doesNotMatch(narrow[0], /271k/, "the token count goes first — the gauge already says the proportion");
    assert.match(narrow[0], /27%/, "the gauge outlives the count it duplicates");
    assert.match(narrow[0], /Staging all fixer changes/, "what it is doing survives");
    assert.match(narrow[0], /sonnet·high/, "and what it costs");

    const tight = await at(80);
    for (const row of tight) {
      assert.ok(displayWidth(row) <= 80, `a row was ${displayWidth(row)} columns: ${row}`);
    }
    assert.doesNotMatch(tight[0], /Staging all fixer changes/, "the step goes before the brief does");
    assert.match(tight[0], /Fechar os nove achados/, "who it is never goes");
  });
});

// Column widths are the widest cell across one tick's rows, which makes them
// a function of the moment rather than of the session. The three sparse
// columns spend most of a session empty and dropped; the tick one of them
// first fills, every column to its right moves — nine columns, measured, on
// rows whose own content had not changed. bazel's own progress bar carries the
// rule in a comment: "To keep the UI appearance more stable, always show the
// elapsed time if we also show a strategy (otherwise the strategy will jump)."
await test("a sparse column keeps its room once the session has shown it", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const task = (id, status) => ({
      id,
      name: "local_agent",
      description: `Brief for ${id}`,
      label: `Step for ${id}`,
      model: "claude-sonnet-5",
      effort: "high",
      status,
      startTime: NOW - 600_000,
      tokenCount: 100_000,
      contextWindowSize: 1_000_000,
    });
    const at = async (status) => {
      const out = await runTaskRows({
        now: NOW,
        input: JSON.stringify({ session_id: "held", columns: 200, tasks: [task("a", "running"), task("b", status)] }),
      });
      const row = stripAnsi(JSON.parse(out.split("\n")[0]).content);
      return row.indexOf("Brief for a");
    };

    const quiet = await at("running");
    const showing = await at("queued");
    assert.ok(showing > quiet, "the column has to appear at all the first time it is filled");

    // The point of the memory: it does not snap back, and it does not move again.
    assert.equal(await at("running"), showing, "an emptied column keeps the room it took");
    assert.equal(await at("running"), showing, "and keeps it on every later tick");
    assert.equal(await at("queued"), showing, "and refilling it moves nothing");
  });
});

// Reserving room is not an argument for keeping a column the terminal has no
// space for. Shedding is decided after the reservation is folded in.
await test("a remembered width still loses to a terminal that cannot fit it", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const tasks = [
      { id: "a", name: "pr-shepherd", description: "Review the contract gate", label: "Reading the file", model: "claude-opus-5", effort: "xhigh", status: "queued", startTime: NOW - 600_000, tokenCount: 100_000, contextWindowSize: 1_000_000 },
    ];
    const wide = await runTaskRows({ now: NOW, input: JSON.stringify({ session_id: "shed", columns: 200, tasks }) });
    assert.match(stripAnsi(JSON.parse(wide.split("\n")[0]).content), /queued/, "with room, the status is there");

    const narrow = await runTaskRows({ now: NOW, input: JSON.stringify({ session_id: "shed", columns: 60, tasks }) });
    for (const line of narrow.split("\n").filter(Boolean)) {
      const row = stripAnsi(JSON.parse(line).content);
      assert.ok(displayWidth(row) <= 60, `a row was ${displayWidth(row)} columns: ${row}`);
    }
  });
});
