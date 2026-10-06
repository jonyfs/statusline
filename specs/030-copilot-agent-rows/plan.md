# Implementation Plan: Subagent rows in GitHub Copilot CLI

**Branch**: `feat/copilot-agent-rows` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

## Summary

Copilot's session log already names every subagent, so the change sits in the event reader and
the renderer, and no new command is needed. `copilotSessionActivity` learns to tell root events from subagent events and
returns the running subagents in the task shape `task-rows` already renders. Under Copilot the
bar appends those rows after its own lines.

## Technical Context

JavaScript ES modules, Node 18+, no runtime dependencies. Tests run in the suite's throwaway
HOME against `events.jsonl` fixtures written to temporary directories.

## Research

**R1. Root versus subagent.** An event with a top-level `agentId` came from a subagent; one
without came from the root session (real session, 2026-10-05). Turn state and line 2's skills
read root events only.

**R2. Running.** A subagent is keyed by `data.toolCallId` of `subagent.started`, which is the id
`subagent.completed` and `subagent.failed` repeat. `session.shutdown` after it ends it too. The
row id is the event's `agentId`, falling back to the `toolCallId`.

**R3. The task shape.** `alignTaskRows` takes Claude Code's task objects. The mapping:
`id` from R2, `name` = `agentName`, `description` = `agentDescription` ?? `agentDisplayName`,
`label` = the latest `toolTitle` ?? `toolName` of that agent, `model` and `effort` from
`subagent.configured` ?? `subagent.started`, `startTime` = the started timestamp in ms. No token
count: Copilot reports `totalTokens` only on completion, so the gauge stays empty.

**R4. Models outside Claude's families.** `taskTier` knows `opus`, `sonnet`, `haiku` and `fable`
and returns null otherwise, which drops the tier cell. A `modelLabel` field, set only by the
Copilot mapping when the tier is null, fills that cell with `model·effort` in `surface2`.
`taskTier` and Claude Code's rows are unchanged.

**R5. Where the rows go.** `renderReadings` appends them after the drawn lines, only when it is
returning text (not `asRows`, not `asPool`), so the doctor and the composer see the bar exactly
as before. Width is `maxWidth`, the bar's own.

**R6. Cap.** Past 6 running subagents, the first 6 rows are kept and a seventh, `+N more`, is
printed in `surface2`.

## Constitution Check

II is amended (MINOR, 7.2.0): under a harness without its own subagent rows, the rows follow
the bar in the same output, never count toward the three, and are not drawn in Claude Code.
III: every figure on a row is a field Copilot wrote. VI: English. VIII: the README text names
what the rows show; no image of them is claimed. No violation.

## Source changes

```text
src/copilotEvents.js   root/subagent split, running subagents, per-agent skills and steps
src/taskRows.js        modelLabel fallback in the tier cell
src/render.js          agents reading in gather(), rows appended in renderReadings()
scripts/tests/copilot-agent-rows.test.js
scripts/tests/fixtures/copilot-subagent-events.jsonl (the real session's log, paths trimmed)
README.md, .specify/memory/constitution.md, CLAUDE.md, .specify/feature.json
```

## Results (2026-10-05)

- Suite: 606 passed locally.
- Copilot CLI 1.0.91, for real: `copilot -p` dispatched two background `explore` subagents while
  `bin/cli.js render` ran every half second against that session's directory, in Copilot's
  payload. The frames showed two rows below the bar,
  `gpt-5.6-luna·low · Read a.txt after delay` and the same for `b.txt`, then
  `· Running command` once each subagent started its shell step, then one row (now naming
  `explore`, since it no longer shared the type with a sibling), then none. Line 2 read
  `working` throughout. The subagents' `sleep` was refused by the session's permission rules,
  which did not affect the rows.
- Flush timing, measured on the same kind of run: a `subagent.started` stamped `46.455` was in
  `events.jsonl` by a poll at `46.791`, so a row can appear on the next refresh.
- CI run 37406294067 passed on Linux, macOS and Windows (Node 18, 20, 22), with the install, preview and composer jobs.
