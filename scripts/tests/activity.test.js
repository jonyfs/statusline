import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getSessionActivity } from "../../src/skills.js";
import { scanTail } from "../../src/transcriptTail.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 600, maxHeight: 40 };

function transcript(entries) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "activity-"));
  const file = path.join(dir, "session.jsonl");
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return file;
}

const assistant = (at, content) => ({
  type: "assistant",
  timestamp: new Date(at).toISOString(),
  message: { content },
});

const todoWrite = (at, todos) =>
  assistant(at, [{ type: "tool_use", name: "TodoWrite", input: { todos } }]);

const skillUse = (at, skill) =>
  assistant(at, [{ type: "tool_use", name: "Skill", input: { skill } }]);

await test("no transcript is not an idle session", () => {
  // Saying "idle" for a session this process cannot see would be a claim
  // about something unobserved.
  assert.equal(getSessionActivity(undefined, { now: NOW }), null);
  assert.equal(getSessionActivity("/does/not/exist.jsonl", { now: NOW })?.working, false);
});

await test("a session that just did something reads as working", () => {
  const file = transcript([assistant(NOW - 2000, [{ type: "text", text: "hi" }])]);
  assert.equal(getSessionActivity(file, { now: NOW }).working, true);
});

await test("a session quiet for a while reads as idle", () => {
  const file = transcript([assistant(NOW - 120_000, [{ type: "text", text: "hi" }])]);
  assert.equal(getSessionActivity(file, { now: NOW }).working, false);
});

await test("the todo list is reduced to done, total and what is current", () => {
  const file = transcript([
    todoWrite(NOW - 60_000, [
      { content: "Read the spec", status: "completed" },
      { content: "Write the parser", status: "in_progress" },
      { content: "Wire it up", status: "pending" },
      { content: "Document it", status: "pending" },
    ]),
  ]);
  const { todos } = getSessionActivity(file, { now: NOW });
  assert.deepEqual(todos, { done: 1, total: 4, current: "Write the parser" });
});

await test("a todo list outlives the skill window", () => {
  // A list written an hour ago is still the list. Skills expire because
  // nothing says they stopped; a todo list says its own state.
  const file = transcript([
    todoWrite(NOW - 3 * 3600_000, [{ content: "Old work", status: "in_progress" }]),
  ]);
  const activity = getSessionActivity(file, { now: NOW });
  assert.equal(activity.todos.total, 1);
  assert.deepEqual(activity.skills, [], "the skill from the same era is gone");
});

await test("a finished list still says so", () => {
  const file = transcript([
    todoWrite(NOW - 30_000, [
      { content: "A", status: "completed" },
      { content: "B", status: "completed" },
    ]),
  ]);
  const { todos } = getSessionActivity(file, { now: NOW });
  assert.deepEqual(todos, { done: 2, total: 2, current: null });
});

await test("one pass answers skills, todos and activity together", () => {
  // Reading the file three times would have tripled the only cost on the
  // redraw path that ever grew with the session.
  const file = transcript([
    skillUse(NOW - 60_000, "humanizer"),
    todoWrite(NOW - 30_000, [{ content: "Ship it", status: "in_progress" }]),
    assistant(NOW - 1000, [{ type: "text", text: "working" }]),
  ]);
  const scan = scanTail(file, { now: NOW });
  assert.deepEqual(scan.skills, ["humanizer"]);
  assert.equal(scan.todos.current, "Ship it");
  assert.ok(scan.lastAt >= NOW - 2000);
});

await test("the bar shows the todo count and the current item", () => {
  const file = transcript([
    todoWrite(NOW - 30_000, [
      { content: "Fix authentication", status: "in_progress" },
      { content: "Add tests", status: "pending" },
      { content: "Update docs", status: "completed" },
    ]),
  ]);
  const out = stripAnsi(
    renderPayload(fullPayload({ transcript_path: file }), {
      sources: gitSources(),
      trackChanges: false,
      now: NOW,
      ...WIDE,
    })
  );
  assert.match(out, /▸ Fix authentication \(1\/3\)/);
});

await test("the bar says working or idle, and neither without a transcript", () => {
  const busy = transcript([assistant(NOW - 1000, [{ type: "text", text: "x" }])]);
  const quiet = transcript([assistant(NOW - 600_000, [{ type: "text", text: "x" }])]);

  const render = (file) =>
    stripAnsi(
      renderPayload(fullPayload({ transcript_path: file }), {
        sources: gitSources(),
        trackChanges: false,
        now: NOW,
        ...WIDE,
      })
    );

  assert.match(render(busy), /● working/);
  assert.match(render(quiet), /○ idle/);

  const none = stripAnsi(
    renderPayload(fullPayload(), { sources: gitSources(), trackChanges: false, now: NOW, ...WIDE })
  );
  assert.doesNotMatch(none, /working|idle/);
});

await test("a malformed todo entry is skipped, not fatal", () => {
  const file = transcript([
    assistant(NOW - 30_000, [{ type: "tool_use", name: "TodoWrite", input: { todos: "not an array" } }]),
    assistant(NOW - 1000, [{ type: "text", text: "x" }]),
  ]);
  const activity = getSessionActivity(file, { now: NOW });
  assert.equal(activity.todos, null);
  assert.equal(activity.working, true, "the rest of the scan still worked");
});
