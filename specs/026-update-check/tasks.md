---
description: "Task list for the update check"
---

# Tasks: The statusline tells you it has an update, and can take it

**Input**: Design documents from `specs/026-update-check/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md

**Tests**: Included, test-first as the repository works. Every test runs in the suite's
throwaway HOME, and the update tests build real origin and clone repositories in a temporary
directory, as `scripts/tests/install-update.test.js` already does. No test reaches the network.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 notify, US2 automatic (the default), US3 choose and check on demand

## Phase 1: Setup

- [X] T001 With the rendered evidence already in `specs/026-update-check/glyph-evidence.png`, add `U+F01DA` and `U+F0737` to `WANTED` in `scripts/extract-glyphs.py` with the evidence comments from research R3, and regenerate `src/preview/glyphs.json`, confirming only those two outlines are added

## Phase 2: Foundational (blocks every story)

- [X] T002 Write failing tests in `scripts/tests/update-check.test.js` for `src/updateCheck.js`: `readBehaviour()` is `auto` with no file, reads `~/.claude/statusline/updates.json`, falls back to `auto` on an unknown value, and is overridden by `CLAUDE_STATUSLINE_UPDATES`; `classify(subject)` gives `feature` for `feat:`, `feat(x):` and `feat!:`, `fix` for `fix:` and `fix(x):`, `other` for `docs:`, `chore:`, `Merge ...` and free text; `pendingCommits(root)` against a temporary origin and clone returns the commits in `HEAD..@{u}` with cleaned subjects cut to 72 characters and never changes the clone; a fetch against an unreachable remote returns `ok: false` within the time limit
- [X] T003 Implement `readBehaviour`, `writeBehaviour`, `classify` and `pendingCommits` (fetch with `GIT_TERMINAL_PROMPT=0`, stdin closed, 30 s limit; `git log --format=%H%x09%s HEAD..@{u}`; `plainText` on subjects) in `src/updateCheck.js` until T002 passes
- [X] T004 Add `runUpdateCheck({ root, now, applyUpdate })` to `src/updateCheck.js`: resolve the behaviour, skip when `off`, collect pending commits, set `outcome` per `data-model.md` (`current` when nothing is `feature` or `fix`), call `applyUpdate` only in `auto` with something to apply, and write the `update` cache entry keyed by `repoKey(root)`; add an `update` entry to `PROBES` in `src/refresh.js` that calls it with the clone root and `update()` from `src/update.js`
- [X] T005 Add `updateCheckDue(entry, now)` (true when missing or 24 h old) and `maybeStartUpdateCheck(now)` to `src/updateCheck.js`, using `spawnRefresh` from `src/cache.js`; add `update` to `MAX_AGE_MS` and `REFRESH_BUDGET_MS` in `src/freshness.js` so the lock lasts 24 h and the refresh may take 60 s; call it from `gather()` in `src/render.js` through a probe (`probe.maybeStartUpdateCheck`) so tests and previews can stub it
- [X] T006 Add tests to `scripts/tests/update-check.test.js` that `gather()` with `CLAUDE_STATUSLINE_NO_REFRESH=1` starts nothing, and that a fresh entry starts nothing

**Checkpoint**: the check runs and records results; nothing is drawn yet; `npm test` green.

## Phase 3: User Story 1, know that improvements and fixes are waiting (P1)

**Goal**: in `notify`, a `update ready · …` chip while improvements or fixes are pending.

**Independent Test**: behaviour `notify`, clone behind by one `feat:` and two `fix:` commits: run the check, then render; the chip reads `update ready · 1 feature, 2 fixes` and the clone is unchanged.

- [X] T007 [US1] Add failing tests to `scripts/tests/update-check.test.js`: the `ready` chip text with counts and zero counts omitted; no chip for `current`, for pending `docs:` only, or with behaviour `off`; the clone untouched in `notify`; subject text never on the bar
- [X] T008 [P] [US1] Add the registry row `{ key: "update", line: 1, order: 70, priority: 60, colour: "identity", source: "cache" }` and its `SEGMENT_ABOUT` sentence in `src/segments.js`
- [X] T009 [P] [US1] Add `NF_DOWNLOAD = "\u{F01DA}"` and `NF_ARROW_UP_BOLD = "\u{F0737}"` with evidence comments and the glyph keys `updateReady` (plain `⤓`) and `updateDone` (plain `⤒`) to `GLYPHS` in `src/render.js`
- [X] T010 [US1] Add `updateNotice(entry, sessionId)` to `src/updateCheck.js` returning the chip state per `data-model.md`, a probe `getUpdateNotice` that reads the entry, and the `update` chip builder on line 1 in `src/render.js`

**Checkpoint**: Story 1 works alone.

## Phase 4: User Story 2, updates happen by themselves (P1, default)

**Independent Test**: default behaviour, clean clone behind by one `fix:` commit: run the check; the clone is at the upstream commit and install ran; render twice in one session and once in another; the `statusline updated · 1 fix` chip shows in the first session only.

- [X] T011 [US2] Add failing tests to `scripts/tests/update-check.test.js`: `auto` fast-forwards a clean clone through the injected `applyUpdate` and records `updated` with the arrived counts; local edits and a diverged history record `blocked` with the reason and leave the clone untouched; an `applyUpdate` returning a non-zero status records `failed`; the `updated` and `failed` chips show for the first `session_id` drawn after the event and not for a later one, and `shownTo` is written once; `blocked` shows while it lasts
- [X] T012 [US2] Implement the `auto` branch of `runUpdateCheck` and the `updated`, `blocked` and `failed` states of `updateNotice` in `src/updateCheck.js`, recording `shownTo` with `writeEntry` the first time a one-time chip is built
- [X] T013 [US2] Print `Updates: <mode> (change with: node "<cli>" updates <other>)` from `install` in `bin/cli.js`, using `readBehaviour`, and after a successful `update` (FR-014); add a test to `scripts/tests/install-update.test.js`

**Checkpoint**: Stories 1 and 2 pass.

## Phase 5: User Story 3, choose, and check on demand (P3)

- [X] T014 [US3] Add failing tests to `scripts/tests/update-check.test.js` for the commands in `contracts/cli.md`: `updates` prints the behaviour and its source; `updates notify` writes the file; an unknown value exits 1; `CLAUDE_STATUSLINE_UPDATES` is reported as overriding; `check-updates` lists pending subjects and changes nothing; the `doctor` `updates:` line for current, ready, blocked and never checked
- [X] T015 [US3] Implement `updates` and `check-updates` in `bin/cli.js` using `src/updateCheck.js`, and the `updates:` line in `formatReport` in `src/doctor.js` (read in `runDoctor`, like the install line)

## Phase 6: Polish

- [X] T016 Stub `maybeStartUpdateCheck` and `getUpdateNotice` in `scripts/tests/fixtures/sources.js` and in `SOURCES` in `scripts/composer-fixture.js` (with a `ready` notice there, so the pool draws the chip), regenerate `scripts/tests/fixtures/composer-bar.txt` deliberately, and run `npm run composer`
- [X] T017 [P] Add an `update-ready.svg` case to `scripts/preview-fixtures.js` and run `npm run previews`
- [X] T018 [P] Document the check, the three behaviours, the chip states, what `auto` trusts (fast-forward from the clone's own upstream, no signature check) and how to turn it off in `README.md`; update its command list and glyph table; apply the humanizer to the new prose (FR-013)
- [X] T019 Run `npm test` and the quickstart in `specs/026-update-check/quickstart.md` in a throwaway HOME, and record the results
- [X] T020 Set `status: done` in `specs/026-update-check/spec.md`

## Dependencies

- T001 before T009.
- Phase 2 blocks all stories. US1 before US2 (US2 extends `updateNotice` and `runUpdateCheck`). US3 depends only on Phase 2.
- Polish after the stories.

## Parallel opportunities

- T008 and T009.
- US3 (T014, T015) alongside US2.
- T017 and T018.

## Implementation strategy

MVP is Phases 1 to 3: in `notify` the bar already tells the user what is waiting. Phase 4
turns on the default, `auto`. Each phase ends with a green `npm test`.
