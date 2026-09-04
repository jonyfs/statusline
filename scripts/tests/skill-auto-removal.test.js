import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { getActiveSkills, windowMs } from "../../src/skills.js";
import { appendSkillEvent, readSkillEvents } from "../../src/skillEvents.js";
import { makeHome, withHome } from "./fixtures/home.js";

const tmpFile = (name = "t.jsonl") => path.join(mkdtempSync(path.join(os.tmpdir(), "skill-removal-")), name);

const entry = (ts, skill) =>
  JSON.stringify({
    type: "assistant",
    timestamp: ts,
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
  });

// FR-002: both detection paths share the same window.
await test("the hook path and the transcript path apply the same window", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const w = windowMs();

    appendSkillEvent("parity-session", "boundary-skill", { now: now - w - 1000 });
    const viaHook = readSkillEvents("parity-session", { limit: 5, now });
    assert.deepEqual(viaHook, [], "just past the window, the hook path drops it");

    const file = tmpFile();
    writeFileSync(file, entry(new Date(now - w - 1000).toISOString(), "boundary-skill") + "\n");
    const viaTranscript = getActiveSkills(file, 5, { now });
    assert.deepEqual(viaTranscript, [], "just past the same window, the transcript path drops it too");
  });
});

// FR-001/FR-005/FR-006 (User Story 1): a skill invoked once, then not
// re-invoked, is present before the window elapses and absent after, with
// no restart or manual step.
await test("a skill invoked once disappears once the window elapses, no action needed", () => {
  const w = windowMs();
  const invokedAt = Date.parse("2026-01-01T12:00:00.000Z");
  const file = tmpFile();
  writeFileSync(file, entry(new Date(invokedAt).toISOString(), "one-shot-skill") + "\n");

  assert.deepEqual(getActiveSkills(file, 5, { now: invokedAt + w - 1000 }), ["one-shot-skill"]);
  assert.deepEqual(getActiveSkills(file, 5, { now: invokedAt + w + 1000 }), []);
});

// Acceptance Scenario 2: repeated use within the window keeps a skill shown.
await test("a repeatedly invoked skill stays shown across renders", () => {
  const w = windowMs();
  const start = Date.parse("2026-01-01T12:00:00.000Z");
  const file = tmpFile();
  writeFileSync(
    file,
    [entry(new Date(start).toISOString(), "sticky-skill"), entry(new Date(start + w / 2).toISOString(), "sticky-skill")].join(
      "\n"
    ) + "\n"
  );

  assert.deepEqual(getActiveSkills(file, 5, { now: start + w }), ["sticky-skill"], "re-invoked, still within a fresh window");
});

// FR-003 (User Story 2): the delay is configurable.
await test("CLAUDE_STATUSLINE_SKILL_WINDOW_MIN moves the boundary", () => {
  const prev = process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN;
  try {
    process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = "60";
    assert.equal(windowMs(), 60 * 60 * 1000);

    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const file = tmpFile();
    writeFileSync(file, entry(new Date(now - 45 * 60 * 1000).toISOString(), "long-window-skill") + "\n");
    assert.deepEqual(
      getActiveSkills(file, 5, { now }),
      ["long-window-skill"],
      "45 minutes old still counts as active under a 60-minute window"
    );
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN;
    else process.env.CLAUDE_STATUSLINE_SKILL_WINDOW_MIN = prev;
  }
});

// FR-004 (User Story 3): each skill's expiry depends only on its own last use.
await test("one skill's staleness does not affect a fresh, unrelated skill", () => {
  const w = windowMs();
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const file = tmpFile();
  writeFileSync(
    file,
    [entry(new Date(now - w - 1000).toISOString(), "stale-skill"), entry(new Date(now).toISOString(), "fresh-skill")].join(
      "\n"
    ) + "\n"
  );

  const active = getActiveSkills(file, 5, { now });
  assert.deepEqual(active, ["fresh-skill"], "only the fresh skill is shown, the stale one is gone");
});

// Edge case: no further session activity at all still expires the skill.
await test("a skill invoked once with no further session activity still expires", () => {
  const w = windowMs();
  const invokedAt = Date.parse("2026-01-01T12:00:00.000Z");
  const file = tmpFile();
  writeFileSync(file, entry(new Date(invokedAt).toISOString(), "lonely-skill") + "\n");

  assert.deepEqual(getActiveSkills(file, 5, { now: invokedAt + w + 60_000 }), []);
});
