---
description: "Task list for the spend-limit chip and the at-limit form"
---

# Tasks: The bar keeps counting after the limit is lifted

**Input**: Design documents from `specs/023-extra-usage-limit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/output.md

**Tests**: Included. The repository works test-first, and every behaviour in
`contracts/output.md` has a row a test can check.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1, US2, US3)

## Phase 1: Setup

- [X] T001 Amend Principle III in `.specify/memory/constitution.md`: add `rate_limits.spend_limit.used_percentage` and its `resets_at` to the displayed fields, allow that figure above 100%, bump the version to 6.2.0 with a Sync Impact Report entry (FR-013)

## Phase 2: Foundational (blocks every story)

- [X] T002 In `src/tokens.js`, extend `getRateLimits` to return `spendLimitPct` (rounded, null when not a finite non-negative number) and `spendLimitResetsAt`, and give `formatResetCountdown` and `shortCountdown` an optional `maxMs` argument that defaults to the current 30-day bound (FR-001, FR-014)
- [X] T003 In `src/render.js` `gather()`, add `spendLimit` and `spendLimitReset` readings from the payload next to `fiveHour` and `sevenDay`

**Checkpoint**: readings exist and nothing on the bar has changed yet (`npm test` stays green).

## Phase 3: User Story 1, see how much of the granted allowance is used (P1) MVP

**Goal**: a `spend` chip on line 3 whenever the payload carries a valid spend-limit entry.

**Independent Test**: render a payload with `spend_limit` and compare line 3 with the rows in `contracts/output.md`.

### Tests for User Story 1

- [X] T004 [US1] Write `scripts/tests/spend-limit.test.js` with failing tests for: chip shown with figure and reset; figure follows the payload across two renders; 115% shown uncapped with the critical band mark; reset `?` when missing; reset `?` beyond 32 days and accepted at 31 days; chip absent for missing, negative, NaN or string values; line 3 byte-identical to before when no spend entry and no window at 100% (SC-005); plain mode uses `$`

### Implementation for User Story 1

- [X] T005 [P] [US1] Add the registry row `{ key: "spendLimit", line: 3, order: 52, priority: 95, colour: "ramp", source: "payload" }` and its `SEGMENT_ABOUT` sentence in `src/segments.js`
- [X] T006 [P] [US1] Add `NF_WALLET = "\u{F0584}"` and the glyph key `spend` (Nerd `NF_WALLET`, plain `$`) to `GLYPHS` in `src/render.js`, and add `"F0584"` to `WANTED` in `scripts/extract-glyphs.py`
- [X] T007 [US1] Add the `spendLimit` builder to `line3Content` in `src/render.js`: ramp colour, band mark, `spend N%`, reset after ` · ` using the 7-day rule (countdown inside a day, `resetMomentLabel` beyond) with the 32-day bound, and reset text shed with `moment: false`
- [X] T008 [US1] Regenerate `src/preview/glyphs.json` with `python3 scripts/extract-glyphs.py > src/preview/glyphs.json` and confirm the glyph test in `scripts/tests/` passes

**Checkpoint**: Story 1 works alone. `npm test` passes.

## Phase 4: User Story 2, an exhausted window reads as exhausted (P2)

**Goal**: `full` after the band mark on a 5-hour or 7-day chip at 100% or more.

**Independent Test**: render a payload with `five_hour.used_percentage: 100` and no spend entry.

### Tests for User Story 2

- [X] T009 [US2] Add failing tests to `scripts/tests/spend-limit.test.js`: 5h at 100 reads `5h 100%▴ full · <countdown>`; 7d at 100 reads `7d 100%▴ full · <day>`; 99 has no `full`; 99.6 rounds to 100 and has `full`; `full` survives when reset text is shed at narrow width; no spend chip and no invented figure when absent

### Implementation for User Story 2

- [X] T010 [US2] In `src/render.js`, add `full` to the `fiveHour` and `sevenDay` builders when the displayed figure is at least 100, placed before the reset text so width shedding never removes it (FR-006)

**Checkpoint**: Stories 1 and 2 both pass.

## Phase 5: User Story 3, find out whether this setup reports the granted allowance (P3)

**Goal**: `doctor` reports the spend-limit allowance, and explains its absence.

**Independent Test**: run the doctor tests with and without a spend entry.

### Tests for User Story 3

- [X] T011 [US3] Add failing tests to `scripts/tests/spend-limit.test.js` (or `scripts/tests/doctor.test.js`, whichever already builds doctor rows from a payload): row `on` with `12% · resets in …`; row `off` whose reason names the Claude gateway; `--explain` includes `spendLimit`

### Implementation for User Story 3

- [X] T012 [US3] In `src/doctor.js`, add `spendLimit` to `DESCRIBE` using `describeWindow` with the 32-day bound, and in `absenceReason` return "not in the payload: Claude Code reports a spend limit only behind a Claude gateway with spend limits" for `spendLimit` (FR-010)

**Checkpoint**: all three stories pass.

## Phase 6: Polish and cross-cutting

- [X] T013 [P] Add a spend-limit case to `scripts/preview-fixtures.js` if the README shows line 3 states there, then run `npm run previews` to regenerate the images (Principle VIII)
- [X] T014 [P] Document the spend chip, the `full` form and the gateway-only condition in `README.md` near the existing 5-hour and 7-day description, then run the humanizer over the edited prose (FR-012)
- [X] T015 Run `npm test` and the quickstart commands in `specs/023-extra-usage-limit/quickstart.md`, and record the results
- [X] T017 Suppress the run-out projection in `src/render.js` when the 5-hour window is already at 100%, with a test in `scripts/tests/spend-limit.test.js` that fails without it (found by T015)
- [X] T016 Set `status: done` in `specs/023-extra-usage-limit/spec.md` once everything above is checked

## Dependencies

- T001 is independent of code, but must land before the feature ships.
- T002 and T003 block every story.
- US1 (T004 to T008), US2 (T009, T010) and US3 (T011, T012) each depend only on Phase 2. US2 and US3 touch the same files as US1 (`render.js`, the test file), so running them one after another avoids merge churn.
- Polish depends on the stories it documents.

## Parallel opportunities

- T005 and T006 touch different files and can run together.
- T013 and T014 can run together.

## Implementation strategy

MVP is Phase 1 through Phase 3: the spend chip alone answers the complaint for gateway users.
Phase 4 adds value for everyone else. Phase 5 explains an absence. Each phase ends with a
green `npm test`.
