/**
 * `doctor`: what the statusline just read, where each value came from, how
 * old it is, and what it cost.
 *
 * Two rules shape this. It gathers through the same path the renderer
 * uses, so it cannot describe behaviour the renderer does not have. And
 * where a segment reads from cache, it reports both: the cached reading
 * the redraw would use, and a live probe run for the diagnostic's own
 * benefit. One column would have to pretend the two are the same thing,
 * and the whole point of the command is to show where they differ.
 */

import { gather, renderReadings } from "./render.js";
import { SEGMENTS as REGISTRY } from "./segments.js";
import {
  getDirLabel,
  getDirUrl,
  getGitInfo,
  getPrInfo,
  getRemoteUrl,
  getCiStatus,
  probeGitInfo,
  probePrInfo,
  normalizePr,
} from "./git.js";
import { getActiveSkills, getSessionActivity } from "./skills.js";
import { getRtkSavings, probeRtkSavings } from "./rtk.js";
import { formatResetCountdown } from "./tokens.js";
import { getOpenTabUrl } from "./openTerminalTab.js";
import { isRenderable, ageMs, MAX_AGE_MS, SOURCE_BUDGET_MS, REFRESH_BUDGET_MS } from "./freshness.js";
import { displayWidth } from "./theme.js";
import { terminalWidth, terminalHeight } from "./layout.js";
import { resolveLayout } from "./config.js";
import { resolveArrangement } from "./arrangement.js";

/**
 * How to describe each segment's value, and which reading feeds it.
 *
 * The row set itself comes from the registry, so a segment added there
 * shows up here without being listed twice. What lives in this table is
 * only the part the registry does not know: how to put a value into words.
 */
const DESCRIBE = {
  branch: ["git", (v) => (v?.detached ? `${v.branch} (detached)` : v?.branch)],
  worktreeState: ["git", (v) => (v ? `${v.changed} changed, ${v.untracked} untracked` : null)],
  conflicts: ["git", (v) => (v?.conflicts ? `${v.conflicts} unmerged` : null)],
  pr: ["pr", (v) => (v ? `#${v.number} ${v.review ?? "open"}${v.source ? ` (${v.source})` : ""}` : null)],
  repo: ["repo", (v) => (v?.owner ? `${v.owner}/${v.name}` : null)],
  ci: ["ci", (v) => (v ? `${v.conclusion ?? v.status} ${v.workflow ?? ""}`.trim() : null)],
  worktree: ["worktree", (v) => (v?.name ? `${v.name}${v.from ? ` from ${v.from}` : ""}` : null)],
  projectDir: ["projectDir", (v) => v ?? null],
  skills: ["skills", (v) => (v?.length ? v.join(", ") : null)],
  todo: ["activity", (v) => (v?.todos ? `${v.todos.done}/${v.todos.total}` : null)],
  activity: ["activity", (v) => (v ? (v.working ? "working" : "idle") : null)],
  model: ["model", (v) => v ?? null],
  effort: ["effort", (v) => v ?? null],
  context: ["context", (v) => (v === null ? "?%" : `${v}%`)],
  fiveHour: ["fiveHour", (v) => (v === null ? "?%" : `${v}%`)],
  burnRate: ["samples", (v) => (v?.length ? `${v.length} samples` : null)],
  projection: ["samples", (v) => (v?.length ? `${v.length} samples` : null)],
  sevenDay: ["sevenDay", (v) => (v === null ? "?%" : `${v}%`)],
  // One segment carrying both countdowns, so the diagnostic reports both. A
  // row that described only the 5-hour one named half of what is on the line.
  resetMerged: ["resetMerged", (v, now) => describeResets(v, now)],
  duration: ["sessionCost", (v) => (v?.durationMs ? `${Math.round(v.durationMs / 60000)}m` : null)],
  linesChanged: ["sessionCost", (v) => (v?.linesAdded === null ? null : `+${v?.linesAdded} -${v?.linesRemoved}`)],
  rtk: ["rtk", (v) => (v === null ? null : `${v}% saved`)],
  dir: ["dir", (v) => v ?? null],
};

/** Both countdowns, in the order the segment draws them. */
function describeResets(value, now) {
  const both = [
    formatResetCountdown(value?.fiveHour, now),
    formatResetCountdown(value?.sevenDay, now),
  ].filter(Boolean);
  return both.length ? both.join(" / ") : "reset time unknown";
}

