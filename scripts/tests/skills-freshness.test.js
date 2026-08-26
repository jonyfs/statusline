import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getActiveSkills } from "../../src/skills.js";
import { appendSkillEvent } from "../../src/skillEvents.js";
import { writeTranscript } from "./fixtures/transcript.js";
import { makeHome, withHome } from "./fixtures/home.js";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");

await test("a skill invoked in the last entry is on the next render", () => {
  // SC-003. The transcript path, with no hook involved.
  const transcript = writeTranscript({ sizeBytes: 4 * 1024 * 1024, skills: ["just-used"], now: NOW });
  const skills = getActiveSkills(transcript, 3, { now: NOW });
  assert.deepEqual(skills, ["just-used"]);

  const plain = stripAnsi(
    renderPayload(
      { transcript_path: transcript },
      {
        trackChanges: false,
        sources: {
          getGitInfo: () => null,
          getPrInfo: () => null,
          getRemoteUrl: () => null,
          getRtkSavings: () => null,
          getDirUrl: () => null,
          getActiveSkills: (p) => getActiveSkills(p, 3, { now: NOW }),
        },
      }
    )
  );
  assert.match(plain, /just-used/);
});

await test("a skill outside the window is gone on the next render", () => {
  const transcript = writeTranscript({ sizeBytes: 256 * 1024, skills: ["done-with"], now: NOW });
  assert.deepEqual(getActiveSkills(transcript, 3, { now: NOW + 31 * 60 * 1000 }), []);
});

await test("the activity window is configurable and rejects nonsense", () => {
  const transcript = writeTranscript({ sizeBytes: 128 * 1024, skills: ["windowed"], now: NOW });
  const at = NOW + 45 * 60 * 1000;
  const prev = process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN;
  try {
    process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = "90";
    assert.deepEqual(getActiveSkills(transcript, 3, { now: at }), ["windowed"]);
    // A broken override falls back to the default rather than disabling
    // expiry by accident, which would restore the stale-skill bug.
    process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = "not-a-number";
    assert.deepEqual(getActiveSkills(transcript, 3, { now: at }), []);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN;
    else process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = prev;
  }
});

await test("an entry with no timestamp is still counted", () => {
  // Dropping it would hide a skill that may well be active, which is the
  // worse of the two errors.
  const transcript = writeTranscript({ sizeBytes: 64 * 1024, skills: [], now: NOW });
  appendFileSync(
    transcript,
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "stampless" } }] },
    }) + "\n"
  );
  assert.deepEqual(getActiveSkills(transcript, 3, { now: NOW }), ["stampless"]);
});

await test("the hook path and the transcript path agree on the answer", async () => {
  // FR-019: the hook changes when a skill appears, never which skills do.
  const transcript = writeTranscript({ sizeBytes: 128 * 1024, skills: ["from-transcript"], now: NOW });
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("session-a", "from-hook", { now: NOW });
    const viaHook = getActiveSkills(transcript, 3, { now: NOW, sessionId: "session-a" });
    assert.deepEqual(viaHook, ["from-hook"], "the hook file answers first when it has something");

    const viaTranscript = getActiveSkills(transcript, 3, { now: NOW, sessionId: "session-with-no-events" });
    assert.deepEqual(viaTranscript, ["from-transcript"], "with no hook file, the transcript answers");
  });
});

await test("a malformed hook record is skipped, not treated as end of file", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const { appendFileSync } = await import("node:fs");
    const { sessionFileFor, readSkillEvents } = await import("../../src/skillEvents.js");
    appendSkillEvent("session-b", "good-one", { now: NOW });
    appendFileSync(sessionFileFor("session-b"), "{half a record\n");
    appendSkillEvent("session-b", "after-the-mess", { now: NOW });
    assert.deepEqual(
      readSkillEvents("session-b", { limit: 3, now: NOW }),
      ["after-the-mess", "good-one"],
      "a broken line must not hide the records around it"
    );
  });
});
