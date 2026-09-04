# Implementation Plan: Spec-Driven Development Step Indicator

**Branch**: `007-speckit-step-indicator` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-speckit-step-indicator/spec.md`

## Summary

When a `speckit-*` skill is among the currently active skills, show its SDD step in plain language (e.g. "Planning") on the statusline's existing skills line, using a static skill-name-to-label map with a readable fallback for any unmapped skill, and the same recency window/expiry the skills line already uses.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new; reuses `getActiveSkills` (`src/skills.js`)

**Storage**: N/A; reads the same session-scoped skill-event log / transcript tail already used for active-skill detection

**Testing**: `scripts/tests/*.test.js`; extend or add a test near the existing skills-related tests

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no new I/O; the step label is a pure lookup against the skill names `getActiveSkills` already returns

**Constraints**: MUST NOT introduce a second active-skill detection path; MUST reuse the existing 30-minute window (`src/skills.js` `windowMs()`) so expiry behavior stays uniform across all skill indicators

**Scale/Scope**: one small lookup table (installed `speckit-*` skill names as seen in the project's `.claude/skills/` listing → step label) plus a few lines in the line-2 rendering path (`src/render.js:698-720`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Four-Line Display Structure, Line 2 content)**: Line 2 already carries "active skills for the current session"; the step label is additional text on that same existing element, not a new line or segment. PASS.
- **Principle VI (English-Only Codebase)**: step labels MUST be English words (e.g. "Planning", "Implementing"), consistent with the English-only-output feature (specs/005) being planned in parallel. Carried into Phase 1 as a naming constraint on the lookup table.
- **Principle II ("wide element must justify its width")**: a short one- or two-word label is a small, bounded width addition; no new width-fitting logic needed beyond the line's existing trim pass.
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
├── skills.js       # getActiveSkills(); add sddStepFor(skillName) lookup + fallback
└── render.js        # line-2 rendering (~line 698); append step label to the skills chip

scripts/tests/
└── (extend an existing skills-related test file with step-label mapping cases)
```

**Structure Decision**: Single-project CLI, no new files. `src/skills.js` gains a small exported lookup function; `src/render.js` calls it when building the line-2 skills chip. No new module: the mapping table is a handful of entries, not a subsystem.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
