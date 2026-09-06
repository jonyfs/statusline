# Feature Specification: PR Status Freshness & Cache Correctness

**Feature Branch**: `014-pr-status-freshness`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User report: "PR status is always showing the last status of the last PR, it seems that in some cases it's becoming outdated" (status may not reflect current PR, caching or lookup issue)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PR status always reflects current branch's PR (Priority: P1)

Developer switches between branches or opens different pull requests. The statusline's PR segment (line 1) should always show the correct PR state for the currently checked-out branch, not cached/stale data from a previous branch.

**Why this priority**: A stale PR status is actively misleading — developer sees "ready for review" when the PR is already merged, or vice versa. This directly impacts decision-making about merge actions.

**Independent Test**: 
1. Checkout branch with active PR in "ready for review" state
2. Verify statusline shows that PR number and "ready for review" status
3. Checkout different branch with a different PR (or no PR)
4. Verify statusline immediately updates to show the new branch's PR (or "no PR")
5. Confirm cache did not persist old data

**Acceptance Scenarios**:

1. **Given** two branches each with different PRs (PR #100 in "draft" state, PR #200 in "ready for review" state), **When** developer switches from branch A (PR #100) to branch B (PR #200), **Then** statusline immediately shows PR #200 with "ready for review" status, not stale PR #100 data.
2. **Given** a branch with an active PR, **When** developer checks out a different branch with no PR, **Then** statusline shows no PR segment (or "no PR"), not cached PR data from previous branch.
3. **Given** a PR in "draft" state, **When** the PR is manually merged on GitHub while branch remains checked out, **Then** statusline updates to show "merged" status within next render cycle (not lingering stale "draft").

---

### User Story 2 - PR status cache respects branch switching (Priority: P2)

The statusline's PR segment uses a cache for performance (avoiding repeated `gh` calls). That cache must correctly distinguish between branches so switching branches clears or revalidates cached PR data for the new branch.

**Why this priority**: Cache correctness is the underlying cause — if cache persists across branch switches, stale data surfaces. Without this, US1 cannot work reliably.

**Independent Test**:
1. On branch A with PR #100, verify PR status displays correctly
2. Switch to branch B with PR #200
3. Verify cache lookup happens for branch B (not reusing branch A's cached value)
4. Confirm PR #200's status displays, not branch A's cached PR #100

**Acceptance Scenarios**:

1. **Given** a stale cache entry for branch A's PR, **When** developer switches to branch B, **Then** cache entry for branch B is looked up independently (does not reuse branch A's cache).

---

### User Story 3 - PR status updates after git operations (Priority: P3)

After local git operations that might change PR relationship (merge, rebase, reset), the statusline should revalidate rather than showing stale cached data.

**Why this priority**: Less common than branch switching, but still a correctness issue — dev rebases and PR status becomes wrong.

**Independent Test**: Rebase branch on main, statusline PR status updates correctly.

**Acceptance Scenarios**:

1. **Given** a PR on branch, **When** developer rebases branch on main, **Then** statusline revalidates PR status (does not show stale cache).

### Edge Cases

- What happens when branch is detached HEAD? No PR to show; statusline should not show cached PR data from the last named branch.
- What happens when `gh` API is unavailable during a branch switch? Cache should degrade gracefully (show last known value with a staleness indicator, or "unknown").
- What happens when a PR number changes (force-pushed PR with different commits)? Cache key must reflect the actual branch/PR relationship, not just branch name.
- What happens when user switches between two branches rapidly? Cache should not cause stale data on the second switch (should re-query or use branch-specific cache key).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: PR status segment MUST display the pull request state for the currently checked-out branch, not cached data from a previously checked-out branch.
- **FR-002**: When developer switches branches, the statusline MUST revalidate PR status for the new branch within one render cycle (no lingering stale PR data).
- **FR-003**: PR status cache (if used for performance) MUST be keyed by branch name (or commit) so cache lookup for branch A does not return cached value from branch B.
- **FR-004**: When a branch has no PR, the statusline MUST not display PR segment or display "no PR" (not show a cached PR from previous branch).
- **FR-005**: After local git operations (merge, rebase, reset), PR status MUST be revalidated; stale cache entries MUST not persist.
- **FR-006**: On detached HEAD, PR status MUST not show cached data from the last named branch (should show "detached" or "no PR").
- **FR-007**: PR status MUST update within one render cycle of actual PR state change on GitHub (e.g., PR merged remotely), without requiring manual refresh or branch switch.

### Key Entities

- **PR Cache Entry**: Cached PR data keyed by [branch_name or commit_sha], contains {pr_number, state, draft_status, review_state, updated_at}
- **Branch Context**: Current branch name / commit SHA — used as cache key to distinguish PRs across branches
- **Staleness Indicator**: Timestamp or flag indicating when cache entry was last validated

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of branch switches, statusline PR segment updates to reflect the new branch's PR (or "no PR") within one render cycle.
- **SC-002**: For 100% of rapid branch switches (A → B → A), statusline shows correct PR for each branch on each switch, not stale cached data.
- **SC-003**: For 100% of sessions where a PR is merged remotely (on GitHub), statusline reflects "merged" state within 5 render cycles (≈30 seconds).
- **SC-004**: Zero instances of cached PR data from branch A appearing on branch B after a branch switch (measured across test session).
- **SC-005**: Cache hit rate remains >80% within same branch, but does not compromise correctness across branch switches.

## Assumptions

- PR status lookup uses `gh pr view` or similar command that is branch-aware (returns PR for current branch, or fails cleanly if no PR).
- The statusline already has a caching mechanism for performance; this feature fixes the cache's key/validation logic.
- "Stale" means cache entry was written for branch A, but is being read in context of branch B (wrong branch) or was written before a local git operation that could change PR relationship.
- Render cycle frequency is ~every 5–6 seconds; updates should be visible within that cycle.
- Branch-switching happens via `git checkout` or equivalent; cache must clear or be revalidated on branch context change.

## Limitations & Out of Scope

- Caching strategy optimization (e.g., TTL, size limits) — focus is on correctness, not performance tuning
- Network error handling beyond graceful degradation (e.g., retries) — falls to existing error handling
- PR relationship inference (e.g., "PR #100 might still apply to this branch") — only show PR if it unambiguously belongs to current branch
