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
import { PALETTES, displayWidth } from "./theme.js";
import { bar, rampColour } from "./ramp.js";
import { abbreviate } from "./tokens.js";
import { readSkillsByAgent } from "./skillEvents.js";

const RESET = "\x1b[0m";

function fg(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}

/** How long a task has been running, in the same units the bar uses. */
export function elapsed(startTime, now) {
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
const SEP = " \u00b7 ";

/**
 * Names Claude Code uses when the caller did not choose one.
 *
 * `local_agent` is what an ad-hoc Task arrives as, and it is the same word
 * for every such task, so it distinguishes nothing. A named agent type
 * (`pr-shepherd`, `code-review`) says something the description does not and
 * keeps its place on the row.
 */
const GENERIC_TASK_NAMES = new Set(["local_agent", "task", "agent"]);

/**
 * How wide one column may be padded to.
 *
 * A single very long description would otherwise push every column after it
 * across the terminal. Past the cap that row simply overflows its own column
 * and loses alignment, which costs one row rather than all of them.
 */
const MAX_COLUMN = 48;

/**
 * One task as fixed positions, so two rows can be lined up against each other.
 *
 * Positional and always the same length: a task with no gauge still occupies
 * the gauge column, as blank. Without that, column three means the tier on one
 * row and the token count on the next, and padding them to a common width
 * lines up things that are not the same thing.
 */
function taskCells(task, { columns = 80, palette = PALETTES.mocha, now = Date.now(), nameIsShared = false, skills = [] } = {}) {
  const name = task.name || task.type || "task";
  const what = taskDescription(task);
  const tier = taskTier(task);
  const step = taskStep(task);
  // Whatever leads carries the tier colour, so the roster reads at a glance even when the row is
  // trimmed to `columns` and the spelled-out segment is the first thing to go.
  const leadColour = tier ? palette[tier.colour] ?? palette.lavender : palette.lavender;

  // The agent type is worth a column only when it identifies this task. Two
  // cases where it does not: it is the placeholder Claude Code sends for a
  // Task dispatched without a named agent type, which says only that the
  // caller did not name one; or two running tasks share it, which says only
  // that both were dispatched the same way.
  const typeIdentifies = !nameIsShared && !GENERIC_TASK_NAMES.has(name);

  const cell = (plain, colour) => (plain ? { plain, text: `${fg(colour)}${plain}${RESET}` } : { plain: "", text: "" });

  const pct =
    typeof task.tokenCount === "number" && typeof task.contextWindowSize === "number" && task.contextWindowSize > 0
      ? (task.tokenCount / task.contextWindowSize) * 100
      : null;

  const tierLabel = tier ? (tier.effort ? `${tier.model}\u00b7${tier.effort}` : tier.model) : null;
  // The bar keeps its number. Nine cells put 5% and 0% in the same picture,
  // and the figure is what separates them.
  const gauge = pct === null ? null : `${bar(pct, columns)} ${Math.round(pct)}%`;

  // The order is the owner's, chosen on 2026-09-08 from rendered examples:
  // what it costs, then what is unusual about it, then who it is and what it
  // is doing. The three sparse columns lead, which means most rows open with
  // the width they reserve — the trade was made with that in view.
  return [
    cell(tierLabel, tier ? palette[tier.colour] ?? palette.surface2 : palette.surface2),
    cell(taskStatus(task), palette.peach),
    cell(typeIdentifies ? name : null, palette.lavender),
    cell(skills.length ? skills.join(", ") : null, palette.green),
    cell(what ?? (typeIdentifies ? null : name), leadColour),
    cell(step, palette.sapphire),
    cell(gauge, pct === null ? palette.green : palette[rampColour(pct, "green")] ?? palette.green),
    cell(pct === null ? null : abbreviate(task.tokenCount), palette.surface2),
    cell(elapsed(task.startTime, now), palette.surface2),
  ];
}

/**
 * The cells joined, each padded to its column's width across the whole tick.
 *
 * A blank cell keeps its column's room and gets spaces where a separator
 * would be, so nothing after it slides left and no stray dot appears for a
 * value that is not there.
 */
function joinCells(cells, widths, palette) {
  // A column no row in the tick filled is dropped rather than padded to
  // nothing: it would still cost its separator's width, and a gap that wide
  // reads as a missing value rather than as an absent column.
  //
  // With no widths there is no tick to align to — a lone row, as the
  // diagnostic and the cases render one — so an empty cell simply vanishes
  // instead of spending three columns on a separator for nothing.
  const used = (i) => (widths ? widths[i] > 0 : Boolean(cells[i].plain));
  const lastFilled = cells.reduce((last, c, i) => (c.plain && used(i) ? i : last), -1);
  let out = "";
  for (let i = 0; i <= lastFilled; i++) {
    if (!used(i)) continue;
    out += cells[i].text;
    if (i === lastFilled) break;
    const target = Math.min(widths?.[i] ?? displayWidth(cells[i].plain), MAX_COLUMN);
    out += " ".repeat(Math.max(0, target - displayWidth(cells[i].plain)));
    out += cells[i].plain ? `${fg(palette.surface1)}${SEP}${RESET}` : " ".repeat(SEP.length);
  }
  return out;
}

/**
 * Which column a row gives up first when it will not fit.
 *
 * By index into `taskCells`, least useful first. The same reasoning the bar's
 * priority table carries: with more content than columns something is always
 * being dropped, and the only question is whether the choice was made on
 * purpose.
 *
 * The token count goes first because the gauge beside it already says the
 * proportion; the age next, as the least actionable thing on the row; then the
 * gauge itself, since the percentage it draws is the last thing it gives up.
 * What survives to the end is who the agent is, what it was asked to do, what
 * it is doing now, and what it costs.
 */
const SHED_ORDER = [
  7, // the token count: the gauge beside it already says the proportion
  8, // the age: the least actionable thing on the row
  6, // the gauge: its percentage is the last of it to go
  2, // the agent type, which is only there when it identifies something
  1, // the status, which is only there when it is not `running`
  3, // the skills it is running
  5, // the step it is on
];

/** The widths each column must reach for a tick's rows to line up. */
function columnWidths(rows, dropped = new Set()) {
  const widths = [];
  for (const cells of rows) {
    cells.forEach((c, i) => {
      widths[i] = dropped.has(i) ? 0 : Math.max(widths[i] ?? 0, displayWidth(c.plain));
    });
  }
  return widths;
}

export function renderTaskRow(task, options = {}) {
  if (!task?.id) return null;
  const palette = options.palette ?? PALETTES.mocha;
  const cells = taskCells(task, options);
  return { id: task.id, content: joinCells(cells, options.widths, palette) };
}

/**
 * The agent type, which is the value `renderTaskRow` leads with and colours
 * by tier. A task with neither `name` nor `type` returns `null`: no
 * fabricated placeholder (FR-006, specs/011-multiagent-skills-line).
 *
 * This is how the task was dispatched, not what it is doing, and the two are
 * not equally useful. A named type says something (`pr-shepherd`,
 * `code-review`); the generic one Claude Code sends for an ad-hoc Task does
 * not, and two agents dispatched the same way arrive with the same word. The
 * snapshot therefore carries the description as well, and the chip on line 2
 * prefers it.
 */
function taskLabel(task) {
  return task?.name || task?.type || null;
}

/** The standing brief: what this agent was asked to do, fixed for its life. */
function taskDescription(task) {
  const raw = task?.description ?? task?.label;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * What the agent is doing right now, which is not what it was asked to do.
 *
 * Claude Code sends both: `description` is the brief ("Fechar os nove achados
 * do PR 67") and `label` is the step ("Staging all fixer changes for commit").
 * They answer different questions and the row was showing only the first,
 * with the second used as a mere fallback for it.
 *
 * Nothing when the two are the same value, which is what happens for a task
 * that arrived with only one of them: repeating a sentence beside itself says
 * less than showing it once.
 */
function taskStep(task) {
  const raw = task?.label;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const step = raw.trim();
  return step === taskDescription(task) ? null : step;
}

/** A status worth a column: `running` is what every row already looks like. */
function taskStatus(task) {
  const raw = task?.status;
  return typeof raw === "string" && raw && raw !== "running" ? raw : null;
}

/**
 * Where a tick's roster is written.
 *
 * Keyed by the session that produced it. It was a single `latest.json` until
 * 2026-09-06, which meant two Claude Code windows open on two projects each
 * read the other's running agents onto their own line 2 — the limitation this
 * file used to document as unavoidable, on the belief that the tick carried
 * no correlation key. It carries `session_id`, the same value the statusline
 * payload carries, so the two sides can find each other without sharing a
 * file with everybody else.
 *
 * `latest.json` remains the name used when a tick arrives without a session
 * id, so a harness that does not send one behaves exactly as it did.
 */
function snapshotPath(sessionId) {
  const safe = sessionId ? String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_") : "latest";
  return path.join(os.homedir(), ".claude", "statusline", "tasks", `${safe}.json`);
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
 */
function writeTaskSnapshot(tasks, now, sessionId) {
  try {
    const labeled = tasks
      .map((t) => {
        const label = taskLabel(t);
        if (!t?.id || !label) return null;
        // Only what the reader needs. The tier, the age and the context figure
        // were recorded here while line 2 described each agent; line 2 says
        // nothing about agents now, and the rows read the live tick rather
        // than this file, so writing them would be writing what nobody reads.
        return { id: t.id, label };
      })
      .filter(Boolean);
    mkdirSync(path.dirname(snapshotPath(sessionId)), { recursive: true });
    writeFileSync(snapshotPath(sessionId), JSON.stringify({ writtenAt: now, tasks: labeled }));
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
  const sessionId = payload?.session_id ?? payload?.sessionId ?? null;
  writeTaskSnapshot(tasks, now, sessionId);
  if (!tasks.length) return "";

  const flavor = process.env.CLAUDE_STATUSLINE_FLAVOR || "mocha";
  const palette = PALETTES[flavor] || PALETTES.mocha;
  const columns = typeof payload.columns === "number" ? payload.columns : 80;

  // Skills the hook attributed to a running subagent. Empty unless the hook is
  // installed and Claude Code's `agent_id` turns out to be the same value as
  // the task `id` here, which is not documented either way; an agent with
  // nothing recorded simply shows no skills.
  const skillsByAgent = readSkillsByAgent(sessionId);

  // Which names fail to tell one running task from another. Computed over the
  // whole tick, because a name can only be judged against its siblings.
  const seen = new Map();
  for (const t of tasks) {
    const n = taskLabel(t);
    if (n) seen.set(n, (seen.get(n) ?? 0) + 1);
  }

  const optionsFor = (task) => ({
    columns,
    palette,
    now,
    nameIsShared: (seen.get(taskLabel(task)) ?? 0) > 1,
    skills: skillsByAgent.get(task?.id) ?? [],
  });

  // Two passes: the columns can only be sized once every row in the tick has
  // been measured, which is the whole point of aligning them.
  const measured = tasks
    .map((task) => {
      try {
        return task?.id ? { task, cells: taskCells(task, optionsFor(task)) } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  // Shed until the widest row fits, or until only the identity is left. A row
  // that overflows is not truncated here — Claude Code cuts it — so the choice
  // of what is lost has to be made before it goes out.
  const dropped = new Set();
  let widths = columnWidths(measured.map((m) => m.cells), dropped);
  for (const column of SHED_ORDER) {
    const widest = Math.max(...measured.map((m) => displayWidth(joinCells(m.cells, widths, palette))));
    if (widest <= columns) break;
    dropped.add(column);
    widths = columnWidths(measured.map((m) => m.cells), dropped);
  }

  return measured
    .map(({ task }) => {
      try {
        return renderTaskRow(task, { ...optionsFor(task), widths });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((row) => JSON.stringify(row))
    .join("\n");
}
