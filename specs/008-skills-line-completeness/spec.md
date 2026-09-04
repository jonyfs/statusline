# Feature Specification: Skills Line Completeness

**Feature Branch**: `008-skills-line-completeness`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "verifique pq algumas skills não aparecem na linha de skills" (check why some skills don't show up on the skills line)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every recently active skill is accounted for (Priority: P1)

A developer runs several skills in one session and checks the statusline's skills line. Every skill invoked within the active window is either shown by name or counted in an explicit "+N more" indicator, so the developer never wonders whether a skill they just ran is simply missing.

**Why this priority**: This is the direct complaint. A skill that silently vanishes from the line undermines trust in the whole indicator.

**Independent Test**: Invoke more skills than the line shows at once, then confirm the visible names plus the "+N" count add up to the true number of skills active in the window.

**Acceptance Scenarios**:

1. **Given** a developer has run 3 skills in the active window, **When** the statusline renders, **Then** all 3 names appear on the skills line.
2. **Given** a developer has run more skills than the line displays at once, **When** the statusline renders, **Then** the visible names are the most recently used ones, and the count of the rest is shown rather than silently dropped.
3. **Given** the true number of recently active skills exceeds the tool's internal scan depth, **When** the statusline renders, **Then** the shown "+N more" count still reflects the truth, not just what the scan happened to see.

---

### User Story 2 - A skill run inside a subagent or background task is tracked the same as one run directly (Priority: P2)

A developer dispatches work to a subagent (fork, Task-based agent, or background workflow) that itself invokes a skill. The statusline's skills line reflects that skill the same way it would if the developer had invoked it directly in the main conversation.

**Why this priority**: Delegated work is common, and a skill line that only sees top-level invocations quietly misses a growing share of real activity as delegation increases.

**Independent Test**: Dispatch a subagent that invokes a named skill, then confirm the skill appears on the parent session's skills line within the active window.

**Acceptance Scenarios**:

1. **Given** a subagent invokes a skill on behalf of the current session, **When** the statusline renders, **Then** that skill is counted the same as a directly invoked one.

---

### User Story 3 - The developer can tell why a skill isn't showing (Priority: P3)

A developer wonders why a skill they ran a while ago is no longer on the line. There's a documented, discoverable reason (it expired, it's beyond the count shown, or skill tracking isn't wired up in this environment) rather than an unexplained gap.

**Why this priority**: Even a working design has edges (expiry windows, display limits); making those edges legible turns a confusing gap into an understood limit.

**Independent Test**: Check the tool's diagnostic output after a skill has expired from the window and confirm it explains why the skill no longer appears.

**Acceptance Scenarios**:

1. **Given** a skill was run outside the active window, **When** a developer checks the diagnostic/doctor output, **Then** it states that the skill expired and when it was last seen.
2. **Given** skill tracking depends on an optional hook that isn't installed, **When** a developer checks the diagnostic/doctor output, **Then** it states that the hook is missing and that the tool is using the slower fallback instead.

### Edge Cases

- What happens when the same skill is invoked twice in the window? It MUST still count as one entry (no duplicate names), consistent with current behavior; this is not itself a "missing skill" bug.
- What happens when the number of truly active skills exceeds the number the tool actually looks at while scanning? The reported "+N more" count MUST reflect the true total, not just the portion the scan reached, so the indicator never understates activity.
- What happens when neither the recency hook nor the transcript is readable (e.g. missing transcript path, permissions issue)? The skills line MUST simply be empty, and this state MUST be distinguishable from "zero skills were actually run" in diagnostic output.
- What happens when a skill is invoked through a mechanism the tool doesn't currently recognize as a skill invocation (e.g. a differently-shaped record)? It is out of scope to guarantee recognition of every possible invocation shape, but any such gap MUST be documented as a known limitation rather than silently assumed not to exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST show every skill invoked within the active window, either directly by name or accounted for in the overflow count, with no invocation silently unaccounted for.
- **FR-002**: The overflow count ("+N more") MUST reflect the true number of additional active skills, not merely the number the tool happened to examine before stopping its scan.
- **FR-003**: The statusline MUST count a skill invoked by a subagent, background task, or delegated workflow the same as one invoked directly in the main session, provided it happened within the same session's activity window.
- **FR-004**: The diagnostic/doctor output MUST report, for a skill that no longer appears, whether it expired from the active window (and when it was last seen) versus never having been detected.
- **FR-005**: The diagnostic/doctor output MUST report whether skill tracking is using the fast hook-based path or the slower transcript-scan fallback, so a developer can tell whether missing hook installation is a factor.
- **FR-006**: The statusline MUST NOT change today's dedup-by-name behavior (a repeated skill still counts once); this feature only affects skills wrongly left off the line entirely.

### Key Entities

- **Active skill**: A skill invoked within the current session's activity window, eligible to appear on the skills line.
- **Skills line**: The statusline element listing recently active skill names, with an overflow indicator when more are active than fit.
- **Active window**: The time span (and scan depth) during which an invoked skill is still considered current enough to report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any session, the sum of names shown plus the reported overflow count on the skills line equals the true number of skills active in the window, 100% of the time.
- **SC-002**: A skill invoked by a delegated subagent appears on the parent session's skills line within one redraw after the delegated invocation, at the same rate as a directly invoked skill.
- **SC-003**: A developer checking diagnostic output for a "missing" skill gets a specific, correct reason (expired, beyond display limit, tracking unavailable) rather than no explanation, 100% of the time such a check is made.

## Assumptions

- "The skills line" refers to the statusline's existing recently-active-skills indicator, not a new display element.
- The root causes behind skills going missing are a mix of: the active window's time-based expiry, a fixed limit on how many recent invocations are scanned before the overflow count is computed, and skill invocations that happen inside delegated subagents rather than the top-level session transcript. All three are treated as in-scope defects or gaps to close, not accepted permanently.
- Skills invoked through mechanisms not yet recognized as skill invocations (an edge case beyond the three known causes above) are treated as a documentation gap for this feature, not a guaranteed-fixed defect, since the full set of possible invocation shapes isn't enumerable in advance.
- No new skill-invocation UI is being introduced; this feature corrects and makes legible the existing skills line's accuracy.
