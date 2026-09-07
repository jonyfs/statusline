# Feature Specification: Multi-Agent Skills Visibility

**Feature Branch**: `013-multi-agent-skills`

**Created**: 2026-09-05

**Status**: Abandoned 2026-09-06

**Input**: User description: "a linha de skills em uso deve mostrar as skills usadas em multiplas agentes em execuçao no momento" (the skills line in use should show the skills used in multiple agents running at the moment)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skills from all running agents appear on the skills line (Priority: P1)

A developer has multiple agents running concurrently, each invoking different skills. The skills line should show all the skills those agents are actually using, not just skills invoked by the top-level session directly.

**Why this priority**: This is the core request. The skills line's purpose is to answer "what is shaping the work right now" — if multiple agents are running with their own active skills, that work is being shaped by all those skills combined, and the line should show the complete picture.

**Independent Test**: Dispatch multiple concurrent agents (each invoking identifiable skills), and confirm the skills line aggregates and displays all active skills across all agents, not just a subset.

**Acceptance Scenarios**:

1. **Given** two agents are running concurrently (Agent A using skill X, Agent B using skill Y), **When** the statusline renders, **Then** the skills line shows both skills grouped by agent (e.g., "A: X, B: Y" or similar agent-identified format), even though neither the top-level session nor a single agent used both.
2. **Given** three agents are running (Agent A using skills X and Y, Agent B using skill Z, Agent C using skill W), **When** the statusline renders, **Then** the skills line reflects all four active skills grouped by their agent (e.g., "A: X, Y; B: Z; C: W") or a "+N" overflow indicator if space-constrained, showing which agent contributes which skill.
3. **Given** only the top-level session is active (no agents running), **When** the statusline renders, **Then** the skills line shows only directly-invoked skills, exactly as it does today.

---

### User Story 2 - Skills remain visible for the full duration their agent is running (Priority: P2)

A skill invoked by an agent should be visible on the skills line for as long as that agent is actively using it. Once the agent finishes, its skills fall away the same way any finished directly-invoked skill already does.

**Why this priority**: A stale skill entry would be as misleading as a missing one. The line must accurately reflect what is happening right now across all active agents.

**Independent Test**: Start an agent using a skill, confirm the skill is visible, let the agent finish, confirm the skill is gone on a subsequent render without manual refresh.

**Acceptance Scenarios**:

1. **Given** an agent is actively running and invoking a skill, **When** the statusline renders, **Then** that skill is visible on the skills line.
2. **Given** the agent finishes and no longer needs that skill, **When** the statusline renders after the agent completes, **Then** the skill is no longer on the line.

---

### User Story 3 - Skill visibility remains consistent across the skills line and subagent rows (Priority: P3)

The skills line's view of what agents are doing should be honest about the same set of agents and skills shown on their dedicated subagent rows, so a developer sees one consistent story across both displays.

**Why this priority**: Two independent displays of the same work that contradict each other would undermine trust in both. Consistency is essential for the line to be useful as a status indicator.

**Independent Test**: Compare the skills an agent is shown using on its dedicated row with what appears for that agent on the skills line; confirm they match or at least do not contradict.

**Acceptance Scenarios**:

1. **Given** an agent has both its own dedicated row and one or more of its skills on the skills line, **When** a developer reads both, **Then** they describe the same set of active work, not conflicting views of it.

### Edge Cases

- What happens when multiple agents invoke the same skill concurrently? Show the skill once on the line (not duplicated), since the line already shows skill names without per-agent cardinality. The line shows "which skills are active," not "how many agents are using each skill."
- What happens when the number of distinct skills across all agents exceeds line width? The existing overflow handling (show a subset plus an accurate "+N" count) applies to the complete aggregated set, ensuring the count is always honest about what's not shown.
- What happens when an agent stops, but the top-level session is still invoking one of the same skills? The shared skill remains on the line (still active from the top-level session), and only disappears when neither the top-level session nor any agent is using it anymore.
- What happens when an agent invokes a skill without a human-readable name or label? It's acceptable to omit that agent's unnamed skill rather than show a placeholder; agents with identifiable skills are still shown accurately.
- What happens if skill activity information is not immediately available from a running agent? The line shows only the skills it has confirmed information for. As agent activity becomes visible, those skills are added to the line (may lag slightly behind agent start, same way directly-invoked skill visibility can lag).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline's skills line MUST aggregate and display skills from all currently running agents, grouped by agent identifier, not only skills invoked directly by the top-level session. A skill source for an agent is either a formal named skill (`/skill` invocation) or the agent's task description/label, whichever is available first. Format: "AgentID: skill1, skill2; AgentID2: skill3" or equivalent grouping that preserves agent identity.
- **FR-002**: A skill invoked by any running agent MUST appear on the skills line while that agent is active, even if no other agent or the top-level session invokes it.
- **FR-003**: When multiple agents invoke the same skill, that skill MUST appear once on the line, not duplicated per agent.
- **FR-004**: The skills line MUST apply its existing overflow handling (display a subset plus an accurate "+N" count) across the full aggregated set of all active skills (top-level and all agents combined).
- **FR-005**: A skill MUST disappear from the skills line once no agent and the top-level session are using it anymore, without lingering past its actual activity end.
- **FR-006**: When no agent is running, the skills line MUST show only directly-invoked skills, matching its current behavior exactly.
- **FR-007**: Skills shown on the skills line for each agent MUST be consistent with (the same skills listed as) what that agent's dedicated row displays, rather than independently derived conflicting lists.
- **FR-008**: The statusline MUST NOT invent or fabricate a skill name for an agent that provides no identifiable skill information; such cases are omitted rather than shown as placeholders.
- **FR-009**: Claude Code MUST pass subagent skill/activity state to the render command via an extension to the existing stdin JSON payload (new array field listing active agents with their associated skills or task descriptions), ensuring the render has access to all necessary data in a single, self-contained invocation.

