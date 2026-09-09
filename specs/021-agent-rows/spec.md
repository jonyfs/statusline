# Feature Specification: What a subagent row can say

**Feature ID**: `021-agent-rows`

**Status**: Implemented 2026-09-08

**Date**: 2026-09-08

**Input**: Evaluate what could be added to the agent rows to understand what is
being done, which skills are associated, and anything else useful.

## How this was answered

By capturing a real tick rather than reading the documentation. The field list
had been wrong before — feature 013 was built against a `payload.activeAgents`
that does not exist — so the plugin was instrumented for one tick, a live
window's payload was read, and the instrumentation was reverted before anything
was designed.

What arrived, from two running agents in the barbershop window:

```
top level   columns  cwd  prompt_id  session_id  tasks  transcript_path
per task    id  type  status  description  label  cwd  startTime
            model  effort  tokenCount  contextWindowSize  tokenSamples
```

Four of those the row was discarding.

## What was discarded, and what each is worth

**`label` is not `description`.** They answer different questions and the row
was treating the second as a mere fallback for the first:

```
description  "Fechar os nove achados do PR 67"       the brief, fixed for the agent's life
label        "Staging all fixer changes for commit"  the step it is on right now
```

The literal answer to "what is being done" was arriving and being dropped.

**`tokenSamples` separates working from stuck.** A short ring of recent token
counts. Both captured agents reported sixteen samples with a variation of zero:
neither had spent a token across that window. A stalled agent and a busy one
look identical on the row today, and that is the question that makes a person
look at the rows at all.

**`status`** is `running` for every row the bar draws, so it is worth a column
only when it is not.

**`cwd`** matches the session's for an ordinary agent and says nothing. An agent
working in another worktree is exactly what you would want to know and cannot
see.

## Requirements

- **FR-001**: A row shows the brief and the step separately, and does not
  repeat one as the other when a task carries only one of them.
- **FR-002**: A row says whether the agent has consumed anything across the
  samples it reported.
- **FR-003**: The growth is reported as a total, not a rate. Nothing states how
  far apart the samples are, so a per-minute figure would be an invented unit on
  a real measurement.
- **FR-004**: A status is shown only when it is not `running`; a directory only
  when it differs from the session's.
- **FR-005**: The skills column keeps its place directly after the name, where
  it already was.
- **FR-006**: A column no row in the tick fills is dropped rather than padded,
  and a row rendered alone drops its empty cells entirely.

## Success Criteria

- A reader can tell, from the rows alone, what each agent was asked to do, what
  it is doing now, and whether it is doing anything.
- An agent in another worktree is visible as such.
- The rows remain a table: every column falls in the same place on every row.

## Assumptions

- `idle` describes what is observed, not what is wrong. Waiting on a tool and
  being stuck look the same from here, and the row does not claim to know which.

## Out of Scope

- A per-agent context projection. With no growth there is no slope to project
  from, and inventing one would be worse than showing nothing.
- The `type` field beyond its existing use as a name fallback: it is
  `local_agent` for every ad-hoc Task and identifies nothing.
