# Feature Specification: Multi-Agent Skills On The Skills Line

**Feature Branch**: `011-multiagent-skills-line`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "deve mostrar a lista de skills que estão sendo executadas tb no modo multi agente na linha de skills, hoje ainda não mostra" (the skills line should also show skills running in multi-agent mode; today it still doesn't)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work happening in a subagent shows up on the skills line too (Priority: P1)

A developer dispatches work to one or more subagents (running in parallel, doing something on the developer's behalf). While that work is in progress, the statusline's skills line reflects what the subagents are doing, not just what the top-level session itself has invoked directly.

**Why this priority**: This is the entire request. Without it there's no feature.

**Independent Test**: Dispatch a subagent doing identifiable work, and confirm the skills line reflects it while the subagent is active, when a directly-invoked-only view would show nothing for it.

**Acceptance Scenarios**:

1. **Given** one subagent is actively running, **When** the statusline renders, **Then** the skills line includes something identifying that subagent's current work, not just what the top-level session invoked directly.
2. **Given** several subagents are running at once, doing different things, **When** the statusline renders, **Then** the skills line reflects all of them, subject to the line's existing overflow handling (a shown subset plus an accurate "+N" count) rather than silently keeping only one.
3. **Given** no subagent is currently running, **When** the statusline renders, **Then** the skills line looks exactly as it does today, showing only what the top-level session itself invoked.

---

### User Story 2 - A finished subagent's activity leaves the line the same way a finished skill does (Priority: P2)

A subagent completes its work. Once it's done, whatever it contributed to the skills line disappears the same way any other finished activity already does, without a stale entry lingering.

**Why this priority**: Without this, the feature would trade "invisible" for "stuck visible," which is a different, but equally misleading, failure mode.

**Independent Test**: Dispatch a subagent, confirm its activity shows, let it finish, confirm the entry is gone on a subsequent render.

**Acceptance Scenarios**:

1. **Given** a subagent has finished and is no longer running, **When** the statusline renders after that, **Then** its entry is no longer on the skills line.

---

### User Story 3 - The main skills line and the subagent rows stay two honest, consistent views (Priority: P3)

A developer already sees a dedicated row per running subagent (its own progress display, per this project's existing subagent-row feature). The skills line's new subagent entries are consistent with what those rows already say, so a developer isn't shown two different stories about the same running work.

**Why this priority**: Two independent displays of the same underlying activity that disagree would be worse for trust than the current gap, since a developer would no longer know which one to believe.

**Independent Test**: Compare the identifying text shown on a subagent's own row with what appears for it on the skills line; confirm they describe the same thing.

**Acceptance Scenarios**:

1. **Given** a subagent has both its own row and an entry on the skills line, **When** a developer reads both, **Then** they name the same running work, not two different descriptions of it.

### Edge Cases

- What happens when a subagent doesn't identify what it's doing in a way distinct enough to show (e.g. no meaningful name or description available)? It's reasonable to omit that subagent from the skills line rather than show a blank or generic placeholder entry, as long as subagents that do identify their work are still shown.
- What happens when a subagent's work happens to be invoking a named skill internally? Whatever text best identifies that activity (the skill's name if visible, otherwise the subagent's own task description) is what's shown; this feature does not require inventing visibility into something the system genuinely can't observe.
- What happens the moment a subagent both starts and finishes between two statusline renders? It's acceptable for very short-lived subagent activity to never appear, the same way an extremely brief directly-invoked skill already could be missed between renders today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline's skills line MUST include identifying activity from currently running subagents, not only skills invoked directly by the top-level session.
- **FR-002**: The skills line MUST apply its existing overflow handling (a shown subset plus an accurate "+N" count) to the combined set of directly-invoked skills and subagent activity, not to either source alone.
- **FR-003**: A subagent's contribution to the skills line MUST disappear once that subagent is no longer running, without lingering past its own completion.
- **FR-004**: When no subagent is running, the skills line MUST behave exactly as it does today, showing only directly-invoked skill activity.
- **FR-005**: The text shown for a subagent's activity on the skills line MUST be consistent with (describe the same thing as) what that subagent's own dedicated row already shows, rather than an independently-derived, potentially-conflicting description.
- **FR-006**: The statusline MUST NOT fabricate a skill name for a subagent that provides no identifiable activity description; such a subagent is simply omitted rather than shown as a placeholder.

### Key Entities

- **Subagent activity**: The identifying description of what a currently running subagent is doing, as already known to this project's existing subagent-row feature.
- **Skills line**: The existing statusline element listing recently active skill names with an overflow indicator; this feature adds subagent activity as a second contributing source alongside directly-invoked skills.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of sessions with at least one subagent running, the skills line shows at least one entry reflecting that activity, where today it shows none.
- **SC-002**: A subagent's entry on the skills line is present for the full duration that subagent is running, and gone within one redraw of it finishing.
- **SC-003**: With no subagent running, the skills line's rendered output is unchanged from its current (pre-feature) behavior, in 100% of such sessions.

## Assumptions

- "Multi-agent mode" refers to this project's existing subagent mechanism (the dedicated per-subagent rows drawn by the `task-rows` subcommand), not a different or hypothetical multi-agent system.
- Today, the main statusline render and the subagent-row display are two separate command invocations with separate inputs; the main render currently has no visibility into subagent activity at all, which is the concrete, verified reason the skills line shows nothing for it today. Closing that gap requires the render command to gain access to subagent activity somehow, by whatever mechanism is simplest and safest; the specific mechanism is a planning decision, not a business rule fixed here.
- A subagent's identifying text (name/description, whatever the existing subagent-row feature already uses) is reused as-is for the skills line entry, rather than deriving a separate description, per FR-005's consistency requirement.
- This feature does not require detecting which named skill a subagent is internally using, if the subagent mechanism itself doesn't already expose that; the subagent's own task-level identification is an acceptable, honest substitute, per the Edge Cases.
