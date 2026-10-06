import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import {
  CODEX_ITEMS,
  CODEX_ITEMS_HISTORY,
  CODEX_THEMES,
  CODEX_STATUS_LINE,
  codexItemsState,
  applyCodexItems,
  removeCodexStatusLine,
  hasCodexStatusLine,
} from "../../src/codexConfig.js";
import { installHarness, uninstallHarness, harnessStatus } from "../../src/install.js";
import { harnessLine } from "../../src/doctor.js";

// specs/034-codex-items. Every id below was checked against the strings of
// the Codex CLI 0.160.1 binary; the spec lists where each one sits.

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const OLD_029 = [
  "model-with-reasoning", "current-dir", "git-branch", "context-used",
  "five-hour-limit", "weekly-limit", "fast-mode", "run-state", "task-progress",
];
const line = (items) => `status_line = [${items.map((i) => JSON.stringify(i)).join(", ")}]`;
const COLORS = "status_line_use_colors = true";

function codexHome(config) {
  const home = mkdtempSync(path.join(os.tmpdir(), "statusline-codex-034-"));
  if (config !== undefined) writeFileSync(path.join(home, "config.toml"), config);
  return home;
}
const read = (home) => readFileSync(path.join(home, "config.toml"), "utf8");
const env = (home) => ({ CODEX_HOME: home, COPILOT_HOME: path.join(os.tmpdir(), "statusline-no-copilot-034") });

// Item 1: the list ---------------------------------------------------------------

await test("Codex items follow the Claude bar's reading order", () => {
  assert.deepEqual(CODEX_ITEMS, [
    "project-name", "git-branch", "branch-changes", "pull-request-number",
    "task-progress", "run-state", "model-with-reasoning", "fast-mode", "permissions",
    "context-used", "five-hour-limit", "weekly-limit",
  ]);
  assert.equal(CODEX_STATUS_LINE, line(CODEX_ITEMS));
  assert.ok(!CODEX_ITEMS.includes("current-dir"), "the absolute path pushed every later item off the line");
});

await test("the history holds every list this plugin has written, newest first", () => {
  assert.deepEqual(CODEX_ITEMS_HISTORY[0], CODEX_ITEMS);
  assert.ok(CODEX_ITEMS_HISTORY.some((l) => JSON.stringify(l) === JSON.stringify(OLD_029)), "the 029 list");
});

// Item 4: existing installs ------------------------------------------------------

await test("an older list this plugin wrote is upgraded, the rest of the file kept byte for byte", () => {
  const before = `model = "gpt-5.5"\n\n[tui]\n${line(OLD_029)}\nanimations = false # mine\n\n[projects."/x"]\ntrust_level = "trusted"\n`;
  assert.equal(codexItemsState(before), "older");
  const r = applyCodexItems(before);
  assert.equal(r.items, "upgraded");
  assert.equal(r.text, before.replace(line(OLD_029), CODEX_STATUS_LINE));
  assert.equal(codexItemsState(r.text), "current");
  assert.deepEqual(applyCodexItems(r.text), { text: r.text, items: "unchanged" });
});

await test("an older list reformatted over several lines still counts as ours", () => {
  const multi = `[tui]\nstatus_line = [\n${OLD_029.map((i) => `  '${i}', # c`).join("\n")}\n]\ntheme = "dark"\n`;
  assert.equal(codexItemsState(multi), "older");
  assert.equal(applyCodexItems(multi).text, `[tui]\n${CODEX_STATUS_LINE}\ntheme = "dark"\n`);
  assert.equal(removeCodexStatusLine(multi), '[tui]\ntheme = "dark"\n');
});

await test("a list the person edited is never overwritten", () => {
  for (const items of [["model", "current-dir"], [...OLD_029, "hostname"], [...CODEX_ITEMS].reverse()]) {
    const text = `[tui]\n${line(items)}\n`;
    assert.equal(codexItemsState(text), "user");
    assert.deepEqual(applyCodexItems(text), { text, items: "kept" });
    assert.equal(removeCodexStatusLine(text), text);
    assert.equal(hasCodexStatusLine(text), false);
  }
});

