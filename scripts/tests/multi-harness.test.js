import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { detectHarness } from "../../src/harness.js";
import { copilotSessionActivity } from "../../src/copilotEvents.js";
import { setCodexStatusLine, removeCodexStatusLine, CODEX_ITEMS } from "../../src/codexConfig.js";
import { installHarness, uninstallHarness, harnessStatus } from "../../src/install.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G, PLAIN, re } from "./glyphs.js";

// specs/029-multi-harness. The Copilot payload here is the one Copilot CLI
// 1.0.80 sent to a capture script on 2026-10-01, with figures filled in.

const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };
const fixture = JSON.parse(readFileSync(new URL("./fixtures/copilot-payload.json", import.meta.url), "utf8"));

function eventsDir(events) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-copilot-session-"));
  writeFileSync(path.join(dir, "events.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return dir;
}
const at = (secondsAgo) => new Date(NOW - secondsAgo * 1000).toISOString();
const copilot = (over = {}, events = []) => ({ ...fixture, transcript_path: eventsDir(events), ...over });
const render = (payload, opts = {}) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, ...WIDE, ...opts }));

// Detection -------------------------------------------------------------

await test("Copilot is recognised by its loader's variable or by its payload, and nothing else is", () => {
  assert.equal(detectHarness({}, { COPILOT_CLI_BINARY_VERSION: "1.0.80" }), "copilot");
  assert.equal(detectHarness({ ai_used: { total_nano_aiu: 0 } }, {}), "copilot");
  assert.equal(detectHarness({ allow_all_enabled: false }, {}), "claude", "a field alone is not a harness");
  assert.equal(detectHarness(fullPayload({ now: NOW }), {}), "claude");
  assert.equal(detectHarness({}, {}), "claude");
});

// Story 1: rendering under Copilot ------------------------------------------

await test("under Copilot there are no chips for limits Copilot does not have", () => {
  const out = render(copilot());
  assert.doesNotMatch(out, / 5h | 7d |spend|%\/h|limit ~/, out);
  assert.match(out, /Auto/, "the model");
  assert.match(out, /Context 31%/, "the context figure");
  assert.match(out, /12m/, "the session duration");
});

await test("Copilot's premium requests and allow-all show only when they say something", () => {
  const out = render(copilot({ allow_all_enabled: true }));
  assert.match(out, re`${G.premium} 3 premium`);
  assert.match(out, re`${G.allowAll} allow all`);
  const quiet = render(copilot({ allow_all_enabled: false, cost: { ...fixture.cost, total_premium_requests: 0 } }));
  assert.doesNotMatch(quiet, /premium|allow all/);
  assert.equal(PLAIN.premium, "✦");
  assert.equal(PLAIN.allowAll, "⊘");
});

await test("Copilot's events give the skills and the working state", () => {
  const events = [
    { type: "session.start", data: {}, timestamp: at(600) },
    { type: "skill.invoked", data: { name: "code-review", source: "user" }, timestamp: at(120) },
    { type: "skill.invoked", data: { name: "humanizer", source: "user" }, timestamp: at(60) },
    { type: "assistant.turn_start", data: { turnId: "3" }, timestamp: at(40) },
  ];
  const activity = copilotSessionActivity(eventsDir(events), { now: NOW, limit: 3 });
  assert.deepEqual(activity.skills, ["humanizer", "code-review"]);
  assert.equal(activity.working, true, "an open turn is work in progress");
  const out = render(copilot({}, events));
  assert.match(out, /humanizer, code-review/);
  assert.match(out, /working/);
});

await test("a closed turn long ago reads idle, and an old skill has left the window", () => {
  const events = [
    { type: "skill.invoked", data: { name: "ancient" }, timestamp: at(6 * 3600) },
    { type: "assistant.turn_start", data: {}, timestamp: at(300) },
    { type: "assistant.turn_end", data: {}, timestamp: at(290) },
  ];
  const activity = copilotSessionActivity(eventsDir(events), { now: NOW });
  assert.deepEqual(activity.skills, []);
  assert.equal(activity.working, false);
  assert.equal(copilotSessionActivity(path.join(os.tmpdir(), "no-such-session"), { now: NOW }), null);
});

await test("a Claude payload renders exactly as it did", () => {
  const claude = fullPayload({ now: NOW });
  const a = render(claude);
  assert.match(a, / 5h 20%/);
  assert.doesNotMatch(a, /premium|allow all/);
});

// Story 1: install for Copilot -------------------------------------------------

const tempDir = (prefix) => mkdtempSync(path.join(os.tmpdir(), prefix));

await test("install for Copilot writes only statusLine, keeps the rest, and backs up", () => {
  const home = tempDir("statusline-copilot-home-");
  writeFileSync(path.join(home, "settings.json"), '// managed by me\n{\n  "theme": "dark",\n  "statusLine": {"command": "old"}\n}\n');
  const r = installHarness("copilot", { env: { COPILOT_HOME: home } });
  assert.equal(r.ok, true, r.reason);
  const written = JSON.parse(readFileSync(path.join(home, "settings.json"), "utf8"));
  assert.equal(written.theme, "dark");
  assert.match(written.statusLine.command, /^\S+ "[^"]+cli\.js" render$/, "the specs/028 form");
  assert.equal(written.statusLine.refreshInterval, 60);
  assert.ok(r.backupPath && existsSync(r.backupPath));
  assert.match(r.notes.join(" "), /comments/);

  const u = uninstallHarness("copilot", { env: { COPILOT_HOME: home } });
  assert.equal(u.changed, true);
  assert.equal(JSON.parse(readFileSync(path.join(home, "settings.json"), "utf8")).statusLine, undefined);
});

