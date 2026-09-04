# Implementation Plan: Statusline English-Only Output

**Branch**: `005-statusline-english-only` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-statusline-english-only/spec.md`

## Summary

Verify every tool-authored string the statusline renders (segment labels, status words, error/fallback text, CLI help/doctor output) is English, fix any that aren't, and add a fast repeatable check so future additions can't silently reintroduce non-English text. Pass-through data (branch names, commit messages, task titles) stays untouched. A source scan during specification found no non-English literals today, so this plan is a verification-plus-guard feature, not a rewrite.

## Technical Context

**Language/Version**: Node.js >=18, ES modules (`"type": "module"` in package.json)

**Primary Dependencies**: none beyond Node's standard library (`package.json` lists no runtime `dependencies`)

**Storage**: N/A. No persistent storage; reads git/gh/glab CLI output and the statusLine stdin payload

**Testing**: custom test harness under `scripts/tests/*.test.js`, run via `scripts/test-harness.js`; `npm test` runs `scripts/smoke-test.js`

**Target Platform**: cross-platform CLI (darwin/linux/win32 per `package.json` `os` field), invoked by Claude Code's `statusLine` hook

**Project Type**: single-project CLI/library (statusline renderer + `bin/cli.js` entry point)

**Performance Goals**: no new goal; the check must run in under 10 seconds per SC-003, well within the existing test suite's budget

**Constraints**: no new runtime dependency (project constraints already forbid extra dependencies per Principle IV); must not alter segment widths/truncation behavior

**Scale/Scope**: ~25 source files under `src/`, a handful of tool-authored string sites per file; a static, one-time scan plus a small allowlist-driven regression script

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle VI (English-Only Codebase)**: this feature exists to enforce that principle at the rendered-output layer, not just in source comments. PASS: the feature is the gate closing itself.
- **Principle IV (Installable by Clone, zero package manager)**: the regression check MUST be a plain Node script (no new npm dependency), consistent with the project's zero-runtime-dependency stance. PASS, carried as a design constraint into Phase 1.
- **Principle II (Four-Line Display Structure)**: any wording fix MUST NOT change segment placement or line assignment, only word choice. PASS, no structural change proposed.
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
src/                     # existing statusline source (segments.js, render.js, git.js, taskRows.js, ...)
bin/cli.js                # existing CLI entry point (help/doctor output)
scripts/
├── tests/*.test.js       # existing per-module tests
├── check-english-strings.js   # NEW: regression check for tool-authored strings (FR-007)
└── test-harness.js       # existing runner; wire the new check in here
```

**Structure Decision**: Single-project CLI, matching the existing layout. No new directories. One new script (`scripts/check-english-strings.js`) is added alongside the existing per-module tests in `scripts/tests/`, and any string fixes land directly in the `src/` files that already own that text (`segments.js`, `render.js`, `doctor.js`, `bin/cli.js`).

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
