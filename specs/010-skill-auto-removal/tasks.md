# Tasks: Skill Auto-Removal

**Input**: Design documents from `/specs/010-skill-auto-removal/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; verifying an existing mechanism against a spec's full acceptance criteria is only meaningful as tests.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Re-read `windowMs()`, `getActiveSkills`, `getActiveSkillsDetailed` (`src/skills.js`), `readSkillEvents` (`src/skillEvents.js`), and `scanTailForSkills`/`scanTail` (`src/transcriptTail.js`) to confirm the current expiry filtering logic before writing verification tests against it

---

## Phase 2: Foundational

**Purpose**: Nothing new to build; the existing mechanism is the foundation. This phase confirms it's wired consistently across both detection paths before user-story-level tests build on it.

- [X] T002 Add a test confirming both the hook path (`readSkillEvents`) and the transcript-fallback path (`scanTailForSkills`) apply the identical `windowMs()` value for the same clock/skill-age inputs, so neither path can silently diverge on "when does a skill expire" (FR-002)

**Checkpoint**: Both detection paths are confirmed to share one expiry rule.

---

## Phase 3: User Story 1 - A finished skill disappears without any action from the developer (Priority: P1) 🎯 MVP

**Goal**: A skill not invoked past the window is absent from the very next render, no restart or refresh needed.

**Independent Test**: Invoke a skill, confirm it's shown, let it age past the window, confirm it's gone with no action taken.

### Tests for User Story 1

- [X] T003 [P] [US1] Add/confirm a test: a skill invoked once, then not re-invoked, is present before the window elapses and absent after, on a plain re-render with no other action (Acceptance Scenario 1). Extends the existing "skills expire once they stop being used" case in `scripts/tests/skills.test.js` if it doesn't already cover this framing.
- [X] T004 [P] [US1] Add a test: a skill re-invoked repeatedly within the window remains shown across multiple renders (Acceptance Scenario 2)

### Implementation for User Story 1

- [X] T005 [US1] If T003/T004 reveal any gap (e.g. a code path that doesn't re-check the window on every render, or caches a stale "shown" state), fix it in `src/skills.js`; otherwise this task is a no-op confirming the existing behavior already passes

**Checkpoint**: User Story 1 fully verified; T003/T004 pass without needing T005 to change anything (expected, per research.md), or with a small fix if a real gap is found.

---

## Phase 4: User Story 2 - A skill's removal doesn't wait longer than a reasonable, known delay (Priority: P2)

**Goal**: The delay is single, documented, and configurable.

**Independent Test**: Confirm removal happens exactly at the documented delay, and that changing the documented setting changes the delay.

### Tests for User Story 2

- [X] T006 [P] [US2] Add a test: with `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` unset, a skill exactly at the 30-minute boundary is still shown, and one past it is not (Acceptance Scenario 1, exercising `DEFAULT_WINDOW_MS`)
- [X] T007 [P] [US2] Add a test: with `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` set to a custom value, the boundary moves accordingly (Acceptance Scenario 2)

### Implementation for User Story 2

- [X] T008 [US2] Confirm README already documents the default delay and the override (verified in research.md); no doc change needed. This task is a check, not new writing.

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - Multiple skills expire independently (Priority: P3)

**Goal**: Each skill's expiry depends only on its own last-used time.

**Independent Test**: Use skill A, let it age out, then use skill B; confirm only B shows.

### Tests for User Story 3

- [X] T009 [US3] Add a test: skill A invoked well before the window, skill B invoked just now, in the same session; the rendered skills line shows only B (Acceptance Scenario 1)

### Implementation for User Story 3

- [X] T010 [US3] Confirm the per-skill filtering already in `scanTailForSkills`/`readSkillEvents` (each entry checked against `now - windowMs` independently, not against a single session-wide "last activity" timestamp) already satisfies this; fix if any code path collapses to a single shared cutoff instead of a per-skill one

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 [P] Add an edge-case test: a skill invoked once with no further session activity at all is removed once the window elapses, the same as if other work had continued (spec's first Edge Case)
- [X] T012 Run `node scripts/smoke-test.js` to confirm no regression to the skills line's common case
- [X] T013 Run `specs/010-skill-auto-removal/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; establishes hook-vs-transcript parity before story-level tests build on it
- **User Story 1 (P1)**: depends on Foundational
- **User Story 2 (P2)**: depends on Foundational; independent of US1
- **User Story 3 (P3)**: depends on Foundational; independent of US1/US2
- **Polish**: depends on all three stories

### Parallel Opportunities

- T003 and T004 can be written in parallel
- T006 and T007 can be written in parallel
- User Story 2 and User Story 3 can proceed in parallel once Foundational is done

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (parity confirmed)
2. Complete Phase 3 (User Story 1: automatic removal verified)
3. Validate: T003/T004 pass
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → both detection paths confirmed to share one expiry rule
2. User Story 1 → automatic removal verified (MVP)
3. User Story 2 → delay documented and configurable, confirmed
4. User Story 3 → per-skill independence confirmed
5. Polish → edge case, smoke test, quickstart
