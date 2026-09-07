> **Closed 2026-09-07.** See the "What became of it" section of
> [spec.md](spec.md). Unticked boxes below are left as they were: this list
> was never worked through, and marking it done would be a second untruth on
> top of the first.

# Tasks: Multi-Agent Skills Visibility

**Input**: Design documents from `/specs/013-multi-agent-skills/`

**Prerequisites**: plan.md (complete), spec.md (clarified with 4 Q/A)

**Tests**: Not explicitly requested in spec; smoke-test.js will be extended for multi-agent scenarios

**Organization**: Tasks grouped by user story to enable independent implementation and validation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- File paths are exact and actionable

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Verify project state and dependencies

- [~] T001 Verify Node.js v18+ is installed and available
- [~] T002 Review existing `src/skills.js` to understand current skill tracking implementation
- [~] T003 Review `src/render.js` stdin payload handling to identify extension point for `activeAgents` field

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend `src/render.js` to accept `activeAgents` array in stdin JSON payload (parsing, validation, passing to skills module)
- [x] T005 Create new module `src/skillAggregation.js` with core functions: `aggregateSkills()`, `deduplicateSkills()`, `groupByAgent()`, `formatForDisplay()`
- [x] T006 [P] Write unit tests for `skillAggregation.js` in `tests/test-skill-aggregation.js` (test deduplication, grouping, edge cases with empty/null data)
- [x] T007 Extend `src/skills.js` to call `skillAggregation.aggregateSkills()` with both direct skills and agent skills from task snapshot

**Checkpoint**: Agent skill aggregation module is functional and ready to be integrated into display pipeline

---

## Phase 3: User Story 1 - Skills from all running agents appear on the skills line (Priority: P1) 🎯 MVP

**Goal**: Display all active skills from multiple concurrent agents, grouped by agent identifier on the skills line

**Independent Test**: 
1. Mock `activeAgents` in stdin payload with 2–3 agents, each with different skills
2. Run statusline render and confirm skills line output includes agent-grouped format (e.g., "A: skill1, skill2; B: skill3")
3. Confirm no duplicate skill names appear per agent

### Implementation for User Story 1

- [x] T008 Modify `src/render.js` skillsReading to handle agent-grouped skill aggregation (updated to call getAggregatedSkills when activeAgents present)
- [~] T009 [P] [US1] Extend `src/cache.js` to cache agent identifiers alongside skill freshness state (avoid re-parsing agent structure on every render)
- [x] T010 [P] [US1] Create integration test `tests/test-agent-integration.js` with mock task snapshot and mock `activeAgents` payload; verify aggregation output format
- [~] T011 [US1] Manually test with `echo` command piping mock payload to `statusline` CLI; validate skills line displays grouped format with overflow handling
- [~] T012 [US1] Test overflow scenario: >10 skills across agents; verify "+N" indicator shows correct remaining count

**Checkpoint**: User Story 1 is complete and testable independently. Skills line correctly aggregates and displays agent skills with agent grouping.

---

## Phase 4: User Story 2 - Skills remain visible for full duration their agent is running (Priority: P2)

**Goal**: Skills from agents appear only while agents are active; disappear when agents finish

**Independent Test**:
1. Start mock agent with skill, render statusline → skill visible
2. Remove agent from `activeAgents` array, render again → skill is gone
3. Confirm direct skills (non-agent) still respect 30-minute activity window

### Implementation for User Story 2

- [~] T013 [US2] Verify `src/skillAggregation.js` removes agent skills when agent is removed from `activeAgents` array (no lingering entries)
- [~] T014 [US2] Test freshness check: confirm agent skills disappear if task snapshot is stale (>30s old) per spec 011 mechanism
- [~] T015 [US2] Verify skill line updates correctly across renders when agents start/stop/change skills (no flickering, no stale entries)
- [~] T016 [US2] Document skill lifecycle in code comments: agent skill appears when agent in snapshot, removed when snapshot updated and agent gone

**Checkpoint**: User Story 2 is complete. Agent skills have proper lifecycle; they appear and disappear with agent activity, no stale entries.

---

## Phase 5: User Story 3 - Skill visibility remains consistent across skills line and subagent rows (Priority: P3)

**Goal**: Skills shown on the skills line match what subagent dedicated rows display (consistency check)

