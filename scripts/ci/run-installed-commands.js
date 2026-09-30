#!/usr/bin/env node
/**
 * Runs the commands `install` wrote, through the shells Claude Code uses, the
 * way Claude Code runs them: the command string handed to the shell, the
 * payload on stdin (specs/028-cross-platform).
 *
 * The test suite checks the strings; only running them proves a shell can
 * parse them. PowerShell reads a line that opens with a quoted string as an
 * expression and never runs it, which is how the Windows install was broken
 * without any test noticing.
 *
 * Usage: node scripts/ci/run-installed-commands.js <shell>...
 *   shells: sh, bash, git-bash, pwsh, powershell
 * Reads the settings from the HOME / USERPROFILE the job set.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const SHELLS = {
  sh: (cmd) => ["sh", ["-c", cmd]],
  bash: (cmd) => ["bash", ["-c", cmd]],
  // Not the `bash` on a Windows PATH, which can be WSL's.
  "git-bash": (cmd) => ["C:\\Program Files\\Git\\bin\\bash.exe", ["-c", cmd]],
  pwsh: (cmd) => ["pwsh", ["-NoProfile", "-NonInteractive", "-Command", cmd]],
  powershell: (cmd) => ["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd]],
};

const shells = process.argv.slice(2);
if (!shells.length || shells.some((s) => !SHELLS[s])) {
  console.error(`Usage: run-installed-commands.js <${Object.keys(SHELLS).join("|")}>...`);
  process.exit(2);
}

const settings = JSON.parse(readFileSync(path.join(os.homedir(), ".claude", "settings.json"), "utf8"));
const hook = (settings.hooks?.PostToolUse ?? []).flatMap((g) => g.hooks ?? []).find((h) => /note-skill\s*$/.test(h.command));
const commands = [
  // The bar draws its context segment whatever the payload says, so its
  // presence proves the command ran even if a shell did not pass stdin on.
  { name: "statusLine", command: settings.statusLine?.command, expect: /Context/ },
  { name: "skill hook", command: hook?.command, expect: null },
  { name: "subagent rows", command: settings.subagentStatusLine?.command, expect: null },
];
const payload = JSON.stringify({ model: { display_name: "Sonnet 5" }, context_window: { used_percentage: 42 } });

let failed = 0;
for (const { name, command, expect } of commands) {
  if (!command) {
    console.log(`FAIL  ${name}: install wrote no command`);
    failed++;
    continue;
  }
  for (const shell of shells) {
    const [exe, args] = SHELLS[shell](command);
    const r = spawnSync(exe, args, { input: payload, encoding: "utf8", timeout: 30_000 });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const ok = !r.error && r.status === 0 && (!expect || expect.test(r.stdout ?? ""));
    console.log(`${ok ? "  ok" : "FAIL"}  ${name} via ${shell}: ${command}`);
    if (!ok) {
      failed++;
      console.log(`      exit ${r.status}${r.error ? `, ${r.error.message}` : ""}\n      ${out.trim().split("\n").slice(0, 6).join("\n      ")}`);
    }
  }
}
process.exit(failed ? 1 : 0);
