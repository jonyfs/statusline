# Feature Specification: PR Label Display

**Feature Branch**: `006-pr-labels-display`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "deve mostrar ao lado do pr e seu status a lista de labels que estão associados ao pr" (show, next to the PR and its status, the list of labels associated with the PR)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See PR labels at a glance (Priority: P1)

A developer working on a branch with an open pull request glances at the statusline and sees the PR number, its review status, and the labels attached to it (e.g. `needs-review`, `do-not-merge`, `bug`), without opening the PR in a browser.

**Why this priority**: This is the entire request. Without it there's no feature.

**Independent Test**: Open a PR with one or more labels on GitHub/GitLab, run the statusline in that branch's directory, and confirm the labels appear next to the PR number/status.

**Acceptance Scenarios**:

1. **Given** a branch has an open PR with labels `bug` and `priority-high`, **When** the statusline renders, **Then** both labels appear next to the PR segment, alongside the existing number and review status.
2. **Given** a branch has an open PR with no labels, **When** the statusline renders, **Then** the PR segment shows exactly as it does today (number and status only), with no empty label markers.
3. **Given** a branch has no open PR, **When** the statusline renders, **Then** no PR segment (and no label list) is shown, matching current behavior.

---

### User Story 2 - Labels stay readable on a narrow terminal (Priority: P2)

A developer working in a narrow terminal pane sees the PR segment stay legible: labels don't push other segments off-screen or make the line wrap unreadably.

**Why this priority**: The statusline already manages a tight, single-line budget across many segments; unbounded label text would break that budget and make the whole line worse, not just the PR segment.

**Independent Test**: Open a PR with many labels (5+) or with a long label name, run the statusline at a narrow terminal width, and confirm the line stays within the existing width-trimming behavior rather than overflowing.

**Acceptance Scenarios**:

1. **Given** a PR has more labels than fit in the available space, **When** the statusline renders at a narrow width, **Then** the label list is truncated (e.g. showing a count of the rest) rather than breaking the line layout.
2. **Given** a PR has a very long label name, **When** the statusline renders, **Then** the existing line-trimming behavior applies to the PR segment as it does to other segments.

---

### User Story 3 - Works for both PRs and merge requests (Priority: P3)

A developer on a GitLab project sees merge request labels the same way a GitHub user sees PR labels, since the statusline already treats PRs and MRs as the same segment.

**Why this priority**: The PR segment already unifies GitHub PRs and GitLab MRs under one `kind` field; skipping MRs here would be an inconsistent, surprising gap.

**Independent Test**: Open an MR with labels on a GitLab-backed branch, run the statusline, and confirm labels appear the same way they do for a GitHub PR.

**Acceptance Scenarios**:

1. **Given** a GitLab merge request has labels, **When** the statusline renders, **Then** the labels appear next to the MR segment using the same presentation as PR labels.

### Edge Cases

- What happens when the label list cannot be fetched (e.g. offline, API error, rate limit) but the PR number/status can? The PR segment MUST still render with number and status; labels are simply omitted for that render, matching the tool's existing "degrade gracefully" behavior for other segments.
- What happens when a label name itself is very long or contains unusual characters/emoji? It is displayed as returned by the source, subject to the same line-width trimming as any other segment text.
- What happens when the same label list hasn't changed since the last cached PR lookup? The existing PR caching/refresh behavior applies to labels the same way it applies to number and status, since they are fetched together.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST fetch the list of labels associated with the current branch's open PR/MR, alongside the number and review status it already fetches.
- **FR-002**: The statusline MUST display fetched labels next to the existing PR/MR number and status, only when the PR segment itself is shown.
- **FR-003**: The statusline MUST NOT display an empty label list or placeholder when a PR has zero labels; the segment MUST look exactly as it does today in that case.
- **FR-004**: The statusline MUST truncate the displayed label list when it does not fit in the available line width, showing an indicator of how many additional labels exist rather than silently dropping them.
- **FR-005**: The statusline MUST apply this behavior identically to GitHub PRs and GitLab MRs, consistent with the existing unified PR/MR segment.
- **FR-006**: The statusline MUST continue to show the PR number and status even when label data is unavailable (fetch failure, timeout, or unsupported host), rather than hiding the whole segment.
- **FR-007**: The statusline MUST use the existing PR caching/refresh mechanism for label data so labels don't add a separate, uncached network call on every render.

### Key Entities

- **PR label**: A short text tag (with an optional color, per GitHub/GitLab) attached to a pull/merge request, used for triage or status signaling (e.g. `bug`, `needs-review`).
- **PR/MR segment**: The existing statusline element showing the PR/MR number, its kind (PR or MR), and its review/CI status; this feature adds labels as a new piece of data attached to that same segment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can identify all labels on the current branch's PR without leaving the terminal, for 100% of PRs that have labels.
- **SC-002**: The PR segment's rendering time budget stays within the tool's existing per-render performance envelope; adding labels does not introduce a new network round-trip beyond the existing PR lookup.
- **SC-003**: At any terminal width the statusline already supports, the line never overflows or wraps because of label text; long label lists degrade to a truncated count instead.
- **SC-004**: Existing PRs with no labels render identically to current behavior, verified with no visual diff in existing golden/snapshot tests for the PR segment.

## Assumptions

- "Next to the PR and its status" means appended to the existing PR segment on the same line, not a new separate segment or a second line.
- Label data is available from the same source already used for PR number/status/review state (`gh pr view` / equivalent GitLab command), just with an additional field requested.
- A reasonable default cap of a few labels shown before truncating (with a "+N more" style indicator) is acceptable; the exact number is a presentation detail decided during planning, not a business requirement.
- Label color (as set on GitHub/GitLab) is out of scope for this feature; labels are shown as plain text, consistent with the statusline's existing minimal, low-color segment style.
