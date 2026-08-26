---

description: "Task list for statusline line-by-line audit and freshness guarantees"
---

# Tasks: Statusline Line-by-Line Audit and Freshness Guarantees

**Input**: Design documents from `/specs/001-statusline-freshness-audit/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Branch**: `001-statusline-freshness-audit`, already created. Work lands through a pull request.

**Tests**: Included. FR-008 requires every audited behaviour to be covered by a test, SC-005 requires every segment covered in its present, absent and degraded states, and Principle IX requires `scripts/smoke-test.js` to catch platform regressions. Tests are written before the code they cover.

**Organization**: Grouped by user story, so each story can be implemented, tested and shipped on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

Single project, flat `src/`, per the structure decision in plan.md. Tests live under
`scripts/tests/` and run through `npm test`. No dependency may be added to
`package.json`; Principle IV makes zero runtime dependencies a condition of the
install path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the test suite able to hold roughly fifty new cases without every task colliding in one file, and build the fixtures the later phases assert against.

- [X] T001 Extract the `test`, `stripAnsi` and counter helpers from `scripts/smoke-test.js` into `scripts/test-harness.js`, exporting `test()`, `stripAnsi()` and `summary()`
- [X] T002 Rewrite `scripts/smoke-test.js` as a runner that imports every `scripts/tests/*.test.js`, prints the platform banner, and exits non-zero on any failure
- [X] T003 Move the existing render assertions from `scripts/smoke-test.js` into `scripts/tests/render.test.js`
- [X] T004 [P] Move the existing path, URL and install assertions into `scripts/tests/platform.test.js`
- [X] T005 [P] Move the existing transcript and skill-window assertions into `scripts/tests/skills.test.js`
- [X] T006 [P] Add `scripts/tests/fixtures/transcript.js` writing a synthetic JSONL transcript of a caller-chosen size, with entries of realistic width and a skill invocation at a chosen position
- [X] T007 [P] Add `scripts/tests/fixtures/repo.js` creating throwaway git repositories in `os.tmpdir()`: clean with upstream, no upstream, detached HEAD, dirty tree, untracked files, a repository with 5,000 changed files (SC-001), one containing a submodule (research.md flags submodule state as unconfirmed), and a linked worktree of another repository
- [X] T008 [P] Add `scripts/tests/fixtures/home.js` creating a throwaway `HOME` with its own `settings.json`, so install and uninstall can be tested without touching the real one
- [X] T009 Run `npm test` and confirm the migrated suite passes unchanged on this platform

**Checkpoint**: The suite is file-per-concern, so later tasks marked [P] genuinely touch different files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The freshness rules, the cache, and the two cross-cutting guarantees every story depends on: usage segments that show `?%`, and a render that never exits non-zero.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T010 [P] Write `scripts/tests/freshness.test.js` covering: a reading with `value: null` renders nothing, a reading past its maximum age renders nothing, a reading inside its maximum age renders, a reading with an `at` in the future is treated as a miss, and the payload-derived usage segments keep their slot with `?%` instead of disappearing
- [X] T011 [P] Write `scripts/tests/cache.test.js` covering: miss on absent file, miss on unparseable file, miss on wrong `schema`, hit inside maximum age, a failed refresh leaving the previous value intact, the lock preventing a second refresh inside the maximum age, two writers renaming over the same file without either seeing a partial read, and a payload with no session identifier falling back to the shared key
- [X] T012 [P] Write `scripts/tests/exit-code.test.js`: with a source stubbed to throw, and again with the renderer itself stubbed to throw, `bin/cli.js render` writes lines to stdout, writes nothing to stderr, and exits 0 (FR-015)
- [X] T013 Create `src/freshness.js` with the `Reading` shape from data-model.md, the per-segment maximum-age table, the per-source budget table, `isRenderable(reading, now)`, and the rule that usage segments render `?%` rather than vanishing
- [X] T014 Create `src/cache.js` with `repoKey(dir)` hashing the absolute repository root via `node:crypto`, `readEntry(key, name)`, `writeEntry(key, name, value)` writing to `<file>.tmp` and renaming over the target, and lock handling per `contracts/state-files.md`
- [X] T015 Add `spawnRefresh(key, name, cwd)` to `src/cache.js`, spawning `process.execPath` detached with `stdio: "ignore"` and `unref()`, honouring `CLAUDE_STATUSLINE_NO_REFRESH=1` by doing nothing
- [X] T016 Refactor `src/render.js` to build readings and ask `src/freshness.js` whether each segment renders, keeping the existing `sources` override so preview generation stays reproducible
- [X] T017 Implement the usage segments in `src/render.js` and `src/tokens.js` as payload-only with `?%` for an absent field and unknown text for an absent reset, with no estimation anywhere (FR-010, Principle III)
- [X] T018 Wrap the render path in `bin/cli.js` so any unexpected throw prints whatever lines could be built, or one minimal line if none could, writes nothing to stderr, and exits 0 (FR-015, `contracts/cli.md`)
- [X] T019 Extend the sweep in `src/changeTracker.js` to prune `~/.claude/statusline/cache/` and `~/.claude/statusline/skills/` under the same one-week rule and the same first-render trigger
- [X] T020 Run `npm test` and confirm rendering is unchanged by the refactor, then confirm `npm run previews` produces no diff

**Checkpoint**: Freshness decisions live in one place, and the bar can no longer show an error or vanish on a crash.

---

## Phase 3: User Story 1 - The line keeps up with the session (Priority: P1) 🎯 MVP

**Goal**: A redraw completes inside 300 ms at p95 on a session of any age, with no network call on the redraw path.

**Independent Test**: Render against an 80 MB transcript and a repository with 5,000 changed files; the redraw finishes inside the budget in 95 of 100 runs and shows the skill invoked immediately before it.

### Tests for User Story 1

- [X] T021 [P] [US1] Write `scripts/tests/transcript-tail.test.js`: reads only the tail, discards the partial first line of a mid-file chunk, expands backwards until the skill limit or the window cutoff, stops at the byte cap and reports `truncated: true`, and returns `bytesRead` far below file size for a large fixture
- [X] T022 [P] [US1] Write `scripts/tests/git-status.test.js` against the fixtures from T007: branch name parsed, `ahead`/`behind` parsed from `# branch.ab`, `upstream: null` and `ahead: null` when the header is absent, `head: "(detached)"` on a detached HEAD, correct `changed`/`untracked` counts including paths with spaces, a submodule's state counted the way the segment claims, a linked worktree reporting its own branch, and a repository with tens of thousands of untracked files still answering inside the git budget
- [X] T023 [P] [US1] Write `scripts/tests/budget.test.js`: 100 consecutive renders against a generated 80 MB transcript in the 5,000-file repository, asserting the 95th percentile under 300 ms, and the same measurement against a 1 MB transcript within 20% of it (SC-001, SC-002)
- [X] T024 [P] [US1] Write `scripts/tests/offline.test.js`: with the PR source stubbed to hang, and again stubbed to fail the way an unauthenticated `gh` fails, the render still completes under budget and the segment is absent rather than wrong (SC-004)
- [X] T025 [P] [US1] Write `scripts/tests/skills-freshness.test.js`: a skill invoked in the last transcript entry appears on the next render, one whose last use is outside the window disappears, and an entry carrying no timestamp is still counted (FR-005, SC-003)
- [X] T026 [P] [US1] Write `scripts/tests/source-budget.test.js`: each on-path source stubbed to exceed its declared budget is abandoned at that budget, the segment falls back to a cached value or disappears, and the render still finishes (FR-003, budgets in data-model.md)

### Implementation for User Story 1

- [X] T027 [US1] Create `src/transcriptTail.js` reading backwards in 256 KB chunks through `openSync`/`readSync`, discarding the partial first line of any chunk not starting at byte 0, stopping on the skill limit or a timestamp older than the window, capped at 4 MB and 100 ms, returning `{ skills, truncated, bytesRead }`
- [X] T028 [US1] Rewrite `src/skills.js` to use `src/transcriptTail.js` instead of `readFileSync` plus `split("\n")`, keeping the existing window semantics, the `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` override, and the rule that an entry with no timestamp is kept
- [X] T029 [US1] Rewrite `getGitInfo` in `src/git.js` to issue one `git --no-optional-locks status --porcelain=v2 --branch -z` within the 150 ms git budget, parsing the `# branch.*` headers and entry lines into the git snapshot from data-model.md, with `upstream`, `ahead` and `behind` null when no upstream exists
- [X] T030 [US1] Move `getRemoteUrl` in `src/git.js` behind `src/cache.js` under the `remote` key with its 24-hour maximum age
- [X] T031 [US1] Rewrite `getPrInfo` in `src/git.js` to read the `pr` cache entry only, never calling `gh` inline, and to ask `spawnRefresh` when the entry is past half its maximum age
- [X] T032 [US1] Rewrite `src/rtk.js` the same way against the `rtk` cache entry
- [X] T033 [US1] Add the `refresh <key>` subcommand to `bin/cli.js`, performing exactly one lookup within the 5 s off-path budget, writing the cache atomically, clearing its lock on both success and failure, and leaving a previous good value alone when the lookup fails, per `contracts/cli.md`
- [X] T034 [US1] Enforce the per-source budgets from data-model.md in the gathering path, replacing the current blanket 1500 ms timeouts in `src/git.js` and `src/rtk.js`
- [X] T035 [US1] Wire `src/render.js` to the new git snapshot: render the ahead and behind segments only when `upstream` is not null
- [X] T036 [US1] Confirm change tracking in `src/changeTracker.js` compares values rather than gather times, so a cache refresh that changed nothing does not animate an icon (Principle X)
- [X] T037 [US1] Manual check without `doctor`, which does not exist yet: render against the largest transcript under `~/.claude/projects` and time it with `/usr/bin/time -p`

**Checkpoint**: The reported lag is gone, and the redraw no longer touches the network.

---

## Phase 4: User Story 2 - Every segment says something true (Priority: P2)

**Goal**: Every segment on all four lines is either correct or absent, and the line fits.

**Independent Test**: Feed a captured live payload plus the edge payloads through the renderer and compare each segment against what was put in.

### Tests for User Story 2

- [X] T038 [P] [US2] Write `scripts/tests/segments.test.js` covering each of the fifteen segment keys in three states each: present, absent, and degraded (SC-005)
- [X] T039 [P] [US2] Write `scripts/tests/countdown.test.js`: a reset an hour ahead, a reset days ahead switching to `Nd Nh`, a reset that just passed, a reset that passed hours ago rendering as unknown rather than "resetting now", and a reset crossing a daylight-saving boundary where the countdown, the clock face and the named day agree (FR-011)
- [X] T040 [P] [US2] Write `scripts/tests/width.test.js` asserting every rendered line stays within 120 characters for the widest fixture in both glyph modes, counting display width rather than code units, and that the trim order in data-model.md is followed step by step (FR-014, SC-006)
- [X] T041 [P] [US2] Add cases to `scripts/tests/render.test.js` for the directory label at the filesystem root and at a Windows drive root, and for a detached HEAD rendering as a commit rather than a branch
- [X] T042 [P] [US2] Add a case to `scripts/tests/skills.test.js` asserting that a fourth active skill produces a visible truncation marker rather than silence (FR-013)
- [X] T043 [P] [US2] Write `scripts/tests/effort-style.test.js`: effort renders only with a real `effort.level`, a non-default output style renders in its own segment with its own icon, an output style never appears behind the effort icon, and a default output style renders nothing (FR-021)

### Implementation for User Story 2

- [X] T044 [P] [US2] Fix `getDirLabel` in `src/git.js` so a path whose basename is empty (`/`, `C:\`) renders the root itself rather than an empty label
- [X] T045 [P] [US2] Fix `formatResetCountdown` in `src/tokens.js` so a timestamp more than a few minutes past renders as unknown rather than "resetting now"
- [X] T046 [US2] Render a detached HEAD in `src/render.js` as the short commit id with a marker that does not claim to be a branch, and suppress the branch tree link for it
- [X] T047 [US2] Split effort and output style in `src/render.js` into two segments per FR-021: effort keeps the lightning icon and appears only with a real level, `outputStyle` gets its own icon and appears only when non-default (touches the same file as T046, so not parallel)
- [X] T048 [US2] Add the truncation marker to the skills line in `src/render.js` when more skills are active than the line shows
- [X] T049 [US2] Add a width guard to `src/render.js` following the trim order in data-model.md, stopping at the first step that brings the line inside 120 characters
- [X] T050 [P] [US2] Add fixtures to `scripts/preview-fixtures.js` for the newly distinguishable states: no upstream, detached HEAD, skills truncated, output style set, and a line wide enough to trigger the guard
- [X] T051 [US2] Regenerate previews with `npm run previews` and commit the SVG and PNG output in the same change, per Principle VIII
- [X] T052 [US2] Run `npm test` and confirm every segment's three states pass on this platform

**Checkpoint**: Both stories work independently, and no segment can show a value that is not the real one.

---

## Phase 5: User Story 3 - The user can see why a value looks wrong (Priority: P3)

**Goal**: A diagnostic that accounts for every segment on the line, and a benchmark that re-measures the budget without editing code.

**Independent Test**: Run the diagnostic on a live session; it names every segment with value, age, source and cost, separates the cached reading from a live probe, and gives a reason for each absent one.

### Tests for User Story 3

- [X] T053 [P] [US3] Write `scripts/tests/doctor.test.js`: every segment key appears in the report, a cached segment shows both the reading `render` would use and the live probe result in separate columns, an absent segment carries a reason distinguishing "not applicable" from "source failed", and `--json` output parses to the shape in data-model.md (FR-016, FR-017, SC-007)
- [X] T054 [P] [US3] Write `scripts/tests/bench.test.js` asserting the benchmark reports a p95 and a per-source breakdown, and exits 0 on a passing run

### Implementation for User Story 3

- [X] T055 [US3] Create `src/doctor.js` running the same gathering path as the renderer, timing each source, and producing the diagnostic report rows from data-model.md plus a total elapsed row
- [X] T056 [US3] Add the live-probe column to `src/doctor.js`, run alongside the cached reading rather than in place of it, so the report never describes a path the renderer does not take (`contracts/cli.md`)
- [X] T057 [US3] Add the `doctor` subcommand to `bin/cli.js`, printing a table by default and JSON with `--json`, exiting 0 whenever a report was produced
- [X] T058 [P] [US3] Create `scripts/bench.js` with a `--runs` option, reporting per-run elapsed time, the 95th percentile, and a per-source breakdown (FR-018)
- [X] T059 [US3] Run `node scripts/bench.js --runs 100` in the 5,000-file fixture repository and record the measured p95 in the pull request

**Checkpoint**: All three stories work, and the 300 ms budget is measurable by anyone.

---

## Phase 6: Cross-Cutting - the optional skill hook

**Purpose**: Make the skills line react at invocation time rather than at transcript-flush time. Accelerates User Story 1; nothing depends on it, per FR-019.

- [X] T060 [P] Write `scripts/tests/skill-events.test.js`: an appended record is read back, a malformed line is skipped rather than ending the read, a missing file falls back to the transcript path with an identical rendered line, and records outside the window are dropped
- [X] T061 [P] Write `scripts/tests/install-hook.test.js` against the throwaway `HOME` from T008: install registers the hook by default, `--no-hook` skips it, the registered command uses `process.execPath` with both paths quoted, uninstall removes exactly that entry, a hand-written or third-party `PostToolUse` entry survives uninstall, and settings are otherwise byte-identical (FR-020, SC-008)
- [X] T062 Create `src/skillEvents.js` with an append-only writer and a tail reader for `~/.claude/statusline/skills/<session-id>.jsonl`, per `contracts/state-files.md`
- [X] T063 Add the `note-skill` subcommand to `bin/cli.js`, reading the hook payload from stdin, appending one record, writing nothing to stdout or stderr, and always exiting 0
- [X] T064 Make `src/skills.js` prefer the event file when it exists and fall back to `src/transcriptTail.js` otherwise, with the rendered line identical either way
- [X] T065 Add hook registration to `src/install.js`: on by default, skipped with `--no-hook`, using `process.execPath` as the interpreter per Principle IX and `contracts/hooks.md`, quoting both paths, non-interactive, idempotent, and reported on the install summary
- [X] T066 Add matching hook removal to `uninstall` in `src/install.js`, matched on this plugin's own CLI path so no other hook is touched
- [X] T067 Run `npm test` and confirm the install and uninstall cases pass against the throwaway `HOME`, never the real one

**Checkpoint**: With the hook registered the skills line is immediate; without it, everything still meets its budget.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T068 [P] Document `CLAUDE_STATUSLINE_NO_REFRESH`, the `doctor` subcommand, and the hook with its `--no-hook` opt-out in `README.md`, including how to remove it
- [X] T069 [P] Rewrite the "How it stays current" section of `README.md`, which currently states that every value is gathered on each redraw, to describe cached values with maximum ages and a detached refresh
- [X] T070 [P] Update the "Active skills" paragraph in `README.md` for the truncation marker and the hook-versus-transcript paths
- [X] T071 [P] Document the new output style segment and the effort split in `README.md`
- [X] T072 Run every check in [quickstart.md](./quickstart.md) end to end and record the measured p95
- [X] T073 Confirm CI passes on Linux, macOS and Windows, and that the preview staleness check produces no diff
- [ ] T074 Pass every markdown file changed in this feature through the `humanizer` skill, then open the pull request from `001-statusline-freshness-audit` — the humanizer pass is done; the pull request is left for whoever decides this is ready to land

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies, start immediately
- **Foundational (Phase 2)**: needs Phase 1, blocks every user story
- **User Story 1 (Phase 3)**: needs Phase 2
- **User Story 2 (Phase 4)**: needs Phase 2; T035 in US1 also touches the ahead/behind rendering that T038 asserts, so run US1 first if both are in flight
- **User Story 3 (Phase 5)**: needs Phase 2; reports whatever exists at the time, so it can run alongside US2
- **Hook (Phase 6)**: needs T027 and T028 from US1, since FR-019 requires the transcript fallback to stand on its own
- **Polish (Phase 7)**: needs whichever stories are being shipped

### User Story Dependencies

- **US1 (P1)**: independent once Phase 2 is done. This is the MVP.
- **US2 (P2)**: independent, but shares `src/render.js` and `src/git.js` with US1
- **US3 (P3)**: independent, and reads through the same gathering path the other two build

### Within Each Story

- Tests are written first and must fail before the implementation lands
- New modules before the code that wires them into `src/render.js`
- Rendering changes before preview regeneration

### Parallel Opportunities

- T004 through T008 in Setup
- T010, T011 and T012 in Foundational
- T021 through T026 in US1
- T038 through T043 in US2, and T044, T045 and T050 in its implementation
- T053, T054 and T058 in US3
- T060 and T061 in the hook phase
- T068 through T071 in Polish
- US2 and US3 can proceed together once US1 has landed

T046, T047, T048 and T049 all edit `src/render.js` and are deliberately sequential.

---

## Parallel Example: User Story 1

```bash
# Write all six test files for User Story 1 together:
Task: "Write scripts/tests/transcript-tail.test.js"
Task: "Write scripts/tests/git-status.test.js"
Task: "Write scripts/tests/budget.test.js"
Task: "Write scripts/tests/offline.test.js"
Task: "Write scripts/tests/skills-freshness.test.js"
Task: "Write scripts/tests/source-budget.test.js"

# Then the implementation, which is mostly sequential:
# T027 -> T028 (skills.js needs transcriptTail.js)
# T029 -> T035 (render.js needs the new git snapshot shape)
# T030, T031, T032 can run together once T014 and T015 exist
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup, so the suite can grow
2. Phase 2: Foundational, which blocks everything
3. Phase 3: User Story 1
4. Stop and validate: run the budget checks in quickstart.md against the largest real transcript on the machine
5. This alone answers the reported complaint

### Incremental delivery

1. Setup and Foundational, giving a testable freshness layer, `?%` where a payload field is missing, and a render that always exits 0
2. US1, the MVP, ending the lag
3. US2, removing every misleading segment
4. US3, making the budget measurable by anyone
5. The hook, making skills instant

Each step ships on its own and leaves the previous one working.

---

## Notes

- Two things changed during implementation and are recorded in research.md
  (Decision 8) rather than left as a silent deviation: the git snapshot became a
  cached source with a background refresh, because a repository with 5,000 modified
  files costs 812 ms and no flag brings that down; and the transcript fixture grew a
  `fillerAgeMs` option, because a scan cannot be pushed to its time budget by
  material the activity window would discard first.
- The budget test runs at a tenth of SC-001's scale on CI (10 runs, 8 MB, 500 files)
  and says so on stdout. The full measurement runs locally and in quickstart.md.
- PNG copies of the previews under `docs/images/` are for Medium and are generated on
  demand by `scripts/generate-article-images.js`; they are not part of the staleness
  check, because rasterisation is not byte-reproducible.
- [P] means different files and no dependency on unfinished work
- Every commit that changes a segment regenerates previews in the same commit, per Principle VIII
- No task may add a runtime dependency
- Every new file path goes through `node:path`, and every spawned command uses `process.execPath` with `cwd` rather than an interpolated shell string, per Principle IX
- Install and uninstall tests run against the throwaway `HOME` from T008, never `~/.claude/settings.json`
- Stop at any checkpoint to validate a story on its own
