# Feature Specification: Subagent-Aware Activity Status

**Feature Branch**: `012-subagent-activity-status`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "sempre considere o status do harness tb quando usando sub agente, as vezes mostra como idle porém esta executando subagente, ou seja, deve refletir no statusline tb" (always consider the harness's status too when a subagent is in use; it sometimes shows idle while a subagent is actually running, so that should be reflected on the statusline too)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The statusline shows "working" while a subagent is running, even if the main session has gone quiet (Priority: P1)

A developer dispatches work to a subagent and waits. While the subagent works, the top-level session itself may not write anything for a while, since the work is happening elsewhere. Today the statusline reads that quiet as "idle." A developer glancing at the statusline should instead see "working," because work is genuinely in progress.

**Why this priority**: This is the entire request: the status shown is actively wrong during exactly the situation a developer most wants a correct answer (delegated work in progress).

**Independent Test**: Dispatch a subagent, let the top-level session go quiet for longer than the existing idle threshold, and confirm the statusline still shows "working" while the subagent is active.

**Acceptance Scenarios**:

1. **Given** a subagent is actively running and the top-level session has not written anything recently, **When** the statusline renders, **Then** it shows "working," not "idle."
2. **Given** a subagent is actively running and the top-level session is also actively writing, **When** the statusline renders, **Then** it still shows "working" (unchanged from today for this case).
3. **Given** no subagent is running and the top-level session has gone quiet past the existing idle threshold, **When** the statusline renders, **Then** it shows "idle," exactly as it does today.

---

### User Story 2 - The status returns to accurately reflecting idle once the subagent finishes (Priority: P2)

A subagent finishes its work and the top-level session is also quiet. The statusline goes back to showing "idle" once nothing is actually happening, rather than getting stuck showing "working" from stale subagent information.

**Why this priority**: An indicator that can get stuck "on" is as untrustworthy as one that's wrong in the other direction; both defeat the point of an activity indicator.

**Independent Test**: Let a subagent finish, confirm no session activity is in progress, and confirm the statusline returns to "idle" within a reasonable delay.

**Acceptance Scenarios**:

1. **Given** a subagent has finished and the top-level session is also quiet, **When** the statusline renders after both, **Then** it shows "idle."

### Edge Cases

- What happens right as a subagent starts, before any statusline render has observed it yet? The status is whatever the most recent available information says; a brief lag between a subagent actually starting and the statusline first reflecting it is acceptable, the same way any other statusline figure lags the exact instant it changes.
- What happens when subagent activity information itself isn't available (e.g. the mechanism that reports it hasn't produced anything yet, or is stale)? The status falls back to what the top-level session's own activity already says today, rather than guessing.
- What happens with multiple subagents, some active and some finished? As long as at least one is genuinely active, the status shows "working."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline's working/idle indicator MUST show "working" whenever at least one subagent is actively running, regardless of how recently the top-level session itself wrote anything.
- **FR-002**: The statusline's working/idle indicator MUST continue to show "working" whenever the top-level session itself is actively writing, unchanged from current behavior.
- **FR-003**: The statusline's working/idle indicator MUST show "idle" only when neither the top-level session nor any subagent is currently active.
- **FR-004**: The statusline MUST return to showing "idle" within one normal redraw of every subagent finishing and the top-level session also going quiet, without needing a restart or manual refresh.
- **FR-005**: When no information about subagent activity is available, the statusline MUST fall back to today's existing top-level-session-only behavior, rather than showing an incorrect or fabricated status.

### Key Entities

- **Working/idle status**: The existing statusline indicator on line 2 showing whether the session is actively doing something right now.
- **Subagent activity**: Whether at least one subagent is currently running, as already tracked for this project's related skills-line feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of renders where at least one subagent is actively running, the statusline shows "working," even when the top-level session has been quiet past today's existing idle threshold.
- **SC-002**: The statusline returns to "idle" within one redraw of all activity (top-level and subagent) genuinely stopping, in every session.
- **SC-003**: With no subagent ever running in a session, the statusline's working/idle behavior is unchanged from today, in 100% of such sessions.

## Assumptions

- "The harness's status" refers to this statusline's own working/idle indicator (line 2), which already exists and already reflects the top-level session's recent activity; this feature extends what that indicator considers, not what it displays.
- This feature builds on the subagent-activity visibility already established for this project's skills-line work: whatever mechanism already knows "is a subagent currently running" is the source this indicator also draws from, rather than a second, independent detection method.
- A subagent's own activity recency (rather than merely "was dispatched, ever") is what counts as "active," consistent with how the top-level session's own working/idle detection already works today.
