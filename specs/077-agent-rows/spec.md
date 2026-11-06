---
track: quick
status: done
---

# Agent rows: the share, the queue, the band, the finished

**Feature Branch**: `feat/073-backlog-batch`

**Created**: 2026-11-05

**Input**: Backlog items 76, 79, 83 and 88 of the owner's selection: each subagent's share of the
session's tokens, the agents still queued, a band when an agent's context runs high, and the
finished agents collapsed into one row.

**Track**: `quick`: one more column, one word, one summary row; the band was already there.

## Requirements

- **FR-001** (76): `sessionTotals` keeps the tokens of each subagent by its id (the `agent-<id>.jsonl`
  file, or the `agentId` of a sidechain entry). The task rows read the session's totals and add a
  tenth cell, `18% of session`, the agent's tokens over the session's total; it is the first cell
  width sheds. Absent when the session's total is unknown or the agent has spent nothing yet.
- **FR-002** (79): A task whose status is `pending` reads `queued` in the status cell, where any
  status other than `running` already draws.
- **FR-003** (83): Already drawn: the context gauge takes the statusline's ramp (warn and critical
  bands) and a critical mark from 85%. README names it; nothing changes.
- **FR-004** (88): When two or more finished agents are still inside their two-minute grace, they
  draw as one row, `✓ 3 done · explore, code-review, tests` (the names cut to the width), carried
  by the first finished task's id; the others' rows are taken off. One finished agent keeps its
  own row, with its outcome.

## Out of scope

The agent's current tool, its queue position, the typical duration, nesting beyond what the rows
already draw (not selected).