await test("no status_line yet: the list is written; an uneditable file is refused", () => {
  assert.equal(codexItemsState(""), "absent");
  assert.equal(applyCodexItems("").items, "written");
  assert.equal(codexItemsState('tui = { theme = "dark" }\n'), "unsafe");
  assert.equal(applyCodexItems('tui = { theme = "dark" }\n').text, null);
});

await test("install keeps the person's list, says so, and still turns colors on", () => {
  const before = '[tui]\nstatus_line = ["model", "git-branch"]\n';
  const home = codexHome(before);
  const r = installHarness("codex", { env: env(home) });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.items, "kept");
  assert.ok(r.notes.some((n) => n.includes(CODEX_STATUS_LINE)), r.notes.join("\n"));
  assert.equal(read(home), `[tui]\nstatus_line = ["model", "git-branch"]\n${COLORS}\n`);
  assert.equal(uninstallHarness("codex", { env: env(home) }).changed, true);
  assert.equal(read(home), before);
});

await test("install upgrades an older install, and uninstall then restores the original bytes", () => {
  const original = 'model = "gpt-5.5"\n';
  const home = codexHome(original);
  // What 029's install left behind.
  writeFileSync(path.join(home, "config.toml"), `${original}\n[tui]\n${line(OLD_029)}\n`);
  const r = installHarness("codex", { env: env(home) });
  assert.equal(r.items, "upgraded");
  assert.equal(read(home), `${original}\n[tui]\n${CODEX_STATUS_LINE}\n${COLORS}\n`);
  assert.equal(uninstallHarness("codex", { env: env(home) }).changed, true);
  assert.equal(read(home), original);
});

// The writer's edge cases, with CRLF -------------------------------------------

await test("install and uninstall round-trip a CRLF file byte for byte, and add CRLF lines", () => {
  for (const before of [
    'model = "gpt-5.5"\r\n\r\n[projects."/x"]\r\ntrust_level = "trusted"\r\n',
    '["tui"] # mine\r\ntheme = "dark"\r\n\r\n[other]\r\nstatus_line = "untouched"\r\n',
    `[ tui ]\r\n"status_line" = [\r\n${OLD_029.map((i) => `  "${i}"`).join(",\r\n")}]\r\nanimations = false\r\n`,
  ]) {
    const home = codexHome(before);
    assert.equal(installHarness("codex", { env: env(home) }).ok, true);
    const after = read(home);
    assert.ok(!/[^\r]\n/.test(after), `a bare LF crept in: ${JSON.stringify(after)}`);
    assert.ok(after.includes(`${CODEX_STATUS_LINE}\r\n`));
    assert.ok(after.includes(`${COLORS}\r\n`));
    assert.equal(uninstallHarness("codex", { env: env(home) }).changed, true);
    const expected = before.includes('"status_line" = [') ? '[ tui ]\r\nanimations = false\r\n' : before;
    assert.equal(read(home), expected);
  }
});

await test("install then uninstall returns an LF file byte for byte, every tui spelling", () => {
  for (const before of [
    "",
    'model = "gpt-5.5"\n\n[tui]\ntheme = "dark"\n# trailing comment\n',
    "[ 'tui' ] # x\nanimations = false\n[profiles.x]\ntui.theme = \"dark\"\n",
    '[tui]\nterminal_title = ["project-name"]\n',
  ]) {
    const home = codexHome(before);
    assert.equal(installHarness("codex", { env: env(home) }).ok, true);
    assert.equal(uninstallHarness("codex", { env: env(home) }).changed, true);
    assert.equal(read(home), before, JSON.stringify(before));
  }
});

// Item 2: colors and the opt-in theme -------------------------------------------

