import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload } from "../../src/render.js";
import { trackChanges } from "../../src/changeTracker.js";
import { getSessionActivity } from "../../src/skills.js";
import { SEGMENTS } from "../../src/segments.js";
import { unavailableChip } from "../../src/unavailable.js";
import { getPrLookupFailed } from "../../src/git.js";
import { PAYLOAD, SOURCES } from "../composer-fixture.js";

const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };
const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const NOW = 1_787_000_000_000;
const line = (stamp, entry) => JSON.stringify({ timestamp: new Date(stamp).toISOString(), ...entry });
const transcript = (entries) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sf-"));
  const file = path.join(dir, "t.jsonl");
  writeFileSync(file, entries.join("\n") + "\n");
  return file;
};
const draw = (activity, extra = {}) =>
  strip(
    renderPayload(PAYLOAD, {
      sources: { ...SOURCES, getSessionActivity: () => activity },
      trackChanges: false,
      layout: NO_ARRANGEMENT,
      maxWidth: 400,
      maxHeight: 40,
      ...extra,
    })
  );

await test("the spinner advances one frame a redraw, on the session's counter", () => {
  const id = `spin-${process.pid}`;
  const frames = [];
  for (let i = 0; i < 6; i++) frames.push(trackChanges(id, { branch: "main" }, { now: NOW + i * 7 }).frame);
  assert.deepEqual(frames.slice(0, 4), [0, 1, 2, 3]);
  assert.deepEqual(frames.slice(4), [0, 1], "and it repeats");
  const withNow = trackChanges(id, { branch: "main" }, { now: NOW - 99999 }).frame;
  assert.equal(withNow, 2, "the clock does not choose the frame");
});

await test("the working chip shows the frame of its redraw", () => {
  const F = [GLYPHS.nerd.workingFrame0, GLYPHS.nerd.workingFrame1, GLYPHS.nerd.workingFrame2, GLYPHS.nerd.workingFrame3];
  assert.deepEqual(F, ["\u{EE06}", "\u{EE07}", "\u{EE09}", "\u{EE0A}"]);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => i),
    [0, 1, 2, 3]
  );
  const out = draw({ working: true, background: { shells: 0, agents: 0 }, todos: null, skills: [] });
  assert.ok(F.some((f) => out.includes(`${f} working`)), "a spinner frame precedes working");
});

await test("the plain tier spins in ASCII and the emoji tier holds still", () => {
  assert.deepEqual(
    [GLYPHS.plain.workingFrame0, GLYPHS.plain.workingFrame1, GLYPHS.plain.workingFrame2, GLYPHS.plain.workingFrame3],
    ["|", "/", "-", "\\"]
  );
  assert.equal(new Set([0, 1, 2, 3].map((i) => GLYPHS.emoji[`workingFrame${i}`])).size, 1);
});

await test("idle is a coffee cup for five minutes, then sleeping, and line 2 goes quiet", () => {
  const idleFor = (ms) => ({ working: false, background: { shells: 0, agents: 0 }, todos: null, skills: ["speckit-plan"], idleMs: ms });
  assert.ok(draw(idleFor(2 * 60_000)).includes(`${GLYPHS.nerd.idle} idle`));
  assert.ok(draw(idleFor(6 * 60_000)).includes(`${GLYPHS.nerd.sleeping} sleeping`));
  assert.ok(draw({ ...idleFor(null) }).includes(`${GLYPHS.nerd.idle} idle`), "no known clock is idle, not sleeping");
});

