/**
 * The rows Claude Code draws for running subagents.
 *
 * A second command with its own contract: it runs on its own tick, receives
 * a `tasks` array rather than a session payload, and writes one JSON line
 * per row it wants to override. Folding it into the statusline command
 * would have meant one entry point branching on which contract called it,
 * which is how both contracts end up half-tested.
 *
 * What it renders is the statusline's own vocabulary, per item F2's chosen
 * form: the same palette and the same ramp. It is also the one place a
 * progress bar still earns its width: a task row has a whole line to itself
 * and no other number competing for it, which is not true of line 4.
 *
 * Everything here is best effort. A row it cannot render is a row it stays
 * silent about, which leaves Claude Code's own rendering in place.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PALETTES } from "./theme.js";
import { bar, rampColour } from "./ramp.js";
import { abbreviate } from "./tokens.js";

const RESET = "\x1b[0m";

function fg(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}

/** How long a task has been running, in the same units the bar uses. */
function elapsed(startTime, now) {
  const started = typeof startTime === "number" ? startTime : Date.parse(startTime ?? "");
  if (!Number.isFinite(started)) return null;
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * The tier a task is running at, from the `model` and `effort` the payload carries.
 *
 * Why a row shows this at all: with several subagents in flight, the rows are the only place a
 * person can see that the expensive one is on the expensive model. A roster on disk says what was
 * DECLARED; the row says what is RUNNING, and those are different claims — a declared tier is not
 * proof the harness honoured it, and this is the only view that shows the difference.
 *
 * The colour is the projection of the tier, not decoration: same reading at a glance whether or not
 * the text fits the width. `model` is absent until a task's model resolves (Claude Code v2.1.205),
 * and a task with no tier gets no segment rather than a guessed one.
 */
const TIERS = [
  { test: (m, e) => m === "opus" && (e === "xhigh" || e === "max"), colour: "red" },
  { test: (m, e) => m === "opus" && e === "high", colour: "peach" },
  { test: (m) => m === "opus", colour: "peach" },
  { test: (m, e) => m === "sonnet" && (e === "high" || e === "xhigh" || e === "max"), colour: "yellow" },
  { test: (m) => m === "sonnet", colour: "green" },
  { test: (m) => m === "haiku", colour: "teal" },
];

/** `model` may arrive as an id, a display name or an object; all three carry the family in text. */
function modelFamily(model) {
  const raw =
    typeof model === "string" ? model : model && (model.id || model.display_name || model.name);
  if (typeof raw !== "string") return null;
  const text = raw.toLowerCase();
  for (const family of ["opus", "sonnet", "haiku", "fable"]) {
    if (text.includes(family)) return family;
  }
  return null;
}

function effortLevel(effort) {
  const raw = typeof effort === "string" ? effort : effort && (effort.level || effort.name);
  return typeof raw === "string" ? raw.toLowerCase() : null;
}

export function taskTier(task) {
  const model = modelFamily(task?.model);
  if (!model) return null;
  const effort = effortLevel(task?.effort);
  const match = TIERS.find((t) => t.test(model, effort));
  return { model, effort, colour: match ? match.colour : "surface2" };
}

/**
 * One row's body: what the task is, how long it has been at it, and how
 * much of its own context window it has used.
 *
 * The context bar needs both `tokenCount` and `contextWindowSize`, which
 * require Claude Code v2.1.205 and are absent while a task's model is still
 * resolving. A row missing either renders without the bar rather than with
 * an empty one.
 */
export function renderTaskRow(task, { columns = 80, palette = PALETTES.mocha, now = Date.now() } = {}) {
  if (!task?.id) return null;

  const name = task.name || task.type || "task";
  const tier = taskTier(task);
  // The name carries the tier colour, so the roster reads at a glance even when the row is trimmed
  // to `columns` and the spelled-out segment is the first thing to go.
  const nameColour = tier ? palette[tier.colour] ?? palette.lavender : palette.lavender;
  const parts = [`${fg(nameColour)}${name}${RESET}`];

  if (task.description || task.label) {
    parts.push(`${fg(palette.text)}${task.description || task.label}${RESET}`);
  }

  if (tier) {
    const label = tier.effort ? `${tier.model}·${tier.effort}` : tier.model;
    parts.push(`${fg(palette[tier.colour] ?? palette.surface2)}${label}${RESET}`);
  }

  const pct =
    typeof task.tokenCount === "number" && typeof task.contextWindowSize === "number" && task.contextWindowSize > 0
      ? (task.tokenCount / task.contextWindowSize) * 100
      : null;

  if (pct !== null) {
    const colour = palette[rampColour(pct, "green")] ?? palette.green;
    parts.push(`${fg(colour)}${bar(pct, columns)} ${Math.round(pct)}%${RESET}`);
    parts.push(`${fg(palette.surface2)}${abbreviate(task.tokenCount)}${RESET}`);
  }

  const age = elapsed(task.startTime, now);
  if (age) parts.push(`${fg(palette.surface2)}${age}${RESET}`);

  const body = parts.join(`${fg(palette.surface1)} · ${RESET}`);
  return { id: task.id, content: body };
}

/**
 * The one piece of text that identifies a task well enough to name it on
 * the skills line (specs/011-multiagent-skills-line, FR-005). `name` is
 * the same value `renderTaskRow` leads with and colours by tier, so this
 * is the same identity, not a second guess at one. A task with neither
 * `name` nor `type` returns `null`: no fabricated placeholder (FR-006).
 */
function taskLabel(task) {
  return task?.name || task?.type || null;
}

function snapshotPath() {
  return path.join(os.homedir(), ".claude", "statusline", "tasks", "latest.json");
}

/**
 * Best-effort persistence of the current tick's tasks, so the separate
 * `render`/statusLine command (a different process, per its own tick) can
 * fold running subagent activity into the skills line. `task-rows` and
 * `render` share no other state (specs/011-multiagent-skills-line,
 * research.md): the tick payload carries no session id or cwd to key a
 * per-session file by, so this is a single global snapshot, overwritten on
 * every tick, read with a short freshness window rather than trusted
 * indefinitely. A write failure never affects this command's own output.
 *
 * Known limitation, documented rather than worked around (same posture as
 * `behind` in the git segment): two concurrent Claude Code sessions on the
 * same machine, each running their own subagents, will each see the
 * other's subagent activity folded into their own skills line, since there
 * is currently no correlation key in the tick payload to tell them apart.
 * Fixing this would require Claude Code to send one, which is outside this
 * project's control.
 */
function writeTaskSnapshot(tasks, now) {
  try {
    const labeled = tasks.map((t) => ({ id: t?.id, label: taskLabel(t) })).filter((t) => t.id && t.label);
    mkdirSync(path.dirname(snapshotPath()), { recursive: true });
    writeFileSync(snapshotPath(), JSON.stringify({ writtenAt: now, tasks: labeled }));
  } catch {
    // Best effort: losing a snapshot costs one redraw's subagent visibility,
    // never this command's own tick output.
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

/**
 * The `task-rows` subcommand. Reads the tick's JSON, writes one line per row
 * it overrides, and says nothing about the rest.
 */
export async function runTaskRows({ now = Date.now(), input } = {}) {
  const raw = input ?? (await readStdin());
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return "";
  }

  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  writeTaskSnapshot(tasks, now);
  if (!tasks.length) return "";

  const flavor = process.env.CLAUDE_STATUSLINE_FLAVOR || "mocha";
  const palette = PALETTES[flavor] || PALETTES.mocha;
  const columns = typeof payload.columns === "number" ? payload.columns : 80;

  return tasks
    .map((task) => {
      try {
        return renderTaskRow(task, { columns, palette, now });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((row) => JSON.stringify(row))
    .join("\n");
}
