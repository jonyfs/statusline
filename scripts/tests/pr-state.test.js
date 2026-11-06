import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload, ageLabel } from "../../src/render.js";
import { normalizePr, summarizeChecks } from "../../src/git.js";
import { buildReport } from "../../src/doctor.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

// specs/074-pr-state: what decides the pull request's next step, and the branch's.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const HOUR = 3600 * 1000;

const raw = (over = {}) => ({
  number: 81,
  state: "OPEN",
  isDraft: false,
  url: "https://github.com/someone/their-project/pull/81",
  reviewDecision: "APPROVED",
  mergeStateStatus: "BLOCKED",
  reviewRequests: 2,
  statusCheckRollup: [
    { name: "test (ubuntu-latest, 18)", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "test (ubuntu-latest, 20)", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "lint", status: "COMPLETED", conclusion: "FAILURE" },
    { name: "build", status: "IN_PROGRESS", conclusion: null },
    { name: "docs", status: "COMPLETED", conclusion: "SKIPPED" },
  ],
  autoMergeRequest: { mergeMethod: "SQUASH" },
  createdAt: new Date(NOW - 2 * 24 * HOUR - HOUR).toISOString(),
  additions: 412,
  deletions: 87,
  changedFiles: 23,
  threads: 3,
  ...over,
});

const sources = (pr, over = {}) => ({
  ...gitSources({ branch: "feature/theirs", upstream: "origin/feature/theirs" }),
  getRemoteUrl: () => "https://github.com/someone/their-project",
  getPrInfo: () => pr,
  ...over,
});
const render = (src, width = 300, payload = fullPayload({ now: NOW })) =>
  stripAnsi(renderPayload({ ...payload, cwd: "/tmp/their-project" }, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 }));

await test("the checks are counted by outcome, skips count as passed, and the first failure is named", () => {
  assert.deepEqual(summarizeChecks(raw().statusCheckRollup), { ok: 3, failed: 1, running: 1, failedName: "lint" });
  assert.equal(summarizeChecks([]), null);
  assert.deepEqual(summarizeChecks([{ context: "ci/circle", state: "FAILURE" }]), { ok: 0, failed: 1, running: 0, failedName: "ci/circle" });
});

await test("the normalised request carries the merge state, the reviewers awaited, the size, the age and the threads", () => {
  const pr = normalizePr(raw(), "gh");
  assert.equal(pr.mergeState, "BLOCKED");
  assert.equal(pr.awaiting, 2);
  assert.equal(pr.autoMerge, "SQUASH");
  assert.equal(pr.additions, 412);
  assert.equal(pr.threads, 3);
  const bare = normalizePr({ number: 4, state: "OPEN", url: "u" }, "gh");
  assert.equal(bare.mergeState, null);
  assert.equal(bare.checks, null);
  assert.equal(bare.awaiting, 0);
  assert.equal(ageLabel(20 * 60_000), "20m");
  assert.equal(ageLabel(5 * HOUR), "5h");
  assert.equal(ageLabel(49 * HOUR), "2d");
});

await test("line 1 says blocked with automerge, counts the checks naming the failure, the reviewers and threads, and the size with age", () => {
  const out = render(sources(raw()));
  assert.match(out, /blocked · automerge/);
  assert.match(out, /\u{F4A4}3 \u{F530}1 \u{F0996}1 · lint/u);
  assert.match(out, /2 awaiting · 3 threads/);
  assert.match(out, /\+412 −87 · 23f · 2d/);
  const clean = render(sources(raw({ mergeStateStatus: "CLEAN", autoMergeRequest: null, reviewRequests: 0, threads: 0 })));
  assert.match(clean, / mergeable /);
  assert.doesNotMatch(clean, /automerge|awaiting|threads/);
  const draft = render(sources(raw({ isDraft: true })));
  assert.doesNotMatch(draft, /blocked|awaiting/);
  const unknown = render(sources(raw({ mergeStateStatus: "UNKNOWN", statusCheckRollup: [], threads: null, reviewRequests: 0 })));
  assert.doesNotMatch(unknown, /unknown|awaiting|\u{F4A4}\d/u);
});

await test("width sheds the failing check's name and the request's files and age before the figures", () => {
  const widths = Array.from({ length: 40 }, (_, i) => 240 - i * 4);
  const shed = widths.map((w) => render(sources(raw()), w)).find((o) => /\u{F530}1/u.test(o) && !/· lint/.test(o));
  assert.ok(shed, "the failing check's name goes before its count");
});

await test("the alerts draw in the attention role with a link, and the branch's age after its state", () => {
  const src = sources(null, {
    getAlerts: () => ({ dependabot: 2, codeScanning: 1, total: 3 }),
    getBranchMeta: () => ({ branch: "feature/theirs", defaultBranch: "main", firstCommitAt: Math.floor((NOW - 14 * 24 * HOUR) / 1000) }),
  });
  const out = render(src);
  assert.match(out, /alerts 3/);
  assert.match(out.split("\n")[0], /\u{F0A33} 14d/u);
  const young = render(sources(null, { getBranchMeta: () => ({ branch: "feature/theirs", defaultBranch: "main", firstCommitAt: Math.floor((NOW - 10 * 60_000) / 1000) }) }));
  assert.doesNotMatch(young, /\u{F0A33} \d+m/u, "not before an hour");
  assert.doesNotMatch(render(sources(null, { getAlerts: () => ({ dependabot: 0, codeScanning: 0, total: 0 }) })), /alerts/);
});

await test("the branch chip turns critical with a mark on the default branch", () => {
  const onMain = { ...gitSources({ branch: "main", upstream: "origin/main" }), getBranchMeta: () => ({ branch: "main", defaultBranch: "main", firstCommitAt: null }) };
  const out = render(onMain);
  assert.match(out, /\u{F418} main! /u);
  assert.doesNotMatch(out.split("\n")[0], /\u{F0A33}/u, "the default branch has no age");
  const elsewhere = render(sources(null, { getBranchMeta: () => ({ branch: "feature/theirs", defaultBranch: "main", firstCommitAt: null }) }));
  assert.doesNotMatch(elsewhere, /!/);
});

await test("the doctor has a row for each, with the figures in words", () => {
  const src = sources(raw(), { getAlerts: () => ({ dependabot: 2, codeScanning: 0, total: 2 }), getBranchMeta: () => ({ branch: "feature/theirs", defaultBranch: "main", firstCommitAt: 1757000000 }) });
  const report = buildReport({ ...fullPayload({ now: NOW }), cwd: "/tmp/their-project" }, { now: NOW, live: false, probe: src });
  const by = Object.fromEntries(report.segments.map((s) => [s.key, s]));
  assert.match(by.prMerge.value, /blocked, automerge SQUASH/);
  assert.match(by.prChecks.value, /3 passed, 1 failed, 1 running \(lint\)/);
  assert.match(by.prReview.value, /2 awaiting, 3 unresolved/);
  assert.match(by.prSize.value, /\+412 -87, 23 files/);
  assert.match(by.alerts.value, /2 dependabot/);
  assert.match(by.branchAge.value, /first commit past main/);
});
