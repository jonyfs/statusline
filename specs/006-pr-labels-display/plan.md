# Implementation Plan: PR Label Display

**Branch**: `006-pr-labels-display` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-pr-labels-display/spec.md`

## Summary

Fetch and display the current branch's PR/MR labels next to the existing PR segment (number + review status), reusing the tool's existing cached, budget-limited PR lookup rather than adding a new network call. Labels are omitted (not blocked) when unavailable, truncated with a "+N" count when too many to fit, and shown identically for GitHub PRs and GitLab MRs consistent with the existing unified segment.

## Technical Context

**Language/Version**: Node.js >=18, ES modules

**Primary Dependencies**: `gh` CLI (already shelled out to via `execFileSync` in `src/git.js`); no new dependency

**Storage**: existing on-disk cache used by `src/cache.js` / `readEntry` / `spawnRefresh`, keyed per repository; labels ride the same cache entry as PR number/status

**Testing**: `scripts/tests/*.test.js` (in particular tests near `segments.test.js`, `render.test.js`); add cases for label truncation and empty-label rendering

**Target Platform**: cross-platform CLI, same as the rest of the statusline

**Project Type**: single-project CLI/library

**Performance Goals**: no new round-trip; labels MUST be fetched in the same `gh pr view --json ...` call already made in `probePrResult` (`src/git.js:328`), by adding `labels` to the existing `--json` field list

**Constraints**: MUST NOT block the redraw path (`getPrInfo` reads cache only, per its existing 300ms-redraw-budget comment); MUST NOT widen the PR segment unboundedly on narrow terminals

**Scale/Scope**: one existing segment (`src/render.js:663-671`) gains a label list; one existing normalizer (`normalizePr`, `src/git.js:259`) gains a `labels` field; one existing prober (`probePrResult`, `src/git.js:328`) requests one more JSON field

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle II (Four-Line Display Structure, Line 1 content)**: Line 1 already lists "pull request (number, state, review state)" as in-scope content; labels extend that same listed item rather than adding a new segment. PASS.
- **Principle II ("a wide element must justify its width against the number beside it")**: labels are lower-signal than the PR number/status already shown, so the design MUST cap and truncate rather than let labels dominate the line. Carried into Phase 1 design (data-model truncation rule).
- **Principle X (Icons Carry Live State)**: labels are plain text, not a new icon; no glyph decision required. PASS, no new icon introduced.
- **Principle III (Token Tracking Grounded in Real Data)**: not applicable to this feature (no rate-limit/token field touched).
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
├── git.js         # normalizePr(), probePrResult(), getPrInfo(): extend with `labels`
├── render.js       # PR segment builder (~line 663): append label text + truncation
└── segments.js     # segment registry, no new row; PR segment already declared

scripts/tests/
├── segments.test.js   # extend: labels included/excluded per current registry
└── render.test.js     # extend: label truncation, empty-label, MR-label cases
```

**Structure Decision**: Single-project CLI, no new files. Three existing files change: `src/git.js` (fetch + normalize labels), `src/render.js` (display + truncate), and their corresponding test files. No new module is warranted for a few added lines of fetch/format logic.

## Complexity Tracking

No Constitution Check violations. This section is not applicable.
