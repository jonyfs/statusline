import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { buildCommandForTest, shellPath, checkInstall, uninstall, projectOverrides } from "../../src/install.js";

// specs/028-cross-platform. A command install writes has to parse in every
// shell Claude Code runs it through: sh, Git Bash, and PowerShell on Windows
// when Git Bash is absent. PowerShell rejects a line that opens with a quoted
// string, and bash rejects the `&` that would fix it, so the interpreter goes
// unquoted and the script path quoted.

const WIN = { platform: "win32" };
const POSIX = { platform: "linux" };

await test("on Windows, the command uses forward slashes and an unquoted interpreter", () => {
  assert.equal(
    buildCommandForTest("node", "C:\\Users\\John Smith\\.claude\\statusline-plugin\\bin\\cli.js", "render", WIN),
    'node "C:/Users/John Smith/.claude/statusline-plugin/bin/cli.js" render'
  );
  assert.equal(
    buildCommandForTest("C:\\nodejs\\node.exe", "C:\\p\\cli.js", "note-skill", WIN),
    'C:/nodejs/node.exe "C:/p/cli.js" note-skill'
  );
});

await test("a Windows interpreter with a space becomes node when node runs, and stays quoted when not", () => {
  const exe = "C:\\Program Files\\nodejs\\node.exe";
  assert.equal(buildCommandForTest(exe, "C:\\p\\cli.js", "task-rows", { ...WIN, nodeRuns: () => true }), 'node "C:/p/cli.js" task-rows');
  assert.equal(
    buildCommandForTest(exe, "C:\\p\\cli.js", "task-rows", { ...WIN, nodeRuns: () => false }),
    '"C:/Program Files/nodejs/node.exe" "C:/p/cli.js" task-rows'
  );
});

await test("on POSIX, an interpreter is quoted only when it has a space; the script path always is", () => {
  assert.equal(buildCommandForTest("/usr/bin/node", "/home/a/cli.js", "render", POSIX), '/usr/bin/node "/home/a/cli.js" render');
  assert.equal(
    buildCommandForTest("/opt/my node/node", "/home/a b/cli.js", "render", POSIX),
    '"/opt/my node/node" "/home/a b/cli.js" render'
  );
  assert.equal(buildCommandForTest("node", "C:\\not\\windows.js", "render", POSIX), 'node "C:\\not\\windows.js" render', "POSIX leaves backslashes alone");
});

await test("shellPath converts only on Windows", () => {
  assert.equal(shellPath("C:\\a\\b", "win32"), "C:/a/b");
  assert.equal(shellPath("/a/b\\c", "darwin"), "/a/b\\c");
});

await test("old and new command forms are both recognised as this plugin's", async () => {
  const { CLI_PATH_FOR_TEST } = await import("../../src/install.js");
  const oldForm = `"node" "${CLI_PATH_FOR_TEST}" render`;
  const newForm = `node "${CLI_PATH_FOR_TEST}" render`;
  const execForm = `${process.execPath} "${CLI_PATH_FOR_TEST}" note-skill`;
  const checks = checkInstall({
    statusLine: { type: "command", command: newForm },
    hooks: { PostToolUse: [{ matcher: "Skill", hooks: [{ type: "command", command: execForm }] }] },
  });
  assert.deepEqual(checks.map((c) => c.entry), ["statusLine", "skill hook"]);
  assert.ok(checks.every((c) => c.ok), JSON.stringify(checks));
  assert.equal(checkInstall({ statusLine: { type: "command", command: oldForm } })[0].ok, true);

  for (const command of [oldForm, newForm]) {
    const home = makeHome({ statusLine: { type: "command", command }, theme: "dark" });
    await withHome(home, () => {
      assert.equal(uninstall().changed, true, `uninstall did not recognise ${command}`);
      assert.equal(home.read().statusLine, undefined);
      assert.equal(home.read().theme, "dark");
    });
  }
});

// Story 3: a project statusLine that hides this one ---------------------------

await test("a project statusLine that is not this plugin is named, in either project file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-project-"));
  assert.deepEqual(projectOverrides(dir), []);
  mkdirSync(path.join(dir, ".claude"));
  writeFileSync(path.join(dir, ".claude", "settings.local.json"), JSON.stringify({ statusLine: { type: "command", command: "npx other-statusline" } }));
  const found = projectOverrides(dir);
  assert.equal(found.length, 1);
  assert.match(found[0].file, /settings\.local\.json$/);
  assert.equal(found[0].command, "npx other-statusline");
  writeFileSync(path.join(dir, ".claude", "settings.json"), "{ not json");
  assert.equal(projectOverrides(dir).length, 1, "an unreadable file is skipped, not fatal");
});

await test("a project statusLine that is this plugin at another path is not foreign", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-project-"));
  mkdirSync(path.join(dir, ".claude"));
  writeFileSync(
    path.join(dir, ".claude", "settings.json"),
    JSON.stringify({ statusLine: { type: "command", command: 'node "/somewhere/statusline-plugin/bin/cli.js" render' } })
  );
  assert.deepEqual(projectOverrides(dir), []);
});
