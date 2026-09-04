# Tasks: Subagent-Aware Activity Status

**Input**: Design documents from `/specs/012-subagent-activity-status/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; a one-line OR is easy to write and easy to get subtly wrong (e.g. inverted, or applied after the value is already read elsewhere).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Re-read `gather()`'s `activity` computation (`src/render.js`, ~line 308) and `getSessionActivity()` (`src/skills.js`) to confirm the exact patch point before changing it

---

## Phase 2: Foundational

**Purpose**: No separate foundational work; this feature is a single small change reusing existing infrastructure (specs/011's `subagentActivity()`). This phase is the patch itself, since there's nothing to build ahead of the user story.

- [X] T002 In `src/render.js`'s `gather()`, right after `activity` is computed, set `activity.value.working = activity.value.working || subagentActivity(now).length > 0` when `activity.value` is non-null

**Checkpoint**: `working` reflects both sources; ready for story-level tests to confirm each case.

---

## Phase 3: User Story 1 - The statusline shows "working" while a subagent is running, even if the main session has gone quiet (Priority: P1) 🎯 MVP

**Goal**: A running subagent alone is enough to show "working."

**Independent Test**: Fresh subagent snapshot, stale top-level transcript; confirm "working" is shown.

### Tests for User Story 1

- [X] T003 [P] [US1] Add a test: with a fresh subagent snapshot present and the top-level transcript's `working` false (quiet past `ACTIVE_WITHIN_MS`), the rendered activity badge shows "working" (Acceptance Scenario 1)
- [X] T004 [P] [US1] Add a test: with both the top-level session and a subagent active, the badge still shows "working" (Acceptance Scenario 2, unchanged case)
- [X] T005 [P] [US1] Add a test: with no subagent running and the top-level session quiet past the threshold, the badge shows "idle," exactly as before this feature (Acceptance Scenario 3)

### Implementation for User Story 1

- [X] T006 [US1] Confirm T002 already satisfies T003-T005; fix only if a test reveals the OR is misplaced or inverted

**Checkpoint**: User Story 1 fully functional; T003-T005 pass.

---

## Phase 4: User Story 2 - The status returns to accurately reflecting idle once the subagent finishes (Priority: P2)

**Goal**: No stuck "working" once everything is actually quiet.

**Independent Test**: Subagent finishes (empty snapshot or one past the freshness window), top-level session quiet; confirm "idle."

### Tests for User Story 2

- [X] T007 [US2] Add a test: a subagent snapshot past specs/011's freshness window, combined with a quiet top-level session, yields "idle" (Acceptance Scenario 1)

### Implementation for User Story 2

- [X] T008 [US2] Confirm T002 already satisfies T007, since `subagentActivity()`'s own freshness window (not a new one) is what's being reused; no new code expected

**Checkpoint**: Both user stories independently functional and verified.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T009 [P] Add a test confirming behavior is unchanged when no subagent snapshot has ever existed (FR-005), matching today's `activity.test.js` cases exactly
- [X] T010 Run `node scripts/smoke-test.js` to confirm no regression to line 2 for sessions with no subagents
- [X] T011 Run `specs/012-subagent-activity-status/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; is the feature's entire implementation, so both user stories depend on it
- **User Story 1 (P1)**: depends on Foundational
- **User Story 2 (P2)**: depends on Foundational; independent of US1, reuses the same patch
- **Polish**: depends on both stories

### Parallel Opportunities

- T003, T004, T005 can be written in parallel
- User Story 2 can proceed in parallel with User Story 1 once Foundational (T002) is done

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (the OR patch)
2. Complete Phase 3 (User Story 1: subagent activity shows "working")
3. Validate: T003-T005 pass
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → the OR patch exists
2. User Story 1 → correct "working" while a subagent runs (MVP)
3. User Story 2 → confirmed to return to "idle" once genuinely quiet
4. Polish → no-snapshot regression check, smoke test, quickstart
