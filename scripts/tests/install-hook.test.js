import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { install, uninstall, buildHookCommand } from "../../src/install.js";

const thirdPartyHook = {
  matcher: "Bash",
  hooks: [{ type: "command", command: "/usr/local/bin/someone-elses-tool" }],
};

await test("install registers the skill hook by default", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    const result = install();
    assert.equal(result.hookRegistered, true);

    const settings = home.read();
    const group = settings.hooks.PostToolUse.find((g) => g.matcher === "Skill");
    assert.ok(group, "a PostToolUse entry matching Skill must exist");
    assert.match(group.hooks[0].command, /note-skill/);
  });
});

await test("--no-hook skips it, and the install is otherwise the same", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    const result = install({ registerHook: false });
    assert.equal(result.hookRegistered, false);
    assert.ok(home.read().statusLine.command.includes("render"));
    assert.equal(home.read().hooks, undefined, "no empty container may be left behind");
  });
});

await test("the hook command uses the absolute interpreter, with both paths quoted", async () => {
  // Principle IX for a command string this feature introduces. The
  // `statusLine` command's bare `node` is a documented exception that
  // predates it and does not extend here.
  const command = buildHookCommand();
  assert.match(command, /^"[^"]+" "[^"]+" note-skill$/);
  assert.ok(command.startsWith(`"${process.execPath}"`), `interpreter was ${command.split('"')[1]}`);
});

await test("installing twice does not stack two hooks", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    install();
    install();
    const ours = home
      .read()
      .hooks.PostToolUse.filter((g) => (g.hooks || []).some((h) => h.command.includes("note-skill")));
    assert.equal(ours.length, 1, "install must be idempotent");
  });
});

await test("uninstall removes the statusline and the hook, and nothing else", async () => {
  const home = makeHome({ hooks: { PostToolUse: [thirdPartyHook] }, theme: "dark" });
  await withHome(home, () => {
    install();
    const result = uninstall();
    assert.equal(result.changed, true);
    assert.equal(result.hookRemoved, true);

    const settings = home.read();
    assert.equal(settings.statusLine, undefined);
    assert.deepEqual(
      settings.hooks.PostToolUse,
      [thirdPartyHook],
      "another tool's hook must survive untouched"
    );
    assert.equal(settings.theme, "dark", "unrelated settings must be untouched");
  });
});

await test("settings are byte-identical after an install and uninstall round trip", async () => {
  // SC-008. The comparison is on parsed content rather than raw bytes,
  // since the file is rewritten with a normalised indentation either way.
  const before = { theme: "dark", hooks: { PostToolUse: [thirdPartyHook] }, permissions: { allow: ["Bash(ls *)"] } };
  const home = makeHome(before);
  await withHome(home, () => {
    install();
    uninstall();
    assert.deepEqual(home.read(), before);
  });
});

await test("uninstall leaves a statusline this plugin did not install alone", async () => {
  const home = makeHome({ statusLine: { type: "command", command: "some-other-tool --render" } });
  await withHome(home, () => {
    const result = uninstall();
    assert.equal(result.changed, false);
    assert.match(result.reason, /No statusline installed by this plugin/);
    assert.equal(home.read().statusLine.command, "some-other-tool --render");
  });
});

await test("uninstall on a machine with no settings file says so rather than throwing", async () => {
  const home = makeHome({});
  await withHome(home, async () => {
    const { rmSync } = await import("node:fs");
    rmSync(home.settingsPath);
    const result = uninstall();
    assert.equal(result.changed, false);
    assert.match(result.reason, /does not exist/);
  });
});

await test("install backs the settings up before touching them", async () => {
  const home = makeHome({ theme: "light" });
  await withHome(home, async () => {
    const { readFileSync } = await import("node:fs");
    const result = install();
    assert.deepEqual(JSON.parse(readFileSync(result.backupPath, "utf8")), { theme: "light" });
  });
});

await test("install writes the refresh interval and the subagent row command", async () => {
  // Item F1 at 60 seconds, and F2. Both live in settings.json beside the
  // command, so only the installer can put them there. The subagent rows are
  // their own top-level setting with their own tick, not a field on
  // `statusLine`: written as `statusLine.taskCommand` until 2026-09-06, which
  // Claude Code does not read, so the rows kept their default rendering and
  // the snapshot line 2 reads from was never written.
  const home = makeHome({});
  await withHome(home, () => {
    const result = install();
    assert.equal(result.refreshInterval, 60);
    assert.equal(result.taskRows, true);

    const written = home.read();
    assert.equal(written.statusLine.refreshInterval, 60);
    assert.equal(written.statusLine.taskCommand, undefined, "not a field on statusLine");
    assert.equal(written.subagentStatusLine.type, "command");
    assert.match(written.subagentStatusLine.command, /task-rows$/);
    assert.ok(
      written.subagentStatusLine.command.startsWith(`"${process.execPath}"`),
      "spawned commands use the running interpreter"
    );
  });
});

// A settings file written by an older install carries the key Claude Code
// never read. Installing again must clear it rather than leave both.
await test("installing over the old task-row key removes it", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    install();
    const stale = home.read();
    stale.statusLine.taskCommand = stale.subagentStatusLine.command;
    home.write(stale);

    install();
    const written = home.read();
    assert.equal(written.statusLine.taskCommand, undefined, "the key Claude Code ignores is gone");
    assert.match(written.subagentStatusLine.command, /task-rows$/);
  });
});

await test("each addition can be skipped on its own", async () => {
  const home = makeHome({});
  await withHome(home, () => {
    install({ refreshInterval: false, taskRows: false });
    const written = home.read();
    assert.equal(written.statusLine.refreshInterval, undefined, "--no-refresh-interval leaves it out");
    assert.equal(written.subagentStatusLine, undefined, "--no-task-rows leaves it out");
    assert.match(written.statusLine.command, /render$/, "the statusline itself is still installed");
  });
});

await test("uninstall takes the interval and the subagent row command with it", async () => {
  const home = makeHome({ theme: "dark" });
  await withHome(home, () => {
    install();
    uninstall();
    assert.deepEqual(home.read(), { theme: "dark" }, "everything this install wrote is gone");
  });
});
