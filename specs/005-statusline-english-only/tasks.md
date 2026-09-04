# Tasks: Statusline English-Only Output

**Input**: Design documents from `/specs/005-statusline-english-only/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: The regression check (US3) is itself the test artifact for this feature; additional unit-test tasks are included for the string audit and pass-through guarantee since they're the only way to verify FR-001 through FR-006.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Confirm baseline: re-run the non-English literal grep from research.md across `src/*.js`, `bin/cli.js` and record the result (expected: zero, per the planning-time scan) as a comment at the top of `scripts/check-english-strings.js` before writing it

---

## Phase 2: Foundational

**Purpose**: The regression script is the shared tool every user story either produces or is verified against.

- [X] T002 Create `scripts/check-english-strings.js`: extract string literals from `src/*.js` and `bin/cli.js`, flag any containing non-ASCII/non-English-word patterns not on a maintained allowlist, print file:line:text for each, exit non-zero if any found
- [X] T003 Wire `scripts/check-english-strings.js` into `scripts/test-harness.js` so it runs alongside the existing `scripts/tests/*.test.js` suite

**Checkpoint**: The check exists and runs (even if the allowlist still needs tuning per US1/US3 below).

---

## Phase 3: User Story 1 - Consistent English labels across all segments (Priority: P1) 🎯 MVP

**Goal**: Every tool-authored string the statusline renders is confirmed English.

**Independent Test**: Run with `LANG`/`LC_ALL` set to a non-English locale; no statusline-authored string changes language.

### Implementation for User Story 1

- [X] T004 [US1] Run `node scripts/check-english-strings.js` against current `src/segments.js`, `src/render.js`, `src/freshness.js`, `src/taskRows.js`, `src/skills.js` and fix any flagged literal (expected: none, but this task is the actual verification, not an assumption)
- [X] T005 [US1] Run `node scripts/check-english-strings.js` against `bin/cli.js` (help/doctor output) and fix any flagged literal
- [X] T006 [US1] Add a locale test in `scripts/tests/english-output.test.js`: spawn the statusline with `LANG=pt_BR.UTF-8` and assert rendered output is unchanged from the default-locale run (proves locale independence per Acceptance Scenario 1)
- [X] T007 [US1] Add a doctor/help output check in `scripts/tests/english-output.test.js`: run `--doctor` and `--help`, assert output contains no flagged non-English literal per T002's rules

**Checkpoint**: User Story 1 fully verified and testable independently.

---

## Phase 4: User Story 2 - Pass-through data is left untranslated (Priority: P2)

**Goal**: Non-English branch names, commit messages, and task titles render unchanged.

**Independent Test**: Point the statusline at a repo with a non-English branch name; confirm it's unchanged while surrounding labels stay English.

### Implementation for User Story 2

- [X] T008 [P] [US2] Add a fixture test in `scripts/tests/english-output.test.js` (or extend `scripts/tests/branch-scope.test.js`): a branch name containing non-English characters renders byte-for-byte unchanged in the git segment
- [X] T009 [P] [US2] Add a fixture test verifying a task title with non-English text renders unchanged in the todo/task segment (`scripts/tests/task-rows.test.js`)
- [X] T010 [US2] Confirm `scripts/check-english-strings.js` (T002) never inspects runtime data (branch names, task titles, commit messages), only `src/`/`bin/` literals; add a code comment in the script stating this scope boundary explicitly

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - Regression guard for future strings (Priority: P3)

**Goal**: A contributor adding a new tool-authored string gets caught before merge if it isn't English.

**Independent Test**: Introduce a deliberately non-English literal, run the check, confirm it's flagged.

### Implementation for User Story 3

- [X] T011 [US3] Add a self-test in `scripts/tests/check-english-strings.test.js`: temporarily inject a known non-English literal into a throwaway fixture file, run the checker against it, assert non-zero exit and correct file:line reporting
- [X] T012 [US3] Document the check in `README.md`'s contributing/testing section: how to run it, what it catches, how to extend the allowlist for a legitimately new English word
- [X] T013 [US3] Confirm `npm test` (or the harness it drives) runs the check by default, so CI/local pre-merge runs catch a new violation without an extra manual step

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Run `node scripts/smoke-test.js` to confirm no regression to existing segment widths/alignment from any string change made in T004/T005
- [X] T015 Run `specs/005-statusline-english-only/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories (the check script must exist before any story can use it)
- **User Story 1 (P1)**: depends on Foundational; no dependency on US2/US3
- **User Story 2 (P2)**: depends on Foundational; independent of US1 (may run in parallel)
- **User Story 3 (P3)**: depends on Foundational (T002); independent of US1/US2 findings, though it exercises the same script
- **Polish**: depends on all three stories being complete

### Parallel Opportunities

- T008 and T009 (different test fixtures, different files) can run in parallel
- User Story 1 and User Story 2 can be worked in parallel once Phase 2 is done, since they touch different concerns (tool-authored strings vs. pass-through data)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (User Story 1)
3. Validate: locale test and doctor/help check both pass
4. This alone resolves the user's original complaint

### Incremental Delivery

1. Setup + Foundational → check script exists
2. User Story 1 → confirms/fixes English-only rendering (MVP)
3. User Story 2 → confirms pass-through data untouched (regression safety net)
4. User Story 3 → guard against future drift
5. Polish → smoke test + quickstart validation