// Audit #20. Without this guard the install created ~/.copilot itself and
// reported success, and doctor then said Copilot CLI was found.
await test("install for Copilot refuses when Copilot is not set up, and creates nothing", () => {
  const home = path.join(os.tmpdir(), `statusline-no-copilot-here-${process.pid}`);
  const r = installHarness("copilot", { env: { COPILOT_HOME: home } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Copilot CLI is not set up/);
  assert.equal(existsSync(home), false, "no directory was made for it");
  assert.deepEqual(harnessStatus({ env: { COPILOT_HOME: home, CODEX_HOME: path.join(os.tmpdir(), "nope-2") } }), []);
});

await test("uninstall for Copilot leaves another tool's statusLine alone", () => {
  const home = tempDir("statusline-copilot-home-");
  writeFileSync(path.join(home, "settings.json"), JSON.stringify({ statusLine: { command: "other-tool" } }));
  assert.equal(uninstallHarness("copilot", { env: { COPILOT_HOME: home } }).changed, false);
  assert.equal(JSON.parse(readFileSync(path.join(home, "settings.json"), "utf8")).statusLine.command, "other-tool");
});

// Story 2: Codex ------------------------------------------------------------------

const OURS = `status_line = [${CODEX_ITEMS.map((i) => JSON.stringify(i)).join(", ")}]`;

await test("Codex items are the ones Codex 0.158 draws, in bar order", () => {
  assert.deepEqual(CODEX_ITEMS, [
    "model-with-reasoning", "current-dir", "git-branch", "context-used",
    "five-hour-limit", "weekly-limit", "fast-mode", "run-state", "task-progress",
  ]);
});

await test("the Codex writer appends a [tui] table when there is none, and removes it cleanly", () => {
  const before = 'model = "gpt-5.5"\n\n[projects."/x"]\ntrust_level = "trusted"\n';
  const after = setCodexStatusLine(before);
  assert.ok(after.startsWith(before), "nothing before it changed");
  assert.match(after, new RegExp(`\\n\\[tui\\]\\n${OURS.replace(/[[\]]/g, "\\$&")}\\n$`));
  assert.equal(removeCodexStatusLine(after), before, "round trip");
});

await test("the Codex writer replaces a status_line inside [tui] and nowhere else", () => {
  const one = '[tui]\nstatus_line = ["model-name"]\ntheme = "dark"\n\n[other]\nstatus_line = "untouched"\n';
  const out = setCodexStatusLine(one);
  assert.equal(out, `[tui]\n${OURS}\ntheme = "dark"\n\n[other]\nstatus_line = "untouched"\n`);
  const multi = '[tui]\nstatus_line = [\n  "a",\n  "b",\n]\ntheme = "dark"\n';
  assert.equal(setCodexStatusLine(multi), `[tui]\n${OURS}\ntheme = "dark"\n`);
  const noKey = '[tui] # mine\ntheme = "dark"\n';
  assert.equal(setCodexStatusLine(noKey), `[tui] # mine\n${OURS}\ntheme = "dark"\n`);
});

await test("removing Codex's status_line touches only ours", () => {
  const theirs = '[tui]\nstatus_line = ["model-name"]\n';
  assert.equal(removeCodexStatusLine(theirs), theirs);
});

await test("install for Codex backs up, writes, and refuses when Codex is not set up", () => {
  const codexHome = tempDir("statusline-codex-home-");
  writeFileSync(path.join(codexHome, "config.toml"), 'model = "gpt-5.5"\n');
  const r = installHarness("codex", { env: { CODEX_HOME: codexHome } });
  assert.equal(r.ok, true, r.reason);
  const text = readFileSync(path.join(codexHome, "config.toml"), "utf8");
  assert.ok(text.includes(OURS));
  assert.ok(existsSync(r.backupPath));
  assert.equal(uninstallHarness("codex", { env: { CODEX_HOME: codexHome } }).changed, true);
  assert.equal(readFileSync(path.join(codexHome, "config.toml"), "utf8"), 'model = "gpt-5.5"\n');
  const missing = installHarness("codex", { env: { CODEX_HOME: path.join(os.tmpdir(), "statusline-no-codex-here") } });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /Codex is not set up/);
});

// Story 3: doctor -------------------------------------------------------------------

await test("harness status reports each harness found, and whether this plugin is set up there", () => {
  const copilotHome = tempDir("statusline-copilot-home-");
  const codexHome = tempDir("statusline-codex-home-");
  writeFileSync(path.join(codexHome, "config.toml"), "");
  const env = { COPILOT_HOME: copilotHome, CODEX_HOME: codexHome };
  let s = harnessStatus({ env });
  assert.deepEqual(s.map((h) => [h.harness, h.configured]), [["copilot", false], ["codex", false]]);
  installHarness("copilot", { env });
  installHarness("codex", { env });
  s = harnessStatus({ env });
  assert.deepEqual(s.map((h) => [h.harness, h.configured]), [["copilot", true], ["codex", true]]);
  const none = harnessStatus({ env: { COPILOT_HOME: path.join(os.tmpdir(), "nope-1"), CODEX_HOME: path.join(os.tmpdir(), "nope-2") } });
  assert.deepEqual(none, []);
});
