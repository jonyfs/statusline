# Tasks: PR Label Display

**Input**: Design documents from `/specs/006-pr-labels-display/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gh-pr-view-labels.md, quickstart.md

**Tests**: Included, since the spec's acceptance scenarios are all render-output assertions best proven by tests rather than manual inspection.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Read current `probePrResult`, `normalizePr`, and the PR segment builder (`src/git.js:259`, `src/git.js:328`, `src/render.js:663-671`) to confirm line numbers haven't shifted since planning; adjust task line references below if they have

---

## Phase 2: Foundational

**Purpose**: The `labels` field must exist on the normalized PR object before any user story can display it.

- [X] T002 In `src/git.js`, extend `probePrResult`'s `gh pr view --json` call to request `labels` in addition to `number,state,isDraft,url`, and include `pr.labels` (array of `{name}` objects) in the returned value
- [X] T003 In `src/git.js`, extend `normalizePr(raw, source)` to read `raw.labels` (array of `{name}` objects from `gh`, or array of plain strings from the payload/MR path per contracts/gh-pr-view-labels.md) and normalize both shapes into a `labels: string[]` field, defaulting to `[]` when absent

**Checkpoint**: `getPrInfo()` callers now receive a `labels` array (possibly empty) alongside existing PR fields.

---

## Phase 3: User Story 1 - See PR labels at a glance (Priority: P1) 🎯 MVP

**Goal**: PR labels appear next to the existing PR number/status.

**Independent Test**: Open a PR with labels, run the statusline, confirm labels appear next to number/status.

### Tests for User Story 1

- [X] T004 [P] [US1] Add a test in `scripts/tests/render.test.js`: given a PR reading with `labels: ["bug", "priority-high"]`, the rendered PR segment text includes both label names
- [X] T005 [P] [US1] Add a test in `scripts/tests/render.test.js`: given a PR reading with `labels: []`, the rendered PR segment text is byte-for-byte identical to the pre-feature output (number + status only, no empty marker), proving FR-003

### Implementation for User Story 1

- [X] T006 [US1] In `src/render.js`, extend the PR segment's `text:` template (line ~665-671) to append the label list (space/comma-joined) after the existing `${review ? ...}` suffix, only when `pr.labels?.length`
- [X] T007 [US1] In `src/render.js`, confirm the "no PR" branch (when `pr` is falsy) is unaffected: no label list appears when there's no open PR (Acceptance Scenario 3)

**Checkpoint**: User Story 1 fully functional; T004/T005 pass.

---

## Phase 4: User Story 2 - Labels stay readable on a narrow terminal (Priority: P2)

**Goal**: Long/many labels truncate instead of breaking the line.

**Independent Test**: A PR with 5+ labels or one very long label name; confirm truncation, not overflow.

### Tests for User Story 2

- [X] T008 [P] [US2] Add a test in `scripts/tests/render.test.js`: given `labels` with 5 entries, the rendered text shows the first 3 plus a `+2` suffix, per data-model.md's truncation rule
- [X] T009 [P] [US2] Add a test in `scripts/tests/render.test.js`: given a PR with a very long single label name, confirm the existing `trimFromLeft` line-width trim pass still applies without throwing or producing a malformed segment

### Implementation for User Story 2

- [X] T010 [US2] In `src/render.js`, implement the 3-label cap with `+N` suffix (mirroring the skills-line `hiddenCount` pattern at line ~708-713) when building the PR segment's label text
- [X] T011 [US2] Verify no new width-aware logic is needed beyond T010: confirm the existing per-line trim pass (`trimFromLeft`) already covers the PR segment as one text field, per research.md's "belt-and-suspenders" decision

**Checkpoint**: User Stories 1 and 2 both verified independently.

---

## Phase 5: User Story 3 - Works for both PRs and merge requests (Priority: P3)

**Goal**: GitLab MR labels display the same way GitHub PR labels do.

**Independent Test**: An MR with labels on a GitLab-backed branch shows labels the same way a GitHub PR does.

### Tests for User Story 3

- [X] T012 [US3] Add a test in `scripts/tests/render.test.js` (or a `git.test.js` if one exists): a payload-sourced PR object with `kind: "mr"` and `labels: ["needs-review"]` normalizes and renders identically in form to a GitHub PR's labels

### Implementation for User Story 3

- [X] T013 [US3] Confirm `normalizePr` (T003) already handles the payload's plain-string `labels` array without special-casing `kind === "mr"`: implementation should already be correct from T003, so this task is verification, not new code, per research.md's decision not to add a `glab` shell-out

**Checkpoint**: All three user stories independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add a test confirming label fetch failure (mocked `gh` error) still returns PR number/status with `labels: []`, not a null PR (FR-006)
- [X] T015 [P] Add a test confirming no new network call is made for labels beyond the existing single `gh pr view` invocation (inspect the mock call count in the existing PR-fetch test setup)
- [X] T016 Run `node scripts/smoke-test.js` to confirm no regression elsewhere on the line
- [X] T017 Run `specs/006-pr-labels-display/quickstart.md` end to end and confirm every expected result matches

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories (labels must exist on the normalized object first)
- **User Story 1 (P1)**: depends on Foundational; no dependency on US2/US3
- **User Story 2 (P2)**: depends on Foundational and on US1's label-text rendering existing (T006) to have something to truncate
- **User Story 3 (P3)**: depends on Foundational (T003's normalization already covers it); independently testable once T003 lands
- **Polish**: depends on all three stories

### Parallel Opportunities

- T004 and T005 (different assertions, same file, no shared state) can be written in parallel
- T008 and T009 can be written in parallel
- User Story 3 (T012/T013) can proceed in parallel with User Story 2, since both depend only on Foundational + US1's rendering path

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2 (labels field exists)
2. Complete Phase 3 (User Story 1: labels display)
3. Validate: T004/T005 pass, quickstart's first two scenarios succeed
4. This alone resolves the user's original request

### Incremental Delivery

1. Setup + Foundational → `labels` field flows through the existing PR pipeline
2. User Story 1 → labels visible (MVP)
3. User Story 2 → truncation safety net for narrow terminals / many labels
4. User Story 3 → GitLab MR parity confirmed
5. Polish → failure-path and no-extra-network-call guarantees, smoke test, quickstart