const SEGMENTS = REGISTRY.map((row) => {
  const [reading, describe] = DESCRIBE[row.key] ?? [row.key, (v) => (v == null ? null : String(v))];
  return { ...row, reading, describe };
});

/** Segments whose value comes from cache, and the live probe for each. */
const LIVE_PROBES = {
  branch: (cwd) => probeGitInfo(cwd, REFRESH_BUDGET_MS.git),
  // The worktree segment reads the payload, not git, so there is no live
  // probe for it: running one compared a worktree name against a git
  // snapshot and printed whichever field happened to line up.
  worktreeState: (cwd) => probeGitInfo(cwd, REFRESH_BUDGET_MS.git),
  pr: (cwd) => normalizePr(probePrInfo(cwd, REFRESH_BUDGET_MS.gh), "gh"),
  rtk: (cwd) => probeRtkSavings(cwd, REFRESH_BUDGET_MS.rtk),
};

/**
 * Why a segment is not on the line. The distinction that matters is
 * between "there is nothing to show here" and "the source failed", which
 * a blank line cannot express (FR-017).
 */
function absenceReason(segment, reading, readings, now) {
  if (!reading) return "no reading";
  if (reading.error) return `source failed: ${reading.error}`;

  const inRepo = readings?.git?.value != null;
  if (Array.isArray(reading.value) && reading.value.length === 0) {
    return segment.key === "skills" ? "no skill used inside the activity window" : "nothing to show";
  }
  if (reading.value === null || reading.value === undefined) {
    if (["branch", "worktree", "remote"].includes(segment.key) && !inRepo) {
      return "not a git repository";
    }
    if (segment.key === "pr") {
      return inRepo
        ? "no open pull request for this branch, or nothing cached yet"
        : "not a git repository";
    }
    if (segment.key === "rtk") return "rtk not installed, or nothing cached yet";
    if (segment.key === "effort") return "the payload carries no effort level";
    if (segment.key === "outputStyle") return "no output style set";
    return "nothing to show";
  }
  const age = ageMs(reading, now);
  if (age > MAX_AGE_MS[segment.key]) {
    return `value is ${Math.round(age / 1000)}s old, past its ${Math.round(MAX_AGE_MS[segment.key] / 1000)}s limit`;
  }
  if (segment.key === "outputStyle" && reading.value === "default") return "the default style is not worth a segment";
  if (segment.key === "worktreeState" && reading.value.changed === 0 && reading.value.untracked === 0) {
    return "a clean tree adds no counters";
  }
  return "not rendered";
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

export function buildReport(payload, { now = Date.now(), live = true, probe } = {}) {
  // The same probe set the renderer builds. Missing one here made the
  // diagnostic report a source failure for a segment that renders fine,
  // which is the diagnostic lying about the thing it exists to explain.
  const probes = probe || {
    getGitInfo,
    getPrInfo,
    getRemoteUrl,
    getCiStatus,
    getActiveSkills,
    getSessionActivity,
    getRtkSavings,
    getDirUrl: (cwd) => getOpenTabUrl(cwd) || getDirUrl(cwd),
  };

  const started = Date.now();
  const readings = gather(payload, probes, { now });
  // The arrangement in force, so every line and order below describes the
  // bar this machine draws rather than the one the registry would draw.
  const layout = resolveLayout(readings.cwd);
  const resolved = resolveArrangement(REGISTRY, layout.arrangement, layout.origin);
  const placements = new Map(resolved.placements.map((p) => [p.key, p]));
  const rendered = renderReadings(readings, payload, {
    tracking: false,
    now,
    asRows: true,
    arrangement: layout.arrangement,
    arrangementOrigin: layout.origin,
  });
  const elapsedMs = Date.now() - started;

  const rows = SEGMENTS.map((segment) => {
    const reading = readings[segment.reading];
    const shown = isRenderable(segment.key, reading, now);
    const describe = segment.describe || ((v) => (v === null || v === undefined ? null : String(v)));
    const value = shown ? describe(reading.value, now) : null;

    const placed = placements.get(segment.key) ?? segment;
    const row = {
      key: segment.key,
      line: placed.line,
      order: placed.order,
      priority: segment.priority,
      colour: segment.colour,
      arranged: placed.line !== segment.line || placed.order !== segment.order,
      on: placed.on !== false,
      rendered: Boolean(shown && value !== null && placed.on !== false),
      value: value ?? "—",
      source: reading?.source ?? "none",
      ageMs: Math.max(0, Math.round(ageMs(reading, now))),
      fresh: reading?.fresh ?? false,
      tookMs: reading?.tookMs ?? 0,
    };
    if (!row.rendered) {
      row.reason = row.on ? absenceReason(segment, reading, readings, now) : "switched off by the arrangement";
    }

    if (live && LIVE_PROBES[segment.key]) {
      const at = Date.now();
      let probed = null;
      try {
        probed = LIVE_PROBES[segment.key](readings.cwd);
      } catch (err) {
        probed = null;
        row.liveError = err?.message || String(err);
      }
      row.live = probed === null ? "—" : describe(probed, now) ?? "—";
      row.liveTookMs = Date.now() - at;
    }
    return row;
  });

  return {
    cwd: readings.cwd,
    elapsedMs,
    terminal: { columns: terminalWidth(), rows: terminalHeight() },
    // Which arrangement is in force, where it came from, and every part of
    // it that was refused. A segment missing because somebody switched it
    // off is a different answer from one missing because its source failed,
    // and the diagnostic exists to tell those two apart.
    arrangement: {
      origin: resolved.origin,
      path: layout.path,
      name: resolved.name,
      error: layout.error ?? null,
      ignored: resolved.ignored,
    },
    // Why "no burn rate yet" is the answer during the first minute of a
    // session, without having to guess at it.
    samples: (readings.samples?.value ?? []).length,
    budgets: { redrawMs: 300, sources: SOURCE_BUDGET_MS, refresh: REFRESH_BUDGET_MS },
    // Numbered by what was printed, not by the four-line scheme: with no
    // skills the second printed row is line 3's content, and calling it
    // "line 2" in a diagnostic would be the diagnostic lying.
    // Reported by the line each row is, not by where it landed: with no
    // skills the second printed row is line 3, and calling it row 2 leaves
    // the reader matching widths against the wrong content.
    rows: rendered.map((entry, i) => ({ row: i + 1, line: entry.line, width: displayWidth(entry.text) })),
    segments: rows,
  };
}

function pad(text, width) {
  const value = String(text);
  if (value.length > width - 1) return value.slice(0, width - 2) + "… ";
  return value + " ".repeat(width - value.length);
}

export function formatReport(report) {
  const header = [
    pad("segment", 14),
    pad("line", 6),
    pad("pri", 5),
    pad("shown", 6),
    pad("value", 36),
    pad("source", 11),
    pad("age", 8),
    pad("cost", 8),
    pad("live", 28),
  ].join("");

  const rows = report.segments.map((row) => {
    const live = row.live === undefined ? "" : `${row.live} (${row.liveTookMs} ms)`;
    return [
      pad(row.key, 14),
      pad(`${row.line}${row.arranged ? "*" : ""}`, 6),
      pad(row.priority, 5),
      pad(row.rendered ? "yes" : "no", 6),
      pad(row.rendered ? row.value : row.reason, 36),
      pad(row.source, 11),
      pad(`${(row.ageMs / 1000).toFixed(1)}s`, 8),
      pad(`${row.tookMs} ms`, 8),
      pad(live, 28),
    ].join("");
  });

  const widths = report.rows.map((l) => `line ${l.line}: ${l.width} columns`).join(", ");
  const a = report.arrangement;
  const arrangementLine =
    a.origin === "default"
      ? `arrangement: default${a.path ? ` (nothing usable at ${a.path})` : ""}${a.error ? `: ${a.error}` : ""}`
      : `arrangement: ${a.name ? `"${a.name}" ` : ""}from ${a.origin}${a.path ? ` (${a.path})` : ""}`;
  const ignoredLines = a.ignored.map(
    (entry) => `  ignored ${entry.what}${entry.key ? ` on ${entry.key}` : ""}: ${entry.reason}`
  );
  return [
    `working directory: ${report.cwd}`,
    arrangementLine,
    ...ignoredLines,
    `redraw: ${report.elapsedMs} ms of a ${report.budgets.redrawMs} ms budget`,
    `terminal: ${report.terminal.columns} columns, ${report.terminal.rows} rows`,
    `history: ${report.samples} samples (a rate needs 5 spanning a minute)`,
    `rendered ${widths}`,
    "",
    header,
    "-".repeat(header.length),
    ...rows,
  ].join("\n");
}

export async function runDoctor({ json = false, now = Date.now() } = {}) {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const report = buildReport(payload, { now });
  return json ? JSON.stringify(report, null, 2) : formatReport(report);
}
