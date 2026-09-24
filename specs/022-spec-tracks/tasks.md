# Tasks: Two spec tracks, and a scaffold that cannot lie

**Input**: Design documents from `/specs/022-spec-tracks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included because this feature's fourth user story *is* a test.
The scaffold check is the deliverable, not a verification of one.

**Organization**: grouped by user story. One ordering constraint overrides story
independence and is called out in Dependencies: the backfill and the script changes land
in a single commit.

## Format: `[ID] [P?] [Story] Description`

- `[P]` means parallelizable: a different file, no dependency on an unfinished task.
- `[US1]`..`[US4]` map to the user stories in spec.md.

## Path Conventions

Paths are repository-relative from `/Users/jony/repositorios/ai/statusline`. The scaffold
lives in `.specify/`; the test lives in `scripts/tests/`. Nothing under `src/` is touched.

---

## Phase 1: Setup

**Purpose**: establish the baseline this feature is measured against.

- [X] T001 Record the current failure verbatim by running `bash .specify/scripts/bash/check-prerequisites.sh --json` against a quick-track directory and saving the output, so the before state in specs/022-spec-tracks/quickstart.md step 1 is evidenced rather than remembered
- [X] T002 Run `node scripts/smoke-test.js` and record the passing count as the baseline that SC-006 is checked against

**Checkpoint**: baseline captured. No file has changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the declaration reader and the declarations themselves. Every user story
depends on both.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T003 Add `read_spec_declaration <spec-file>` to `.specify/scripts/bash/common.sh`, printing `SPEC_TRACK=` and `SPEC_STATUS=` lines, parsing only the block between a first-line `---` and the next `---`, trimming surrounding whitespace, emitting an empty value for an absent or unrecognized key, and never aborting a caller under `set -e`, following the parser ladder of `read_feature_json_feature_directory` in the same file (FR-001, FR-002, FR-003, FR-006, FR-007)
- [X] T004 [P] Add the front matter block to `.specify/templates/spec-template.md`, seeded `track: quick` and `status: active`, with one paragraph above the Requirements section explaining how to choose a track (FR-015)
- [X] T005 Backfill front matter into all 21 existing `specs/*/spec.md` files: `track: full` for 001 through 016 and 019, `track: quick` for 017, 018, 020 and 021, `status: done` for all except `003-status-change-animations`, which gets `status: active` as its interim value per spec.md Assumptions. Create no `plan.md` or `tasks.md` for any of them (FR-010)
- [X] T006 Verify T005 mechanically: every directory under `specs/` has a first-line `---`, and `ls specs/017-line-legibility specs/018-readme-current specs/020-links-that-belong-here specs/021-agent-rows` still shows no `plan.md` and no `tasks.md`

**Checkpoint**: the reader exists and every spec declares itself. Nothing enforces it yet,
so `main` is still green.

FR-009 originally had no task, on the assumption that the agent-context scripts only
summarize a plan when one is present and so need no change. That assumption was wrong, and
the gap is why the conflict below went unnoticed until `/speckit-analyze` read the script.
T030 closes it.

---

## Phase 3: User Story 1 - A small feature starts without lying about its shape (Priority: P1) 🎯 MVP

**Goal**: a quick-track feature passes the prerequisite check with only its spec, and a
full-track feature is held to its plan and tasks only once it is finished.

**Independent Test**: point `SPECIFY_FEATURE_DIRECTORY` at a directory holding only a
`spec.md` declaring `track: quick`, run `check-prerequisites.sh --json`, and get exit 0.
Shipping only this story already unblocks the repository.

### Implementation for User Story 1

- [X] T007 [US1] Replace the unconditional `[[ ! -f "$IMPL_PLAN" ]]` failure in `.specify/scripts/bash/check-prerequisites.sh` with declaration-driven logic: call `read_spec_declaration` on `$FEATURE_SPEC`, and require `plan.md` and `tasks.md` only when the track is `full` and the status is `done` (FR-004, FR-008)
- [X] T008 [US1] Keep `--require-tasks` requiring `tasks.md` regardless of declaration in `.specify/scripts/bash/check-prerequisites.sh`, since a caller passing it is about to implement, per contracts/scaffold-cli.md
- [X] T009 [US1] Add a spec.md existence check to `.specify/scripts/bash/check-prerequisites.sh` before the declaration is read, emitting the `spec.md not found` message from contracts/scaffold-cli.md (FR-008)
- [X] T010 [US1] Apply the same narrowing to the `plan.md` requirement in `.specify/scripts/bash/setup-tasks.sh`, leaving its `FEATURE_DIR` / `AVAILABLE_DOCS` / `TASKS_TEMPLATE` output shape unchanged (FR-008)
- [X] T011 [US1] Validate against specs/022-spec-tracks/quickstart.md steps 2 and 3: a finished quick feature exits 0, and the same directory switched to `track: full` exits 1 naming the missing plan

**Checkpoint**: the original failure is gone. A quick feature needs only its spec.

---

## Phase 4: User Story 2 - An undeclared spec is caught, not guessed at (Priority: P1)

**Goal**: a missing or invalid declaration fails with a message naming the offending key
and its allowed values, never a silent default.

**Independent Test**: run the check against a spec with no front matter, one with an
unknown track, and one with an unknown status. Three failures, and the track message and
the status message are distinct.

### Implementation for User Story 2

- [X] T012 [US2] Emit the exact track failure message from contracts/scaffold-cli.md in `.specify/scripts/bash/check-prerequisites.sh` when `SPEC_TRACK` is empty or unrecognized, including the second line telling the reader to add a front matter block
- [X] T013 [US2] Emit the exact status failure message from contracts/scaffold-cli.md in `.specify/scripts/bash/check-prerequisites.sh` when `SPEC_STATUS` is empty or unrecognized, and confirm the track message does not also fire for a status-only problem
- [X] T014 [P] [US2] Emit the same two messages from `.specify/scripts/bash/setup-tasks.sh`, so the two scripts do not disagree about what a bad declaration looks like
- [X] T015 [US2] Validate against specs/022-spec-tracks/quickstart.md step 4: no block, then `status: maybe`, each producing its own message

**Checkpoint**: stories 1 and 2 both hold. The scripts read declarations and refuse to
guess.

---

## Phase 5: User Story 3 - Every existing spec says what it is (Priority: P2)

**Goal**: all 21 directories carry a declaration matching what is on disk, with no
retroactive artifact.

**Independent Test**: specs/022-spec-tracks/quickstart.md step 5 prints a track and a
status for all 21 directories, and the four quick directories still hold no plan.

The edits themselves are T005, in Foundational, because the scripts of stories 1 and 2
reject an undeclared spec the moment they land. What remains here is verification and the
one decision this feature cannot make for the maintainer.

- [X] T016 [US3] Run specs/022-spec-tracks/quickstart.md step 5 and confirm all 21 directories print a valid track and status, and that the four quick directories gained no artifacts
- [X] T017 [US3] Run `bash .specify/scripts/bash/check-prerequisites.sh --json` against each of the 21 directories via `SPECIFY_FEATURE_DIRECTORY` and confirm every one exits 0
- [X] T018 [US3] Resolve `specs/003-status-change-animations`. Expected to be a maintainer decision; it was not. `specs/003-status-change-animations/decisions.md` already says "User Story 2 and User Story 3 are closed by this decision rather than by implementation", and `src/changeTracker.js` carries the reasoning at its `HIGHLIGHTED` set: the board was rendered, no candidate was chosen, the bar marks a change with colour instead. Set `status: done` and added a note above the unchecked boxes in its tasks.md pointing at decisions.md. The boxes stay unchecked because nobody built them

**Checkpoint**: the repository's history is declared. T018 is the one open item.

---

## Phase 6: User Story 4 - The scaffold fails loudly when it stops matching reality (Priority: P2)

**Goal**: a change that leaves the scaffold describing something untrue fails in CI.

**Independent Test**: break each guarded condition one at a time and confirm a named
failure; restore and confirm the suite is green on all three platforms.

**Blocked by**: T018.

### Tests for User Story 4

These tasks are the feature, not a check on it.

- [X] T019 [US4] Create `scripts/tests/spec-scaffold.test.js` importing `test` from `../test-harness.js` and reading files with `node:fs` only: no subprocess, no network, no git history, per FR-014, FR-017 and FR-022
- [X] T020 [US4] Add the case "the pointer names a directory that exists", asserting `.specify/feature.json` names an existing directory under `specs/` (FR-011, FR-020)
- [X] T021 [P] [US4] Add the case "every spec declares a track and a status" to `scripts/tests/spec-scaffold.test.js`, asserting a valid declaration in all 21 directories under `specs/`, and covering a spec whose body contains `---` as a separator to prove the reader only accepts front matter at the top of the file (FR-012)
- [X] T022 [P] [US4] Add the case "a finished feature has what its track promises", asserting that every `done` full-track directory holds `plan.md` and `tasks.md`, and that extra files never fail (FR-018)
- [X] T023 [P] [US4] Add the case "only the pointed feature is in progress", asserting at most one `active` directory and that it is the one `feature.json` names (FR-019)
- [X] T024 [P] [US4] Add the case "both pointers name the same feature", comparing the feature directory segment inside the `<!-- SPECKIT START -->` block of `CLAUDE.md` against `.specify/feature.json`, matching on directory rather than full path so a quick feature with no plan still passes (FR-013)
- [X] T025 [US4] Run specs/022-spec-tracks/quickstart.md step 6: break the pointer, confirm a named failure, restore; break the `CLAUDE.md` block, confirm a failure reporting both values, restore; confirm the suite returns to green

**Checkpoint**: the scaffold now fails the build when it stops matching reality.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 [P] Update `.specify/workflows/speckit/workflow.yml` so it describes both tracks rather than a single mandatory cycle (FR-021)
- [X] T027 Amend `.specify/memory/constitution.md` with one new principle defining the two tracks and the declaration contract, with its own version bump. Do not touch Principle XI
- [X] T028 Run `node scripts/smoke-test.js` and confirm the count equals the T002 baseline plus the six new cases, with zero failures (SC-006)
- [X] T030 Make the agent-context scripts follow the pointer rather than the newest plan on
      disk (FR-009, FR-013). `update-agent-context.sh` picked the most recently modified
      `specs/*/plan.md` across the whole tree, so a quick-track feature, having no plan,
      would have had another feature's plan written into its `CLAUDE.md` block, and the
      T024 case would have failed in CI on the first quick feature after this landed. Both
      the bash and PowerShell versions now read `.specify/feature.json` and use that
      feature's `plan.md`, or its `spec.md` when it has no plan, falling back to the old
      sweep only when there is no pointer at all. The block's sentence names which of the
      two it points at
- [X] T031 Fix the create-new-feature fallback (FR-015, U1). When the spec template cannot
      be resolved it ran `touch "$SPEC_FILE"`, producing an empty undeclared spec that
      `check-prerequisites.sh` then rejects: creating a feature would break the tooling
      that created it. It now writes a minimal declared stub
- [X] T032 Correct the constitution's own footer (D1, D2). Principle XII had been added
      and the Sync Impact Report bumped, but `**Version**:` still read 6.0.0 and the
      Compliance Review and Repository State sections still enumerated Principles I to XI.
      The Governance section requires a MINOR bump for a new principle. Also corrected
      "four-line format" in that enumeration, stale since 6.0.0 made the bar three lines
- [X] T029 Prove SC-008. A `--depth 1` clone was the planned method but clones the last commit, not the working tree, so it could not see this work. Verified more strictly instead: the working tree copied without `.git` at all, where `git rev-parse` fails outright, still runs 495 passed / 0 failed

---

## Dependencies

**The commit boundary (FR-016).** T005 (declarations) and T007 through T014 (enforcement)
land in a single commit. Split either way, `main` breaks: narrowed scripts without declarations
reject every existing spec, and declarations alone leave the original failure in place.
This overrides the usual one-story-per-commit habit and is the reason T005 sits in
Foundational rather than in Phase 5.

```
Phase 1 (baseline)
    |
    v
