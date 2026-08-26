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
 * form: the same palette, the same bar, the same ramp. A task's context bar
 * reads exactly like the session's.
 *
 * Everything here is best effort. A row it cannot render is a row it stays
 * silent about, which leaves Claude Code's own rendering in place.
 */

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
  const parts = [`${fg(palette.lavender)}${name}${RESET}`];

  if (task.description || task.label) {
    parts.push(`${fg(palette.text)}${task.description || task.label}${RESET}`);
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
