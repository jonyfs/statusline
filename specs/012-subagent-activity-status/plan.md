# Implementation Plan: Subagent-Aware Activity Status

**Branch**: `012-subagent-activity-status` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-subagent-activity-status/spec.md`

## Summary

`getSessionActivity()`'s `working` flag (`src/skills.js`) is computed only from the top-level session transcript's own recency (`ACTIVE_WITHIN_MS`, 10 seconds); it has no way to know a subagent is running. This plan ORs in the subagent-activity snapshot already built for `011-multiagent-skills-line` (`subagentActivity()`, freshness-windowed, no new detection mechanism per the spec's Assumptions): `working` becomes true whenever either the top-level session wrote recently OR at least one subagent is currently active per that snapshot.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new; reuses `subagentActivity()` from specs/011

**Storage**: no new storage; reads the same `~/.claude/statusline/tasks/latest.json` snapshot specs/011 already writes

**Testing**: `scripts/tests/activity.test.js` (existing working/idle tests) and/or `scripts/tests/multiagent-skills.test.js`'s sibling patterns

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no new I/O beyond the single snapshot read `subagentActivity()` already performs; this feature calls it once more per render (or reuses a single call, per Phase 1 design) rather than adding a second read

**Constraints**: MUST NOT introduce a second subagent-detection mechanism (per spec Assumptions); MUST NOT change behavior when no subagent snapshot exists (FR-005)

**Scale/Scope**: `src/render.js` (where `activity` is computed, ~line 308) and/or `src/skills.js` (`getSessionActivity`, if the OR is better placed there)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Line 2 content: "current activity")**: no new segment; this corrects the accuracy of an existing Line 2 element's underlying signal. PASS.
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
└── render.js   # gather(), ~line 308: OR subagentActivity(now) into activity.value.working

scripts/tests/
└── activity.test.js   # extend with subagent-aware working/idle cases
```

**Structure Decision**: Single-project CLI, no new files. One small change in `gather()` where `activity` is already computed, reusing `subagentActivity()` from specs/011 rather than adding a new probe.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
