# Tasks: Rows for git gates running in this repository's worktrees

## Phase 1: Setup

- [X] T001 Amend Principle II in `.specify/memory/constitution.md` for gate rows, 7.3.0
- [X] T002 [P] Add `gates` to `MAX_AGE_MS` and `REFRESH_BUDGET_MS` in `src/freshness.js`

## Phase 2: Foundational (blocks every story)

- [X] T003 Failing tests in `scripts/tests/gate-rows.test.js` for the pure parts: porcelain parsing, `etime` parsing, hook detection by parent and name, step labels (R7), worktree attribution by longest prefix, lock state (R3)
- [X] T004 `src/gateRuns.js`: the pure functions behind T003, then `probeGateRuns(cwd)` (git, `ps`, `/proc` or `lsof`, locks) and `readGateRuns(cwd)` (cache, live pids, refresh trigger); register `gates` in `src/refresh.js`

## Phase 3: User Story 1, see which gates are running and where (P1)

- [X] T005 [US1] Failing tests: rows render after the bar for Claude and Copilot (after agent rows), the session's worktree is marked, no runs means a byte-identical bar, a dead pid drops its row, other repositories are excluded
- [X] T006 [US1] `src/gateRows.js` and the `src/render.js` wiring (probe, reading, rows after the bar, glyphs in the table and `scripts/extract-glyphs.py` / `src/preview/glyphs.json`)

## Phase 4: User Story 2, a run waiting for another (P2)

- [X] T007 [US2] Failing tests, then the waiting state from `gates.lock`, a stale lock ignored, and the lock-only run (Windows path)

## Phase 5: User Story 3, Copilot and Codex (P2)

- [X] T008 [US3] README: the rows, where the data comes from, the Windows limit, and that Codex cannot show them; the feature matrix row

## Phase 6: User Story 4, a short window (P3)

- [X] T009 [US4] Failing tests, then the `gates` line 1 segment (registry row, description, chip builder), the collapse when the rows do not fit the height, the cap of 6 with `+N more`, and the arrangement switching it off; composer preset and doctor entries the registry tests require

## Phase 7: Polish

- [X] T010 [P] A generated README preview of the rows (`scripts/generate-previews.js`, `docs/previews/gate-rows.svg`)
- [X] T011 Validate for real with the quickstart on this machine and, if one runs, a barbershop gate; record results in `plan.md`
- [X] T012 Suite, CI, merge, version, update the installs
