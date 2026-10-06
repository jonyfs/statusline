/**
 * A session waiting on its own background work is not idle.
 *
 * A `run_in_background` Bash call (a git-hook gate, a build, an e2e run) or
 * an async Agent started by the main session writes nothing to the
 * transcript until its task-notification arrives, and Claude Code does not
 * pass shells to the subagent status line's `tasks`. So ten seconds after
 * the main session went quiet, line 2 said "idle" while the gate was still
 * running. The record shapes below are copied from a real Claude Code
 * transcript (Principle III): the start is a tool_result whose
 * `toolUseResult` carries `backgroundTaskId` or `status: "async_launched"`,
 * and the end is a `<task-notification>` with the same id and a status.
 */
import assert from "node:assert/strict";
import { writeFileSync, appendFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getSessionActivity } from "../../src/skills.js";
import { scanTail } from "../../src/transcriptTail.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";
import { G, re } from "./glyphs.js";

const NOW = Date.parse("2026-10-06T14:00:00.000Z");
const WIDE = { maxWidth: 600, maxHeight: 40 };
const iso = (at) => new Date(at).toISOString();

function transcript(entries) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "background-"));
  const file = path.join(dir, "session.jsonl");
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return file;
}

const said = (at) => ({
  type: "assistant",
  timestamp: iso(at),
  message: { role: "assistant", content: [{ type: "text", text: "waiting on the gate" }] },
});

// A Bash call with run_in_background: true, as its tool_result lands.
const shellStarted = (at, id) => ({
  type: "user",
  timestamp: iso(at),
  message: {
    role: "user",
    content: [
      {
        tool_use_id: `toolu_${id}`,
        type: "tool_result",
        content: `Command running in background with ID: ${id}. Output is being written to: /tmp/tasks/${id}.output. You will be notified when it completes.`,
        is_error: false,
      },
    ],
  },
  toolUseResult: { stdout: "", stderr: "", interrupted: false, backgroundTaskId: id },
});

// An Agent call with run_in_background: true.
const agentLaunched = (at, id) => ({
  type: "user",
  timestamp: iso(at),
  message: {
    role: "user",
    content: [{ tool_use_id: `toolu_${id}`, type: "tool_result", content: [{ type: "text", text: "Async agent launched successfully." }] }],
  },
  toolUseResult: { isAsync: true, status: "async_launched", agentId: id, description: "Background sleeper agent" },
});

const notification = (id, status) =>
  `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>toolu_${id}</tool-use-id>\n<output-file>/tmp/tasks/${id}.output</output-file>\n<status>${status}</status>\n<summary>Background command finished</summary>\n</task-notification>`;

// The three places a real transcript carries a notification.
const enqueued = (at, id, status) => ({
  type: "queue-operation",
  operation: "enqueue",
  timestamp: iso(at),
  content: notification(id, status),
});
const removed = (at, id, status) => ({
  type: "queue-operation",
  operation: "remove",
  timestamp: iso(at),
  content: notification(id, status),
});
const queued = (at, id, status) => ({
  type: "attachment",
  timestamp: iso(at),
  attachment: { type: "queued_command", prompt: notification(id, status) },
});
const delivered = (at, id, status) => ({
  type: "user",
  timestamp: iso(at),
  message: { role: "user", content: notification(id, status) },
});

await test("a background shell with no notification is still pending", () => {
  const file = transcript([
    shellStarted(NOW - 90_000, "bA"),
    shellStarted(NOW - 80_000, "bB"),
    enqueued(NOW - 70_000, "bA", "completed"),
    removed(NOW - 70_000, "bA", "completed"),
    said(NOW - 60_000),
  ]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 1, agents: 0 });
});

await test("a killed or failed shell is no longer pending", () => {
  const file = transcript([
    shellStarted(NOW - 90_000, "bA"),
    shellStarted(NOW - 80_000, "bB"),
    queued(NOW - 70_000, "bA", "completed"),
    delivered(NOW - 65_000, "bB", "killed"),
    said(NOW - 60_000),
  ]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 0, agents: 0 });

  const failed = transcript([shellStarted(NOW - 90_000, "bC"), delivered(NOW - 65_000, "bC", "failed")]);
  assert.deepEqual(scanTail(failed, { now: NOW }).background, { shells: 0, agents: 0 });
});

// TaskStop's tool_result, as Claude Code records it (seen 2026-10-06).
const stopped = (at, id) => ({
  type: "user",
  timestamp: iso(at),
  message: { role: "user", content: [{ tool_use_id: `toolu_stop_${id}`, type: "tool_result", content: `{"message":"Successfully stopped task: ${id}"}` }] },
  toolUseResult: { message: `Successfully stopped task: ${id}`, task_id: id, task_type: "local_bash", command: "sleep 600" },
});

await test("a shell stopped with TaskStop is no longer pending, though no notification came", () => {
  const file = transcript([shellStarted(NOW - 90_000, "bS"), stopped(NOW - 30_000, "bS"), said(NOW - 20_000)]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 0, agents: 0 });
});

await test("an async agent with no notification counts as an agent", () => {
  const file = transcript([agentLaunched(NOW - 90_000, "a538228b4b501c891"), said(NOW - 60_000)]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 0, agents: 1 });
});

await test("a start older than the max age does not count", () => {
  // Background shells die with the session's process, so a start this old
  // with no notification is far more likely a session that was closed and
  // resumed than a shell still running.
  const file = transcript([shellStarted(NOW - 3 * 3600_000, "bOld"), said(NOW - 60_000)]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 0, agents: 0 });
});

await test("a notification quoted by the assistant does not end the shell", () => {
  // The assistant writing about a notification (in a script, a test, a
  // reply) is not Claude Code delivering one.
  const file = transcript([
    shellStarted(NOW - 90_000, "bA"),
    {
      type: "assistant",
      timestamp: iso(NOW - 60_000),
      message: { role: "assistant", content: [{ type: "text", text: notification("bA", "completed") }] },
    },
  ]);
  assert.deepEqual(scanTail(file, { now: NOW }).background, { shells: 1, agents: 0 });
});

await test("a quiet session waiting on a background shell reads as working", () => {
  const file = transcript([shellStarted(NOW - 90_000, "bB"), said(NOW - 60_000)]);
  const activity = getSessionActivity(file, { now: NOW });
  assert.equal(activity.working, true);
  assert.deepEqual(activity.background, { shells: 1, agents: 0 });
});

await test("line 2 says working with the background count, then idle once it is notified", () => {
  const file = transcript([shellStarted(NOW - 90_000, "bB"), said(NOW - 60_000)]);
  const render = () =>
    stripAnsi(
      renderPayload(fullPayload({ transcript_path: file }), {
        sources: { ...gitSources(), subagentActivity: () => [] },
        trackChanges: false,
        now: NOW,
        ...WIDE,
      })
    );

  assert.match(render(), re`${G.working} working · 1 bg`);

  appendFileSync(file, JSON.stringify(enqueued(NOW - 25_000, "bB", "completed")) + "\n");
  const after = render();
  assert.match(after, re`${G.idle} idle`);
  assert.doesNotMatch(after, / bg /);
});

await test("a session working on its own does not add a background count", () => {
  const file = transcript([said(NOW - 1000)]);
  const out = stripAnsi(
    renderPayload(fullPayload({ transcript_path: file }), {
      sources: { ...gitSources(), subagentActivity: () => [] },
      trackChanges: false,
      now: NOW,
      ...WIDE,
    })
  );
  assert.match(out, re`${G.working} working `);
  assert.doesNotMatch(out, / bg /);
});
