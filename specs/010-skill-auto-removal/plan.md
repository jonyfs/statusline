# Implementation Plan: Skill Auto-Removal

**Branch**: `010-skill-auto-removal` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-skill-auto-removal/spec.md`

## Summary

Confirm and harden the existing time-window-based skill expiry (`windowMs()` in `src/skills.js`, 30-minute default, overridable via `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN`) against the spec's explicit requirements: automatic removal with no developer action, a single documented and configurable delay, per-skill independence, and no restart/refresh needed. A baseline check found the mechanism already exists and is already covered by one test (`scripts/tests/skills.test.js`, "skills expire once they stop being used"); this plan's job is closing any gap between that mechanism and the spec's full acceptance criteria (in particular User Story 2's "documented in one place" and User Story 3's per-skill independence across both detection paths: hook log and transcript fallback), not building new infrastructure.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new

**Storage**: N/A; reads existing session-scoped hook event log and transcript tail

**Testing**: `scripts/tests/skills.test.js` and siblings (`skills-freshness.test.js`, `skills-completeness.test.js`)

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no new goal; expiry is a filter already applied during the existing scan, not an added pass

**Constraints**: MUST NOT introduce a second, independent expiry mechanism alongside `windowMs()`; MUST NOT change the default delay's order of magnitude without a documented reason, since it's already tuned (per `src/skills.js`'s own comments) against a real transcript's stale-skill problem

**Scale/Scope**: `src/skills.js` (`windowMs`, `getActiveSkills`, `getActiveSkillsDetailed`), `src/skillEvents.js` (`readSkillEvents`, hook path), `src/transcriptTail.js` (`scanTailForSkills`, `scanTail`, transcript-fallback path). README already documents the delay and its override (verified during research), so no doc change is in scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Four-Line Display Structure, Line 2 content)**: no new segment; this hardens the existing "active skills" element's own removal behavior. PASS.
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
├── skills.js          # windowMs(), getActiveSkills(), getActiveSkillsDetailed()
├── skillEvents.js      # hook-log path: readSkillEvents() already filters by windowMs
└── transcriptTail.js    # transcript-fallback path: scanTailForSkills()/scanTail() already filter by windowMs

scripts/tests/
├── skills.test.js            # existing expiry test; extend with per-skill independence cases
└── skills-freshness.test.js  # hook-vs-transcript path parity for expiry
```

**Structure Decision**: Single-project CLI, no new files. All three detection-path files already implement window-based filtering; this plan's changes are verification tests confirming the spec's acceptance criteria hold, plus closing any gap found (e.g. a path that doesn't yet apply the window independently per skill). README already documents SC-002's requirement; no doc change is needed.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
