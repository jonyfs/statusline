import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload, gather, harnessProbes } from "../../src/render.js";
import { copilotTerminal, terminalFor, DEFAULT_WIDTH } from "../../src/layout.js";
import { getContextPercent, getContextTokens } from "../../src/tokens.js";
import { copilotSessionActivity } from "../../src/copilotEvents.js";
import { readCopilotTodos, summarizeTodoRows } from "../../src/copilotTodos.js";
import { normalizeCopilotQuota, formatQuotaDate, probeCopilotQuota, COPILOT_QUOTA_KEY } from "../../src/copilotQuota.js";
import { runRefresh } from "../../src/refresh.js";
import { readEntry } from "../../src/cache.js";
import { installHarness, uninstallHarness, harnessStatus, COPILOT_REFRESH_INTERVAL_SECONDS, QUIET_FOOTER_KEYS } from "../../src/install.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G } from "./glyphs.js";
import { buildReport, formatReport, harnessLine, terminalLine, terminalReport } from "../../src/doctor.js";

// specs/033-copilot-parity. The payload is the one Copilot CLI 1.0.91 sent to
// a capture command on 2026-10-06 (`used_percentage: null` before the first
// model call), and the events are a real 1.0.92 session from this machine
// with the message bodies taken out.

const NOW = Date.parse("2026-10-06T15:17:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };
const fixture = JSON.parse(readFileSync(new URL("./fixtures/copilot-payload-1091.json", import.meta.url), "utf8"));
const realEvents = readFileSync(new URL("./fixtures/copilot-parity-events.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

function sessionDir(events) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-parity-session-"));
  writeFileSync(path.join(dir, "events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
  return dir;
}
const at = (secondsAgo) => new Date(NOW - secondsAgo * 1000).toISOString();
const copilot = (over = {}, events = realEvents) => ({ ...fixture, transcript_path: sessionDir(events), ...over });
const render = (payload, opts = {}, sources = {}) =>
  stripAnsi(renderPayload(payload, { sources: { ...emptySources, ...sources }, trackChanges: false, now: NOW, ...WIDE, ...opts }));

/** Runs `fn` with COLUMNS and LINES unset, the way Copilot spawns the command. */
function withoutSize(fn) {
  const saved = { COLUMNS: process.env.COLUMNS, LINES: process.env.LINES };
  delete process.env.COLUMNS;
  delete process.env.LINES;
  try {
    return fn();
  } finally {
    process.env.COLUMNS = saved.COLUMNS;
    process.env.LINES = saved.LINES;
  }
}

// Item 1: the real terminal size ----------------------------------------------

await test("under Copilot with no COLUMNS the size comes from /dev/tty, less Copilot's padding", () => {
  const tty = () => ({ columns: 117, rows: 40 });
  assert.deepEqual(copilotTerminal({ env: {}, platform: "darwin", readTty: tty }), { columns: 117, rows: 40, source: "tty" });
  assert.deepEqual(copilotTerminal({ env: {}, platform: "linux", readTty: tty, settings: { statusLine: { padding: 3 } } }), {
    columns: 114,
    rows: 40,
    source: "tty",
  });
  // A padding that is not a non-negative whole number is Copilot's to reject.
  assert.equal(copilotTerminal({ env: {}, platform: "linux", readTty: tty, settings: { statusLine: { padding: "x" } } }).columns, 117);
});

await test("COLUMNS wins, and Windows or a missing terminal falls back to 120", () => {
  let opened = 0;
  const tty = () => {
    opened++;
    return { columns: 117, rows: 40 };
  };
  assert.deepEqual(terminalFor("copilot", { env: { COLUMNS: "80", LINES: "20" }, platform: "darwin", readTty: tty }), {
    columns: 80,
    rows: 20,
    source: "COLUMNS",
  });
  assert.deepEqual(terminalFor("claude", { env: {}, platform: "darwin", readTty: tty }), { columns: DEFAULT_WIDTH, rows: Infinity, source: "default" });
  assert.equal(opened, 0, "the terminal is never opened under Claude Code or with COLUMNS set");
  assert.deepEqual(terminalFor("copilot", { env: {}, platform: "win32", readTty: tty }), { columns: DEFAULT_WIDTH, rows: Infinity, source: "default" });
  assert.equal(opened, 0, "nor on Windows, which has no /dev/tty");
  const failing = () => {
    throw Object.assign(new Error("ENXIO: no such device"), { code: "ENXIO" });
  };
  assert.deepEqual(terminalFor("copilot", { env: {}, platform: "linux", readTty: failing }), { columns: DEFAULT_WIDTH, rows: Infinity, source: "default" });
  assert.deepEqual(terminalFor("copilot", { env: {}, platform: "linux", readTty: () => null }).source, "default");
});

await test("a Copilot bar is fitted to the terminal it measured, not wrapped from 120", () => {
  const payload = copilot({ cost: { ...fixture.cost, total_premium_requests: 3, total_lines_added: 1200 } });
  const draw = (readTty) =>
    withoutSize(() =>
      stripAnsi(renderPayload(payload, { sources: { ...emptySources, readTty, getRtkSavings: () => 81 }, trackChanges: false, now: NOW }))
    ).split("\n");
  const wide = draw(() => null);
  assert.ok(wide.some((l) => [...l].length > 60), "at the 120 fallback some line is wider than 60, so the case below can tell");
  const fitted = draw(() => ({ columns: 60, rows: 2 }));
  assert.ok(fitted.length <= 2, `the measured height reached the renderer: ${fitted.length} lines`);
  for (const line of fitted) assert.ok([...line].length <= 60, `${[...line].length} columns: ${line}`);
});

// Item 2: the context figure before the first model call -----------------------

await test("the context falls back to Copilot's current figure, then to tokens over the limit", () => {
  assert.equal(getContextPercent(fixture), 0, "Copilot 1.0.91 sends 0 here while used_percentage is null");
  assert.equal(getContextPercent({ context_window: { used_percentage: null, current_context_tokens: 50_000, displayed_context_limit: 200_000 } }), 25);
  assert.equal(getContextPercent({ context_window: { used_percentage: null, current_context_tokens: 5, displayed_context_limit: 0 } }), null);
  assert.equal(getContextPercent({ context_window: { used_percentage: 31, current_context_used_percentage: 12 } }), 31, "the payload's own figure wins");
  assert.equal(getContextTokens(fixture).size, 200_000, "the displayed limit stands in for a null window size");
  assert.match(render(copilot()), /Context 0%/);
  assert.match(render(fullPayload({ now: NOW })), /Context 26%/, "Claude Code is unchanged");
});

// Item 3: the effort -------------------------------------------------------------

await test("the effort comes from the root user message in Copilot's log", () => {
  const activity = copilotSessionActivity(sessionDir(realEvents), { now: NOW });
  assert.equal(activity.effort, "medium");
  assert.match(render(copilot()), new RegExp(`${G.effort} medium`, "u"));
});

await test("a later model change replaces the effort, a subagent's never does, and settings come last", () => {
  const events = [
    { type: "user.message", data: { responsesReasoning: { effort: "medium" } }, timestamp: at(60) },
    { type: "session.model_change", agentId: "a1", data: { newModel: "gpt-5.6-luna", reasoningEffort: "low" }, timestamp: at(50) },
    { type: "user.message", agentId: "a1", data: { responsesReasoning: { effort: "low" } }, timestamp: at(45) },
  ];
  assert.equal(copilotSessionActivity(sessionDir(events), { now: NOW }).effort, "medium");
  const changed = [...events, { type: "session.model_change", data: { newModel: "gpt-6-luna", reasoningEffort: "xhigh" }, timestamp: at(30) }];
  assert.equal(copilotSessionActivity(sessionDir(changed), { now: NOW }).effort, "xhigh");
  const fresh = [{ type: "session.model_change", data: { newModel: "auto", reasoningEffort: null }, timestamp: at(30) }];
  assert.equal(copilotSessionActivity(sessionDir(fresh), { now: NOW }).effort, null);
  const fromSettings = render(copilot({}, fresh), {}, { copilotSettings: () => ({ effortLevel: "high" }) });
  assert.match(fromSettings, new RegExp(`${G.effort} high`, "u"));
  assert.doesNotMatch(render(copilot({}, fresh)), new RegExp(G.effort, "u"), "nothing known, no chip");
});

// Item 4: the model behind Auto --------------------------------------------------

await test("Auto names the model the root agent answered with, never a subagent's", () => {
  const activity = copilotSessionActivity(sessionDir(realEvents), { now: NOW });
  assert.equal(activity.resolvedModel, "gpt-6-luna", "the subagents ran mai-code-1.1-flash");
  const out = render(copilot());
  assert.match(out, new RegExp(`${G.model} gpt-6-luna \\(auto\\)`, "u"));
  assert.doesNotMatch(out, /mai-code/);
});

await test("before any answer the router's choice speaks, and before that, Auto", () => {
  const routed = realEvents.slice(0, 3);
  assert.equal(copilotSessionActivity(sessionDir(routed), { now: NOW }).resolvedModel, "gpt-6-luna");
  const none = realEvents.slice(0, 2);
  assert.equal(copilotSessionActivity(sessionDir(none), { now: NOW }).resolvedModel, null);
  assert.match(render(copilot({}, none)), new RegExp(`${G.model} Auto `, "u"));
  // A model chosen by name is shown as Copilot names it.
  assert.match(render(copilot({ model: { id: "gpt-6-luna", display_name: "GPT-6 Luna" } })), /GPT-6 Luna/);
  // A model change clears what the router chose for the old one.
  const switched = [...realEvents, { type: "session.model_change", data: { newModel: "auto", reasoningEffort: null }, timestamp: at(5) }];
  assert.equal(copilotSessionActivity(sessionDir(switched), { now: NOW }).resolvedModel, null);
});

await test("the model's routed name is the first thing it gives up on a narrow line", () => {
  const out = render(copilot(), { maxWidth: 34 });
  assert.match(out, new RegExp(`${G.model} gpt-6-luna `, "u"));
});

// Item 5: todos from session.db --------------------------------------------------

const require = createRequire(import.meta.url);
function nodeSqlite() {
  try {
    return require("node:sqlite");
  } catch {
    return null;
  }
}
function hasSqliteCli() {
  if (process.platform === "win32") return false;
  try {
    execFileSync("sqlite3", ["-version"], { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
const TODO_ROWS = [
  ["write-tests", "Write the failing tests", "done"],
  ["impl-reader", "Implement the reader", "in_progress"],
  ["docs", "Update the README", "pending"],
];
/** A session.db shaped like the one Copilot's sql tool keeps, or null when nothing here can make one. */
function makeSessionDb(dir, rows = TODO_ROWS) {
  const file = path.join(dir, "session.db");
  const sql = [
    "CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'pending', created_at TEXT);",
    "CREATE TABLE todo_deps (todo_id TEXT, depends_on TEXT);",
    ...rows.map(([id, title, status]) => `INSERT INTO todos (id, title, status) VALUES ('${id}', '${title}', '${status}');`),
  ].join("\n");
  const sqlite = nodeSqlite();
  if (sqlite) {
    const db = new sqlite.DatabaseSync(file);
    db.exec("PRAGMA journal_mode=WAL;");
    db.exec(sql);
    db.close();
    return file;
  }
  if (hasSqliteCli()) {
    execFileSync("sqlite3", [file, sql]);
    return file;
  }
  return null;
}

await test("todos are counted the way line 2 counts Claude Code's", () => {
  assert.deepEqual(summarizeTodoRows(TODO_ROWS.map(([, title, status]) => ({ title, status }))), {
    done: 1,
    total: 3,
    current: "Implement the reader",
  });
  assert.equal(summarizeTodoRows([]), null, "an empty list is no chip");
  assert.deepEqual(summarizeTodoRows([{ title: "a", status: "blocked" }]), { done: 0, total: 1, current: null });
});

await test("a session.db is read read-only, by node:sqlite or the sqlite3 CLI, and no file means no chip", () => {
  const dir = sessionDir(realEvents);
  assert.equal(readCopilotTodos(dir), null, "no session.db yet");
  const file = makeSessionDb(dir);
  if (!file) return; // neither driver exists here; the absent path above is all there is to check
  const before = readFileSync(file);
  const expected = { done: 1, total: 3, current: "Implement the reader" };
  if (nodeSqlite()) assert.deepEqual(readCopilotTodos(dir, { drivers: ["node"] }), expected);
  if (hasSqliteCli()) assert.deepEqual(readCopilotTodos(dir, { drivers: ["cli"] }), expected);
  assert.equal(readCopilotTodos(dir, { drivers: ["cli"], platform: "win32" }), null, "no sqlite3 CLI on Windows");
  assert.deepEqual(readFileSync(file), before, "nothing was written");
  const out = render(copilot({ transcript_path: dir }));
  assert.match(out, new RegExp(`${G.todo} Implement the reader \\(1/3\\)`, "u"));
});

await test("a session.db without a todos table is no chip, not an error", () => {
  const dir = sessionDir([]);
  const file = path.join(dir, "session.db");
  const sqlite = nodeSqlite();
  if (sqlite) {
    const db = new sqlite.DatabaseSync(file);
    db.exec("CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT);");
    db.close();
  } else if (hasSqliteCli()) {
    execFileSync("sqlite3", [file, "CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT);"]);
  } else {
    writeFileSync(file, "not a database");
  }
  assert.equal(readCopilotTodos(dir), null);
});

// Item 6: repeat skill invocations ------------------------------------------------

await test("skill.invoked_ref counts as a skill invocation", () => {
  const events = [
    { type: "skill.invoked", data: { name: "about", content: "..." }, timestamp: at(3000) },
    { type: "skill.invoked_ref", data: { name: "about", contentId: "sha256:00", contentLength: 3 }, timestamp: at(30) },
    { type: "skill.invoked_ref", agentId: "a1", data: { name: "review" }, timestamp: at(20) },
  ];
  const activity = copilotSessionActivity(sessionDir(events), { now: NOW });
  assert.deepEqual(activity.skills, ["about"], "the repeat keeps it in the window; the subagent's stays on its row");
});

// Item 7: AI credits ------------------------------------------------------------

await test("the AI credits a session used show as Copilot formats them, and only once some were used", () => {
  assert.doesNotMatch(render(copilot()), /AIC/, "0 credits says nothing");
  const used = copilot({ ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64" } });
  assert.match(render(used), new RegExp(`${G.spend} 0\\.64 AIC `, "u"));
  const worded = copilot({ ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64 AI credits" } });
  assert.match(render(worded), new RegExp(`${G.spend} 0\\.64 AI credits `, "u"), "a unit Copilot sent is not doubled");
  assert.doesNotMatch(render(fullPayload({ now: NOW })), /AIC/, "Claude Code has no credits");
});

await test("with a session limit the credits chip says how much of it is gone, and a cleared limit goes", () => {
  const limited = [...realEvents, { type: "session.session_limits_changed", data: { sessionLimits: { maxAiCredits: 20 } }, timestamp: at(10) }];
  const payload = copilot({ ai_used: { total_nano_aiu: 4_200_000_000, formatted: "4.20" } }, limited);
  assert.equal(copilotSessionActivity(payload.transcript_path, { now: NOW }).sessionLimit, 20);
  assert.match(render(payload), new RegExp(`${G.spend} 4\\.20/20 AIC · 21% `, "u"));
  const cleared = [...limited, { type: "session.session_limits_changed", data: { sessionLimits: null }, timestamp: at(5) }];
  assert.equal(copilotSessionActivity(sessionDir(cleared), { now: NOW }).sessionLimit, null);
  const resumed = [{ type: "session.resume", data: { sessionLimits: { maxAiCredits: 5 } }, timestamp: at(5) }];
  assert.equal(copilotSessionActivity(sessionDir(resumed), { now: NOW }).sessionLimit, 5);
});

// Item 8: the monthly quota --------------------------------------------------------

// `gh api /copilot_internal/user` for this machine's account on 2026-10-06,
// trimmed to what the normaliser reads.
const QUOTA_RESPONSE = {
  access_type_sku: "free_limited_copilot",
  quota_reset_date: "2026-11-01",
  quota_reset_date_utc: "2026-11-01T00:00:00.000Z",
  quota_snapshots: {
    chat: { percent_remaining: 97.0, entitlement: 200, remaining: 194, unlimited: false, has_quota: true },
    completions: { percent_remaining: 100.0, entitlement: 2000, remaining: 2000, unlimited: false, has_quota: true },
    premium_interactions: { percent_remaining: 0.0, entitlement: 0, remaining: 0, unlimited: false, has_quota: false },
  },
};

await test("the quota normaliser keeps the monthly figures and drops what has no allowance", () => {
  const q = normalizeCopilotQuota(QUOTA_RESPONSE);
  assert.equal(q.resetDate, "2026-11-01");
  assert.deepEqual(q.quotas.chat, { usedPct: 3, entitlement: 200, unlimited: false, full: false });
  assert.equal(q.quotas.premium, null, "an entitlement of 0 is no quota");
  const paid = normalizeCopilotQuota({
    ...QUOTA_RESPONSE,
    quota_snapshots: {
      premium_interactions: { percent_remaining: 0, entitlement: 300, unlimited: false, has_quota: false },
      chat: { percent_remaining: 100, entitlement: 0, unlimited: true },
    },
  });
  assert.deepEqual(paid.quotas.premium, { usedPct: 100, entitlement: 300, unlimited: false, full: true });
  assert.equal(paid.quotas.chat, null, "unlimited is no meter");
  assert.equal(normalizeCopilotQuota({ message: "Not Found" }), null);
  assert.equal(normalizeCopilotQuota(null), null);
  assert.equal(formatQuotaDate("2026-11-01"), "Nov 1");
  assert.equal(formatQuotaDate("nonsense"), null);
});

await test("the quota chips sit where the windows sit, labelled monthly, with the reset date", () => {
  const quota = normalizeCopilotQuota({
    ...QUOTA_RESPONSE,
    quota_snapshots: {
      ...QUOTA_RESPONSE.quota_snapshots,
      premium_interactions: { percent_remaining: 24, entitlement: 300, unlimited: false, has_quota: true },
    },
  });
  const out = render(copilot(), {}, { getCopilotQuota: () => quota });
  const line3 = out.split("\n").find((l) => l.includes("Context"));
  assert.match(line3, new RegExp(`${G.calendar} month premium 76%\u25B5 · Nov 1 `, "u"));
  assert.match(line3, new RegExp(`${G.calendar} month chat 3% · Nov 1 `, "u"));
  assert.ok(line3.indexOf("Context") < line3.indexOf("premium") && line3.indexOf("premium") < line3.indexOf("chat"));
  assert.doesNotMatch(out, / 5h | 7d /, "still no windows Copilot does not have");
  const narrow = render(copilot(), { maxWidth: 120 }, { getCopilotQuota: () => quota, getRtkSavings: () => 81 });
  assert.match(narrow, /month chat 3%/, "the figure stays");
  assert.doesNotMatch(narrow, /month chat 3% · /, "the date goes before the figure does");
});

await test("no quota is read, and no lookup started, under Claude Code", () => {
  let asked = 0;
  const probe = { ...emptySources, getCopilotQuota: () => (asked++, normalizeCopilotQuota(QUOTA_RESPONSE)) };
  gather(fullPayload({ now: NOW }), harnessProbes(probe, "claude"), { now: NOW });
  assert.equal(asked, 0);
  const out = render(fullPayload({ now: NOW }), {}, { getCopilotQuota: () => normalizeCopilotQuota(QUOTA_RESPONSE) });
  assert.doesNotMatch(out, /month chat/);
});

await test("the quota refresh caches GitHub's answer and caches nothing when gh fails", async () => {
  const ok = await runRefresh("copilotQuota", COPILOT_QUOTA_KEY, os.tmpdir(), {
    probes: { copilotQuota: () => probeCopilotQuota({ run: () => JSON.stringify(QUOTA_RESPONSE) }) },
  });
  assert.equal(ok, true);
  assert.equal(readEntry(COPILOT_QUOTA_KEY, "copilotQuota").value.quotas.chat.usedPct, 3);
  const missingGh = probeCopilotQuota({
    run: () => {
      throw Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
    },
  });
  assert.equal(missingGh.state, "failed");
  const unauthenticated = probeCopilotQuota({
    run: () => {
      throw Object.assign(new Error("exit 4"), { status: 4, stderr: "gh auth login" });
    },
  });
  assert.equal(unauthenticated.state, "failed");
});

// Item 9: install for Copilot ----------------------------------------------------

const tempDir = (prefix) => mkdtempSync(path.join(os.tmpdir(), prefix));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

await test("install for Copilot refreshes every 10 seconds", () => {
  const home = tempDir("statusline-parity-copilot-");
  writeFileSync(path.join(home, "settings.json"), "{}");
  const r = installHarness("copilot", { env: { COPILOT_HOME: home } });
  assert.equal(r.ok, true, r.reason);
  assert.equal(COPILOT_REFRESH_INTERVAL_SECONDS, 10);
  assert.equal(readJson(path.join(home, "settings.json")).statusLine.refreshInterval, 10);
  assert.equal(readJson(path.join(home, "settings.json")).footer, undefined, "the footer is not touched without the flag");
});

await test("--quiet-footer turns off what the bar repeats, keeps the bar on, and uninstall puts it back", () => {
  const home = tempDir("statusline-parity-copilot-");
  const file = path.join(home, "settings.json");
  const original = { theme: "dark", footer: { showBranch: true, showAgent: true, showCustom: false, showQuota: true } };
  writeFileSync(file, JSON.stringify(original));
  const env = { COPILOT_HOME: home };
  assert.equal(installHarness("copilot", { env, quietFooter: true }).ok, true);
  let s = readJson(file);
  for (const key of QUIET_FOOTER_KEYS) assert.equal(s.footer[key], false, key);
  assert.equal(s.footer.showAgent, true, "items the bar does not show stay");
  assert.equal(s.footer.showCustom, true, "the bar itself is on");
  assert.equal(s.theme, "dark");

  // A second install must not record its own falses as "what was there".
  assert.equal(installHarness("copilot", { env, quietFooter: true }).ok, true);
  // The person turns one back on in Copilot's picker; uninstall leaves that alone.
  s.footer.showDirectory = true;
  writeFileSync(file, JSON.stringify(s));

  assert.equal(uninstallHarness("copilot", { env }).changed, true);
  const after = readJson(file);
  assert.equal(after.statusLine, undefined);
  assert.deepEqual(after.footer, { showBranch: true, showAgent: true, showCustom: false, showQuota: true, showDirectory: true });
  assert.equal(after.theme, "dark");
});

await test("--no-quiet-footer restores the footer, and a footer that was absent is removed again", () => {
  const home = tempDir("statusline-parity-copilot-");
  const file = path.join(home, "settings.json");
  writeFileSync(file, JSON.stringify({ model: "auto" }));
  const env = { COPILOT_HOME: home };
  installHarness("copilot", { env, quietFooter: true });
  assert.equal(readJson(file).footer.showBranch, false);
  installHarness("copilot", { env, quietFooter: false });
  assert.deepEqual(readJson(file), { model: "auto", statusLine: readJson(file).statusLine });
  assert.equal(readJson(file).statusLine.refreshInterval, 10);
});

await test("harness status reports Copilot's refresh interval and whether its footer is quiet", () => {
  const home = tempDir("statusline-parity-copilot-");
  const file = path.join(home, "settings.json");
  writeFileSync(file, "{}");
  const env = { COPILOT_HOME: home, CODEX_HOME: path.join(os.tmpdir(), "statusline-no-codex-parity") };
  installHarness("copilot", { env });
  let [c] = harnessStatus({ env });
  assert.equal(c.refreshInterval, 10);
  assert.equal(c.quietFooter, false);
  installHarness("copilot", { env, quietFooter: true });
  [c] = harnessStatus({ env });
  assert.equal(c.quietFooter, true);
  installHarness("copilot", { env, quietFooter: false });
  assert.equal(existsSync(file), true);
  [c] = harnessStatus({ env });
  assert.equal(c.quietFooter, false);
});

// doctor ------------------------------------------------------------------------

await test("doctor names Copilot's refresh interval and footer, and where the width came from", () => {
  const base = { harness: "copilot", home: "/h/.copilot", configured: true };
  assert.match(harnessLine({ ...base, refreshInterval: 10, quietFooter: true }), /refreshes every 10s; Copilot's footer quieted/);
  assert.match(harnessLine({ ...base, refreshInterval: 60, quietFooter: false }), /refreshes every 60s; .*--quiet-footer hides that/);
  assert.match(harnessLine({ harness: "codex", home: "/h/.codex", configured: true }), /^install: Codex found at \/h\/\.codex, set up with this plugin$/);
  const t = terminalReport("copilot", { env: {}, readTty: () => ({ columns: 117, rows: 40 }), settings: { statusLine: { padding: 2 } } });
  assert.deepEqual([t.columns, t.rows, t.columnsSource], [115, 40, "tty"]);
  assert.match(terminalLine(t), /115 columns \(read from \/dev\/tty: Copilot CLI sets no COLUMNS; less its padding of 2\), 40 rows/);
});

await test("doctor describes the credits and the quota, and says why they are absent under Claude Code", () => {
  const probe = {
    ...emptySources,
    getSessionActivity: () => null,
    getCopilotQuota: () => normalizeCopilotQuota(QUOTA_RESPONSE),
  };
  const report = buildReport(copilot({ ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64" } }), { now: NOW, live: false, probe });
  const row = (key) => report.segments.find((s) => s.key === key);
  assert.match(row("chatQuota").value, /^3% of 200 this month, resets 2026-11-01/);
  assert.match(row("premiumQuota").reason, /no such monthly allowance/);
  assert.equal(row("aiCredits").value, "0.64 AI credits");
  assert.match(row("model").value, /gpt-6-luna \(auto\)/);
  const claude = buildReport(fullPayload({ now: NOW }), { now: NOW, live: false, probe: emptySources });
  assert.equal(claude.segments.find((s) => s.key === "chatQuota").reason, "Copilot CLI only");
  assert.ok(formatReport(claude).includes("chatQuota"));
});
