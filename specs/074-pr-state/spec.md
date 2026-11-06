---
track: quick
status: done
---

# The pull request's state, and the branch's: what decides the next step

**Feature Branch**: `feat/073-backlog-batch`

**Created**: 2026-11-05

**Input**: Backlog items 17, 18, 19, 20, 21, 22, 23, 26, 33, 35 and 39 of the owner's selection: the
checks summary, the merge state, the reviewers awaited, the unresolved threads, the request's age
and size, auto-merge, the failing check's name, the repository's alerts, the branch's age, and a
warning on the default branch.

**Track**: `quick`: three probes widened or added behind the detached refresh, six segments, one
rule on the branch chip.

## Why this exists

Line 1 says a pull request exists and how it was reviewed. It does not say whether it can be
merged, what is holding it, how big or old it is, or that the branch under the cursor is `main`.
Everything below comes from calls the bar already makes (`gh pr view`, `git`) with more fields, plus
two small ones (a GraphQL query for review threads, the alerts endpoints), all behind the detached
refresh so no redraw waits on the network.

## Requirements

- **FR-001**: `probePrResult` asks `gh pr view` for `mergeStateStatus`, `mergeable`, `reviewRequests`,
  `statusCheckRollup`, `autoMergeRequest`, `createdAt`, `additions`, `deletions` and `changedFiles`
  besides what it asked before, and `normalizePr` carries them as `mergeState`, `awaiting`,
  `checks` (`{ ok, failed, running, failedName }`), `autoMerge`, `createdAt`, `additions`,
  `deletions`, `changedFiles`. With a request found, one GraphQL query counts its unresolved review
  threads into `threads`; a failed query leaves `threads` null.
- **FR-002**: Segment `prMerge` (line 1 after the request): `blocked`, `conflicts` (`DIRTY`), `behind`
  or `mergeable`, in the critical, critical, attention and healthy roles; `· automerge` follows
  when auto-merge is armed. Absent for drafts, merged or closed requests, and `UNKNOWN`.
- **FR-003**: Segment `prChecks`: the passed, failed and running checks as `✓5 ✗1 ●2` with the CI
  glyphs, then `· <name>` of the first failed check (cut to 24 columns), shed first for width.
  Absent without checks.
- **FR-004**: Segment `prReview`: `2 awaiting · 3 threads`, either part alone when the other is
  zero; absent when both are.
- **FR-005**: Segment `prSize`: `+412 −87 · 23f · 2d`, the age from `createdAt` in days, hours or
  minutes.
- **FR-006**: Segment `alerts`: open Dependabot and code-scanning alerts of the repository, `alerts 2`,
  in the attention role, refreshed hourly; a repository that refuses the endpoints draws nothing.
- **FR-007**: A `branchMeta` cache, refreshed every minute: the default branch (from
  `refs/remotes/origin/HEAD`) and the time of the branch's first own commit past it. Segment
  `branchAge` draws `14d` after the branch's state; the branch chip draws `main!` in the critical
  role when the branch under the cursor is the default one.
- **FR-008**: Doctor rows for every new segment; README counts and the line-1 row follow.

## Out of scope

Issues assigned, other pull requests, deployments, CODEOWNERS (not selected); any write to GitHub.
