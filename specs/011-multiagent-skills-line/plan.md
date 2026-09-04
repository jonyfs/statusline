# Implementation Plan: Multi-Agent Skills On The Skills Line

**Branch**: `011-multiagent-skills-line` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-multiagent-skills-line/spec.md`

## Summary

The `task-rows` subcommand (subagent rows) and the main `render`/statusLine command are two separate CLI invocations Claude Code drives independently, with no shared state today (confirmed by reading `src/taskRows.js`: it is stateless, transforming one tick's stdin JSON to stdout JSON with nothing written to disk). This plan adds a small bridge: `task-rows` persists a snapshot of the current tick's tasks to a cache file on every tick; the main render reads that snapshot (freshness-windowed, best-effort) and folds each task's identifying text into the skills line alongside directly-invoked skills, sharing the line's existing overflow/dedup handling.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new; reuses `node:fs` the same way `src/cache.js` and `src/skillEvents.js` already do

**Storage**: a new small JSON file under `~/.claude/statusline/tasks/`, written by `task-rows` on every tick, read by `render`

**Testing**: `scripts/tests/task-rows.test.js` (write side), a new or extended test for the read side and its merge into the skills chip

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: the bridge file read on the render path MUST stay a small, single synchronous read, consistent with the redraw's existing budget; the write on the task-rows tick MUST NOT block that command's own budget

**Constraints**: MUST NOT turn `task-rows` from stateless into something that can fail its own tick if the write fails (best-effort write, like every other write in this codebase); MUST NOT block `render` if the bridge file is missing, stale, or unreadable (falls back to today's directly-invoked-only behavior, per FR-004)

**Scale/Scope**: `src/taskRows.js` (write the snapshot), a small new reader (in `src/skills.js` or a sibling), `src/render.js` (merge into the skills chip build)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II ("Subagent rows are not statusline lines... MUST NOT count toward the four")**: this feature does not add a line or count a subagent row as one; it enriches the existing Line 2 skills element with text describing subagent activity. PASS, no new line introduced.
- **Principle II (Line 2 content: "active skills for the current session")**: subagent activity is not literally a "skill" invocation in every case (a subagent's own task description may not name a skill at all); FR-005/FR-006 already scope this to "identifying activity," reusing the same row text the subagent-row feature already shows. Carried into Phase 1 as a labeling/wording decision, not a structural one.
- **Principle VI (English-Only Codebase)**: subagent task names/descriptions are pass-through data (like a task title elsewhere in this project), not tool-authored prose, so no translation obligation.
- No violations requiring justification. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── taskRows.js       # runTaskRows(): write a best-effort snapshot of the current tick's tasks
├── skills.js          # new reader: subagent activity from the snapshot, freshness-windowed
└── render.js            # skills chip builder: merge subagent activity with directly-invoked skills

scripts/tests/
├── task-rows.test.js         # extend: write side persists a snapshot
└── multiagent-skills.test.js # new: read side + merge into the skills chip
```

**Structure Decision**: Single-project CLI, no new top-level directories. One new small state file location under `~/.claude/statusline/tasks/`, matching the existing `~/.claude/statusline/skills/` and `~/.claude/statusline/cache/` precedent in `src/skillEvents.js` and `src/cache.js`.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
