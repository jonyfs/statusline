---

description: "Task list for the selected statusline redesign"
---

# Tasks: The Selected Statusline Redesign

**Input**: Design documents from `/specs/002-statusline-design-review/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), constitution v4.0.0

**Branch**: `002-statusline-design-review`, created. Lands through a pull request.

**Tests**: Included, written before the code they cover, as in feature 001.

**Organization**: Grouped by the twelve implementation steps in plan.md rather than by the spec's user stories. The spec's stories are about producing the review page and honouring the selection, which US1 and US2 already delivered; what remains is US3, "only the selected changes get built", and 55 items in one phase would not be reviewable. Each phase below is an increment that can be shipped and judged on its own.

**Scope rule**: every task traces to a selected item. An item that was not selected leaves current behaviour byte-identical (FR-017).

## Format: `[ID] [P?] Description`

- **[P]**: different files, no dependency on unfinished work
- Item codes in brackets, for example `[A1]`, name the selection entry the task serves

---

## Phase 1: The segment registry

**Purpose**: Move segment definitions out of `render.js` and into a table. No behaviour change: the same fifteen segments, same order, same colours, now declared rather than inlined. This is what makes the priority table a reviewable object.

- [X] T001 Write `scripts/tests/segments.test.js`: every registry row has a key, line, order, priority and colour channel; keys are unique; priorities are unique; no row declares both `ramp` and `change`; every key in the priority table of data-model.md is present and vice versa
- [X] T002 Create `src/segments.js` with the registry for the fifteen segments that render today, using the priorities and colour channels from data-model.md
- [X] T003 Rewrite `src/render.js` to build its lines from the registry rather than from inline arrays, keeping output byte-identical
- [X] T004 Run `npm test` and `npm run previews`, and confirm no test changed and no preview diff appeared

**Checkpoint**: The bar renders exactly as before, from a table anybody can read.

---

## Phase 2: Layout [D2, D4, D1, D3, D8]

**Purpose**: Real width, priority-driven degradation, line shedding. Still fifteen segments, but they now degrade by intent instead of by source order.

- [X] T005 [P] Write `scripts/tests/layout.test.js`: width comes from `COLUMNS` and falls back to 120 when absent; at 200, 120, 100 and 80 columns the surviving segments are exactly those the priority table predicts; a segment never changes position because a neighbour disappeared
- [X] T006 [P] Write `scripts/tests/shedding.test.js`: at `LINES` 40, 8, 6 and 4 the rendered line count is 4, 4, 3 and 1 respectively, following the order skills, model, place, with line 4 last; every line returns when the rows do
- [X] T007 Create `src/layout.js` with `terminalWidth()` and `terminalHeight()` reading `COLUMNS` and `LINES` [D2]
- [X] T008 Add priority fill to `src/layout.js`: fill each line by descending priority until the next segment would exceed the width [D4]
- [X] T009 Add line shedding to `src/layout.js`, in the order skills, model, place, keeping line 4 to the end [D1]
- [X] T010 Add right alignment to `src/layout.js`: a group of segments drawn from the far edge inward [D3]
- [X] T011 Add column alignment across lines to `src/layout.js`, and make it yield to the width limit when the two conflict [D8]
- [X] T012 [P] Add `E0B1`, `E0B2` and `E0B3` to `scripts/extract-glyphs.py` and regenerate `src/preview/glyphs.json`, so right-aligned and thin separators can be drawn
- [X] T013 Wire `src/render.js` to `src/layout.js`, and mark the reset countdowns as the right-aligned group [D3]
- [X] T014 Run the width and shedding checks from quickstart.md at 200, 120, 100, 80 and 60 columns

**Checkpoint**: The bar fits any terminal, and what it drops is what the table says it drops.

---

## Phase 3: Payload-first values [A1, A2, C1, C2]

**Purpose**: The two segments that pay a subprocess for something the payload already sends. This step pays for itself on the first redraw.

- [X] T015 [P] Write `scripts/tests/payload-pr.test.js`: the PR renders from `pr.number`, `pr.state` and `pr.review_state`; `gh` is not called when the field is present; `gh` is still called when it is absent; `pr.kind` renders a merge request without breaking on the Claude Code version that omits it
- [X] T016 [P] Write `scripts/tests/payload-repo.test.js`: branch and directory links are built from `workspace.repo`; `git remote` is not called when it is present, and is called when it is not
- [X] T017 Read `pr` from the payload in `src/render.js` and `src/git.js`, with the `gh` lookup kept as the fallback [A1, C1]
- [X] T018 Read `workspace.repo` for link construction, with `git remote get-url` kept as the fallback [A2, C2]
- [X] T019 Render the review state on the PR segment, per A1's chosen form [A1]
- [X] T020 Render owner and repo as text, per A2's chosen form [A2]

**Checkpoint**: Two subprocesses become fallbacks, and the PR segment says more than it did.

---

## Phase 4: The rest of the free payload values

**Purpose**: Twelve registry rows and their tests. Each is a payload field with no cost.

- [X] T021 [P] Write `scripts/tests/payload-segments.test.js` covering every segment below in its present, absent and degraded states
- [X] T022 [P] Session duration, hours and minutes [A4]
- [X] T023 [P] Time waiting on the API, absolute [A5]
- [X] T024 [P] Lines added and removed, both [A6]
- [X] T025 [P] Token counts, used of total [A7]
- [X] T026 [P] Context window size, always shown [A8]
- [X] T027 [P] The 200k flag, a marker when true [A10]
- [X] T028 [P] Agent name, marker plus name [A14]
- [X] T029 [P] Session name, full [A15]
- [X] T030 [P] Working directory against project directory, both when they differ, on line 1 [A17]
- [X] T031 [P] Worktree identity, name and origin branch [A19]
- [X] T032 Add every new reading to `src/freshness.js` with its maximum age

**Checkpoint**: Everything the payload sends and the owner selected is on the bar.

---

## Phase 5: How a number is drawn [E1, E2, E3, E4, E5, E6, E8, E9]

**Purpose**: The bar, the ramp, the shape rule that keeps it readable without colour, and the formatting.

- [X] T033 [P] Write `scripts/tests/ramp.test.js`: a level maps to a band at 60 and 85; each band has a distinct bar character; the mapping is identical for context and for the rate limits
- [X] T034 [P] Write `scripts/tests/bar.test.js`: bar width scales with the terminal (8, 10, 16); the number renders beside the bar; a bar plus number never exceeds its segment's share
- [X] T035 Create `src/ramp.js`: level to colour and to bar shape, in one place [E4, E5, E6]
- [X] T036 Render context as a bar and a number [E1, E2, E3]
- [X] T037 Apply the ramp to context, 5-hour and 7-day [E4, E5]
- [X] T038 Make each band change the bar's characters, so the band survives greyscale [E6]
- [X] T039 [P] Dim the reset countdowns [E8]
- [X] T040 [P] Abbreviate token counts, per E9

**Checkpoint**: A glance says which band a value is in, with or without colour.

---

## Phase 6: Change highlighting moves to colour [E10]

**Purpose**: Replace the frame animation with a colour shift, on the four segments the split assigns to it.

- [ ] T041 [P] Write `scripts/tests/highlight.test.js`: branch, PR, skills and model brighten for 30 seconds after a change and revert; context, 5-hour, 7-day and burn rate never highlight; no segment carries both channels
- [ ] T042 Replace the frame sequence in `src/changeTracker.js` with a colour shift [E10]
- [ ] T043 Assert the channel split in `src/segments.js`, so a row declaring both fails the suite rather than the eye
- [ ] T044 Update the README's animation section, which describes frames

**Checkpoint**: A colour on the bar means one thing, wherever it is.

---

## Phase 7: Merges and removals [C3, C4, C5, C6, C7]

**Purpose**: Take width back. Cheapest once the registry exists.

- [ ] T045 [P] Write `scripts/tests/merges.test.js` covering each merge and removal in its chosen form
- [ ] T046 Merge effort and output style into one segment beside the model [C3]
- [ ] T047 Show the weekday only past 24 hours [C4]
- [ ] T048 Show rtk only when it has moved five points [C5]
- [ ] T049 Collapse the two reset countdowns into one segment carrying both [C6]
- [ ] T050 Keep the directory even when it repeats the repository name, and record why [C7]

**Checkpoint**: The line is shorter than it was two phases ago, with more on it.

---

## Phase 8: Computed values [B1, B2, B3, B4, B8, B12]

**Purpose**: The four items that need history, the conflict count that is already parsed, and the clock.

- [ ] T051 [P] Write `scripts/tests/samples.test.js`: the ring holds at most 60 samples, evicts oldest first, survives a corrupt state file, and yields nothing until 5 samples span 60 seconds
- [ ] T052 [P] Write `scripts/tests/rates.test.js`: burn rate, projection and sparkline are absent below the sample threshold and correct above it; a projection that lands past the reset is marked
- [ ] T053 Create `src/samples.js`: the bounded ring in the existing session state file
- [ ] T054 Burn rate on the 5-hour window, percent per hour, ramped [B1]
- [ ] T055 Projected exhaustion time [B2]
- [ ] T056 [P] Distance to auto-compaction, a warning past the threshold [B3]
- [ ] T057 [P] Context trend as a sparkline [B4]
- [ ] T058 [P] Merge conflicts, counted from the `u` records already parsed [B8]
- [ ] T059 [P] A 24-hour clock [B12]

**Checkpoint**: The bar says where a number is heading, not only where it is.

---

## Phase 9: Network and transcript [B10, F6, F7]

**Purpose**: One background-refresh value, and two that ride the transcript read that already happens.

- [ ] T060 [P] Write `scripts/tests/ci.test.js`: CI status renders from cache only, never calls `gh` on the redraw path, and disappears rather than going stale
- [ ] T061 [P] Write `scripts/tests/activity.test.js`: the working or idle marker and the todo count come from the tail read, and both are absent rather than wrong when the transcript says nothing
- [ ] T062 CI status, symbol and workflow, behind the existing background refresh [B10]
- [ ] T063 Working or idle marker from the transcript tail [F6]
- [ ] T064 Todo progress, count and current item, from the same read [F7]

**Checkpoint**: The bar shows what Claude is doing, not only what the session looks like.

---

## Phase 10: Themes, configuration, interval, task rows [F1, F2, F3, F5]

- [ ] T065 [P] Write `scripts/tests/themes.test.js`: Nord and Gruvbox define every token the Catppuccin flavors define; neither is the default; every segment renders in all six
- [ ] T066 [P] Write `scripts/tests/task-rows.test.js` against `contracts/task-rows.md`: one JSON line per overridden row, an omitted id keeps the default, an empty content hides the row, and a row never exceeds `columns`
- [ ] T067 [P] Write `scripts/tests/settings.test.js` against `contracts/settings.md`: install writes `refreshInterval: 60` and the task-row command, `--no-refresh-interval` skips the interval, and uninstall removes both
- [ ] T068 Add Nord and Gruvbox to `src/theme.js` [F3]
- [ ] T069 Add the thin separator fallback, with Powerline still the default [D9]
- [ ] T070 Create `src/taskRows.js` and the `task-rows` subcommand [F2]
- [ ] T071 Write `refreshInterval: 60` and the task-row command in `src/install.js`, both removable by uninstall [F1, F2]
- [ ] T072 Per-repository configuration, read from the repository root, ignored inside the home directory [F5]

**Checkpoint**: The bar matches the terminal it lives in, and keeps its countdowns honest while idle.

---

## Phase 11: The diagnostic [FR-016 carried forward]

- [ ] T073 [P] Write `scripts/tests/doctor-002.test.js`: every row reports priority, line and alignment; a dropped segment says whether it was too narrow or on a shed line
- [ ] T074 Add priority, line, align and the drop reason to `src/doctor.js`
- [ ] T075 Report the sample ring's depth, so "no burn rate yet" has an explanation

---

## Phase 12: Documentation and previews

- [ ] T076 [P] Rewrite the README's four-line section for a shape that sheds lines
- [ ] T077 [P] Document the priority table and what an 80-column terminal shows
- [ ] T078 [P] Document the new segments, the themes, and `refreshInterval`
- [ ] T079 Add preview fixtures: narrow terminal, shed lines, both new themes, the bar, the sparkline, the new segments
- [ ] T080 Regenerate previews and commit them in the same change
- [ ] T081 Run every check in quickstart.md and record the measured p95
- [ ] T082 Confirm CI passes on Linux, macOS and Windows
- [ ] T083 Pass every changed markdown file through the `humanizer` skill, then open the pull request

---

## Dependencies & Execution Order

- Phase 1 blocks everything: no other phase can add a segment until there is a table to add it to.
- Phase 2 blocks phases 4 onward, since a new segment without a priority has no defined behaviour on a narrow terminal.
- Phase 3 is independent of phase 2 and can run beside it.
- Phases 4 through 9 are independent of each other once phases 1 and 2 land.
- Phase 10's task rows depend on phase 5, since a task row draws the same bar.
- Phases 11 and 12 come last, because both describe whatever shipped.

### Parallel opportunities

T005 and T006; T015 and T016; every task in phase 4 marked [P]; T033 and T034; T051, T052 and the [P] tasks after them; T065, T066 and T067; T076 through T078.

---

## Implementation Strategy

**Land phase 1 and 2 first, and stop.** They are structural, they change no behaviour a user can see, and they are what everything else stands on. A mistake there is cheap to fix now and expensive later.

Then take phases 3 through 9 in any order, one pull request each, since each is a self-contained increment with its own tests and previews.

Phase 10 last of the building phases, because themes and task rows both render whatever the others produced.

---

## Notes

- Every commit that changes what renders regenerates previews in the same commit.
- No task may add a runtime dependency.
- The preview converter now throws on a private-use glyph it cannot draw, so a new separator or icon fails the build rather than shipping invisible.
- Anything discovered mid-flight that contradicts the selection or the constitution goes back to the owner rather than being decided in the code.
