# Implementation Plan: Speckit Feature Indicator

**Branch**: `009-speckit-feature-indicator` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-speckit-feature-indicator/spec.md`

## Summary

When a `speckit-*` skill is active, read the in-progress feature's identifier from `.specify/feature.json` (the file every `/speckit-*` command already reads and writes) and show it next to the skill on the existing line-2 skills chip, replacing the SDD-step label from the related step-indicator feature in the same parenthetical slot rather than stacking both.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new; reads a small JSON file already maintained by Spec Kit's own tooling

**Storage**: `.specify/feature.json` in the project root, an existing file this feature only reads, never writes

**Testing**: `scripts/tests/*.test.js`; extend `sdd-step-indicator.test.js` or add a sibling file

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no new I/O beyond one small synchronous JSON read per render, cached the same way other per-render reads already are where applicable

**Constraints**: MUST NOT write to `.specify/feature.json` (read-only per FR-002/Assumptions); MUST NOT break when the file is absent (projects not using Spec Kit) or malformed

**Scale/Scope**: one small reader function plus a one-line change to the existing line-2 skills chip builder (`src/render.js`, near where `sddStepFor` is already called)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Four-Line Display Structure, Line 2 content)**: no new segment; this extends the existing Line 2 "active skills" element's parenthetical suffix. PASS.
- **Principle VI (English-Only Codebase)**: the feature identifier is displayed verbatim (it is Spec Kit's own directory-name identifier, e.g. `009-speckit-feature-indicator`), not tool-authored prose, so it is pass-through data rather than a translation concern.
- **Principle II ("wide element must justify its width")**: a feature identifier can run longer than a step label (e.g. `009-speckit-feature-indicator` vs `Planning`); FR-006 requires the existing line-width trim pass to cover it, carried into Phase 1 as a design constraint rather than new trim logic.
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
├── skills.js       # add inProgressFeatureId() reader, or a sibling module
└── render.js        # line-2 skills chip (~line 730-737): swap sddStep for the feature id

scripts/tests/
└── (extend sdd-step-indicator.test.js or add a sibling file)
```

**Structure Decision**: Single-project CLI, no new files required beyond an optional small reader function. `src/render.js`'s existing skills-chip parenthetical (currently `sddStepFor(skills[0])`) is the one line that changes.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
