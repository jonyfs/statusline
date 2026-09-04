# Feature Specification: Spec-Driven Development Step Indicator

**Feature Branch**: `007-speckit-step-indicator`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "deve mostrar, quando alguma skill speckit-* estiver executando qual o passo do sdd está sendo executado" (when a speckit-* skill is running, show which SDD step is being executed)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the current SDD step while a speckit skill runs (Priority: P1)

A developer running a Spec Kit skill (e.g. `speckit-plan`, `speckit-tasks`, `speckit-implement`) glances at the statusline while it works and sees which step of the spec-driven development flow is in progress, in plain language (e.g. "Planning", "Writing tasks", "Implementing"), instead of just the raw skill's internal name.

**Why this priority**: This is the entire request. Without it there's no feature.

**Independent Test**: Trigger a speckit-* skill, watch the statusline while it runs, and confirm a readable step label appears and matches the skill that is active.

**Acceptance Scenarios**:

1. **Given** `speckit-specify` is running, **When** the statusline renders, **Then** it shows a step label meaning "writing the spec" (e.g. "Specifying").
2. **Given** `speckit-plan` is running, **When** the statusline renders, **Then** it shows a step label meaning "planning" (e.g. "Planning").
3. **Given** `speckit-implement` is running, **When** the statusline renders, **Then** it shows a step label meaning "implementing" (e.g. "Implementing").
4. **Given** no speckit-* skill has run recently, **When** the statusline renders, **Then** no SDD step indicator is shown.

---

### User Story 2 - Step indicator expires like other skill activity (Priority: P2)

A developer finishes a speckit-* skill and moves to unrelated work. The SDD step indicator disappears after the skill is no longer active, the same way other active-skill indicators already do, instead of remaining stuck on-screen.

**Why this priority**: The statusline already has a proven "recent skill" activity window; reusing that behavior keeps this feature consistent and avoids a stale label misleading the developer about what's actually running.

**Independent Test**: Run a speckit-* skill, wait past the existing active-skill window, and confirm the step indicator is gone on the next render.

**Acceptance Scenarios**:

1. **Given** a speckit-* skill finished and enough time has passed for skills to be considered inactive, **When** the statusline renders, **Then** the SDD step indicator no longer appears.

---

### User Story 3 - Every current speckit-* skill maps to a readable step (Priority: P3)

A developer uses any of the installed speckit-* skills (specify, clarify, plan, tasks, analyze, implement, checklist, constitution, converge, and the rest) and always sees a sensible plain-language label, never the raw internal skill name or a blank/broken indicator.

**Why this priority**: A partial mapping would work for common cases but confuse anyone using a less common speckit-* skill, undermining trust in the feature.

**Independent Test**: Run each installed speckit-* skill in turn and confirm each produces a distinct, readable label rather than falling back to the raw skill id.

**Acceptance Scenarios**:

1. **Given** any installed speckit-* skill runs, **When** the statusline renders, **Then** it shows a human-readable label for that skill's SDD step, not the raw `speckit-*` identifier.
2. **Given** a non-speckit skill (e.g. `superpowers:brainstorming`) is the only one active, **When** the statusline renders, **Then** no SDD step indicator is shown for it.

### Edge Cases

- What happens when two speckit-* skills both fall inside the active window (e.g. a fast handoff from `speckit-clarify` to `speckit-plan`)? The indicator MUST show the most recently invoked speckit-* skill's step, consistent with how the existing "most recent first" skill ordering already works.
- What happens when a new speckit-* skill is added to the project later and has no mapping yet? The statusline MUST show a reasonable generic label (e.g. the skill's own short name, formatted for reading) rather than hiding the indicator or failing to render.
- What happens when the statusline can't read skill activity at all (e.g. hook data and transcript both unavailable)? No indicator is shown, matching the existing degrade-gracefully behavior for the skills line.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST detect when a `speckit-*` skill is among the currently active skills, using the same activity/recency mechanism already used for other skill indicators.
- **FR-002**: The statusline MUST display a plain-language SDD step label (not the raw skill identifier) whenever a `speckit-*` skill is active.
- **FR-003**: The statusline MUST map each installed `speckit-*` skill to a distinct, human-readable step label reflecting its place in the spec-driven-development flow (e.g. specify, clarify, plan, tasks, analyze, implement, and the other installed speckit skills).
- **FR-004**: The statusline MUST show no SDD step indicator when no `speckit-*` skill is currently active.
- **FR-005**: When multiple speckit-* skills fall within the active window at once, the statusline MUST show the step for the most recently invoked one.
- **FR-006**: The statusline MUST fall back to a readable, generic label (derived from the skill's own name) for any `speckit-*` skill that has no explicit mapping yet, rather than omitting the indicator or breaking rendering.
- **FR-007**: The SDD step indicator MUST expire using the same active-skill time window already applied to other skill indicators, so it never shows a step for a skill that finished long ago.

### Key Entities

- **SDD step**: One phase of the spec-driven-development flow the Spec Kit skills implement (e.g. specify, clarify, plan, tasks, analyze, implement), expressed as a short, plain-language label for the statusline.
- **speckit-* skill**: An installed Spec Kit skill whose name is prefixed `speckit-`, each corresponding to exactly one SDD step.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can tell which SDD step is running by reading the statusline alone, for 100% of the currently installed `speckit-*` skills.
- **SC-002**: The step indicator disappears within the same time window as other active-skill indicators after the skill stops being active, with no manual refresh needed.
- **SC-003**: No raw `speckit-*` skill identifier is ever shown to the user in place of a readable step label.

## Assumptions

- "SDD step" refers to the phase in the Spec Kit spec-driven-development lifecycle (specify, clarify, plan, tasks, analyze, implement, and related skills), not a generic task-management concept.
- The step indicator reuses the statusline's existing active-skill detection (hook-based event log with transcript-tail fallback) rather than introducing a new detection mechanism.
- The step indicator is a label addition to the existing skills area of the statusline, not a new dedicated line or panel.
- Only one SDD step is shown at a time, matching the assumption that a developer works through Spec Kit's flow sequentially rather than running multiple speckit-* skills simultaneously.
