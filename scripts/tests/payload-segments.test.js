import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { abbreviate, formatDuration, getContextTokens, getSessionCost } from "../../src/tokens.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 600, maxHeight: 40 };

const render = (payload, sources = gitSources()) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...WIDE }));

const rich = (over = {}) =>
  fullPayload({
    cwd: "/Users/dev/projects/statusline",
    workspace: { current_dir: "/Users/dev/projects/statusline", project_dir: "/Users/dev/projects/statusline" },
    context_window: {
      used_percentage: 38,
      total_input_tokens: 15500,
      total_output_tokens: 1200,
      context_window_size: 200000,
    },
    cost: {
      total_duration_ms: 3_840_000,
      total_api_duration_ms: 1_320_000,
      total_lines_added: 156,
      total_lines_removed: 23,
    },
    ...over,
  });

// A4 -----------------------------------------------------------------------

await test("session duration renders in hours and minutes, and is absent without it", () => {
  assert.match(render(rich()), /⏳ 1h04m/);
  assert.doesNotMatch(render(fullPayload()), /⏳/);
});

await test("duration degrades rather than showing nonsense", () => {
  assert.equal(formatDuration(-1), null);
  assert.equal(formatDuration("45000"), null);
  assert.equal(formatDuration(undefined), null);
  assert.equal(formatDuration(240000), "4m");
});

// A5 -----------------------------------------------------------------------
//
// The API-time segment was removed on 2026-08-26 for costing width on the
// line that runs out of it first. The payload reader stays, because the
// duration segment beside it uses the same one.

await test("the api figure is read even though nothing shows it", () => {
  assert.equal(getSessionCost(rich()).apiMs, 1_320_000);
  assert.doesNotMatch(render(rich()), /api /, "no segment renders it");
});

// A6 -----------------------------------------------------------------------

await test("lines added and removed render together", () => {
  assert.match(render(rich()), /\+156 −23/);
  assert.doesNotMatch(render(fullPayload()), /\+\d+ −/);
});

await test("a session that only added lines still shows both sides", () => {
  const out = render(rich({ cost: { total_lines_added: 12, total_lines_removed: 0 } }));
  assert.match(out, /\+12 −0/, "zero removed is a fact, not an absence");
});

// A7 and A8 ----------------------------------------------------------------

await test("the token count is read, and no longer shown", () => {
  // A7 was removed on 2026-08-26: the used-of-total figure repeated the
  // window size that A8 shows on its own, on the line with the least room.
  assert.equal(getContextTokens(rich()).used, 16700);
  assert.doesNotMatch(render(rich()), /16\.7k/);
});

await test("the window size renders, so 200k and 1M look different", () => {
  assert.match(render(rich()), /200k window/);
  const big = render(rich({ context_window: { used_percentage: 4, total_input_tokens: 40000, total_output_tokens: 0, context_window_size: 1000000 } }));
  assert.match(big, /1M window/);
});

await test("abbreviation keeps a predictable column count", () => {
  assert.equal(abbreviate(999), "999");
  assert.equal(abbreviate(1000), "1k");
  assert.equal(abbreviate(16742), "16.7k");
  assert.equal(abbreviate(200000), "200k");
  assert.equal(abbreviate(1_000_000), "1M");
  assert.equal(abbreviate(null), null);
});

await test("the window size is absent when the payload omits it", () => {
  assert.doesNotMatch(render(fullPayload()), /window/);
});

// A10 ----------------------------------------------------------------------

await test("the 200k flag renders only when the payload sets it", () => {
  assert.doesNotMatch(render(rich()), /⚠ 200k/);
  assert.match(render(rich({ exceeds_200k_tokens: true })), /⚠ 200k/);
});

await test("getContextTokens reads only what the payload sent", () => {
  assert.deepEqual(getContextTokens({}), {
    input: null,
    output: null,
    used: null,
    size: null,
    exceeds200k: false,
  });
  const partial = getContextTokens({ context_window: { total_input_tokens: 100 } });
  assert.equal(partial.used, 100, "output missing is not the same as input missing");
});

// A14 ----------------------------------------------------------------------

await test("an agent name renders with its marker", () => {
  assert.match(render(rich({ agent: { name: "security-reviewer" } })), /⚙ security-reviewer/);
  assert.doesNotMatch(render(rich()), /⚙/);
});

// A15 ----------------------------------------------------------------------

await test("a session name renders in full", () => {
  assert.match(render(rich({ session_name: "refactor-auth" })), /refactor-auth/);
  assert.doesNotMatch(render(rich()), /refactor-auth/);
});

// A17 ----------------------------------------------------------------------

await test("the project directory renders only when it differs from the working one", () => {
  assert.doesNotMatch(render(rich()), /←/, "same directory, nothing to say");

  const moved = render(
    rich({
      cwd: "/Users/dev/projects/statusline/src",
      workspace: {
        current_dir: "/Users/dev/projects/statusline/src",
        project_dir: "/Users/dev/projects/statusline",
      },
    })
  );
  assert.match(moved, /📁 src/);
  assert.match(moved, /← statusline/);
});

// A19 ----------------------------------------------------------------------

await test("a worktree renders its name and where it came from", () => {
  const wt = render(
    rich({ worktree: { name: "my-feature", branch: "worktree-my-feature", original_branch: "main" } })
  );
  assert.match(wt, /my-feature ← main/);
});

await test("a linked worktree outside a worktree session still names itself", () => {
  // `workspace.git_worktree` is populated for any git worktree; `worktree.*`
  // only inside a worktree session. The bar should say so either way.
  const wt = render(rich({ workspace: { current_dir: "/x", git_worktree: "feature-xyz" } }));
  assert.match(wt, /feature-xyz/);
  assert.doesNotMatch(wt, /feature-xyz ←/, "with no original branch there is no arrow");
});

await test("no worktree, no segment", () => {
  assert.doesNotMatch(render(rich()), /←/);
});

// Cross-cutting ------------------------------------------------------------

await test("every new segment is absent outside a session that carries it", () => {
  const bare = render({}, emptySources);
  for (const marker of [/⏳/, /api /, /\+\d+ −/, /window/, /⚠ 200k/, /⚙ /]) {
    assert.doesNotMatch(bare, marker, `${marker} rendered with nothing to render from`);
  }
});

await test("getSessionCost keeps absent and zero apart", () => {
  assert.deepEqual(getSessionCost({}), {
    durationMs: null,
    apiMs: null,
    linesAdded: null,
    linesRemoved: null,
  });
  assert.equal(getSessionCost({ cost: { total_lines_added: 0 } }).linesAdded, 0);
});
