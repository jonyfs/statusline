import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { normalizePr } from "../../src/git.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

const render = (payload, sources) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...WIDE }));

// FR-001/FR-002 (User Story 1): labels appear next to the PR number/status.
await test("PR labels appear next to the number and status", () => {
  const out = render(
    fullPayload({
      pr: { number: 12, url: "https://github.com/o/r/pull/12", review_state: "approved", labels: ["bug", "priority-high"] },
    }),
    gitSources()
  );
  assert.match(out, /PR #12 approved bug, priority-high/);
});

// FR-003: zero labels renders exactly as before this feature, no empty marker.
await test("a PR with no labels renders unchanged", () => {
  const withEmpty = render(
    fullPayload({ pr: { number: 12, url: "https://github.com/o/r/pull/12", review_state: "approved", labels: [] } }),
    gitSources()
  );
  const withNone = render(
    fullPayload({ pr: { number: 12, url: "https://github.com/o/r/pull/12", review_state: "approved" } }),
    gitSources()
  );
  assert.match(withEmpty, /PR #12 approved /);
  assert.doesNotMatch(withEmpty, /PR #12 approved\s+\S+,/);
  assert.equal(withEmpty, withNone, "an explicit empty array must render the same as an absent field");
});

// FR-004 (User Story 2): more than 3 labels truncate with a "+N" suffix.
await test("more than three labels truncate with a count", () => {
  const out = render(
    fullPayload({
      pr: {
        number: 5,
        url: "u",
        review_state: "approved",
        labels: ["bug", "priority-high", "needs-review", "wip", "docs"],
      },
    }),
    gitSources()
  );
  assert.match(out, /bug, priority-high, needs-review \+2/);
});

// FR-005 (User Story 3): GitLab MRs get the same label presentation.
await test("MR labels render the same way as PR labels", () => {
  const out = render(
    fullPayload({
      pr: {
        number: 44,
        url: "https://gitlab.com/o/r/-/merge_requests/44",
        kind: "mr",
        review_state: "approved",
        labels: ["needs-review"],
      },
    }),
    gitSources()
  );
  assert.match(out, /MR #44 approved needs-review/);
});

// FR-006: label fetch failure (labels absent, older gh, non-GitHub host)
// still shows PR number/status.
await test("PR still renders when labels are unavailable", () => {
  const out = render(
    fullPayload({ pr: { number: 9, url: "u", review_state: "open" } }),
    gitSources()
  );
  assert.match(out, /PR #9 open/);
});

// normalizePr: both the gh label-object shape and the payload's plain-string
// shape normalize to the same `labels: string[]`.
await test("normalizePr reads gh label objects and payload label strings the same way", () => {
  const fromGh = normalizePr(
    { number: 1, url: "u", state: "OPEN", isDraft: false, labels: [{ name: "bug" }, { name: "wip" }] },
    "gh"
  );
  assert.deepEqual(fromGh.labels, ["bug", "wip"]);

  const fromPayload = normalizePr({ number: 2, url: "u", review_state: "approved", labels: ["bug", "wip"] }, "payload");
  assert.deepEqual(fromPayload.labels, ["bug", "wip"]);

  const withoutLabels = normalizePr({ number: 3, url: "u", review_state: "approved" }, "payload");
  assert.deepEqual(withoutLabels.labels, []);
});
