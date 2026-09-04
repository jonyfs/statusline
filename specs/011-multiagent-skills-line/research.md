# Research: Multi-Agent Skills On The Skills Line

## Decision: A single, global snapshot file, not per-session

**Decision**: `task-rows` writes its current tick's task list to one fixed path, `~/.claude/statusline/tasks/latest.json`, overwritten on every tick. `render` reads that one file when building the skills chip.

**Rationale**: The `task-rows` tick payload (verified in `src/taskRows.js` and its test fixtures) carries only `{ tasks, columns }`, no session id, no cwd, no correlation key of any kind. Every other cross-command bridge in this codebase (`src/skillEvents.js`'s per-session skill log, `src/cache.js`'s per-repository cache) is keyed by something the write side actually has; `task-rows` has nothing to key by. A global file is the only option available without changing what Claude Code sends to `task-rows`, which is outside this project's control.

**Alternatives considered**: A per-session file was rejected as impossible with the data available. Adding a new correlation field to the `task-rows` payload was rejected as out of scope: this project consumes Claude Code's tick contract, it doesn't define it.

## Decision: Document the multi-session limitation rather than solve it

**Decision**: With a single global snapshot, a developer running two or more concurrent Claude Code sessions on the same machine, each with their own subagents, would see every session's subagent activity folded into every session's skills line, not just their own. This is accepted and documented, not silently shipped as if solved.

**Rationale**: This project already has a precedent for exactly this kind of tradeoff: the constitution records `behind` (the git divergence figure) as a "known limitation, documented rather than worked around," because the honest fix (fetching from the network on every redraw) would cost more than the imprecision it removes. The same reasoning applies here: solving multi-session correctness would require Claude Code to send a correlation key it currently doesn't send, which this project cannot add on its own.

**Alternatives considered**: Silently shipping this gap without documentation was rejected: a developer running two sessions and seeing one session's subagents on the other's line, with no explanation, would read as a bug rather than a documented tradeoff.

## Decision: Freshness window on the snapshot read, matching subagent-row staleness

**Decision**: `render` treats the snapshot as valid only if it was written recently (a short window, on the order of the `task-rows` tick interval plus margin, not the 30-minute skill-activity window). A stale or missing snapshot contributes nothing, falling back to today's directly-invoked-only behavior (FR-004).

**Rationale**: `task-rows` only writes while Claude Code is actively ticking it for running subagents; once every subagent finishes, ticks presumably stop, and the last-written file would otherwise describe subagents that finished a long time ago, violating FR-003 ("disappear once no longer running"). A short freshness window, not the skill-activity window, is what actually answers "is this subagent still running" for data that arrives as a live tick rather than an invocation log.

**Alternatives considered**: Reusing the 30-minute skill window for this snapshot was rejected: that window approximates "was this skill recently invoked," which is a different question from "is this snapshot still describing current reality," and reusing it would violate FR-003/SC-002's "gone within one redraw of finishing."

## Decision: Reuse the subagent row's own identifying text, not a new description

**Decision**: Whichever field the existing subagent-row rendering (`src/taskRows.js`'s `renderTaskRow`) already uses to identify a task (`name` and/or `description`) is exactly what's folded into the skills line, per FR-005's consistency requirement.

**Rationale**: `renderTaskRow`'s existing tests show it already surfaces `name` and `description` on the row; reusing the same field(s) is the only way to guarantee FR-005 ("the same running work, not two different descriptions of it") without inventing a second source of truth.

**Alternatives considered**: Deriving a separate, skills-line-specific label was rejected: it would risk exactly the inconsistency FR-005 exists to prevent.
