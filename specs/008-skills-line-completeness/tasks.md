# Tasks: Skills Line Completeness

**Input**: Design documents from `/specs/008-skills-line-completeness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included; this is a correctness fix to existing counting/detection logic, and the whole feature is only verifiable by asserting exact counts and diagnostic text.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Re-read `getActiveSkills`/`getActiveSkillsDetailed` (`src/skills.js`), `scanTailForSkills`/`scanTail` (`src/transcriptTail.js`), and `SKILLS_PROBED`/`SKILLS_SHOWN` usage (`src/render.js:237-255`) to confirm the exact current scan-depth-vs-display-cap mechanics before changing them

---

## Phase 2: Foundational

**Purpose**: A true-count signal must exist before the overflow math (US1) or the doctor diagnostics (US3) can use it.

- [X] T002 In `src/transcriptTail.js`, extend `scanTailForSkills` to also return a `trueCount` (or equivalent unbounded-within-window tally) distinct from the capped `skills` array it already returns, without changing the existing `skills`/`truncated`/`bytesRead` return shape's meaning
- [X] T003 In `src/skillEvents.js`, extend `readSkillEvents` (or add a sibling function) to likewise report the true count of distinct skill names within the window, for the hook-based path

**Checkpoint**: Both detection paths (hook and transcript fallback) can report a true count, not just a capped list.

---

## Phase 3: User Story 1 - Every recently active skill is accounted for (Priority: P1) 🎯 MVP

**Goal**: The skills line's shown names plus its overflow count always sum to the true number of active skills.

**Independent Test**: Invoke more skills than the line shows at once; confirm shown + "+N" equals the true total.

### Tests for User Story 1

- [X] T004 [P] [US1] Add a test in `scripts/tests/registry.test.js` or a new `scripts/tests/skills-completeness.test.js`: given 19 distinct skill invocations within the window (exceeding `SKILLS_PROBED`), the computed `hiddenCount` reflects `19 - SKILLS_SHOWN`, not `SKILLS_PROBED - SKILLS_SHOWN`
- [X] T005 [P] [US1] Add a test: given exactly 3 skills invoked, all 3 appear and `hiddenCount` is 0 (Acceptance Scenario 1)
- [X] T006 [P] [US1] Add a test: given 8 skills invoked, the 5 most recent are shown and `hiddenCount` is 3 (Acceptance Scenario 2)

### Implementation for User Story 1

- [X] T007 [US1] In `src/render.js`, change the `hiddenCount` computation (line ~255) from `Math.max(0, list.length - SKILLS_SHOWN)` to use the new true-count signal from T002/T003 instead of the length of the already-capped `list`
- [X] T008 [US1] Ensure the dedup-by-name behavior (repeated skill names counted once) is unaffected by T002/T003/T007: add a regression test confirming a skill invoked 3 times still counts as 1 in both the shown list and the true count (FR-006)

**Checkpoint**: User Story 1 fully functional; T004-T006 and the dedup regression test pass.

---

## Phase 4: User Story 2 - A skill run inside a subagent or background task is tracked the same as one run directly (Priority: P2)

**Goal**: A skill invoked by a subagent counts on the parent session's skills line.

**Independent Test**: Dispatch a subagent that invokes a named skill; confirm it appears on the parent session's skills line within the window.

### Tests for User Story 2

- [X] T009 [US2] Add a test constructing a transcript fixture containing a subagent/Task-tool invocation whose nested content includes a `"skill"` tool_use block; assert `scanTailForSkills` (post-fix) includes that skill name in its result

### Implementation for User Story 2

- [X] T010 [US2] Investigate (per research.md) whether Claude Code's `PostToolUse` hook fires for nested/subagent tool calls under the parent session id; if yes, confirm `appendSkillEvent` already captures it and this story needs only T009's test as proof
- [X] T011 [US2] If T010 finds the hook does not fire for subagent-nested calls, extend `scanTailForSkills`'s block-walking in `src/transcriptTail.js` to also recurse into subagent/Task-tool result blocks looking for nested `"skill"` tool_use entries, so the transcript-fallback path (the documented source of truth) covers this case regardless of hook behavior

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - The developer can tell why a skill isn't showing (Priority: P3)

**Goal**: Doctor output explains expiry, scan-depth truncation, and hook-vs-fallback status.

**Independent Test**: Check doctor output after a skill has expired from the window; confirm it explains why.

### Tests for User Story 3

- [X] T012 [P] [US3] Add a test: given a skill event timestamped outside the active window, `--doctor` output states the skill expired and includes its last-seen timestamp (Acceptance Scenario 1)
- [X] T013 [P] [US3] Add a test: with the hook event log absent/empty, `--doctor` output states the transcript-scan fallback is in use rather than the hook (Acceptance Scenario 2)

### Implementation for User Story 3

- [X] T014 [US3] In `src/doctor.js`, extend the skills diagnostic section (near line 107's "no skill used inside the activity window" message) to report, per skill checked: `active` / `expired (last seen at <time>)` / `never-detected`
- [X] T015 [US3] In `src/doctor.js`, surface the existing `source` field from `getActiveSkillsDetailed()` (`"hook"` vs `"transcript"`) as an explicit English line in doctor output

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Add a test confirming the truncated-scan case (`truncated: true` from `scanTailForSkills`) is distinguishable in doctor output from a clean, complete scan, so a developer can tell when the true count itself might be an estimate rather than exact
- [X] T017 Run `node scripts/smoke-test.js` to confirm no regression to line 2 rendering for the common case (few skills, no truncation)
- [X] T018 Run `specs/008-skills-line-completeness/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks User Story 1 and User Story 3 (both need a true-count/detail signal); User Story 2 does not strictly depend on it but is sequenced after for coherence
- **User Story 1 (P1)**: depends on Foundational (T002/T003)
- **User Story 2 (P2)**: depends on Setup only; independent of US1's counting fix, but investigated/implemented after it in this plan for review clarity
- **User Story 3 (P3)**: depends on Foundational (T002/T003's true-count signal, plus existing `source` field)
- **Polish**: depends on all three stories

### Parallel Opportunities

- T004, T005, T006 can be written in parallel
- T012 and T013 can be written in parallel
- User Story 2 (Phase 4) can be worked in parallel with User Story 1 (Phase 3), since they touch different files (`transcriptTail.js` subagent-walking vs. `render.js` count math), provided both land before User Story 3 needs the combined signal

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (true-count signal exists)
2. Complete Phase 3 (User Story 1: accurate overflow count)
3. Validate: T004-T006 pass, dedup regression (T008) still holds
4. This alone fixes the most visible symptom of the original complaint

### Incremental Delivery

1. Setup + Foundational → true-count signal available to both render and doctor code
2. User Story 1 → overflow count accurate (MVP)
3. User Story 2 → subagent-invoked skills tracked
4. User Story 3 → doctor output explains any remaining gap
5. Polish → truncated-scan visibility, smoke test, quickstart
