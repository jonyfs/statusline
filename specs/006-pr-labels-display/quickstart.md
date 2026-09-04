# Quickstart: PR Label Display

## Prerequisites

- Node.js >=18
- `gh` CLI authenticated (`gh auth status`), on a branch with an open PR that has labels
- Statusline cache warm (run the tool once so `getPrInfo` has a cached entry; see `src/git.js`'s caching comments)

## Validate labels appear next to the PR segment

```bash
gh pr view --json number,state,isDraft,url,labels   # confirm the PR actually has labels
node bin/cli.js   # or however the statusline is normally invoked in this repo's dev setup
```

Expected: the PR segment shows number, review status, and up to 3 label names, matching User Story 1.

## Validate zero-label PRs render unchanged

```bash
# Switch to a branch with an open, label-free PR
node bin/cli.js
```

Expected: PR segment identical to pre-feature output, no empty markers (FR-003).

## Validate truncation on many labels

```bash
# Against a PR with 5+ labels
node bin/cli.js
```

Expected: 3 label names shown, then `+2` (or the correct remainder count) rather than all 5 spelled out (FR-004).

## Validate graceful fallback when labels can't be fetched

```bash
# Simulate by running gh unauthenticated, or against a non-GitHub remote, then:
node bin/cli.js
```

Expected: PR number and status still show; label suffix is simply absent (FR-006).

## Validate MR labels (GitLab)

```bash
# On a GitLab-backed branch with an open MR carrying labels, via whatever payload
# path already supplies MR data to this tool (see research.md: payload-sourced, not glab-shelled)
node bin/cli.js
```

Expected: same presentation as a GitHub PR's labels (FR-005).

## Run the extended test suite

```bash
node scripts/test-harness.js
```

Expected: `scripts/tests/segments.test.js` and `scripts/tests/render.test.js` (extended per plan.md's Project Structure) pass, covering the empty, truncated, and MR cases above without a live network call.