await test("a question nobody answered is your turn, and an answered one is not", () => {
  const ask = line(NOW - 60_000, {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "t1", name: "AskUserQuestion", input: {} }] },
  });
  const answer = line(NOW - 30_000, {
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "yes" }] },
  });
  assert.equal(getSessionActivity(transcript([ask]), { now: NOW }).awaiting, true);
  assert.equal(getSessionActivity(transcript([ask, answer]), { now: NOW }).awaiting, false);
  const bash = line(NOW - 60_000, {
    type: "assistant",
    message: { content: [{ type: "tool_use", id: "t2", name: "Bash", input: {} }] },
  });
  assert.equal(getSessionActivity(transcript([bash]), { now: NOW }).awaiting, false, "a running tool is not a question");
  const out = draw({ working: true, awaiting: true, background: { shells: 0, agents: 0 }, todos: null, skills: [] });
  assert.ok(out.includes(`${GLYPHS.nerd.yourTurn} your turn`));
  assert.ok(!/working/.test(out.split("\n")[1] ?? ""), "the working chip gives way");
});

await test("each highlight lasts as long as it matters", () => {
  const holds = (key, snapA, snapB, seconds) => {
    const id = `hold-${key}-${process.pid}-${seconds}`;
    trackChanges(id, snapA, { now: NOW });
    trackChanges(id, snapB, { now: NOW + 1000 });
    return trackChanges(id, snapB, { now: NOW + 1000 + seconds * 1000 }).isChanged(key);
  };
  assert.equal(holds("branch", { branch: "a" }, { branch: "b" }, 9), true);
  assert.equal(holds("branch", { branch: "a" }, { branch: "b" }, 11), false);
  assert.equal(holds("model", { model: "a" }, { model: "b" }, 11), false);
  assert.equal(holds("pr", { pr: "1" }, { pr: "2" }, 119), true);
  assert.equal(holds("pr", { pr: "1" }, { pr: "2" }, 121), false);
  assert.equal(holds("ci", { ci: "a" }, { ci: "b" }, 119), true);
  assert.equal(holds("skills", { skills: "a" }, { skills: "b" }, 29), true);
  assert.equal(holds("skills", { skills: "a" }, { skills: "b" }, 31), false);
});

await test("the update chip is its icon, and the failure chip is a neutral chip with its own icon", () => {
  const out = strip(
    renderPayload(PAYLOAD, {
      sources: { ...SOURCES, getUpdateNotice: () => ({ state: "updated", text: "statusline updated · 1 feature", firstShowing: true }) },
      trackChanges: false,
      layout: NO_ARRANGEMENT,
      maxWidth: 300,
      maxHeight: 40,
    })
  );
  assert.ok(out.includes(GLYPHS.nerd.updateDone));
  assert.ok(!/statusline updated/.test(out), "the words are in doctor");
  assert.equal(GLYPHS.nerd.updateDone, "\u{F12CC}");
  const chip = unavailableChip({});
  assert.ok(chip.includes("\u{F00E8}") && chip.includes("statusline unavailable") && chip.includes("\x1b[48;2;"));
  assert.ok(!/\x1b/.test(unavailableChip({ NO_COLOR: "1" })), "no colour when asked");
  assert.ok(unavailableChip({ CLAUDE_STATUSLINE_ASCII: "1" }).includes("! statusline unavailable"));
});

await test("conflicts outlast the model and the other chips on line 1", () => {
  const conflicts = SEGMENTS.find((s) => s.key === "conflicts");
  assert.equal(conflicts.priority, 99);
  assert.ok(conflicts.priority > SEGMENTS.find((s) => s.key === "model").priority);
  assert.ok(conflicts.priority > SEGMENTS.find((s) => s.key === "branch").priority);
});

await test("a failed pull request lookup is a marker that expires", () => {
  assert.equal(getPrLookupFailed("/does/not/exist/for/state-feedback", { now: NOW }), false);
});

await test("allow-all is bold and a clean tree is confirmed", () => {
  const raw = renderPayload(PAYLOAD, { sources: SOURCES, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 400, maxHeight: 40 });
  assert.ok(raw.includes("\x1b[1m"));
  const cleanSources = {
    ...SOURCES,
    getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0, conflicts: 0 }),
  };
  const out = strip(renderPayload(PAYLOAD, { sources: cleanSources, trackChanges: false, layout: NO_ARRANGEMENT, maxWidth: 400, maxHeight: 40 }));
  assert.ok(out.includes(GLYPHS.nerd.clean), "the green tick follows the branch");
});
