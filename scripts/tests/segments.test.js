import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { MAX_AGE_MS } from "../../src/freshness.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");
const render = (payload, sources, extra = {}) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...extra }));

const everything = {
  ...gitSources({ ahead: 1, behind: 2, changed: 3, untracked: 4 }),
  getRemoteUrl: () => "https://github.com/owner/repo",
  getPrInfo: () => ({ number: 12, state: "OPEN", isDraft: false, url: "https://github.com/owner/repo/pull/12" }),
  getActiveSkills: () => ["alpha", "beta"],
  getRtkSavings: () => 63,
  getDirUrl: () => "file:///tmp/project",
};

const payload = fullPayload({
  cwd: "/tmp/project",
  output_style: { name: "explanatory" },
  context_window: { used_percentage: 26 },
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: Math.floor(NOW / 1000) + 3600 },
    seven_day: { used_percentage: 77, resets_at: Math.floor(NOW / 1000) + 3 * 86400 },
  },
});

// Present, absent and degraded for each of the fifteen segment keys
// (SC-005). "Degraded" is whatever the segment does when its source
// answers with something unusable rather than nothing at all.

await test("dir: present, and never blank at a filesystem root", () => {
  assert.match(render(payload, everything), /project/);
  assert.match(render({ cwd: "/" }, emptySources), /📁 \S/, "the root must have a visible label");
});

await test("branch: present with a repository, absent without one", () => {
  assert.match(render(payload, everything), /main/);
  assert.doesNotMatch(render({}, emptySources), /main/);
});

await test("branch degraded: a detached HEAD shows a commit, not a branch name", () => {
  const detached = render(
    {},
    { ...everything, getGitInfo: () => ({ branch: "abc1234", detached: true, oid: "abc1234def", upstream: null, ahead: null, behind: null, changed: 0, untracked: 0 }) }
  );
  assert.match(detached, /abc1234/);
  assert.doesNotMatch(detached, /\u{F418}/u, "the branch icon must not label a commit");
});

await test("worktree: counts present when dirty, absent when clean", () => {
  assert.match(render(payload, everything), /3/);
  const clean = render(payload, { ...gitSources(), getRemoteUrl: () => null, getPrInfo: () => null, getActiveSkills: () => [], getRtkSavings: () => null, getDirUrl: () => null });
  assert.doesNotMatch(clean, /\u{F459}|\u{F457}/u, "a clean tree adds no counters");
});

await test("upstream: divergence shown when tracking, absent when there is none", () => {
  assert.match(render(payload, everything), /\u{F40A} 1/u);
  const noUpstream = render(
    {},
    { ...everything, getGitInfo: () => ({ branch: "solo", detached: false, oid: "x", upstream: null, ahead: null, behind: null, changed: 0, untracked: 0 }) }
  );
  assert.match(noUpstream, /solo/);
  assert.doesNotMatch(noUpstream, /\u{F40A}|\u{F409}/u, "no upstream means no divergence counters");
});

await test("pr: present when open, absent when there is none, absent when stale", () => {
  assert.match(render(payload, everything), /PR #12 open/);
  assert.doesNotMatch(render(payload, { ...everything, getPrInfo: () => null }), /PR #/);

  // Degraded: a value older than its maximum age is not shown at all,
  // rather than shown as though it were current.
  const stale = stripAnsi(
    renderPayload(payload, {
      sources: everything,
      trackChanges: false,
      now: NOW,
      // The reading is built at `now`; asking about a moment past the
      // maximum age is the same as holding a value that old.
    })
  );
  assert.match(stale, /PR #12/);
  assert.ok(MAX_AGE_MS.pr > 0);
});

await test("pr degraded: a draft says draft rather than open", () => {
  const draft = render(payload, {
    ...everything,
    getPrInfo: () => ({ number: 9, state: "OPEN", isDraft: true, url: "https://x/y/pull/9" }),
  });
  assert.match(draft, /PR #9 draft/);
});

await test("skills: chips present, line absent when none, count when truncated", () => {
  assert.match(render(payload, everything), /alpha/);

  const none = render(payload, { ...everything, getActiveSkills: () => [] });
  assert.doesNotMatch(none, /🧩/);
  assert.equal(none.split("\n").length, 3, "no skills means three lines, not an empty one");

  const many = render(payload, {
    ...everything,
    getActiveSkills: () => ["a", "b", "c", "d", "e"],
  });
  assert.match(many, /\+2 more/, "the ones left out must be counted, not hidden");
});

await test("model: present from the payload, falls back to a name rather than nothing", () => {
  assert.match(render(payload, everything), /Sonnet 5/);
  assert.match(render({}, emptySources), /Claude/);
  assert.match(render({ model: { id: "claude-opus-5" } }, emptySources), /claude-opus-5/);
});

await test("effort: present with a level, absent without one", () => {
  assert.match(render(payload, everything), /⚡ high/);
  assert.doesNotMatch(render({ model: { display_name: "M" } }, emptySources), /⚡/);
});

await test("outputStyle: present when set, absent when default or missing", () => {
  assert.match(render(payload, everything), /🎨 explanatory/);
  assert.doesNotMatch(render({ output_style: { name: "default" } }, emptySources), /🎨/);
  assert.doesNotMatch(render({}, emptySources), /🎨/);
});

await test("context, fiveHour, sevenDay: present, and ?% rather than absent", () => {
  const full = render(payload, everything);
  assert.match(full, /Context [░█▓▒]* ?26%/);
  assert.match(full, /5h 20%/);
  assert.match(full, /7d 77%/);

  const empty = render({}, emptySources);
  assert.match(empty, /Context [░█▓▒]* ?\?%/);
  assert.match(empty, /5h \?%/);
  assert.match(empty, /7d \?%/);
});

await test("resetMerged: both countdowns in one segment, absent when unknown", () => {
  // C6 merged them. The face is the sooner of the two windows, and the two
  // countdowns render side by side without repeating the word "resets".
  const full = render(payload, everything);
  assert.match(full, /1h00m \/ 3d/);
  const empty = render({}, emptySources);
  assert.doesNotMatch(empty, /\d+h\d+m/, "no countdown without a reset time");
});

await test("rtk: present when installed, absent when not", () => {
  assert.match(render(payload, everything), /rtk 63% saved/);
  assert.doesNotMatch(render(payload, { ...everything, getRtkSavings: () => null }), /rtk/);
});

await test("remote: a branch links to the tree view only when there is a remote", () => {
  const withRemote = renderPayload(payload, { sources: everything, trackChanges: false, now: NOW });
  assert.match(withRemote, /github\.com\/owner\/repo\/tree\/main/);

  const without = renderPayload(payload, {
    sources: { ...everything, getRemoteUrl: () => null },
    trackChanges: false,
    now: NOW,
  });
  assert.doesNotMatch(without, /tree\//);
});
