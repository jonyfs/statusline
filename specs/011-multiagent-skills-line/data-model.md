# Data Model: Multi-Agent Skills On The Skills Line

## Task snapshot (new, on disk)

Path: `~/.claude/statusline/tasks/latest.json`. Written by `task-rows` on every tick, best-effort (a write failure never breaks the tick's own output).

| Field | Type | Notes |
|---|---|---|
| `writtenAt` | number | epoch ms, for the freshness window check on read |
| `tasks` | array | a reduced projection of the tick's own `tasks` array: just enough to identify each one |
| `tasks[].id` | string | for dedup, mirrors the existing task id |
| `tasks[].label` | string | the same identifying text `renderTaskRow` already shows (name/description), per research.md's consistency decision |

## Merged skills-chip source (render-time, not persisted)

| Source | Contributes |
|---|---|
| Directly-invoked skills (existing) | `getActiveSkills()`'s existing result, unchanged |
| Subagent activity (new) | Each fresh task snapshot's `label`, read via the new snapshot reader |

The two lists are combined before the existing "show a few, count the rest" truncation (`SKILLS_SHOWN`/overflow) is applied, per FR-002, so the count stays accurate for the combined set rather than either source alone.

## Freshness rule (not persisted, computed on read)

A snapshot is used only when `now - writtenAt` is within a short window (order of the `task-rows` tick interval, distinct from the 30-minute skill-activity window per research.md). Older or missing snapshots contribute nothing.
