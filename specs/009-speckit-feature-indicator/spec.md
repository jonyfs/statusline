# Feature Specification: Speckit Feature Indicator

**Feature Branch**: `009-speckit-feature-indicator`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "quando estiver fazendo sdd usando speckit skills deve mostrar a identificaçao da spec em andamento da seguinte forma speckit-skill (identificaçao da feature)" (when doing SDD with speckit skills, show the in-progress spec's identification in this format: speckit-skill (feature identification))

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which feature a speckit skill is working on (Priority: P1)

A developer running a Spec Kit skill (`speckit-plan`, `speckit-tasks`, `speckit-implement`, etc.) glances at the statusline and sees not just which skill is active, but which feature it is currently working on, shown as the skill name followed by the feature's identifier in parentheses (e.g. `speckit-plan (009-speckit-feature-indicator)`).

**Why this priority**: This is the entire request. Without it there's no feature.

**Independent Test**: Set the in-progress feature to a known identifier, run a speckit-* skill, and confirm the statusline shows `<skill> (<feature-id>)` exactly.

**Acceptance Scenarios**:

1. **Given** `speckit-plan` is running with feature `009-speckit-feature-indicator` in progress, **When** the statusline renders, **Then** it shows `speckit-plan (009-speckit-feature-indicator)`.
2. **Given** a different speckit-* skill is active with the same feature in progress, **When** the statusline renders, **Then** the feature identifier shown is the same, only the skill name changes.
3. **Given** no speckit-* skill is currently active, **When** the statusline renders, **Then** no feature identification is shown.

---

### User Story 2 - The feature identifier updates as work moves between features (Priority: P2)

A developer finishes specifying one feature and starts another. The statusline's feature identifier switches to the new one on the next render, without showing a stale identifier from the feature that was just finished.

**Why this priority**: A stuck identifier would actively mislead about which feature is in progress, which is worse than showing nothing.

**Independent Test**: Point the in-progress feature at feature A, confirm the statusline shows A; switch it to feature B, confirm the very next render shows B, not A.

**Acceptance Scenarios**:

1. **Given** the in-progress feature changes from one identifier to another between two speckit skill invocations, **When** the statusline renders after the second invocation, **Then** it shows the new identifier, not the old one.

---

### User Story 3 - No misleading identifier when there is nothing to identify (Priority: P3)

A developer runs a speckit-* skill in a project that has no feature currently in progress (a fresh checkout, or a project not using Spec Kit's per-feature tracking). The statusline shows the skill name alone, with no invented or blank feature identifier.

**Why this priority**: A fabricated or empty identifier is worse than an honestly absent one; getting this edge case right keeps the indicator trustworthy the rest of the time.

**Independent Test**: Run a speckit-* skill with no in-progress feature recorded, and confirm the statusline shows the skill name with no parenthetical at all.

**Acceptance Scenarios**:

1. **Given** a speckit-* skill is active but no feature identification is recorded anywhere the statusline can read, **When** the statusline renders, **Then** it shows the skill name with no parentheses, rather than an empty `()` or a placeholder.

### Edge Cases

- What happens when the feature identification itself is very long? It is subject to the same line-width trimming the rest of the statusline already applies, rather than being given special unbounded space.
- What happens when a non-speckit skill is the only one active? No feature identification is shown, consistent with the existing rule that this indicator is speckit-specific.
- What happens right when a speckit skill switches which feature it targets mid-session (as this very session did across specs 005-009)? The statusline is expected to catch up on its next render after the switch is recorded, not retroactively correct any render already drawn.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST show, next to an active speckit-* skill's name, the identifier of the feature currently in progress, in the form `<skill-name> (<feature-identifier>)`.
- **FR-002**: The statusline MUST read the in-progress feature's identifier from the same record Spec Kit's own commands already maintain for this purpose, rather than inferring it from unrelated signals (e.g. guessing from the git branch name).
- **FR-003**: The statusline MUST NOT show a feature identifier when no speckit-* skill is currently active.
- **FR-004**: The statusline MUST NOT show a feature identifier when none is recorded, showing the skill name alone rather than an empty or placeholder parenthetical.
- **FR-005**: The feature identifier shown MUST update on the next render after the recorded in-progress feature changes, without requiring a restart or manual refresh.
- **FR-006**: The feature identifier MUST be subject to the same line-width trimming behavior already applied to the rest of the statusline.

### Key Entities

- **In-progress feature**: The feature directory Spec Kit's own commands (`/speckit-specify`, `/speckit-plan`, etc.) are currently pointed at, identified by its directory name (e.g. `009-speckit-feature-indicator`).
- **speckit-* skill**: An installed Spec Kit skill whose name is prefixed `speckit-`; the skill this feature attaches the feature identifier to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can identify which feature a running speckit-* skill is working on by reading the statusline alone, without opening any file, for 100% of sessions where a feature is in progress.
- **SC-002**: The shown feature identifier matches the actually in-progress feature within one redraw of it changing, every time it changes.
- **SC-003**: No session ever shows a fabricated or blank feature identifier; absence of a recorded feature always renders as the skill name alone.

## Assumptions

- "The identification of the spec in progress" refers to the feature directory name Spec Kit already assigns (e.g. `009-speckit-feature-indicator`), the same identifier used throughout this project's `specs/` directory, not a separate ID scheme.
- This feature's parenthetical suffix is specific to the feature identifier. How it relates to the SDD-step label already introduced by a related feature (showing something like `(Planning)`) is a presentation detail left to planning, for instance combining both or having the feature identifier take precedence in the same slot, rather than a business rule fixed here.
- The record of "which feature is in progress" is read, never written, by the statusline; nothing here changes how or when Spec Kit's own commands update that record.
- Only one feature is treated as "in progress" at a time, matching Spec Kit's own single-current-feature model.
