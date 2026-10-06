import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { opencodePayload, opencodeActivity } from "../../src/opencodePayload.js";
import { parseAnsi } from "../../src/opencode/ansi.js";
import { detectHarness } from "../../src/harness.js";
import { renderPayload } from "../../src/render.js";
import { installHarness, uninstallHarness, harnessStatus } from "../../src/install.js";
import { OPENCODE_PLUGIN_PATH, isOurEntry } from "../../src/opencodeConfig.js";

// specs/038-opencode. The snapshot below has the shape the plugin takes from
// OpenCode 1.18.35's api.state, with the figures of a real session on this
// machine: Kimi K2.7 Code through OpenCode Go, 149.7K tokens of a 262144
// window, which OpenCode's own sidebar showed as 57%.

const NOW = Date.parse("2026-10-06T12:00:00Z");

const PROVIDERS = [
  {
    id: "opencode-go",
    models: {
      "kimi-k2.7-code": { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", limit: { context: 262144, output: 32768 } },
      "no-limit": { id: "no-limit", name: "No Limit" },
    },
  },
];

const assistant = (tokens, extra = {}) => ({
  id: "msg_a",
  role: "assistant",
  providerID: "opencode-go",
  modelID: "kimi-k2.7-code",
  tokens: { input: 1200, output: 800, reasoning: 0, cache: { read: 147700, write: 0 }, ...tokens },
  cost: 0.01,
  ...extra,
});

const SNAPSHOT = {
  version: "1.18.35",
  directory: "/Users/dev/projects/statusline",
  worktree: "/Users/dev/projects/statusline",
  branch: "feat/opencode",
  providers: PROVIDERS,
  session: {
    id: "ses_abc",
    cost: 3.25,
    time: { created: NOW - 65 * 60_000, updated: NOW },
    summary: { additions: 12, deletions: 3, files: 2 },
  },
  messages: [
    { id: "msg_u", role: "user", model: { providerID: "opencode-go", modelID: "kimi-k2.7-code", variant: "high" } },
    assistant({}),
    assistant({ output: 0 }, { id: "msg_streaming" }),
  ],
  status: { type: "busy" },
  todos: [
    { content: "Write the spec", status: "completed" },
    { content: "Run tests to verify changes", status: "in_progress" },
    { content: "Ship", status: "pending" },
  ],
};

// The payload (T001) ---------------------------------------------------------

await test("a session maps to Claude Code's payload, with OpenCode's own figures", () => {
  const p = opencodePayload(SNAPSHOT, { now: NOW });
  assert.equal(detectHarness(p), "opencode");
  assert.equal(p.session_id, "opencode-ses_abc");
  assert.equal(p.cwd, "/Users/dev/projects/statusline");
  assert.deepEqual(p.model, { id: "kimi-k2.7-code", display_name: "Kimi K2.7 Code" });
  assert.equal(p.context_window.context_window_size, 262144);
  // The last message with output, as OpenCode's sidebar counts it.
  assert.equal(Math.round(p.context_window.used_percentage), Math.round((149700 / 262144) * 100));
  assert.equal(p.cost.total_cost_usd, 3.25);
  assert.equal(p.cost.total_duration_ms, 65 * 60_000);
  assert.equal(p.cost.total_lines_added, 12);
  assert.equal(p.cost.total_lines_removed, 3);
  assert.equal(p.rate_limits, undefined, "OpenCode reports no usage windows");
});

await test("the effort is the message's variant", () => {
  const withVariant = opencodePayload(
    { ...SNAPSHOT, messages: [assistant({}, { variant: "max" })] },
    { now: NOW }
  );
  assert.deepEqual(withVariant.effort, { level: "max" });
  const fromUser = opencodePayload({ ...SNAPSHOT, messages: [SNAPSHOT.messages[0]] }, { now: NOW });
  assert.deepEqual(fromUser.effort, { level: "high" });
  assert.deepEqual(fromUser.model, { id: "kimi-k2.7-code", display_name: "Kimi K2.7 Code" });
  assert.equal(fromUser.context_window, undefined, "no answer yet, so no context figure");
});

await test("a model without a context limit has a name but no share", () => {
  const p = opencodePayload({ ...SNAPSHOT, messages: [assistant({}, { modelID: "no-limit" })] }, { now: NOW });
  assert.equal(p.model.display_name, "No Limit");
  assert.equal(p.context_window, undefined);
  const unknown = opencodePayload({ ...SNAPSHOT, messages: [assistant({}, { modelID: "gone" })] }, { now: NOW });
  assert.deepEqual(unknown.model, { id: "gone", display_name: "gone" });
  assert.equal(unknown.context_window, undefined);
});

await test("the home screen, with no session, is a directory and nothing invented", () => {
  const p = opencodePayload({ version: "1.18.35", directory: "/Users/dev/x", worktree: "/", providers: PROVIDERS }, { now: NOW });
  assert.equal(p.session_id, undefined);
  assert.equal(p.model, undefined);
  assert.equal(p.cost, undefined);
  assert.equal(p.workspace.project_dir, undefined, "a worktree of / is no project");
  assert.equal(p.opencode.activity.working, false);
  assert.equal(p.opencode.activity.todos, null);
  assert.deepEqual(opencodePayload(null).opencode.activity.skills, []);
});

await test("working means busy or retrying, and the todo list reads as the bar's", () => {
  assert.equal(opencodeActivity({ status: { type: "busy" } }).working, true);
  assert.equal(opencodeActivity({ status: { type: "retry", attempt: 2 } }).working, true);
  assert.equal(opencodeActivity({ status: { type: "idle" } }).working, false);
  assert.deepEqual(opencodeActivity(SNAPSHOT).todos, { done: 1, total: 3, current: "Run tests to verify changes" });
});

// The bar (T004) -------------------------------------------------------------

const NO_SOURCES = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getCiStatus: () => null,
  getActiveSkills: () => [],
  getActiveSkillsTrueCount: () => 0,
  subagentActivity: () => [],
  getSessionActivity: () => ({ skills: ["from-claude"], todos: null, working: false }),
  getRtkSavings: () => null,
  getDirUrl: () => null,
  maybeStartUpdateCheck: () => false,
  getUpdateNotice: () => null,
  getGateRuns: () => null,
  isRepo: () => false,
  readTty: () => null,
  copilotSettings: () => ({}),
  getCopilotQuota: () => null,
};
const draw = (payload) =>
  stripAnsi(
    renderPayload(payload, {
      sources: NO_SOURCES,
      trackChanges: false,
      now: NOW,
      maxWidth: 200,
      maxHeight: 10,
      layout: { arrangement: null, origin: "default", path: null, error: null },
      samples: [],
    })
  );

