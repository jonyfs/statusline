import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));

function runRender(input, env = {}) {
  return spawnSync(process.execPath, [CLI, "render"], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1", ...env },
  });
}

await test("a normal render exits 0 and writes nothing to stderr", () => {
  const r = runRender("{}");
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "", `stderr must stay empty, got ${JSON.stringify(r.stderr)}`);
  assert.ok(r.stdout.trim().length > 0);
});

await test("malformed stdin still renders and still exits 0", () => {
  const r = runRender("{not json at all");
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /Context/);
});

await test("a render that throws prints a line and exits 0", () => {
  // FR-015: the bar is not a place to print a stack trace, and a non-zero
  // exit is a reason for the harness to stop calling the command at all.
  const r = spawnSync(process.execPath, [CLI, "render"], {
    input: "{}",
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_STATUSLINE_NO_REFRESH: "1",
      CLAUDE_STATUSLINE_TEST_THROW: "1",
    },
  });
  assert.equal(r.status, 0, "a crashing render must not exit non-zero");
  assert.equal(r.stderr, "", "a crashing render must not print to stderr");
  assert.ok(r.stdout.trim().length > 0, "a crashing render must still print something");
});

await test("an unknown subcommand is still an error, as it always was", () => {
  const r = spawnSync(process.execPath, [CLI, "not-a-command"], { encoding: "utf8" });
  assert.equal(r.status, 1, "a typo at the command line should fail loudly");
});

await test("the installed command is the one that renders", () => {
  // Guards against the exit-0 wrapper being added to a path the
  // statusLine command does not actually take.
  const out = execFileSync(process.execPath, [CLI, "render"], {
    input: "{}",
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1" },
  });
  assert.match(out, /Context/);
});

// Claude Code cancels the command it has in flight when a new update
// triggers, which closes the pipe under whichever write is happening. Node's
// default for that is an unhandled EPIPE: a stack trace where the bar should
// be, and a non-zero exit, which is a reason for a harness to stop calling
// the command at all.
//
// Closing the read end from here rather than piping into `head`: a shell
// pipeline needs `/bin/sh` and a `head` that takes `-c`, and Windows has
// neither (Principle IX). What is asserted holds either way — a platform that
// raises EPIPE must not print it, and one that swallows the write must still
// exit 0 — so this guards the outcome rather than the mechanism.
await test("a reader that goes away mid-write is silent, not a stack trace", async () => {
  const child = spawn(process.execPath, [CLI, "render"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1", COLUMNS: "200" },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  child.stdout.destroy();
  child.stdin.end("{}");

  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0, `exited ${code} with stderr: ${stderr}`);
  assert.doesNotMatch(stderr, /EPIPE|at .*cli\.js/, `stderr was: ${stderr}`);
});
