/**
 * Every segment can say what it means.
 *
 * A terminal cannot raise a tooltip: the statusline is printed once by a
 * process that exits, and nothing is listening when a pointer moves. OSC 8 is
 * the closest thing that exists — it costs no display columns, and a terminal
 * that previews link targets says something on hover and opens the section on
 * a click (specs/019-explaining-a-segment).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, stripAnsi } from "../test-harness.js";
import { SEGMENTS, SEGMENT_HELP, helpUrlFor, README_URL } from "../../src/segments.js";
import { renderPayload } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

/** The three that point somewhere better than documentation. */
const ALREADY_LINKED = new Set(["dir", "branch", "pr"]);

const draw = (env = {}) => {
  const previous = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return renderPayload(
      fullPayload({ context_window: { used_percentage: 62 } }),
      {
        sources: {
          ...gitSources(),
          // The branch only links when there is a remote to link into.
          getRemoteUrl: () => "https://github.com/jonyfs/statusline",
          getActiveSkills: () => ["humanizer"],
          getActiveSkillsTrueCount: () => 1,
          getSessionActivity: () => ({ skills: ["humanizer"], todos: null, working: true }),
          getRtkSavings: () => 81,
        },
        trackChanges: false,
        now: NOW,
        ...WIDE,
      }
    );
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

// Invariant 1. This is what stops the table drifting from the registry the way
// the README did: a segment added without a link fails here rather than
// shipping as the one thing on the bar that cannot explain itself.
await test("every segment either has its own link or a help link", () => {
  const uncovered = SEGMENTS.map((s) => s.key).filter(
    (key) => !ALREADY_LINKED.has(key) && !SEGMENT_HELP[key]
  );
  assert.deepEqual(uncovered, [], `these segments can say nothing about themselves: ${uncovered}`);
});

// Invariant 2. A renamed heading must fail the suite rather than ship a link
// that lands at the top of an 880-line page.
await test("every anchor in the map is a heading that exists", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const headings = new Set(
    readme
      .split("\n")
      .filter((l) => l.startsWith("## "))
      // GitHub's own slug: lowercase, punctuation dropped, spaces to hyphens.
      .map((l) => "#" + l.slice(3).trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-"))
  );
  for (const anchor of new Set(Object.values(SEGMENT_HELP))) {
    assert.ok(headings.has(anchor), `${anchor} is not a heading in README.md`);
  }
});

await test("a help link points at the public repository", () => {
  assert.equal(helpUrlFor("context"), `${README_URL}#reading-a-level-at-a-glance`);
  assert.equal(helpUrlFor("dir"), null, "a segment with its own target gets none");
});

// Invariant 3. Opening the folder, the branch or the pull request beats
// reading about them.
await test("a segment that already points somewhere keeps its own target", () => {
  const out = draw();
  assert.match(out, /\x1b\]8;;https:\/\/github\.com\/jonyfs\/statusline\/tree\//, "the branch still opens the tree");
  assert.doesNotMatch(
    out,
    /\x1b\]8;;[^\x07]*#git-and-github-status\x07[^\x1b]*main /,
    "the branch was not overwritten with documentation"
  );
});

// Invariant 4. OSC 8 is stripped before the width is counted, so the priority
// table decides exactly what it decided before.
await test("the bar is the same width with the links and without", () => {
  const linked = draw().split("\n").map(stripAnsi);
  const bare = draw({ CLAUDE_STATUSLINE_NO_HELP_LINKS: "1" }).split("\n").map(stripAnsi);
  assert.deepEqual(bare, linked, "the text is identical, so nothing moved");
  for (let i = 0; i < linked.length; i++) {
    assert.equal(displayWidth(linked[i]), displayWidth(bare[i]), `line ${i + 1} changed width`);
  }
});

await test("the switch drops the help links and keeps the real ones", () => {
  const off = draw({ CLAUDE_STATUSLINE_NO_HELP_LINKS: "1" });
  assert.doesNotMatch(off, /#reading-a-level-at-a-glance/, "no documentation link survives");
  assert.match(off, /\/tree\//, "the branch keeps the target it always had");
});
