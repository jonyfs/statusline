---

description: "Task list for 004 — Research It, Then Let the Owner Build the Bar"
---

# Tasks: Research It, Then Let the Owner Build the Bar

**Input**: Design documents from `specs/004-statusline-redesign-research/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The project runs a smoke test on three platforms
(Principle IX), and three of this feature's promises are the kind that pass
review and fail in a terminal: byte-identical output with no arrangement, a
page that draws what the renderer would draw, and no wrapped line at 60
columns.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The fixed session and the preset table everything else reads

- [X] T001 Create `scripts/composer-fixture.js` exporting one fixed payload, a frozen `FIXED_NOW` and pinned `TZ`, following the shape of `scripts/preview-fixtures.js`, covering a repository with a branch, an open pull request, active skills, a todo and full rate-limit fields so every segment has a value
- [X] T002 Create `scripts/composer-presets.js` with the `Preset` shape from [data-model.md](./data-model.md), an empty `PRESETS` array and the accessors `presets()` and `preset(id)`
- [X] T003 [P] Create `scripts/tests/composer-presets.test.js` asserting every preset has a unique id, a label, the three sentences (`optimisesFor`, `givesUp`, `forWhom`), a `conflicts` array and an `arrangement` object

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The resolver and the two additive source changes the page and the
bar both depend on. Nothing here changes any output.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `src/arrangement.js` with `resolveArrangement(registry, arrangement, origin)` returning resolved placements per [data-model.md](./data-model.md), pure and free of file access, overriding only `on`, `line` and `order` and carrying an `ignored` list of entries it refused
- [X] T005 Create `scripts/tests/arrangement.test.js` asserting: an absent or empty arrangement returns the registry rows unchanged; `on: false` removes a segment whatever its priority; `line` and `order` override; an unknown key is ignored and named; an unknown `version` drops the file whole; `line` outside 1..4 and a non-numeric `order` drop that field only; `priority`, `colour` and `align` are never taken from the arrangement; ties break deterministically on registry order then key
- [X] T006 Add an `asPool` option to `renderReadings` in `src/render.js` returning the built `{ key, text, color, url }` objects for every segment before rows are assembled, leaving the existing return values untouched
- [X] T007 Create `scripts/tests/render-pool.test.js` asserting the pool holds one entry per segment the fixture produces, that each entry's text matches what the rendered row contains, and that the normal render output is unchanged against a golden string
- [X] T008 [P] Add `createAnsiToSvg(glyphs)` to `src/preview/ansiToSvg.js` taking the glyph table as an argument, and rebuild the existing `ansiToSvg` export from it so `scripts/generate-previews.js` is unaffected
- [X] T009 [P] Extend `scripts/tests/width.test.js` or add `scripts/tests/ansi-svg.test.js` asserting `createAnsiToSvg(loadedGlyphs)(sample)` equals `ansiToSvg(sample)` for a sample carrying a Nerd Font glyph, an emoji and a hyperlink

**Checkpoint**: `node scripts/smoke-test.js` passes and the bar draws exactly
as it did before.

---

## Phase 3: User Story 1 — Build the bar in the browser (Priority: P1) 🎯 MVP

**Goal**: A page the owner opens in a browser that starts on today's bar, lets
every segment be switched off, reordered and moved between lines, redraws
through the renderer's own modules, and hands back the arrangement.

**Independent test**: Open the page with no part of story 2 built. Rearrange
the bar, switch width and glyph mode, load a preset, reload the page, and copy
out an arrangement that a reader can see is what they built.

- [X] T010 [US1] Fill `PRESETS` in `scripts/composer-presets.js` with the six presets from [research.md](./research.md) section 4 — `today`, `peripheral`, `rightMargin`, `operational`, `lean`, `oneLine` — each with its three sentences, and `oneLine` carrying Principle II in `conflicts`
- [X] T011 [P] [US1] Extend `scripts/tests/composer-presets.test.js` to assert every preset's arrangement resolves against the registry with an empty `ignored` list, and that `oneLine` is the only preset reporting a principle conflict
- [X] T012 [US1] Create `scripts/generate-composer.js` writing `specs/004-statusline-redesign-research/composer.html`, inlining `src/layout.js`, `src/theme.js`, `src/arrangement.js` and the ANSI-to-SVG drawer as ES modules, plus the pool from `renderReadings({ asPool: true })` against the fixture, the palette, the glyph outlines from `src/preview/glyphs.json` and the presets, with the `process.env` shim from [research.md](./research.md) section 10 defined before any import
- [X] T013 [US1] Add the canvas and the segment list to the generated page: the bar drawn from the current arrangement, opening on the design that ships today and labelled as such, and every registry key listed including the ones currently off
- [X] T014 [US1] Add per-segment toggling to the page, so switching a segment off removes it and leaves every other position where it was
- [X] T015 [US1] Add reordering within a line and moving between lines to the page, redrawing the bar through `resolveArrangement` then `fitToWidth`, `alignColumns` and `renderRow`
- [X] T016 [US1] Add the width switch (80, 120 and 160 columns) and the glyph switch (Nerd Font outlines and the declared plain substitutes) to the page
- [X] T017 [US1] Add the preset row to the page: six entries, each showing its label, what it optimises for, what it gives up, who it is for and any principle it conflicts with, with loading one replacing the canvas and leaving it editable
- [X] T018 [US1] Add the two warnings to the page: no segments on, and a line that cannot fit the narrowest offered width
- [X] T019 [US1] Add the handover to the page: the arrangement's JSON, copyable in one action, with both file paths from [contracts/arrangement.md](./contracts/arrangement.md) named beside it
- [X] T020 [US1] Persist the arrangement being edited to local storage on every change and restore it on load, so a reload does not lose the work
- [X] T021 [US1] Create `scripts/tests/composer.test.js` with the eight assertions in [contracts/composer.md](./contracts/composer.md), following `scripts/tests/animation-board.test.js`, generating into a temporary directory rather than over the committed page
- [X] T022 [P] [US1] Add a `composer` script to `package.json` running `node scripts/generate-composer.js`
- [X] T023 [US1] Generate the page, open it, and have the owner build the arrangement they want
- [X] T024 [US1] Write `specs/004-statusline-redesign-research/decisions.md` with the chosen arrangement verbatim, the preset it started from, and one row per rejected preset with its reason, following `specs/003-status-change-animations/decisions.md`

**Checkpoint**: The owner has an arrangement and a written record. Nothing in
the renderer has changed behaviour.

---

## Phase 4: User Story 2 — Arrange the bar the way I want it (Priority: P2)

**Goal**: The bar honours an arrangement file, keeps every guarantee it
already makes, and explains what it ignored.

**Independent test**: Write an arrangement by hand, redraw, see the bar match
it; remove the file, see the default return byte for byte.

- [X] T025 [US2] Extend `src/config.js` with arrangement resolution: `CLAUDE_STATUSLINE_LAYOUT` naming a file, then the `layout` key in the repository's `.statusline.json`, then `~/.claude/statusline/layout.json`, then the registry, returning the arrangement together with its origin and path
- [X] T026 [P] [US2] Create `scripts/tests/config-layout.test.js` asserting the four precedence ranks against a throwaway HOME, that the first found wins whole rather than merging, and that an unreadable or invalid file means the default rather than an error
- [X] T027 [US2] Change row assembly in `renderReadings` in `src/render.js` to build the pool once, partition it by the resolved line and sort by the resolved order, keeping line 1's directory trim and line 4's trim steps as per-line behaviour
- [X] T028 [US2] Create `scripts/tests/arranged-render.test.js` asserting an arrangement is applied end to end, that a segment moved to another line renders there and the line it left still renders, that a segment holds its position when a neighbour has nothing to say, and that with no arrangement the output is byte-identical to the golden default
- [X] T029 [P] [US2] Extend `scripts/tests/shedding.test.js` and `scripts/tests/layout.test.js` to cover an arrangement: no line wraps at 60 columns, segments still drop by priority, and the line shedding order is unchanged
- [X] T030 [US2] Add an arrangement row to `src/doctor.js`: which rank is in force, the path it came from, and every entry that was ignored with the reason, per [contracts/arrangement.md](./contracts/arrangement.md)
- [X] T031 [P] [US2] Extend `scripts/tests/doctor.test.js` to assert the arrangement row for each of the six error situations in the contract's error table
- [X] T032 [US2] Add a round-trip case to `scripts/tests/composer.test.js` asserting that for every preset, what the page composes at 120 columns equals what the renderer draws for the same arrangement at the same width, and that the arrangement the page hands back is accepted by the resolver with an empty `ignored` list and needs no editing
- [X] T033 [US2] Add the configuration section to `README.md`: what an arrangement is, the file shape, the precedence table, what cannot be overridden and why, and how to ask the diagnostic what is in force

**Checkpoint**: An arrangement copied out of the page renders the same bar in
the terminal, and the default is untouched when no file exists.

---

## Phase 5: User Story 3 — The chosen design becomes what everyone gets (Priority: P3)

**Goal**: A fresh install draws the chosen design, the documentation shows it,
and the previous bar is one file away.

**Independent test**: Install into a clean environment with no arrangement and
see the chosen design, with the committed images showing the same thing.

- [~] T034 [US3] Fold the chosen arrangement from `decisions.md` into `src/segments.js`, changing only `line` and `order` and the presence of rows, leaving priority, colour and alignment as they are
- [~] T035 [P] [US3] Write `specs/004-statusline-redesign-research/arrangements/previous.json` reproducing the registry as it stood before T034, so the old bar is restorable without pinning a version
- [~] T036 [US3] Add a case to `scripts/tests/arranged-render.test.js` asserting `previous.json` renders the pre-change bar segment for segment against a golden string captured before T034
- [~] T037 [US3] Extend `scripts/tests/registry.test.js` and `scripts/tests/segments.test.js` for the new default: line membership, order uniqueness within a line, and the colour-channel rule
- [~] T038 [US3] Regenerate `docs/previews/*.svg` and `docs/images/*.png` with `node scripts/generate-previews.js` and commit them in the same change as T034, per Principle VIII
- [~] T039 [US3] Update `README.md` prose that describes the old layout: the line-by-line walkthrough, the segment counts and any sentence naming a segment that moved
- [~] T040 [US3] Amend `.specify/memory/constitution.md` if the chosen design leaves the four-line structure, recording the reason and bumping the version, in the same change as T034
- [~] T041 [US3] Verify a fresh install draws the chosen design with no arrangement present, following the story 3 steps in [quickstart.md](./quickstart.md)

**Checkpoint**: A clean install shows the new bar, the images agree with it,
and the old bar is restorable.

---

## Phase 6: User Story 4 — Know what is slow, what is fragile, and what is missing (Priority: P4)

**Goal**: The research is a record with reproducible numbers and a disposition
on every finding.

**Independent test**: Re-run every measurement the record cites and force
every failure it describes.

- [X] T042 [P] [US4] Re-run `node scripts/bench.js --runs 50` after T027 and record the figures beside the 2026-09-02 baseline in [research.md](./research.md) section 5, with the p95 comparison stated
- [X] T043 [P] [US4] Force each failure mode in [research.md](./research.md) section 6 and record what the bar and the diagnostic actually showed, correcting the table where reality differs
- [X] T044 [P] [US4] Close out [research.md](./research.md) section 7 by marking each informativeness row adopted with its change or declined with its reason
- [X] T045 [US4] Add a disposition line to every section of [research.md](./research.md), so no finding is left open when the feature closes

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T046 Run `node scripts/smoke-test.js` on macOS, Linux and Windows, or confirm the CI matrix covers all three, per Principle IX
- [X] T047 [P] Walk [quickstart.md](./quickstart.md) end to end on a clean checkout and correct any command that does not behave as written
- [X] T048 [P] Confirm `node scripts/generate-composer.js` twice in a row produces identical bytes, and that the committed page carries no external resource reference
- [X] T049 Update the **Status** line in [spec.md](./spec.md) with the outcome and the date, following the convention feature 003 set
- [X] T050 Pass every markdown file changed in this feature through the humanizer skill before the pull request

---

## Dependencies

```text
Phase 1 (T001-T003)
   ↓
Phase 2 (T004-T009)  ← blocks everything
   ↓
Phase 3 US1 (T010-T024)  ← MVP, produces decisions.md
   ↓
Phase 4 US2 (T025-T033)  ← needs the arrangement from US1 to be worth testing against
   ↓
Phase 5 US3 (T034-T041)  ← needs the chosen design and the restore path US2 provides
   ↓
Phase 6 US4 (T042-T045)  ← T042 needs T027 in place to measure the real cost
   ↓
Phase 7 (T046-T050)
```

Story independence, stated honestly: US2 can be built and tested without US1,
by writing an arrangement by hand. US1 can be built and judged without US2,
because the page composes with its own copy of the modules. US3 is the only
story that genuinely requires an earlier one, since it has nothing to adopt
until US1 has produced a decision. US4 can start at any point and only its
bench comparison waits on US2.

## Parallel opportunities

Within phase 2: T008 and T009 touch only the preview module and are
independent of T004 to T007.

Within phase 3: T011 and T022 are independent of the page tasks. T013 to T020
all edit the generator and must run in sequence.

Within phase 4: T026, T029 and T031 are separate test files and can run
together once their subjects exist.

Within phase 5: T035 can be written the moment T034's before-state is
captured.

Within phase 6: T042, T043 and T044 are independent of each other.

## Implementation strategy

**MVP is phase 3.** The page plus `decisions.md` answers the question the
feature was created to ask, and feature 003 is the precedent for stopping
there if the answer turns out to be "nothing changes". Phases 1 and 2 are the
price of a page that cannot lie about what the terminal will draw.

Ship phase by phase. Each checkpoint above is a state the repository can sit
in with `node scripts/smoke-test.js` green and the bar working.
