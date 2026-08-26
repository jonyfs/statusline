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
    });
    for (const [i, line] of stripAnsi(out).split("\n").entries()) {
      const width = displayWidth(line);
      assert.ok(width <= LIMIT, `line ${i + 1} is ${width} columns: ${JSON.stringify(line)}`);
    }
  });
}

await test("the trim order follows data-model.md, step by step", () => {
  // Line 4's widest realistic form is 117 columns, so the guard normally
  // never fires. Narrowing the limit is how the order gets exercised
  // without inventing content no session would produce.
  const line4At = (maxWidth) =>
    stripAnsi(
      renderPayload(widestPayload, { sources: widest, trackChanges: false, now: NOW, maxWidth })
    )
      .split("\n")
      .pop();

  const untouched = line4At(200);
  assert.match(untouched, /7d 100% ·/, "with room, the named moment stays");
  assert.match(untouched, /rtk/);

  // Step 1: the named moment, which the countdown beside it conveys anyway.
  const step1 = line4At(displayWidth(untouched) - 1);
  assert.doesNotMatch(step1, /7d 100% ·/);
  assert.match(step1, /resets in 1h00m/, "a countdown outlives the named moment");

  // Steps 2 and 3: the countdown text, keeping the clock faces. Step 4:
  // the savings figure, the only thing on the line not about this session.
  const step4 = line4At(60);
  assert.doesNotMatch(step4, /resets in/);
  assert.doesNotMatch(step4, /rtk/);
  assert.match(step4, /Context 100%/, "usage figures are never what gets dropped");
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
    renderPayload({ cwd: long }, { sources: gitSources(), trackChanges: false, now: NOW })
  );
  const line1 = out.split("\n")[0];
  assert.ok(displayWidth(line1) <= LIMIT, `line 1 is ${displayWidth(line1)} columns`);
});
