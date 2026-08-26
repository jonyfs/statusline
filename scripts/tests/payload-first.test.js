import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { normalizePr, repoUrlFromPayload } from "../../src/git.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

const render = (payload, sources) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...WIDE }));

/** Records whether the fallback probe was reached. */
function spy(value) {
  const fn = () => {
    fn.called = true;
    return value;
  };
  fn.called = false;
  return fn;
}

await test("the pull request comes from the payload, and gh is not called", () => {
  // A1 and C1. `gh pr view` costs 540 ms on a warm network and its whole
  // timeout when it cannot reach GitHub. The payload has the same answer for
  // nothing, and carries the review state as well.
  const getPrInfo = spy(null);
  const out = render(
    fullPayload({ pr: { number: 12, url: "https://github.com/o/r/pull/12", review_state: "approved" } }),
    { ...gitSources(), getPrInfo }
  );
  assert.match(out, /PR #12 approved/);
  assert.equal(getPrInfo.called, false, "the payload answered, so gh must not run");
});

await test("gh still answers when the payload has no pull request field", () => {
  // C1's chosen form: keep it as a fallback. Older Claude Code versions do
  // not send `pr`, and gh sometimes knows about one the payload has not
  // found yet.
  const getPrInfo = spy({ number: 7, state: "OPEN", isDraft: false, url: "https://x/y/pull/7" });
  const out = render(fullPayload(), { ...gitSources(), getPrInfo });
  assert.match(out, /PR #7 open/);
  assert.equal(getPrInfo.called, true, "with no payload field, the fallback must run");
});

await test("a review state replaces the bare open state", () => {
  for (const [review, expected] of [
    ["approved", /PR #3 approved/],
    ["changes_requested", /PR #3 changes/],
    ["pending", /PR #3 pending/],
    ["draft", /PR #3 draft/],
  ]) {
    const out = render(
      fullPayload({ pr: { number: 3, url: "https://x/y/pull/3", review_state: review } }),
      gitSources()
    );
    assert.match(out, expected, `review state ${review}`);
  }
});

await test("a merge request says merge request, and an older version still works", () => {
  // `pr.kind` needs Claude Code v2.1.234. This machine runs 2.1.231, so the
  // field is absent here and the GitHub wording is what renders.
  const mr = render(
    fullPayload({ pr: { number: 44, url: "https://gitlab.com/o/r/-/merge_requests/44", kind: "mr", review_state: "approved" } }),
    gitSources()
  );
  assert.match(mr, /MR #44 approved/);

  const pr = render(
    fullPayload({ pr: { number: 44, url: "https://github.com/o/r/pull/44", review_state: "approved" } }),
    gitSources()
  );
  assert.match(pr, /PR #44 approved/);
});

await test("normalizePr reads both shapes into one", () => {
  assert.deepEqual(normalizePr({ number: 1, url: "u", review_state: "approved" }, "payload"), {
    number: 1,
    url: "u",
    review: "approved",
    kind: "pr",
    source: "payload",
  });
  assert.deepEqual(normalizePr({ number: 2, url: "u", state: "OPEN", isDraft: true }, "gh"), {
    number: 2,
    url: "u",
    review: "draft",
    kind: "pr",
    source: "gh",
  });
  assert.equal(normalizePr(null, "payload"), null);
});

await test("repository identity comes from the payload, and git remote is not called", () => {
  // A2 and C2. The payload parses the origin remote for you, host included,
  // which is also what makes the GitLab case work without new code.
  const getRemoteUrl = spy(null);
  const out = render(
    fullPayload({ workspace: { repo: { host: "github.com", owner: "anthropics", name: "claude-code" } } }),
    { ...gitSources(), getRemoteUrl }
  );
  assert.match(out, /anthropics\/claude-code/, "owner and repo render as text, per A2's chosen form");
  assert.equal(getRemoteUrl.called, false, "the payload answered, so git must not run");
});

await test("git remote still answers when the payload has no repository field", () => {
  const getRemoteUrl = spy("https://github.com/owner/repo");
  render(fullPayload(), { ...gitSources(), getRemoteUrl });
  assert.equal(getRemoteUrl.called, true, "with no payload field, the fallback must run");
});

await test("the branch links through whichever source answered", () => {
  const fromPayload = renderPayload(
    fullPayload({ workspace: { repo: { host: "gitlab.com", owner: "o", name: "r" } } }),
    { sources: gitSources(), trackChanges: false, now: NOW, ...WIDE }
  );
  assert.match(fromPayload, /gitlab\.com\/o\/r\/tree\/main/, "the host comes from the payload too");
});

await test("repoUrlFromPayload builds a URL, or nothing", () => {
  assert.equal(
    repoUrlFromPayload({ host: "github.com", owner: "o", name: "r" }),
    "https://github.com/o/r"
  );
  assert.equal(repoUrlFromPayload({ owner: "o", name: "r" }), null, "a repo with no host is not a URL");
  assert.equal(repoUrlFromPayload(undefined), null);
});

await test("neither segment renders outside a repository", () => {
  const out = render({}, emptySources);
  assert.doesNotMatch(out, /PR #/);
  assert.doesNotMatch(out, /\//, "no owner/repo text without a repository");
});
