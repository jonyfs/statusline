---
track: full
status: done
---

# Feature Specification: Subagent rows in GitHub Copilot CLI

**Feature Branch**: `030-copilot-agent-rows`

**Created**: 2026-10-05

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "se é possível mostrar os agentes em inumeras linhas no copilot assim
como é feito no claude code", followed, after the investigation below, by "implemente toda a
spec".

**Track**: `full`. It amends Principle II, which says subagent rows are not statusline lines,
for the one harness where they have to be.

## What the investigation found (2026-10-05)

**Claude Code draws subagent rows through a setting Copilot does not have.** Claude Code runs
`subagentStatusLine` (this plugin's `task-rows` command) on its own tick and draws one row per
running subagent. The Copilot CLI 1.0.91 bundle has no such setting. It has only
`statusLine.command`, whose stdout it splits on newlines and draws without a line cap, re-run on
events and every `statusLine.refreshInterval` seconds.

**Copilot's session log carries every subagent, and was checked on a real session.**
`copilot -p` was asked to dispatch one `explore` subagent with only `task`, `view`, `glob` and
`grep` allowed. Its `events.jsonl` recorded:

```text
subagent.started     data: toolCallId, agentName "explore", agentDisplayName "read-a-b",
                     agentDescription, model "gpt-5.6-luna", agentType, executionMode "sync"
subagent.configured  data: model, reasoningEffort "low", multiTurn
subagent.selected    data: agentName, agentDisplayName "Explore Agent", tools
tool.execution_start data: toolCallId, toolName "view", arguments, toolTitle "Viewing file"
assistant.turn_start / assistant.turn_end  (the subagent's own turns)
subagent.completed   data: toolCallId, durationMs 3670, totalTokens 11175, totalToolCalls 2
```

Every event that came from the subagent carried a top-level `agentId` naming the subagent
instance; the root session's events carried none. `subagent.failed` (with `error`) is the other
way a subagent ends, per the SDK types shipped with the CLI
(`copilot-sdk/generated/session-events.d.ts`).

**Two existing readings were wrong once subagents run.** `copilotSessionActivity` treated every
`assistant.turn_end` as the end of the session's turn, so a subagent finishing its first turn
closed the root's open turn and line 2 could say idle while the root was waiting on it. And it
counted a skill a subagent invoked as the session's own, which Principle II forbids.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See each running subagent on its own row in Copilot (Priority: P1)

**Independent Test**: Render the Copilot fixture payload against an `events.jsonl` with two
started subagents and one completed, and find exactly two rows below the bar.

**Acceptance Scenarios**:

1. **Given** a `subagent.started` with no later `subagent.completed` or `subagent.failed` for the
   same `toolCallId`, **When** the bar renders under Copilot, **Then** a row follows the bar's
   lines with the agent's type, its brief, its current step, its model and its age.
2. **Given** a subagent that completed or failed, **When** the bar renders, **Then** it has no
   row.
3. **Given** a `session.shutdown` after a subagent started, **When** the bar renders, **Then**
   that subagent has no row: the session that ran it is gone.
4. **Given** a subagent whose model is a Claude family, **When** its row renders, **Then** it
   carries the tier colour and label it carries in Claude Code; **given** any other model,
   **Then** the row names the model and effort as reported, in a neutral colour.
5. **Given** a `skill.invoked` carrying a subagent's `agentId`, **When** the bar renders,
   **Then** the skill shows on that subagent's row and not on line 2.
6. **Given** more running subagents than the row cap, **When** the bar renders, **Then** the
   rows stop at the cap and one more row says how many were left out.

### User Story 2 - Line 2 stays truthful while subagents run (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a root `assistant.turn_start` followed by a subagent's `assistant.turn_end`,
   **When** the bar renders, **Then** line 2 reads working.
2. **Given** a running subagent and a quiet log, **When** the bar renders, **Then** line 2 reads
   working (the specs/012 rule).

### Edge Cases

- A Claude Code payload: nothing changes, byte for byte; Claude Code draws its own rows.
- A `subagent.started` without `toolCallId`: no row, since nothing could ever end it.
- A started event older than the 2 MB tail read: not seen, so no row. The bar draws only rows it
  can show are running.
- Copilot passes no `COLUMNS`: the rows are fitted to the same width the bar uses (120 unless
  `COLUMNS` is set), shedding columns in `task-rows`' declared order.
- Text fields carrying control characters or objects are reduced by `plainText`, as everywhere.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Under Copilot, `copilotSessionActivity` MUST return the running subagents from
  `events.jsonl`: started, not completed or failed by `toolCallId`, and not followed by
  `session.shutdown`.
- **FR-002**: Each running subagent MUST carry its type (`agentName`), its brief
  (`agentDescription`, else `agentDisplayName`), its current step (the `toolTitle`, else
  `toolName`, of its latest `tool.execution_start`), its model and effort (`subagent.configured`,
  else `subagent.started`), its start time, and its skills inside the activity window.
- **FR-003**: Under Copilot, the bar MUST print one row per running subagent after its lines,
  built by the same cell, alignment and shedding code as `task-rows`, capped at 6 rows plus one
  `+N more` row.
- **FR-004**: The rows MUST NOT count toward Principle II's three lines and MUST NOT be drawn in
  Claude Code, the doctor's per-line rows or the composer pool.
- **FR-005**: Line 2's working state MUST follow the root session's turns only, and MUST read
  working while any subagent runs.
- **FR-006**: Line 2's skills MUST be the root session's only; a subagent's skills go to its row.
- **FR-007**: Principle II MUST be amended to allow this, for Copilot only.
- **FR-008**: The README's feature matrix MUST say Copilot draws subagent rows, and how.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The fixture with two running and one finished subagent renders exactly two rows.
- **SC-002**: A Claude Code payload renders byte for byte as before.
- **SC-003**: The real session log captured on 2026-10-05, replayed with the clock set while its
  subagent ran, draws one row naming `explore`; replayed after `subagent.completed`, none.
- **SC-004**: The full suite passes on all CI platforms.

## Assumptions

- The event format is Copilot CLI 1.0.91's, the version tested.
- The cap of 6 rows is a judgment: Copilot's footer sits under its input box, and more rows than
  that push the conversation off a laptop screen. It is a constant, easy to change.
