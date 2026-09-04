# Tasks: Spec-Driven Development Step Indicator

**Input**: Design documents from `/specs/007-speckit-step-indicator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; the mapping table and fallback rule are pure functions, cheap to unit test and easy to get subtly wrong (e.g. a raw skill id leaking through).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 List every installed `speckit-*` skill (`ls .claude/skills/ | grep '^speckit-'`) and record the exact set used to build the lookup table in T003

---

## Phase 2: Foundational

**Purpose**: The lookup function must exist before it can be wired into rendering.

- [X] T002 In `src/skills.js`, add an exported `SDD_STEP_LABELS` object mapping each `speckit-*` skill name (from T001) to an English step label, per data-model.md's starting set
- [X] T003 In `src/skills.js`, add an exported `sddStepFor(skillName)` function: returns `SDD_STEP_LABELS[skillName]` if present; otherwise, for any name starting with `speckit-`, returns the fallback-formatted label (strip prefix, hyphens to spaces, capitalize first letter, per research.md); otherwise returns `null`

**Checkpoint**: `sddStepFor()` is callable and covers every installed speckit skill plus the fallback case.

---

## Phase 3: User Story 1 - See the current SDD step while a speckit skill runs (Priority: P1) 🎯 MVP

**Goal**: A readable SDD step label appears when a `speckit-*` skill is active.

**Independent Test**: Trigger a speckit-* skill, watch the statusline, confirm a readable step label appears matching the active skill.

### Tests for User Story 1

- [X] T004 [P] [US1] Add a test in `scripts/tests/skills.test.js` (create if it doesn't exist): `sddStepFor("speckit-specify")` returns "Specifying", `sddStepFor("speckit-plan")` returns "Planning", `sddStepFor("speckit-implement")` returns "Implementing" (Acceptance Scenarios 1-3)
- [X] T005 [P] [US1] Add a test confirming that when `getActiveSkills()` returns an empty array (or no `speckit-*` entries), the rendered line-2 skills chip has no step-label suffix (Acceptance Scenario 4)

### Implementation for User Story 1

- [X] T006 [US1] In `src/render.js`, in the line-2 skills chip builder (~line 698-713), call `sddStepFor(skills[0])` and, if non-null, append it in parentheses to the existing chip text (e.g. `speckit-plan (Planning)`)

**Checkpoint**: User Story 1 fully functional; T004/T005 pass.

---

## Phase 4: User Story 2 - Step indicator expires like other skill activity (Priority: P2)

**Goal**: The step label disappears once the underlying skill ages out of the active window.

**Independent Test**: Run a speckit-* skill, wait past the active-skill window, confirm the step indicator is gone.

### Tests for User Story 2

- [X] T007 [US2] Add a test: with `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` set very small and a skill event older than that window, `getActiveSkills()` returns no `speckit-*` entry and the rendered chip carries no step label

### Implementation for User Story 2

- [X] T008 [US2] Confirm T006 introduces no new expiry logic: the step label is derived purely from `getActiveSkills()`'s existing output each render, so it inherits expiry automatically. This task is verification (re-read T006's diff), not new code, per research.md's decision to reuse the existing window.

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - Every current speckit-* skill maps to a readable step (Priority: P3)

**Goal**: No installed `speckit-*` skill ever falls through to showing its raw id.

**Independent Test**: Run each installed speckit-* skill in turn; confirm each produces a distinct, readable label.

### Tests for User Story 3

- [X] T009 [US3] Add a test iterating every skill name from T001: `sddStepFor(name)` never returns `null` and never equals the raw `speckit-*` string verbatim (proves FR-006 and SC-003)
- [X] T010 [US3] Add a test: for a non-speckit skill (e.g. `"superpowers:brainstorming"`), `sddStepFor()` returns `null`, and the rendered chip carries no step label (Acceptance Scenario 2 of US3)

### Implementation for User Story 3

- [X] T011 [US3] If T009 finds any installed skill missing from `SDD_STEP_LABELS` with an unsatisfying fallback result, add an explicit entry to the table in T002 (e.g. a compound name that formats awkwardly)

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Add a test for the multi-active-skill case: when `getActiveSkills()` returns `["speckit-tasks", "speckit-plan"]` (most recent first), the step label reflects `speckit-tasks`'s step, not `speckit-plan`'s (FR-005)
- [X] T013 Run `node scripts/smoke-test.js` to confirm no regression to line 2 for non-speckit sessions
- [X] T014 Run `specs/007-speckit-step-indicator/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories (the lookup function must exist first)
- **User Story 1 (P1)**: depends on Foundational; no dependency on US2/US3
- **User Story 2 (P2)**: depends on Foundational and US1's rendering hook (T006) existing to observe expiry against
- **User Story 3 (P3)**: depends on Foundational (T002/T003); independently testable once those land
- **Polish**: depends on all three stories

### Parallel Opportunities

- T004 and T005 can be written in parallel
- T009 and T010 can be written in parallel
- User Story 3 can proceed in parallel with User Story 2 once Foundational is done

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (lookup table + function)
2. Complete Phase 3 (User Story 1: label shown on the chip)
3. Validate: T004/T005 pass, quickstart's first scenario succeeds
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → `sddStepFor()` exists and is correct for every known skill
2. User Story 1 → step label visible (MVP)
3. User Story 2 → expiry confirmed to just work via the existing window
4. User Story 3 → completeness across every installed speckit skill, explicit fallback coverage
5. Polish → multi-skill ordering check, smoke test, quickstart
