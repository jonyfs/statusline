import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

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

  // Line 4 has lost enough segments that it fits inside 100 columns on its
  // own, so the priority table only gets to decide below that.
  const tight = line4At(70);
  assert.doesNotMatch(tight, /rtk/, "priority 40 is the first to go");
  assert.match(tight, /Context 100%/, "priority 100 stays");

  const tighter = line4At(40);
  assert.match(tighter, /Context/, "the top of the table survives to the end");
});

await test("dropping a segment is preferred to shortening one", () => {
  // The two mechanisms interact, and the order matters. Dropping the
  // lowest-priority segment recovers more width than shortening a surviving
  // one, so priority runs first and the content ladder only fires when
  // dropping cannot help.
  //
  // This fixture is deliberately pathological: a branch name nobody would
  // type, five skills and a spelled-out model. Line 1 cannot fit at any of
  // these widths, and the trim ladder is global, so it keeps escalating past
  // what line 3 alone would have needed. That is the shape being pinned —
  // what survives is decided by the table, not by position.
  const lastLineAt = (maxWidth) =>
    stripAnsi(
      renderPayload(widestPayload, { sources: widest, trackChanges: false, now: NOW, maxWidth })
    )
      .split("\n")
      .pop();

  const wide = lastLineAt(200);
  assert.match(wide, /rtk/, "with room, the savings figure is there");
  assert.match(wide, /Claude Opus 5/, "and so is the model, since the merge of 2026-09-07");
  assert.match(wide, /7d 100%▲ ·/);

  // Narrower: the savings figure goes, then the reset text, then the effort.
  // The three levels never go — they are what the line is for — and neither
  // does the model, which says what is spending them.
  for (const width of [100, 80, 60]) {
    const line = lastLineAt(width);
    assert.match(line, /Claude Opus 5/, `the model survives at ${width}`);
    assert.match(line, /Context 100%/, `the context figure survives at ${width}`);
    assert.match(line, /5h 100%▲/, `the nearest limit survives at ${width}`);
    assert.equal((line.match(/resets in/g) || []).length, 0, "the words stay off the line");
  }

  // 45: down to the top of the table.
  assert.match(lastLineAt(45), /Context 100%/);
});

// The savings figure was the lowest priority on the bar and the first thing
// any narrow line gave up. The owner asked for it to survive the merge, so it
// now outranks the session duration, the projection and the burn rate — all
// three derived from figures that stay on the line.
await test("the savings figure outlives what is derived from the line", () => {
  const line = stripAnsi(
    renderPayload(
      fullPayload({
        model: { display_name: "Opus 5" },
        context_window: { used_percentage: 50 },
        rate_limits: {
          five_hour: { used_percentage: 50, resets_at: Math.floor(NOW / 1000) + 3600 },
          seven_day: { used_percentage: 50, resets_at: Math.floor(NOW / 1000) + 3 * 86400 },
        },
      }),
      { sources: { ...widest, getActiveSkills: () => [] }, trackChanges: false, now: NOW, maxWidth: 120 }
    )
  )
    .split("\n")
    .pop();
  assert.match(line, /rtk/, "the savings figure is kept at 120 columns");
  assert.doesNotMatch(line, /\dh\d\dm\s*$/, "the session duration went first");
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

await test("a directory name of wide characters is cut by columns, not by characters", () => {
  // Each of these draws two columns. Counting them as one cut half of what
  // was needed and left the line over the limit anyway.
  const wide = "統計行状態表示器の作業ディレクトリ";
  const out = stripAnsi(
    renderPayload(fullPayload({ cwd: `/tmp/${wide}` }), {
      sources: emptySources,
      trackChanges: false,
      maxWidth: 24,
      maxHeight: 40,
    })
  );
  const line1 = out.split("\n")[0];
  assert.ok(line1.includes("…"), "the label was shortened");
  assert.ok(displayWidth(line1) <= 24, `line 1 is ${displayWidth(line1)} columns`);
});