await test("install writes status_line_use_colors under [tui], after the items", () => {
  const home = codexHome('[tui]\ntheme = "dark"\n');
  const r = installHarness("codex", { env: env(home) });
  assert.equal(r.colors, "added");
  assert.equal(read(home), `[tui]\n${CODEX_STATUS_LINE}\n${COLORS}\ntheme = "dark"\n`);
  // A second install changes nothing and still knows the key is ours.
  const again = installHarness("codex", { env: env(home) });
  assert.equal(again.colors, "ours");
  assert.equal(again.items, "unchanged");
  assert.equal(read(home), `[tui]\n${CODEX_STATUS_LINE}\n${COLORS}\ntheme = "dark"\n`);
});

await test("a colors value the person set is kept, and uninstall leaves it", () => {
  for (const value of ["false", "true"]) {
    const before = `[tui]\nstatus_line_use_colors = ${value} # mine\n`;
    const home = codexHome(before);
    const r = installHarness("codex", { env: env(home) });
    assert.equal(r.colors, value === "true" ? "yours-on" : "yours-off");
    assert.ok(read(home).includes(`status_line_use_colors = ${value} # mine`));
    uninstallHarness("codex", { env: env(home) });
    assert.equal(read(home), before);
  }
});

await test("uninstall leaves colors the person turned off after the install", () => {
  const home = codexHome('model = "o3"\n');
  installHarness("codex", { env: env(home) });
  writeFileSync(path.join(home, "config.toml"), read(home).replace(COLORS, "status_line_use_colors = false"));
  uninstallHarness("codex", { env: env(home) });
  assert.equal(read(home), 'model = "o3"\n\n[tui]\nstatus_line_use_colors = false\n');
});

await test("the theme is untouched without a flag", () => {
  const home = codexHome('[tui]\ntheme = "dracula"\n');
  const r = installHarness("codex", { env: env(home) });
  assert.equal(r.theme, "unchanged");
  assert.ok(read(home).includes('theme = "dracula"'));
  assert.deepEqual(CODEX_THEMES, ["catppuccin-mocha", "catppuccin-macchiato", "catppuccin-frappe", "catppuccin-latte"]);
});

await test("a plain reinstall reports the theme an earlier --theme set as kept, not as Codex's own", () => {
  const home = codexHome('[tui]\ntheme = "dracula"\n');
  installHarness("codex", { env: env(home), theme: "catppuccin-latte" });
  const again = installHarness("codex", { env: env(home) });
  assert.equal(again.theme, "kept");
  assert.equal(again.themeName, "catppuccin-latte");
  assert.ok(read(home).includes('theme = "catppuccin-latte"'), "the theme stays");
  // A theme the person chose themselves is just left as it is.
  const mine = codexHome('[tui]\ntheme = "dracula"\n');
  assert.equal(installHarness("codex", { env: env(mine) }).theme, "unchanged");
});

await test("--theme sets a Catppuccin theme and --no-theme puts back the one it replaced", () => {
  const before = '[tui]\ntheme = "dracula" # picked in /theme\n';
  const home = codexHome(before);
  assert.equal(installHarness("codex", { env: env(home), theme: "catppuccin-mocha" }).theme, "set");
  assert.ok(read(home).includes('theme = "catppuccin-mocha"'));
  // A second --theme keeps the first record, so the person's theme survives.
  installHarness("codex", { env: env(home), theme: "catppuccin-latte" });
  assert.ok(read(home).includes('theme = "catppuccin-latte"'));
  assert.equal(installHarness("codex", { env: env(home), theme: false }).theme, "restored");
  assert.ok(read(home).includes('theme = "dracula" # picked in /theme'));
  uninstallHarness("codex", { env: env(home) });
  assert.equal(read(home), before);
});

await test("uninstall removes a theme --theme added, and keeps one changed since", () => {
  const home = codexHome('model = "o3"\n');
  installHarness("codex", { env: env(home), theme: "catppuccin-frappe" });
  assert.equal(uninstallHarness("codex", { env: env(home) }).changed, true);
  assert.equal(read(home), 'model = "o3"\n');

  const other = codexHome('model = "o3"\n');
  installHarness("codex", { env: env(other), theme: "catppuccin-frappe" });
  writeFileSync(path.join(other, "config.toml"), read(other).replace('"catppuccin-frappe"', '"github"'));
  uninstallHarness("codex", { env: env(other) });
  assert.equal(read(other), 'model = "o3"\n\n[tui]\ntheme = "github"\n');
});