await test("the bar under OpenCode: model, context, todo and working, and no window chips", () => {
  const out = draw(opencodePayload(SNAPSHOT, { now: NOW }));
  assert.match(out, /Kimi K2\.7 Code/);
  assert.match(out, /Context 57%/);
  assert.match(out, /Run tests to verify changes \(1\/3\)/);
  assert.match(out, /working/);
  assert.doesNotMatch(out, /5h |7d |\?%/);
  assert.doesNotMatch(out, /from-claude/, "the activity is OpenCode's, not the probe's");
});

await test("before the first answer the model chip says the model, or OpenCode, never Claude", () => {
  const home = draw(opencodePayload({ directory: "/Users/dev/x", version: "1.18.35" }, { now: NOW }));
  assert.match(home, /OpenCode/);
  assert.doesNotMatch(home, /Claude/);
});

// ANSI (T002) ----------------------------------------------------------------

await test("the bar's escapes become coloured runs, and links keep only their text", () => {
  const lines = parseAnsi(
    "\x1b[48;2;69;71;90m\x1b[38;2;205;214;244m\x1b]8;;file:///x\x07 dir \x1b]8;;\x07\x1b[0m plain\n" +
      "\x1b[38;2;166;227;161mgreen\x1b[39m default\x1b[1m\x1b[2K\n\n"
  );
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], [
    { text: " dir ", fg: "#cdd6f4", bg: "#45475a" },
    { text: " plain", fg: null, bg: null },
  ]);
  assert.deepEqual(lines[1], [
    { text: "green", fg: "#a6e3a1", bg: null },
    { text: " default", fg: null, bg: null },
  ]);
});

await test("control characters and unknown escapes never reach the screen as text", () => {
  const lines = parseAnsi("a\x07b\x1b[5Ac\x1b(Bd\re\x1b]0;title\x1b\\f");
  assert.equal(lines.map((l) => l.map((r) => r.text).join("")).join("|"), "abcdef");
});

