---

description: "Task list for 003 — Something Moves When Something Changes"
---

# Tasks: Something Moves When Something Changes

**Input**: Design documents from `specs/003-status-change-animations/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. The project holds itself to a smoke test that runs on
three platforms (Principle IX), and two of this feature's requirements
(constant frame width, byte-identical output with animation off) are the kind
that survive review and fail in a terminal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The candidate definitions everything else reads

- [X] T001 Create `scripts/animation-candidates.js` with the `Candidate` shape from data-model.md and an empty `ANIMATIONS` array, exporting `ANIMATIONS`, `animation()`, `animationFor()` and `frameFor()` per `contracts/animations.md`
- [X] T002 Fill `ANIMATIONS` in `scripts/animation-candidates.js` with the six candidates from research.md: pie fill (`F0A9E` `F0AA0` `F0AA2` `F0AA5`), Pac-Man (`F0BAF` `F0765`), puzzle snap (`F1427` `F0431` `F1426`), robot blink (`F06A9` `F167A`), twinkle (`F04D2` `F04CE`), each with its Braille substitute frames, written as escapes rather than pasted literals
- [X] T003 Add every candidate codepoint to `WANTED` in `scripts/extract-glyphs.py`, with a comment per entry naming what the glyph draws rather than what the table calls it
- [X] T004 Regenerate `src/preview/glyphs.json` with the extractor and confirm every candidate codepoint is present in the output

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The invariants both later stories depend on. No story can be
judged without these, because a candidate that fails T005 is not a candidate.

- [X] T005 Add `scripts/tests/animations.test.js` asserting every candidate has `nerd` and `plain` of equal length, at least two frames, and constant display width within each set, measured with `displayWidth` from `src/theme.js`
- [X] T006 Extend `scripts/tests/animations.test.js` to assert every `nerd` frame codepoint appears in `src/preview/glyphs.json`, so a candidate cannot ship that the preview page would draw as a gap
- [X] T007 Extend `scripts/tests/animations.test.js` to assert `frameFor()` is total: every combination of a known and unknown segment key, a null, negative, zero and past-the-end frame index, and both modes, returns a string and never throws
- [X] T008 Extend `scripts/tests/animations.test.js` to assert `frameFor()` past the last frame holds on the final frame rather than looping

**Checkpoint**: `npm test` passes with the candidate tables in place and
nothing on the bar changed.

---

## Phase 3: User Story 1 — Choose the animation by looking at it (Priority: P1) 🎯 MVP

**Goal**: A page the owner opens in a browser that plays every candidate at
the real frame rate, so the shipped set is chosen by looking rather than by
reading a description.

**Independent test**: Open the page with no part of story 2 built. Every
candidate plays, each is labelled, both intervals are selectable, and a reader
who has never seen the code can say which ones they want.

- [X] T009 [US1] Create `scripts/generate-animation-board.js` that imports `ANIMATIONS` from `scripts/animation-candidates.js` and writes a single self-contained HTML file to `specs/003-status-change-animations/animation-board.html`, embedding the outlines from `src/preview/glyphs.json` so the page needs no font (FR-007)
- [X] T010 [US1] Render each candidate as a playing animation in the board, advancing one frame at a time, with the interval stated on screen (FR-001)
- [X] T011 [US1] Add an interval control to the board offering the busy interval (5.5 seconds) and the idle interval (60 seconds), so the worst case is visible rather than described (FR-002)
- [X] T012 [US1] Add a still strip per candidate in the board showing every frame at once (FR-003)
- [X] T013 [US1] Draw each candidate inside a mock segment in the Catppuccin Mocha palette, beside the same segment in its settled form (FR-004)
- [X] T014 [US1] Show both the Nerd Font form and the Braille substitute form for every candidate in the board (FR-005)
- [X] T015 [US1] Label each candidate in the board with its name, its frame count and the segments it is proposed for (FR-006)
- [X] T016 [P] [US1] Add `scripts/tests/animation-board.test.js` asserting the generator writes a file that references every candidate key and contains no external URL, so the page cannot quietly acquire a dependency
- [X] T017 [US1] Generate the board, publish it for the owner, and record the choices in `specs/003-status-change-animations/decisions.md`: the candidate chosen per segment, the rejections and the reason for each (FR-008)

**Checkpoint reached 2026-09-01**: the owner looked at the board and adopted
no candidate. [decisions.md](./decisions.md) records the choice and the
reason for each rejection.

---

## Phase 4: User Story 2 — The bar moves when something changes (Priority: P2)

**Goal**: The four tracked segments play their chosen sequence over the renders
following a change, then settle.

**Independent test**: Drive a session through a branch switch, a pull request
appearing, a skill activating and a model change, capturing every render. Each
capture differs from the one before it in the animated segment only, and the
sequence ends at the settled form.

**Closed 2026-09-01, not implemented.** What this phase builds is what
`decisions.md` names, and `decisions.md` names nothing. The tasks are left
unchecked because they were not done, not because they are outstanding: there
is no animation to wire, and wiring one nobody chose would put machinery in the
renderer for a feature that does not exist. Reopen this phase only if a later
decision adopts a candidate.

- [ ] T018 [US2] Replace the unused global `frame` counter in `src/changeTracker.js` with the per-segment `frames` map from data-model.md: set to 0 on a change, incremented per render while highlighted, deleted with `changedAt` when the window expires
- [ ] T019 [US2] Make `iconFor(key, staticIcon)` in `src/changeTracker.js` return `frameFor(key, frames[key], { ascii, settled: staticIcon })` instead of always returning the static icon, and pass the mode through from the caller
- [ ] T020 [US2] Wire the segments named in `decisions.md` in `src/render.js` to draw `changes.iconFor(key, g.<icon>)` in place of their static glyph, leaving every other segment untouched
- [ ] T021 [P] [US2] Add cases to `scripts/tests/animations.test.js` for the sequence: a first render animates nothing (FR-014), a change starts at frame 1 on the next render (FR-009), each further render advances exactly one frame (FR-010), and the segment is settled past thirty seconds (FR-011)
- [ ] T022 [P] [US2] Add a case asserting a change arriving mid-animation restarts the sequence and its window (FR-015)
- [ ] T023 [P] [US2] Add a case asserting two segments changing in one render both animate, neither suppressed (US2 scenario 3)
- [ ] T024 [P] [US2] Add a case asserting the rendered line width is constant across a full animation on every animated segment (FR-012, SC-003)
- [ ] T025 [P] [US2] Add a case asserting ASCII mode animates in the substitute set and emits no private-use codepoint (FR-016, SC-008)
- [ ] T026 [P] [US2] Add a case asserting no usage percentage, working-tree count or reset countdown animates (FR-013)
- [ ] T027 [P] [US2] Add a case asserting the animation never changes the segment's text: the branch name, PR number, skill list and model name are present in every frame (FR-018)
- [ ] T028 [US2] Add a case asserting a state file that cannot be read or written leaves the bar rendering without animation rather than failing (FR-022)

**Checkpoint**: not reached. The bar does not animate, by decision.

---

## Phase 5: User Story 3 — It never gets in the way (Priority: P3)

**Goal**: Anyone who finds the motion distracting turns it off and gets the bar
the project renders today.

**Independent test**: Render the same changed state twice, once enabled and
once disabled, and confirm the disabled render is identical to what the bar
produces today.

**Closed 2026-09-01, not implemented.** An off switch for a feature that does
not exist. The bar already renders what this phase's assertion was going to
assert, because nothing was added to turn off.

- [ ] T029 [US3] Add `animate` to `KNOWN` and to `resolveSettings()` in `src/config.js` per `contracts/settings.md`, defaulting to on, with `CLAUDE_STATUSLINE_ANIMATE=0` and `"animate": false` both turning it off
- [ ] T030 [US3] Thread the resolved `animate` setting from `bin/cli.js` through `render()` to the tracker, so an off setting reaches `frameFor()` and returns the settled icon
- [ ] T031 [P] [US3] Add a case to `scripts/tests/config.test.js` for the new setting: environment beats file, file beats default, and the default is on
- [ ] T032 [P] [US3] Add a case asserting the render with animation off is byte-identical to the same input rendered with the feature absent (SC-005)
- [ ] T033 [US3] Confirm `node scripts/generate-previews.js` produces no diff, and add a case asserting the preview path renders with animation off (FR-020, SC-006)

**Checkpoint**: not reached, and not needed. The feature is reversible because
it was never applied.

---

## Phase 6: Polish & Cross-Cutting Concerns

Most of this phase existed to document a shipped feature. Nothing shipped, so
what is left is making sure the repository is honest about that.

- [X] T034 No README section. There is nothing on the bar to document, and a README describing an animation nobody would see would be worse than silence (FR-021 is closed by the decision, not by prose)
- [X] T035 [P] No new row in the "Where the icons come from" table: the candidate codepoints are in `scripts/extract-glyphs.py` and `src/preview/glyphs.json` for the board's sake, and the bar cannot emit any of them
- [X] T036 [P] The sweep evidence stands as committed in `specs/003-status-change-animations/glyph-candidates.png`; no set was chosen, so there is nothing further to render
- [X] T037 No committed preview changed, so `docs/images/` needs no regeneration
- [X] T038 `npm test` passes on this machine at 312 cases, and CI runs the same suite on macOS, Linux and Windows across Node 18, 20 and 22 (Principle IX)

---

## Dependencies

```text
Phase 1 (T001-T004)
   ↓
