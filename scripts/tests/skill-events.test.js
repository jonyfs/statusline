import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendFileSync, readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { appendSkillEvent, readSkillEvents, readSkillEventsTrueCount, sessionFileFor } from "../../src/skillEvents.js";

const CLI = fileURLToPath(new URL("../../bin/cli.js", import.meta.url));
const NOW = Date.parse("2026-08-25T12:00:00.000Z");

await test("an appended record reads back", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s1", "humanizer", { now: NOW });
    assert.deepEqual(readSkillEvents("s1", { now: NOW }), ["humanizer"]);
  });
});

await test("records are newest first and deduplicated by name", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s2", "first", { now: NOW - 3000 });
    appendSkillEvent("s2", "second", { now: NOW - 2000 });
    appendSkillEvent("s2", "first", { now: NOW - 1000 });
    assert.deepEqual(readSkillEvents("s2", { now: NOW }), ["first", "second"]);
  });
});

await test("records outside the activity window are dropped", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s3", "long-ago", { now: NOW - 31 * 60 * 1000 });
    assert.deepEqual(readSkillEvents("s3", { now: NOW }), []);
  });
});

await test("a half-written record is skipped, not treated as end of file", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s4", "before", { now: NOW });
    appendFileSync(sessionFileFor("s4"), '{"skill":"trunc');
    appendFileSync(sessionFileFor("s4"), "\n");
    appendSkillEvent("s4", "after", { now: NOW });
    assert.deepEqual(readSkillEvents("s4", { now: NOW }), ["after", "before"]);
  });
});

await test("a session with no file at all is empty, not an error", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.deepEqual(readSkillEvents("never-seen", { now: NOW }), []);
  });
});

await test("note-skill appends one record, says nothing and exits 0", async () => {
  const home = makeHome();
  const payload = JSON.stringify({
    session_id: "hooked",
    tool_name: "Skill",
    tool_input: { skill: "speckit-implement" },
  });

  const r = spawnSync(process.execPath, [CLI, "note-skill"], {
    input: payload,
    encoding: "utf8",
    env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir },
  });

  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");

  const file = `${home.dir}/.claude/statusline/skills/hooked.jsonl`;
  const record = JSON.parse(readFileSync(file, "utf8").trim());
  assert.equal(record.skill, "speckit-implement");
});

await test("note-skill on an unrecognised payload does nothing and still exits 0", async () => {
  const home = makeHome();
  for (const input of ["", "{not json", JSON.stringify({ tool_name: "Bash" })]) {
    const r = spawnSync(process.execPath, [CLI, "note-skill"], {
      input,
      encoding: "utf8",
      env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir },
    });
    assert.equal(r.status, 0, `input ${JSON.stringify(input)} exited ${r.status}`);
    assert.equal(r.stderr, "");
  }
});

// A subagent's skills belong on that agent's own row, not on line 2. Line 2
// says what is shaping THIS session, and folding four subagents' skills into
// it made the chip a list of things the reader is not doing.
await test("a subagent's skill never reaches the session's own list", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("s1", "artifact-design", { now: NOW });
    appendSkillEvent("s1", "humanizer", { now: NOW, agentId: "agent-a" });
    appendSkillEvent("s1", "code-review", { now: NOW, agentId: "agent-b" });

    assert.deepEqual(readSkillEvents("s1", { now: NOW }), ["artifact-design"]);
    assert.equal(readSkillEventsTrueCount("s1", { now: NOW }), 1, "the count follows the list");
  });
});