// Install (T008, T010) -------------------------------------------------------

function ocHome() {
  const root = mkdtempSync(path.join(os.tmpdir(), "statusline-038-"));
  const dir = path.join(root, "opencode");
  mkdirSync(dir);
  return { env: { XDG_CONFIG_HOME: root }, dir, file: path.join(dir, "tui.json") };
}

await test("install creates tui.json with one entry, and uninstall removes the file it created", () => {
  const h = ocHome();
  const r = installHarness("opencode", { env: h.env });
  assert.equal(r.ok, true);
  assert.equal(r.entry, "added");
  const cfg = JSON.parse(readFileSync(h.file, "utf8"));
  assert.deepEqual(cfg.plugin, [OPENCODE_PLUGIN_PATH]);
  assert.equal(installHarness("opencode", { env: h.env }).entry, "present", "a second install changes nothing");
  assert.equal(harnessStatus({ env: { ...h.env, CODEX_HOME: "/nonexistent", COPILOT_HOME: "/nonexistent" } }).find((x) => x.harness === "opencode").configured, true);
  const u = uninstallHarness("opencode", { env: h.env });
  assert.equal(u.changed, true);
  assert.equal(existsSync(h.file), false);
});

await test("install keeps every other entry, and uninstall restores the same bytes", () => {
  const h = ocHome();
  const original = '{\n  "$schema": "https://opencode.ai/tui.json",\n  "theme": "tokyonight",\n  "plugin": [["@renjfk/opencode-voice", { "model": "x" }]]\n}\n';
  writeFileSync(h.file, original);
  const r = installHarness("opencode", { env: h.env });
  assert.ok(r.backupPath && existsSync(r.backupPath));
  const cfg = JSON.parse(readFileSync(h.file, "utf8"));
  assert.equal(cfg.theme, "tokyonight");
  assert.deepEqual(cfg.plugin, [["@renjfk/opencode-voice", { model: "x" }], OPENCODE_PLUGIN_PATH]);
  uninstallHarness("opencode", { env: h.env });
  assert.equal(readFileSync(h.file, "utf8"), original);
});

await test("an entry from another clone is replaced, and one edited after install is removed alone", () => {
  const h = ocHome();
  writeFileSync(h.file, JSON.stringify({ plugin: ["/old/clone/statusline-plugin/src/opencode/tui.tsx", "other"] }));
  assert.equal(installHarness("opencode", { env: h.env }).entry, "updated");
  assert.deepEqual(JSON.parse(readFileSync(h.file, "utf8")).plugin, ["other", OPENCODE_PLUGIN_PATH]);
  const cfg = JSON.parse(readFileSync(h.file, "utf8"));
  cfg.theme = "added later";
  writeFileSync(h.file, JSON.stringify(cfg));
  uninstallHarness("opencode", { env: h.env });
  assert.deepEqual(JSON.parse(readFileSync(h.file, "utf8")), { plugin: ["other"], theme: "added later" });
});

await test("install refuses without OpenCode, on invalid JSON, or on a plugin key that is not a list", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "statusline-038-"));
  assert.match(installHarness("opencode", { env: { XDG_CONFIG_HOME: root } }).reason, /OpenCode is not set up here/);
  const h = ocHome();
  writeFileSync(h.file, "{ not json");
  assert.equal(installHarness("opencode", { env: h.env }).ok, false);
  assert.equal(readFileSync(h.file, "utf8"), "{ not json");
  writeFileSync(h.file, '{ "plugin": "x" }');
  assert.match(installHarness("opencode", { env: h.env }).reason, /not a list/);
});

await test("comments are noted, and only entries for this plugin's file count as ours", () => {
  const h = ocHome();
  writeFileSync(h.file, '// mine\n{ "plugin": [] }\n');
  const r = installHarness("opencode", { env: h.env });
  assert.match(r.notes[0], /had comments/);
  assert.equal(isOurEntry(["file://" + OPENCODE_PLUGIN_PATH, {}]), true);
  assert.equal(isOurEntry("./plugins/demo.tsx"), false);
  assert.equal(isOurEntry(42), false);
  assert.equal(uninstallHarness("opencode", { env: ocHome().env }).changed, false);
});
