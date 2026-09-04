# Tasks: Speckit Feature Indicator

**Input**: Design documents from `/specs/009-speckit-feature-indicator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; the reader function and its fallback chain are pure and cheap to get subtly wrong (e.g. showing a stale or fabricated identifier).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Confirm `.specify/feature.json`'s current shape (`{"feature_directory": "specs/<id>"}`) against this session's own file to ground the reader's expected input

---

## Phase 2: Foundational

**Purpose**: The reader function must exist before it can be wired into rendering.

- [X] T002 In `src/skills.js`, add an exported `inProgressFeatureId(projectRoot)` function: reads `.specify/feature.json`, parses `feature_directory`, returns its basename, or `null` on any missing file/parse error/absent-or-non-string field (per research.md's degrade-to-null decision)

**Checkpoint**: `inProgressFeatureId()` is callable and returns `null` safely for every failure mode.

---

## Phase 3: User Story 1 - See which feature a speckit skill is working on (Priority: P1) 🎯 MVP

**Goal**: The skills chip shows `<skill> (<feature-id>)` when a speckit-* skill is active and a feature is in progress.

**Independent Test**: Set a known feature id, run a speckit-* skill, confirm the exact format renders.

### Tests for User Story 1

- [X] T003 [P] [US1] Add a test: with `.specify/feature.json` present and `speckit-plan` active, the rendered skills chip shows `speckit-plan (009-speckit-feature-indicator)` (Acceptance Scenario 1)
- [X] T004 [P] [US1] Add a test: with a different active speckit-* skill and the same `feature.json`, only the skill name changes, the feature id stays the same (Acceptance Scenario 2)
- [X] T005 [P] [US1] Add a test: with no speckit-* skill active, no feature identification appears even if `feature.json` is present (Acceptance Scenario 3)

### Implementation for User Story 1

- [X] T006 [US1] In `src/render.js`, in the line-2 skills chip builder (near the existing `sddStepFor(skills[0])` call), read the in-progress feature id via `inProgressFeatureId` and use it in place of the step label when both a speckit-* skill is active and an id is available

**Checkpoint**: User Story 1 fully functional; T003-T005 pass.

---

## Phase 4: User Story 2 - The feature identifier updates as work moves between features (Priority: P2)

**Goal**: The shown identifier tracks `feature.json` live, never sticking on a stale value.

**Independent Test**: Switch `feature.json` between two features across two renders; confirm the identifier switches too.

### Tests for User Story 2

- [X] T007 [US2] Add a test: render once with `feature.json` pointing at feature A, then again after rewriting it to point at feature B; assert the second render shows B, not A (Acceptance Scenario 1)

### Implementation for User Story 2

- [X] T008 [US2] Confirm `inProgressFeatureId` performs a fresh read on every call (no caching that would need explicit invalidation); this task is verification of T002's implementation, not new code, since a plain synchronous file read is already fresh by construction

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - No misleading identifier when there is nothing to identify (Priority: P3)

**Goal**: Absence of a recorded feature renders as the skill name alone, never a fabricated or empty parenthetical.

**Independent Test**: Run a speckit-* skill with no `feature.json` (or a malformed one); confirm no parentheses appear (or the step-label fallback, if any).

### Tests for User Story 3

- [X] T009 [P] [US3] Add a test: `inProgressFeatureId` returns `null` when `.specify/feature.json` does not exist
- [X] T010 [P] [US3] Add a test: `inProgressFeatureId` returns `null` when the file contains invalid JSON, and when `feature_directory` is missing or not a string
- [X] T011 [US3] Add a test: with `inProgressFeatureId` returning `null` and a speckit-* skill active, the rendered chip shows the skill name with no empty `()` (falls back to the step label if `sddStepFor` supplies one, otherwise no parenthetical at all)

### Implementation for User Story 3

- [X] T012 [US3] Verify T006's render.js change already implements the correct fallback chain (feature id, then step label, then nothing); fix if the chain instead produces an empty `()` in the no-id/no-step case

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Add a test confirming a long feature identifier is still subject to the existing line-width trim pass, not given special unbounded space (FR-006)
- [X] T014 Run `node scripts/smoke-test.js` to confirm no regression to line 2 for sessions with no speckit-* skill active
- [X] T015 Run `specs/009-speckit-feature-indicator/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories (the reader must exist first)
- **User Story 1 (P1)**: depends on Foundational
- **User Story 2 (P2)**: depends on Foundational and US1's wiring (T006) to have something to observe updating
- **User Story 3 (P3)**: depends on Foundational (T002's null-handling); independently testable once that lands
- **Polish**: depends on all three stories

### Parallel Opportunities

- T003, T004, T005 can be written in parallel
- T009 and T010 can be written in parallel
- User Story 3 can proceed in parallel with User Story 2 once Foundational is done

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (reader function exists)
2. Complete Phase 3 (User Story 1: identifier shown)
3. Validate: T003-T005 pass, quickstart's first scenario succeeds
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → `inProgressFeatureId()` exists and handles every failure mode
2. User Story 1 → identifier visible (MVP)
3. User Story 2 → confirmed to track live changes
4. User Story 3 → confirmed never to fabricate or blank-parenthesize
5. Polish → width-trim check, smoke test, quickstart