Phase 2 (T005-T008)  ← the invariants; a candidate failing T005 never reaches a story
   ↓
Phase 3 / US1 (T009-T017)  ← MVP. Ends at a decision, touches no renderer code
   ↓
Phase 4 / US2 (T018-T028)  ← builds what the decision named
   ↓
Phase 5 / US3 (T029-T033)
   ↓
Phase 6 (T034-T038)
```

US1 is genuinely independent: it can be built, opened and judged with nothing
in `src/render.js` changed, and it has value even if nothing follows. US2 is
not independent of US1, and the spec says so: what it builds is whatever the
decision names.

US3 could in principle be built before US2, but the assertion it exists to make
(the disabled render matches today's bytes) is vacuous until something can
animate.

## Parallel Opportunities

- **Phase 2**: T005 through T008 all extend one file and are written together
  rather than in parallel.
- **Phase 3**: T016 is the only [P] task; T009 through T015 are successive
  edits to the same generator.
- **Phase 4**: T021 through T027 are independent cases and can be written in
  parallel once T018 to T020 are in place.
- **Phase 5**: T031 and T032 touch different test files.
- **Phase 6**: T035 and T036 are independent of each other.

## Implementation Strategy

**MVP is Phase 3.** A generated page that plays the candidates, and a decision
recorded beside the spec. If the answer turns out to be "none of these are
funny enough to be worth the width", the project has spent one script and no
renderer changes finding that out, which is the cheapest possible place to
learn it.

**Then Phase 4**, which is the feature, and which cannot start earlier because
its content is the decision.

**Then Phase 5**, without which a feature built to interrupt has no answer for
a reader who does not want to be interrupted.
