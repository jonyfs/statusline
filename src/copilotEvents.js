/**
 * Skills and working state from a Copilot CLI session (specs/029-multi-harness).
 *
 * Copilot's payload names a session directory as `transcript_path`, and the
 * session writes `events.jsonl` there: one `{type, data, timestamp}` per line.
 * A real session on 2026-10-01 wrote `assistant.turn_start` and
 * `assistant.turn_end` around each answer; Copilot emits `skill.invoked` with
 * the skill's `name` in `data`. This returns the same shape the Claude
 * transcript reader does, so the rest of the bar does not know the difference,
 * plus the running subagents, which Claude Code draws itself and Copilot does
 * not (specs/030-copilot-agent-rows).
 */

import { openSync, readSync, fstatSync, closeSync } from "node:fs";
import path from "node:path";
import { windowMs } from "./skills.js";
import { plainText } from "./text.js";

/** As much of the log as a redraw reads, from the end. */
const TAIL_BYTES = 2 * 1024 * 1024;

/** The Claude reader's window for "something happened just now". */
const ACTIVE_WITHIN_MS = 10_000;

function readTail(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString("utf8");
    // A read that starts mid-file starts mid-line; that first piece is not an event.
    return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * How many subagent rows the bar prints under Copilot before it says "+N more"
 * (specs/030-copilot-agent-rows). Copilot's footer sits under its input box,
 * and more rows than this push the conversation off a laptop screen.
 */
export const AGENT_ROW_CAP = 6;

/**
 * An event from a subagent carries the subagent's instance id at the top
 * level; the root session's events carry none (a real Copilot CLI 1.0.91
 * session, 2026-10-05). Turn state and line 2's skills read root events only:
 * a subagent finishing its own turn is not the session finishing its turn,
 * and its skills belong to its row (Principle II).
 */
function agentOf(event) {
  return plainText(event?.agentId);
}

export function copilotSessionActivity(sessionDir, { now = Date.now(), limit = 3 } = {}) {
  if (typeof sessionDir !== "string" || !sessionDir) return null;
  const text = readTail(path.join(sessionDir, "events.jsonl"));
  if (text === null) return null;

  const window = windowMs();
  const skills = [];
  let lastAt = null;
  let turnOpen = false;
  // Subagents by the tool call that started them, which is the id their
  // completion repeats. Insertion order is start order.
  const subagents = new Map();
  // What each subagent instance has been doing, by its agentId.
  const byAgent = new Map();
  const agentState = (id) => {
    if (!byAgent.has(id)) byAgent.set(id, { step: null, model: null, effort: null, dispatched: null, skills: [] });
    return byAgent.get(id);
  };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const t = Date.parse(event?.timestamp);
    if (Number.isFinite(t)) lastAt = Math.max(lastAt ?? t, t);
    const agent = agentOf(event);
    const data = event?.data && typeof event.data === "object" ? event.data : {};
    // The model a subagent's own messages and tool calls name is the one it
    // runs on. Real Copilot CLI 1.0.91 logs configured every subagent as
    // gpt-5.6-luna and dispatched all of them to mai-code-1.1-flash, and
    // Copilot itself resolves an agent's model from the dispatch first. The
    // subagent.* events repeat the configured model, so they do not count.
    if (agent && !String(event?.type).startsWith("subagent.")) {
      const dispatched = plainText(data.model);
      if (dispatched) agentState(agent).dispatched = dispatched;
    }
    switch (event?.type) {
      case "assistant.turn_start":
        if (!agent) turnOpen = true;
        break;
      case "assistant.turn_end":
        if (!agent) turnOpen = false;
        break;
      case "skill.invoked": {
        if (!Number.isFinite(t) || now - t > window) break;
        const name = plainText(data.name);
        if (!name) break;
        if (agent) agentState(agent).skills.push(name);
        else skills.push(name);
        break;
      }
      case "subagent.started": {
        const call = plainText(data.toolCallId);
        if (!call) break;
        subagents.set(call, { call, agent, data, startTime: Number.isFinite(t) ? t : null });
        break;
      }
      case "subagent.completed":
      case "subagent.failed": {
        const call = plainText(data.toolCallId);
        if (call) subagents.delete(call);
        break;
      }
      case "session.shutdown":
      case "session.start":
      case "session.resume":
        // The process that ran them is gone; nothing it started is running.
        // A crash or a closed terminal writes no shutdown, so a start or a
        // resume, which begins a new process, also ends the old one's work.
        subagents.clear();
        turnOpen = false;
        break;
      case "subagent.configured":
        if (agent) {
          const state = agentState(agent);
          state.model = plainText(data.model) ?? state.model;
          state.effort = plainText(data.reasoningEffort) ?? state.effort;
        }
        break;
      case "tool.execution_start":
        if (agent) agentState(agent).step = plainText(data.toolTitle) ?? plainText(data.toolName) ?? agentState(agent).step;
        break;
    }
  }

  const agents = [...subagents.values()].map(({ call, agent, data, startTime }) => {
    const state = (agent && byAgent.get(agent)) || { step: null, model: null, effort: null, dispatched: null, skills: [] };
    const configured = state.model ?? plainText(data.model);
    const model = state.dispatched ?? configured;
    return {
      id: agent ?? call,
      name: plainText(data.agentName) ?? plainText(data.agentType),
      description: plainText(data.agentDescription) ?? plainText(data.agentDisplayName),
      label: state.step,
      model,
      // The effort was chosen for the configured model; the log does not say
      // whether a different dispatched model runs at it.
      effort: model === configured ? state.effort : null,
      startTime,
      skills: [...new Set(state.skills.slice().reverse())],
    };
  });

  // Newest first, each skill once.
  const unique = [...new Set(skills.reverse())];
  return {
    skills: unique.slice(0, limit),
    skillsTrueCount: unique.length,
    todos: null,
    // A running subagent is work in progress even when the root has gone
    // quiet, the rule Claude Code's reader follows (specs/012).
    working: turnOpen || agents.length > 0 || (lastAt !== null && now - lastAt <= ACTIVE_WITHIN_MS),
    agents,
  };
}