await test("an unknown theme is refused and nothing is written", () => {
  const home = codexHome('model = "o3"\n');
  const r = installHarness("codex", { env: env(home), theme: "solarized-dark" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /catppuccin-mocha/);
  assert.equal(read(home), 'model = "o3"\n');
});

// Item 3: terminal_title is not written -----------------------------------------

await test("install never writes terminal_title and leaves the person's alone", () => {
  const home = codexHome('[tui]\nterminal_title = ["thread-title"]\n');
  installHarness("codex", { env: env(home), theme: "catppuccin-mocha" });
  assert.equal((read(home).match(/terminal_title/g) || []).length, 1);
  assert.ok(read(home).includes('terminal_title = ["thread-title"]'));
  const fresh = codexHome("");
  installHarness("codex", { env: env(fresh) });
  assert.ok(!read(fresh).includes("terminal_title"));
});

// Item 5: doctor ------------------------------------------------------------------

await test("harness status reports the Codex items, colors and theme", () => {
  const home = codexHome("");
  let [s] = harnessStatus({ env: env(home) });
  assert.deepEqual([s.configured, s.items, s.colors, s.theme], [false, "absent", "unset", null]);
  installHarness("codex", { env: env(home), theme: "catppuccin-mocha" });
  [s] = harnessStatus({ env: env(home) });
  assert.deepEqual([s.configured, s.items, s.colors, s.theme], [true, "current", "ours", "catppuccin-mocha"]);
  writeFileSync(path.join(home, "config.toml"), `[tui]\n${line(OLD_029)}\nstatus_line_use_colors = false\n`);
  [s] = harnessStatus({ env: env(home) });
  assert.deepEqual([s.configured, s.items, s.colors, s.theme], [true, "older", "yours-off", null]);
  writeFileSync(path.join(home, "config.toml"), '[tui]\nstatus_line = ["model"]\n');
  [s] = harnessStatus({ env: env(home) });
  assert.deepEqual([s.configured, s.items], [false, "user"]);
});

await test("doctor's Codex line names the items, colors and theme", () => {
  const base = { harness: "codex", home: "/h/.codex" };
  assert.equal(
    harnessLine({ ...base, configured: true, items: "current", colors: "ours", theme: null }),
    "install: Codex found at /h/.codex, set up with this plugin; items: this plugin's 12, in the Claude bar's order; colors on (set by this plugin)",
  );
  assert.match(harnessLine({ ...base, configured: true, items: "older", colors: "unset", theme: null }), /items: an older list this plugin wrote \(install --harness codex upgrades it\); colors not set \(install --harness codex turns them on\)/);
  assert.match(harnessLine({ ...base, configured: false, items: "user", colors: "yours-off", theme: null }), /^install: Codex found at \/h\/\.codex, items: your own status_line, which install keeps; colors off \(your setting\)$/);
  assert.match(harnessLine({ ...base, configured: true, items: "current", colors: "yours-on", theme: "catppuccin-latte" }), /colors on \(your setting\); theme catppuccin-latte \(set by this plugin; install --harness codex --no-theme restores yours\)$/);
});

// CLI -----------------------------------------------------------------------------

await test("the CLI takes --theme and --no-theme for Codex only", () => {
  const home = codexHome('model = "o3"\n');
  const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env(home) } });
  let r = run(["install", "--harness", "codex", "--theme", "catppuccin-mocha"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Items: +written/);
  assert.match(r.stdout, /Colors: +on/);
  assert.match(r.stdout, /Theme: +catppuccin-mocha/);
  assert.ok(read(home).includes('theme = "catppuccin-mocha"'));
  r = run(["install", "--harness=codex", "--theme=nope"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /catppuccin-mocha/);
  r = run(["install", "--harness", "copilot", "--theme", "catppuccin-mocha"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--theme is for Codex/);
  r = run(["uninstall", "--harness", "codex"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(home), 'model = "o3"\n');
  assert.ok(existsSync(home));
});
