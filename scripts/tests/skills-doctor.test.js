import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { buildReport } from "../../src/doctor.js";
import { appendSkillEvent } from "../../src/skillEvents.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WINDOW_MS = 30 * 60 * 1000;

const probe = { ...gitSources(), getActiveSkills: () => [], getDirUrl: () => null };

// FR-005 (User Story 3): doctor reports whether the hook or the transcript
// fallback answered.
await test("doctor reports the hook as the tracking source when it has data", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("doctor-session", "speckit-plan", { now: NOW });
    const payload = fullPayload({ session_id: "doctor-session" });
    const report = buildReport(payload, {
      now: NOW,
      live: false,
      probe: { ...probe, getActiveSkills: () => ["speckit-plan"] },
    });
    const skillsRow = report.segments.find((s) => s.key === "skills");
    assert.equal(skillsRow.tracking.source, "hook");
  });
});

await test("doctor reports the transcript fallback when there is no hook data", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const payload = fullPayload({ session_id: "no-hook-session" });
    const report = buildReport(payload, { now: NOW, live: false, probe });
    const skillsRow = report.segments.find((s) => s.key === "skills");
    assert.equal(skillsRow.tracking.source, "transcript fallback");
  });
});

// FR-004: a skill that expired from the window is distinguished from one
// that was never used at all.
await test("doctor names an expired skill and when it was last seen", async () => {
  const home = makeHome();
  await withHome(home, () => {
    appendSkillEvent("expired-session", "speckit-tasks", { now: NOW - WINDOW_MS - 60_000 });
    const payload = fullPayload({ session_id: "expired-session" });
    const report = buildReport(payload, { now: NOW, live: false, probe });
    const skillsRow = report.segments.find((s) => s.key === "skills");
    assert.equal(skillsRow.tracking.lastSeen.skill, "speckit-tasks");
    assert.equal(skillsRow.tracking.lastSeen.expired, true);
    assert.match(skillsRow.reason, /speckit-tasks expired, last seen/);
  });
});

await test("doctor reports nothing to explain when no skill was ever used", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const payload = fullPayload({ session_id: "never-used-session" });
    const report = buildReport(payload, { now: NOW, live: false, probe });
    const skillsRow = report.segments.find((s) => s.key === "skills");
    assert.equal(skillsRow.tracking.lastSeen, null);
  });
});

// A truncated scan means the true count is itself an estimate; doctor must
// carry that signal rather than silently reporting an undercount as a
// settled fact. `getActiveSkillsDetailed`'s own `truncated` flag (already
// covered directly by transcript-tail.test.js's byte-cap case) is what
// this field rides on; here we confirm doctor surfaces it either way.
await test("doctor's skills tracking always carries a truncated flag", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const payload = fullPayload({ session_id: "clean-scan-session" });
    const report = buildReport(payload, { now: NOW, live: false, probe });
    const skillsRow = report.segments.find((s) => s.key === "skills");
    assert.equal(typeof skillsRow.tracking.truncated, "boolean");
    assert.equal(skillsRow.tracking.truncated, false, "a small, complete scan is not truncated");
  });
});
