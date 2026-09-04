# Feature Specification: Skill Auto-Removal

**Feature Branch**: `010-skill-auto-removal`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "quando a skill parar de ser usada deve ser removida da linha de skills automaticamente" (when a skill stops being used, it must be automatically removed from the skills line)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A finished skill disappears without any action from the developer (Priority: P1)

A developer invokes a skill, works with it for a while, then stops using it and moves on to unrelated work (or stops working entirely). Without touching any setting or restarting anything, the skill's name eventually stops appearing on the statusline's skills line by itself.

**Why this priority**: This is the entire request. Without it there's no feature.

**Independent Test**: Invoke a skill, confirm it's on the skills line, stop invoking any skill, wait, and confirm it's gone on a later render with no manual action taken.

**Acceptance Scenarios**:

1. **Given** a skill was invoked and is currently shown on the skills line, **When** enough time passes with no further use of that skill, **Then** the statusline stops showing it, with no restart, refresh command, or configuration change from the developer.
2. **Given** a developer keeps re-invoking the same skill, **When** the statusline renders, **Then** the skill keeps showing, since it is still in active use.

---

### User Story 2 - A skill's removal doesn't wait longer than a reasonable, known delay (Priority: P2)

A developer wonders how long a skill stays visible after they've stopped using it. There's a single, documented, bounded delay, so "will it go away, and when" has a predictable answer rather than an open-ended one.

**Why this priority**: Automatic removal that could take an unbounded or unpredictable amount of time is barely better than none: the value of "automatic" is knowing it will happen soon and reliably.

**Independent Test**: Stop using a skill, and confirm it disappears within the documented delay, not later.

**Acceptance Scenarios**:

1. **Given** the documented delay for a skill to be considered no longer in use, **When** that much time has passed since the skill's last invocation, **Then** the very next render no longer shows it.
2. **Given** a developer wants a shorter or longer delay for their own workflow, **When** they change the documented setting for it, **Then** removal follows the new delay on subsequent renders.

---

### User Story 3 - Multiple skills expire independently (Priority: P3)

A developer has used several different skills in the same session at different times. Each one disappears on its own schedule, based on when *that* skill was last used, not tied to any other skill's activity.

**Why this priority**: Without independence, one skill's fresh use could keep an unrelated, long-idle skill artificially visible, or vice versa, undermining the "reflects what's actually shaping the work right now" purpose of the line.

**Independent Test**: Use skill A, wait past the removal delay, then use skill B; confirm the skills line shows only B, not A.

**Acceptance Scenarios**:

1. **Given** skill A was last used well before the removal delay and skill B was used just now, **When** the statusline renders, **Then** skill A is gone and skill B is shown.

### Edge Cases

- What happens when a skill is invoked once and never again, and the session simply continues without using any skill? It is removed once the delay has passed, exactly as if the developer had used and then stopped using it deliberately.
- What happens when the underlying system has no reliable signal for "this skill's task just finished," only for "this skill was invoked"? Removal is based on time since last invocation, since that is the only signal available; this is a documented approximation, not a defect.
- What happens if a developer's session is idle (no activity of any kind) for longer than the removal delay? Every skill shown before the idle period is removed, consistent with "no longer in use."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST stop showing a skill once it has not been invoked for longer than a defined removal delay, without requiring any developer action.
- **FR-002**: The removal delay MUST be a single, documented value that is the same for every skill, not decided per skill.
- **FR-003**: The statusline MUST allow the removal delay to be configured, for a developer whose workflow needs a shorter or longer window than the default.
- **FR-004**: Each skill's removal MUST be evaluated independently, based on that skill's own last-used time, so recent use of one skill does not keep a different, stale skill visible.
- **FR-005**: A skill that continues to be invoked within the removal delay MUST continue to be shown, never removed while still in active use.
- **FR-006**: The statusline MUST NOT require a restart, manual refresh, or any explicit command for a stale skill's removal to take effect; it MUST be visible on the very next normal render after the delay has passed.

### Key Entities

- **Skill activity**: A skill's most recent invocation time, used to decide whether it still counts as "in use."
- **Removal delay**: The configured span of time after a skill's last invocation past which it is no longer shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of skills that have gone unused past the removal delay are absent from the very next statusline render, with no developer action required.
- **SC-002**: A developer can state, without checking source code, how long a skill stays visible after they stop using it, because the delay is documented in one place.
- **SC-003**: A skill still being actively used never disappears from the line while it remains in use.

## Assumptions

- "Stops being used" is measured as time since the skill's last recorded invocation, not as a "task completed" signal, because the tools this statusline observes report when a skill starts but not when its work finishes. This is the same approximation the statusline's active-skill tracking already documents elsewhere as the honest choice available.
- This feature formalizes and verifies an automatic-removal guarantee already partially present in the current design (a configurable time window), rather than introducing an entirely new mechanism; where the current behavior already satisfies a requirement here, the work is confirming and testing it, not rebuilding it.
- The default removal delay is a reasonable "still probably relevant" span (on the order of tens of minutes) rather than a near-instant cutoff, since the same skill is often revisited a few minutes after switching to something else, and removing it too eagerly would be as misleading as leaving it too long.
