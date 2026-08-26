import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { emptySources } from "./fixtures/sources.js";

const BUDGET_MS = 300;

function sleepSync(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // A source that hangs does exactly this to the process that waits on
    // it, which is the situation being tested.
  }
}

await test("a hanging pull request lookup cannot hold up the redraw", () => {
  // The real defence is that `gh` is never called during a redraw at all.
  // This asserts the renderer's own behaviour if a source misbehaves
  // anyway: the line still comes out, without that segment.
  const started = Date.now();
  const out = renderPayload(
    { context_window: { used_percentage: 10 } },
    {
      trackChanges: false,
      sources: {
        ...emptySources,
        getPrInfo: () => {
          sleepSync(50);
          return null;
        },
      },
    }
  );
  const took = Date.now() - started;
  assert.ok(took < BUDGET_MS * 3, `render took ${took} ms with a slow source`);
  assert.doesNotMatch(stripAnsi(out), /PR #/, "no pull request means no segment");
});

await test("an unauthenticated gh is an absent segment, not a wrong one", () => {
  // `gh pr view` exits non-zero with an auth error. That is a failure to
  // read, not a pull request that does not exist, and either way the
  // segment has nothing honest to show.
  const out = renderPayload(
    {},
    {
      trackChanges: false,
      sources: {
        ...emptySources,
        getGitInfo: () => ({
          branch: "main",
          upstream: "origin/main",
          ahead: 0,
          behind: 0,
          changed: 0,
          untracked: 0,
        }),
        getPrInfo: () => {
          throw new Error("gh: not authenticated");
        },
      },
    }
  );
  const plain = stripAnsi(out);
  assert.match(plain, /main/, "the rest of line 1 must survive");
  assert.doesNotMatch(plain, /PR #/);
  assert.doesNotMatch(plain, /authenticated/, "an error message must never reach the bar");
});

await test("a source that throws removes its own segment and nothing else", () => {
  // FR-015, at the level of one source rather than the whole render.
  const out = renderPayload(
    { context_window: { used_percentage: 55 } },
    {
      trackChanges: false,
      sources: {
        ...emptySources,
        getRtkSavings: () => {
          throw new Error("rtk exploded");
        },
        getActiveSkills: () => {
          throw new Error("transcript unreadable");
        },
      },
    }
  );
  const plain = stripAnsi(out);
  assert.match(plain, /Context 55%/, "unrelated segments must be untouched");
  assert.doesNotMatch(plain, /rtk/);
  assert.doesNotMatch(plain, /exploded|unreadable/);
});

await test("with nothing available at all, the line is still four segments of truth", () => {
  const plain = stripAnsi(renderPayload({}, { sources: emptySources, trackChanges: false }));
  assert.match(plain, /Context \?%/);
  assert.match(plain, /5h \?%/);
  assert.match(plain, /7d \?%/);
});