**Independent Test**:
1. Run session with visible subagent rows and monitor skills line
2. Confirm skills shown on skills line for each agent match the agent's dedicated row (same skill names, same agent ID)
3. No contradictory or missing skills between the two displays

### Implementation for User Story 3

- [~] T017 [US3] Review existing subagent-row mechanism (spec 011, task snapshot structure) to verify skill field naming and format
- [~] T018 [US3] Ensure `src/skillAggregation.js` extracts skill source in same order as subagent rows (formal `/skill` first, then task description)
- [~] T019 [US3] Manual validation: run both statusline and subagent-row display side-by-side; verify skill consistency (same skills named the same way)
- [~] T020 [US3] Test edge case: agent with unnamed skills; verify both displays omit it (no placeholder) consistently

**Checkpoint**: User Story 3 is complete. Skills line and subagent rows show consistent view of agent work; developer sees one honest story.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple stories; documentation; testing

- [~] T021 [P] Extend `tests/smoke-test.js` with multi-agent skill aggregation scenarios (mock payload with 2–3 agents, verify output format)
- [~] T022 [P] Add code comments in `src/skillAggregation.js` documenting deduplication algorithm, grouping logic, edge cases
- [~] T023 Update README.md to include example of agent-grouped skill display format (add screenshot or ANSI example)
- [~] T024 Verify cross-platform compatibility: smoke-test passes on Windows (path handling for task snapshot file); test on macOS and Linux
- [~] T025 Run quickstart.md validation scenarios (if quickstart.md is generated in Phase 1 design artifacts)
- [~] T026 Code review: verify no new runtime dependencies introduced; ensure implementation aligns with Constitution Principle IV (zero dependencies)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately
- **Foundational (Phase 2)**: Depends on Setup → BLOCKS all user story implementation
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1, US2, US3 can run in parallel (different files, independent tests)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### Within Each User Story

- Implementation tasks before integration tests
- Models/aggregation before display formatting
- Aggregation before overflow/width handling
- Core display before consistency validation

### Parallel Opportunities

- **Phase 2 Foundation**: T006 (unit tests) and T007 (extend skills.js) can run in parallel
- **Phase 3 (US1)**: T009 (cache), T010 (integration test), T011 (manual test) can run in parallel
- **Phase 6 (Polish)**: T021 (smoke-test), T022 (comments), T023 (README) can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
Developer A:
  T006: Write unit tests for skillAggregation.js

Developer B:
  T007: Extend src/skills.js to call aggregation module

→ Both can work simultaneously; tests provide spec for implementation
```

---

## Parallel Example: Phase 3 (User Story 1)

```bash
Developer A:
  T010: Write integration test with mock payload
  T011: Manual test with echo + CLI

Developer B:
  T008: Modify src/arrangement.js for grouped display
  T009: Extend src/cache.js for agent caching

→ Tests and implementation proceed in parallel; tests provide spec
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (30 min)
2. Complete Phase 2: Foundational (2–3 hours)
3. Complete Phase 3: User Story 1 (1–2 hours)
4. **STOP and VALIDATE**: Manual test with mock payload; confirm skills line shows agent-grouped format
5. Deploy/demo MVP

**Estimated time**: 4–6 hours for MVP (no dependencies on US2 or US3)

### Incremental Delivery

1. Phases 1–2 → Foundation ready
2. Phase 3 (US1) → MVP: Basic multi-agent skills visible ✓
3. Phase 4 (US2) → Enhancement: Proper skill lifecycle (appears/disappears with agents)
4. Phase 5 (US3) → Polish: Consistency validation across displays
5. Phase 6 → Final polish and cross-platform testing

Each phase delivers value without breaking previous work.

### Parallel Team Strategy

With multiple developers:

1. Team completes Phases 1–2 together
2. Once Foundational done:
   - Developer A: US1 (T008–T012)
   - Developer B: US2 (T013–T016)
   - Developer C: US3 (T017–T020)
3. Stories complete and validate independently
4. Team reconvenes for Phase 6 polish

---

## Notes

- [P] tasks = different files, no data dependencies
- [Story] label maps each task to specific user story for traceability
- Each user story is independently completable and testable
- Manual testing with mock payloads verifies output format and edge cases
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No lingering stale entries; no false positives on skill display
- Avoid: cross-story dependencies that break independence, hard-coded agent names, duplicated skill names in output