### Key Entities

- **Active skill**: A named skill being invoked by either the top-level session or any currently running agent; uniquely identified by skill name. For agents, a skill is either a formal named skill (`/skill` invocation) or the agent's task description/label, whichever is identifiable first.
- **Agent skill set**: The set of all distinct skills being invoked by a single agent at the current moment.
- **Aggregated skill set**: The union of all skills from the top-level session and all running agents, which is what the skills line displays.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of renders where multiple agents are running with active skills, the skills line displays all distinct skills those agents are using (subject to overflow handling), where today it might miss agent-specific skills.
- **SC-002**: A skill invoked by any active agent appears on the skills line within one normal render cycle of that agent becoming active, and disappears within one render cycle of that agent (or the top-level session, if it's the only other consumer) finishing.
- **SC-003**: When a single agent is running, the set of skills shown on the skills line exactly matches the set shown on that agent's dedicated row.
- **SC-004**: With no agents running, the skills line's rendered output is unchanged from its current (pre-feature) behavior, in 100% of such sessions.
- **SC-005**: Skill deduplication (same skill by multiple agents) works correctly: the line shows the skill once, and the "+N" overflow count accurately reflects total distinct skills, not duplicated counts.

## Clarifications

### Session 2026-09-05

- Q: When showing a skill invoked by an agent on the skills line, what constitutes a "skill" to display? → A: Either formal named skills (explicit `/skill` invocations) or agent task description/label (whatever is available for that agent), whichever provides identifiable information first.
- Q: When multiple agents are running, how should their skills appear on the skills line — grouped/labeled by agent, or aggregated anonymously? → A: Agent-grouped display (e.g., "Agent1: X, Y; Agent2: Z") to add clarity on which agent uses what and maintain consistency with agent identity shown in dedicated subagent rows.
- Q: How should subagent skill state be made available to the statusline render command? → A: Extend existing stdin JSON payload with subagent skill/activity array — leverages existing data channel, simplest, no new external state files or IPC complexity.
- Q: What's the expected maximum number of concurrent agents in a typical session? → A: 5–10 agents typical. Design for "most sessions have ≤ 10" with careful overflow handling and graceful degradation above that range.

## Assumptions

- Typical sessions will have 5–10 concurrent agents. The design MUST handle up to 10 gracefully and degrade gracefully beyond that via overflow handling ("+N" indicator). Peak sessions may exceed 10, but those are not the primary optimization target.
- "Multiple agents" refers to agents spawned through this project's existing subagent mechanism (the same agents shown in dedicated subagent rows), not a hypothetical different multi-agent system.
- The main statusline render and subagent-row display are currently separate command invocations. Subagent skill state will be passed to the render via extension of the existing stdin JSON payload (a new array field containing active subagent identifiers and their associated skills/descriptions), leveraging the existing data transport channel rather than introducing new IPC or file-based state.
- A skill is identified by its human-readable name or label, as shown both on the agent's dedicated row and in the skills line. Agents that provide no identifiable skill information (no name, no description, etc.) cannot be meaningfully represented on the line and are safely omitted rather than guessed at.
- Skill state from running agents may lag by one render cycle behind the exact moment an agent starts or finishes, consistent with how directly-invoked skill visibility can also lag slightly today.
- The skills line's visual constraint (maximum width per the four-line structure and terminal width) already exists. Overflow handling via "+N" is already implemented; this feature must use the same mechanism for all skills (top-level and aggregated agent skills combined).
- Principle II of the project's constitution (Four-Line Display Structure) governs how line 2 (the skills line) handles overflow and width constraints; this feature does not override or change those rules.

## What became of it

Never shipped, and the approach it describes was removed rather than finished.

It specified aggregating subagent skills into line 2 from a `payload.activeAgents`
field. **Claude Code does not send that field**, so the branch that read it
never executed once; `src/skillAggregation.js` and `src/lines.js` were written,
tagged, installed, and deleted six days later without having run.

What the need became: subagents are named on their own rows, with the tier, the
age, a context gauge and the skills the hook attributed to them
(`specs/017-line-legibility`, `specs/019`). Line 2 carries the session's own
skills and whether it is working, and names no agent
(Constitution II, amended 2026-09-07).
