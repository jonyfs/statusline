---
track: quick
status: done
---

# Close the rows of finished subagents

**Feature Branch**: `fix/067-hide-finished-rows`

**Created**: 2026-11-04

**Input**: a finished subagent's row stayed on the bar for the rest of the session.

## Why this exists

Claude Code lists a task with status `completed`, `failed` or `killed` in every later tick
of `subagentStatusLine`, and the task has no finish time, only `startTime`. The plugin drew
each of them as a normal row, so the row never closed and its age kept counting. The
documented way to remove a row is a line with an empty `content`
(code.claude.com/docs/en/statusline, "Subagent status lines").

## Requirements

- **FR-001**: A task whose status is `completed`, `failed` or `killed` keeps its row for
  `FINISHED_ROW_MS` (120 s, the time Copilot's own panel keeps an idle agent) counted from
  the first tick that showed it finished. After that the plugin writes `{id, content: ""}`.
- **FR-002**: The moment is remembered per session in `tasks/<session>.finished.json`. With
  no memory (read-only run, first tick) nothing is hidden: a row that stays is the safe error.
- **FR-003**: A task that runs again, or that the tick stops listing, is forgotten.
- **FR-004**: Hidden tasks are left out of the column alignment. Other statuses, including
  unknown ones, are never hidden.
- **FR-005**: Copilot's rows are unchanged: they already drop an idle agent after 120 s.

## Known limit

The first sighting is the clock's start, so a row can stay up to one refresh interval (60 s
by default) longer than 120 s after the agent finished.
