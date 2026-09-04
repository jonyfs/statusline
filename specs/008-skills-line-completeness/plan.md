# Implementation Plan: Skills Line Completeness

**Branch**: `008-skills-line-completeness` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-skills-line-completeness/spec.md`

## Summary

Fix the three confirmed causes of skills silently missing from the statusline's skills line: an overflow count computed only from a capped scan depth (undercounts truly active skills), skills invoked inside subagents/delegated work never reaching the top-level transcript scan, and no diagnostic explanation for why a given skill isn't showing. Fixes preserve today's dedup-by-name and time-window behavior unchanged.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: none new

**Storage**: existing per-session hook event log (`~/.claude/statusline/skills/<session>.jsonl`, `src/skillEvents.js`) and transcript-tail scan (`src/transcriptTail.js`); no new storage

**Testing**: `scripts/tests/*.test.js`, in particular any existing skills/activity tests plus `scripts/doctor-*.test.js` patterns already in the suite

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no regression to the existing redraw budget; scan-depth fix must not turn a bounded read into an unbounded one (still cap the raw scan, but report the true total distinctly from what was scanned)

**Constraints**: MUST NOT change the existing dedup-by-name behavior (FR-006); MUST NOT introduce a new expiry/window mechanism, only fix accounting and detection within the existing one

**Scale/Scope**: `src/skills.js` (`getActiveSkills`, `getActiveSkillsDetailed`), `src/transcriptTail.js` (`scanTailForSkills`, `scanTail`), `src/render.js` (overflow count math, `SKILLS_PROBED`/`SKILLS_SHOWN`), `src/doctor.js` (new diagnostic lines), and however subagent-invoked skills currently get (or don't get) written to the parent session's event log/transcript

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Four-Line Display Structure, Line 2 content)**: no new segment; this feature corrects the accuracy of an existing Line 2 element (active skills) and its diagnostic output. PASS.
- **Principle II ("Subagent rows are not statusline lines")**: this principle is about the separate subagent-row display, not skill activity tracking; a skill invoked by a subagent still belongs to the parent session's activity per the spec's User Story 2, so this is not a conflict, it is a distinct concern. Confirmed no conflict.
- **Principle VI (English-Only Codebase)**: new doctor diagnostic strings MUST be English, consistent with existing doctor output and the English-only-output feature (specs/005).
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
├── skills.js         # getActiveSkills/getActiveSkillsDetailed: true-total overflow accounting
├── transcriptTail.js  # scanTailForSkills/scanTail: fix scan-depth-vs-true-count gap
├── skillEvents.js      # hook event log: investigate/extend subagent visibility (FR-003)
├── render.js            # overflow count math (SKILLS_PROBED/SKILLS_SHOWN)
└── doctor.js             # new diagnostic lines: expired vs never-detected vs hook-vs-fallback

scripts/tests/
└── (extend existing skills/doctor test files with overflow-accuracy and diagnostic cases)
```

**Structure Decision**: Single-project CLI, no new files. Five existing files change, each already owning the piece of behavior it's fixing; no new module, since this is corrective work on an existing subsystem rather than new functionality.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
