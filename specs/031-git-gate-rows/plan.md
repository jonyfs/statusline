# Implementation Plan: Rows for git gates running in this repository's worktrees

**Branch**: `feat/git-gate-rows` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-git-gate-rows/spec.md`

## Summary

The detached refresh learns one more lookup, `gates`: list this repository's worktrees, find the
hook processes running under `git` and the worktree each runs in, read each worktree's
`gates.lock`, and cache the runs. The redraw reads that cache, drops runs whose pid has ended,
and prints one row per run after the bar (after the subagent rows under Copilot), or one chip on
line 1 when the window is too short. Codex is documented as unable to show them.

## Technical Context

**Language/Version**: JavaScript ES modules, Node 18+

**Primary Dependencies**: none at runtime; `git`, `ps` and (macOS) `lsof`, each behind a
platform check and run with arguments as an array

**Storage**: the existing cache file per session directory (`src/cache.js`), entry `gates`

**Testing**: `npm test` (the suite's throwaway HOME); a real repository with a slow hook for the
live check

**Target Platform**: Linux, macOS, Windows (locks only, R5)

**Project Type**: CLI (status line renderer)

**Performance Goals**: no added cost on the redraw path beyond one cache read and one
`process.kill(pid, 0)` per cached run

**Constraints**: the redraw's 300 ms budget; the refresh's own budget of 5 s

**Scale/Scope**: 36 worktrees and about 930 processes on the reference machine

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check |
|---|---|
| II. Three-line structure | Rows follow the bar and never count toward the three, like subagent rows; II is amended to say so (MINOR, 7.3.0). The chip is a registered line 1 segment with its own priority and order. |
| III. Real data | Nothing is estimated: every field is read from the process list, git or the lock file. No pass or fail is inferred after a hook ends. |
| VI. English | All files and output in English. |
| VIII. Generated docs | The README illustration of the rows is produced by the renderer through the preview generator, not drawn. |
| IX. Three platforms | `ps` and `lsof` only behind `process.platform`; arguments as arrays, the directory as `cwd`; Windows degrades to locks and the README says so. |
| X. Icons | Two new glyphs, both rendered from the installed font first (`glyph-evidence.png`), with plain fallbacks in the one glyph table and in `scripts/extract-glyphs.py`. |
| XII. Declared track | `track: full`, `status: active`. |

Re-check after design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/031-git-gate-rows/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/gates-lock.md
├── checklists/requirements.md
├── design/gate-rows.html
└── glyph-evidence.png
```

### Source Code (repository root)

```text
src/gateRuns.js        probe (refresh side): worktrees, processes, cwd, locks, steps
                       reader (redraw side): cached runs, live pids, refresh trigger
src/gateRows.js        rows and chip text, aligned and cut to the width
src/refresh.js         `gates` probe registered
src/freshness.js       MAX_AGE_MS.gates, REFRESH_BUDGET_MS.gates
src/segments.js        `gates` segment (line 1) and its description
src/render.js          probe, reading, chip builder, rows after the bar, glyphs
src/doctor.js          LIVE_PROBES/describe entry if the registry requires it
scripts/extract-glyphs.py, src/preview/glyphs.json, scripts/composer-presets.js
scripts/generate-previews.js (+ docs/previews/gate-rows.svg)
scripts/tests/gate-rows.test.js
README.md, .specify/memory/constitution.md
```

**Structure Decision**: two modules split by process, like `cache.js` and `refresh.js`: the
probe that may take seconds runs only in the detached refresh, and the reader the redraw calls
does no subprocess work at all.

## Complexity Tracking

None.

## Results (2026-10-06)

- Suite: 625 passed locally, 19 of them new in `scripts/tests/gate-rows.test.js`, one of which
  starts a real `pre-commit` in a linked worktree and finds it through `probeGateRuns`.
- The quickstart, run against `bin/cli.js render` on macOS: the first redraw showed nothing and
  started the lookup; the second, three seconds later, showed `1 gate` on line 1 and the row
  `pre-commit · wt · side · sleep 25 · 5s`; after the hook ended, both were gone. A redraw
  reading the cache took 158 ms for the whole process.
- Barbershop, 36 worktrees: `probeGateRuns` took 209 ms and found nothing running at that
  moment. Its process tree during an earlier live gate run (pre-commit, `gates.sh`,
  `review-cycle.test.sh` and its subshell, plus `npm run -s lint`) is the shape the step tests
  use.
- One budget test (100 renders against an 80 MB transcript, p95 under 300 ms) failed once in a
  full run with the machine's load average at 29 and passed twice when run alone.
- Planning changed one decision in the spec: the line 1 count is always shown when gates run,
  not only in a short window, because it had to be a registered segment the composer can
  arrange (FR-006, User Story 4).
- CI run 37409296612 passed on Linux, macOS and Windows (Node 18, 20, 22), with the install, preview and composer jobs; on Linux the real-hook test found its worktree through `/proc`.
