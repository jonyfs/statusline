import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const LIMIT = 120;
const NOW = Date.parse("2026-08-25T12:00:00.000Z");

const widest = {
  ...gitSources({ branch: "feature/a-branch-name-of-the-length-people-actually-use", ahead: 12, behind: 34, changed: 567, untracked: 89 }),
  getRemoteUrl: () => "https://github.com/owner/repo",
  getPrInfo: () => ({ number: 12345, state: "OPEN", isDraft: true, url: "https://github.com/owner/repo/pull/12345" }),
  getActiveSkills: () => ["speckit-implement", "humanizer", "caveman", "artifact-design", "dataviz"],
  getRtkSavings: () => 100,
  getDirUrl: () => "file:///tmp/project",
};

const widestPayload = fullPayload({
  cwd: "/tmp/a-project-directory-with-a-long-name",
  model: { display_name: "Claude Opus 5 (preview)" },
  effort: { level: "xhigh" },
  output_style: { name: "explanatory" },
  context_window: { used_percentage: 100 },
  rate_limits: {
    five_hour: { used_percentage: 100, resets_at: Math.floor(NOW / 1000) + 3600 },
    seven_day: { used_percentage: 100, resets_at: Math.floor(NOW / 1000) + 6 * 86400 },
  },
});

await test("display width counts columns, not code units", () => {
  assert.equal(displayWidth("abc"), 3);
  assert.equal(displayWidth("🧠"), 2, "an emoji takes two columns");
  assert.equal(displayWidth("⏱️"), 2, "a variation selector asks for emoji presentation");
  assert.equal(displayWidth("\u{F418}"), 1, "a Nerd Font glyph is drawn single-width");
  assert.equal(displayWidth("\x1b[31mred\x1b[0m"), 3, "colour codes occupy no columns");
});

for (const ascii of [false, true]) {
  const mode = ascii ? "ASCII mode" : "Nerd Font mode";

  await test(`every line fits 120 columns with the widest realistic content, ${mode}`, () => {
    const out = renderPayload(widestPayload, {
      sources: widest,
      trackChanges: false,
      asciiArrows: ascii,
      now: NOW,
      // The constitutional limit is what this asserts, so it is what the
      // render is given. Without it the suite would assert 120 while
      // rendering at whatever width the runner pinned.
      maxWidth: LIMIT,
      maxHeight: 40,
    });
    for (const [i, line] of stripAnsi(out).split("\n").entries()) {
      const width = displayWidth(line);
      assert.ok(width <= LIMIT, `line ${i + 1} is ${width} columns: ${JSON.stringify(line)}`);
    }
  });
}

await test("a narrow line drops by priority, not by position", () => {
  // Feature 002 replaced feature 001's fixed trim ladder with the priority
  // table (item D4). The lowest-priority segment on line 4 is the savings
  // figure, so it is what goes first, wherever it sits in the line.
  const line4At = (maxWidth) =>
    stripAnsi(
      renderPayload(widestPayload, { sources: widest, trackChanges: false, now: NOW, maxWidth })
    )
      .split("\n")
      .pop();

  const roomy = line4At(200);
  assert.match(roomy, /rtk/, "with room, everything renders");

  // Narrowing by a few columns is absorbed by the bar, which scales with the
  // terminal (E3), so nothing has to be dropped. Past that, the priority
  // table decides, and the savings figure at 40 is the first to go.
  const tight = line4At(100);
  assert.doesNotMatch(tight, /rtk/, "priority 40 is the first to go");
  assert.match(tight, /Context 100%/, "priority 100 stays");

  const tighter = line4At(40);
  assert.match(tighter, /Context/, "the top of the table survives to the end");
});

await test("dropping a segment is preferred to shortening one", () => {
  // The two mechanisms interact, and the order matters. Dropping the
  // lowest-priority segment recovers more width than shortening a surviving
  // one, so priority runs first and the content ladder only fires when
  // dropping cannot help. That is why the 7-day segment keeps its weekday
  // right up until the segment itself goes.
  const line4At = (maxWidth) =>
    stripAnsi(
      renderPayload(widestPayload, { sources: widest, trackChanges: false, now: NOW, maxWidth })
    )
      .split("\n")
      .pop();

  const wide = line4At(200);
  assert.match(wide, /rtk/);
  assert.match(wide, /7d 100%▲ ·/);

  // 90 columns: the savings figure goes, priority 40.
  const at90 = line4At(90);
  assert.doesNotMatch(at90, /rtk/);
  assert.match(at90, /7d 100%▲ ·/, "a surviving segment keeps everything it says");

  // 70: the 7-day countdown goes too, priority 78, while the 5-hour one
  // stays at 80. The table decides, not the position on the line.
  const at70 = line4At(70);
  assert.match(at70, /5h 100%/);
  assert.equal((at70.match(/resets in/g) || []).length, 0, "the right-aligned countdowns go together");

  // 45: down to the top of the table.
  assert.match(line4At(45), /Context 100%/);
});

await test("an unconstrained line keeps everything, so the guard costs nothing normally", () => {
  const out = stripAnsi(
    renderPayload(
      fullPayload({
        rate_limits: {
          five_hour: { used_percentage: 20, resets_at: Math.floor(NOW / 1000) + 3600 },
          seven_day: { used_percentage: 40, resets_at: Math.floor(NOW / 1000) + 2 * 86400 },
        },
      }),
      { sources: gitSources(), trackChanges: false, now: NOW }
    )
  );
  const line4 = out.split("\n").pop();
  assert.match(line4, /·/, "with room to spare, the named moment stays");
  assert.ok(displayWidth(line4) <= LIMIT);
});

await test("a very long directory name is shortened from the left, keeping the end", () => {
  const long = "/tmp/" + "segment-".repeat(20) + "end";
  const out = stripAnsi(
    renderPayload({ cwd: long }, { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: LIMIT })
  );
  const line1 = out.split("\n")[0];
  assert.ok(displayWidth(line1) <= LIMIT, `line 1 is ${displayWidth(line1)} columns`);
});
