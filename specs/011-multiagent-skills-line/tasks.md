# Tasks: Multi-Agent Skills On The Skills Line

**Input**: Design documents from `/specs/011-multiagent-skills-line/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; a cross-command bridge (write side in one CLI invocation, read side in another) is exactly the kind of thing that silently breaks without a test on each side plus one on the seam.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Confirm `~/.claude/statusline/tasks/` doesn't collide with existing state directories (`~/.claude/statusline/skills/`, `~/.claude/statusline/cache/`) and follows the same `mkdirSync(..., { recursive: true })` pattern already used in `src/skillEvents.js`/`src/cache.js`

---

## Phase 2: Foundational

**Purpose**: The write side must exist and be correct before anything can read it.

- [X] T002 In `src/taskRows.js`, extend `runTaskRows` to best-effort write `{ writtenAt: now, tasks: [{id, label}, ...] }` to `~/.claude/statusline/tasks/latest.json` on every tick, where `label` reuses the same name/description text `renderTaskRow` already renders on the row (research.md's consistency decision); a write failure MUST NOT change the tick's own stdout output or throw
- [X] T003 In `src/skills.js` (or a sibling module), add a reader (e.g. `subagentActivity(now)`) that reads the snapshot file, returns `[]` on any missing/unreadable/malformed file, and returns `[]` when `now - writtenAt` exceeds the freshness window from research.md

**Checkpoint**: A snapshot can be written by one process and read by another, empty/stale cases handled safely.

---

## Phase 3: User Story 1 - Work happening in a subagent shows up on the skills line too (Priority: P1) 🎯 MVP

**Goal**: Running subagent activity appears on the skills line, combined correctly with directly-invoked skills.

**Independent Test**: With a fresh snapshot present, confirm the skills line includes subagent activity; with several sources exceeding the display cap, confirm accurate combined overflow.

### Tests for User Story 1

- [X] T004 [P] [US1] Add a test: a fresh snapshot with one task produces one entry from `subagentActivity()` with the expected `label` (Acceptance Scenario 1)
- [X] T005 [P] [US1] Add a test: the skills chip, given directly-invoked skills plus subagent activity together exceeding `SKILLS_SHOWN`, shows the correct combined subset and an accurate combined "+N" (Acceptance Scenario 2, FR-002)
- [X] T006 [P] [US1] Add a test: with no snapshot file present, the rendered skills chip is byte-for-byte identical to today's directly-invoked-only behavior (Acceptance Scenario 3, FR-004)

### Implementation for User Story 1

- [X] T007 [US1] In `src/render.js`, in the skills chip builder, merge `subagentActivity(now)`'s labels with the directly-invoked `skills` array (deduplicated the same way `getActiveSkills` already dedupes) before computing `hiddenCount`/the shown subset

**Checkpoint**: User Story 1 fully functional; T004-T006 pass.

---

## Phase 4: User Story 2 - A finished subagent's activity leaves the line the same way a finished skill does (Priority: P2)

**Goal**: A subagent's entry disappears once it's no longer running.

**Independent Test**: Show a subagent's activity, then simulate it finishing (an empty-tasks tick), confirm the entry is gone on the next render.

### Tests for User Story 2

- [X] T008 [US2] Add a test: `runTaskRows` called with an empty `tasks` array overwrites the snapshot to also carry an empty `tasks` list (not leaving the previous tick's tasks stranded on disk), so the next read reflects "nothing running" (Acceptance Scenario 1)
- [X] T009 [US2] Add a test: a snapshot older than the freshness window from research.md contributes nothing, even if its `tasks` array is non-empty (covers the case where ticks simply stopped rather than explicitly reporting empty)

### Implementation for User Story 2

- [X] T010 [US2] Confirm T002/T003 already satisfy T008/T009 (an overwrite-every-tick snapshot plus a freshness-windowed read is the whole mechanism); fix only if a gap is found

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - The main skills line and the subagent rows stay two honest, consistent views (Priority: P3)

**Goal**: A subagent's skills-line entry names the same work its own row shows.

**Independent Test**: Compare the label shown on a subagent's row with its skills-line entry for the same task.

### Tests for User Story 3

- [X] T011 [US3] Add a test: for the same task object, the label written to the snapshot (T002) matches the identifying text `renderTaskRow` produces for that task (Acceptance Scenario 1, FR-005)
- [X] T012 [US3] Add a test: a task with no meaningful name or description is omitted from the snapshot's `tasks` list rather than written with an empty/placeholder `label` (FR-006, Edge Case)

### Implementation for User Story 3

- [X] T013 [US3] If T011/T012 find a mismatch or a placeholder leak, fix the `label` derivation in T002; otherwise this task is a no-op confirming consistency already holds

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Document the single-global-snapshot, multi-session limitation from research.md in a code comment at the snapshot's read and write sites, so a future contributor sees the tradeoff where the code lives, not only in this spec
- [X] T015 Run `node scripts/smoke-test.js` to confirm no regression to the skills line for sessions with no subagents running
- [X] T016 Run `specs/011-multiagent-skills-line/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories (write and read must both exist first)
- **User Story 1 (P1)**: depends on Foundational
- **User Story 2 (P2)**: depends on Foundational; independent of US1's merge logic, though it reuses the same snapshot
- **User Story 3 (P3)**: depends on Foundational (T002's label derivation); independently testable once that lands
- **Polish**: depends on all three stories

### Parallel Opportunities

- T004, T005, T006 can be written in parallel
- T008 and T009 can be written in parallel
- T011 and T012 can be written in parallel
- User Story 2 and User Story 3 can proceed in parallel once Foundational is done

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (bridge exists)
2. Complete Phase 3 (User Story 1: subagent activity shown, correctly combined)
3. Validate: T004-T006 pass, quickstart's first two scenarios succeed
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → the write/read bridge exists and is safe on both ends
2. User Story 1 → subagent activity visible, combined overflow accurate (MVP)
3. User Story 2 → confirmed to disappear on completion, not just on appearance
4. User Story 3 → confirmed consistent with the subagent's own row
5. Polish → limitation documented in code, smoke test, quickstart