Phase 2 (T003 reader, T004 template, T005 backfill)
    |
    +--> Phase 3 (US1)  --+
    |                     |  same commit as T005
    +--> Phase 4 (US2)  --+
    |
    +--> Phase 5 (US3 verification)
              |
              v
            T018 (maintainer decision)
              |
              v
         Phase 6 (US4, the test)
              |
              v
         Phase 7 (workflow, constitution, final runs)
```

Story independence, where it survives: US1 and US2 touch the same two scripts and are not
parallel with each other. US3 is verification only. US4 depends on T018 and on everything
before it.

## Parallel Opportunities

- T004 runs alongside T003: different files, no shared state.
- T014 runs alongside T012 and T013: `setup-tasks.sh` is a different file from
  `check-prerequisites.sh`.
- T021 through T024 run alongside each other: separate cases in one new file, each
  independent of the others' assertions.
- T026 runs alongside anything in Phase 6: the workflow description is read by no test.

## Implementation Strategy

**MVP**: Phases 1 through 3. That is the reader, the declarations, and the narrowed
prerequisite check. At that point the repository is unblocked and a quick feature works,
which is the whole of the user's original complaint.

**Increment 2**: Phase 4. The error contract, so a bad declaration is caught rather than
guessed at.

**Increment 3**: Phases 5 and 6, gated on the maintainer's answer to T018. This is where
the title stops being an aspiration.

**Increment 4**: Phase 7. The workflow description and the constitution catch up with what
the code now does.
