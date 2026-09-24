---
track: full
status: done
---

# Feature Specification: Two spec tracks, and a scaffold that cannot lie

**Feature Branch**: `022-spec-tracks`

**Created**: 2026-09-23

**Status**: Completed (the declaration above is authoritative)

**Input**: Approved design document `docs/designs/speckit-two-tracks.md`, produced by an
office-hours session on 2026-09-23. Its Reviewer Concerns section carries seven open
questions that belong in `/speckit-clarify`, not here.

## Why this exists

Running `bash .specify/scripts/bash/check-prerequisites.sh --json` on `main` today prints:

```
ERROR: plan.md not found in <repo>/specs/021-agent-rows
Run /speckit-plan first to create the implementation plan.
```

`.specify/feature.json` names `specs/021-agent-rows`, and that directory holds only
`spec.md`. Every speckit command that calls check-prerequisites fails on its first call.
The cause runs deeper than a stale pointer. The tooling assumes every feature produces a
plan, while four of the last five features here shipped with `spec.md` alone.

## Clarifications

### Session 2026-09-23

The user delegated these decisions ("prossiga automaticamente"). Each was decided against
evidence in this repository and applied to the sections below.

- Q: Who marks a feature finished, and when? → A: The author, in the commit that closes the
  feature. The check enforces that only the feature the pointer names may be in progress.
- Q: What does the feature pointer hold when no feature is in progress? → A: It always names
  a directory, and a finished directory is a valid value. No null state.
- Q: Is a finished directory's content checked, or only its declaration? → A: Content is
  checked for every finished directory. Presence of what the track promises is required;
  extra files are not an error.
- Q: How does the automated check obtain git history? → A: It does not. The commit-scope
  assertion is dropped, removing the need for history in the first place.
- Q: Are commit scopes that name no directory a defect or a separate sequence? → A: A commit
  scope is the spec directory number. Existing history that drifted stays as it is, and the
  rule is documented rather than enforced by a test.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A small feature starts without lying about its shape (Priority: P1)

The maintainer starts a feature that needs nothing more than a spec. They write `spec.md`,
declare the feature small, and run the speckit commands. Nothing demands a plan that the
feature was never going to have, and nothing fails.

**Why this priority**: this is the blocked path. Until a spec can declare itself small,
every speckit command on this repository fails and no new feature can be specified
through the tooling at all.

**Independent Test**: create a feature directory containing only a `spec.md` that declares
the quick track, point `.specify/feature.json` at it, and run
`bash .specify/scripts/bash/check-prerequisites.sh --json`. It exits 0 and prints the
paths. Shipping only this story already unblocks the repository.

**Acceptance Scenarios**:

1. **Given** a feature directory holding only a `spec.md` that declares the quick track,
   **When** check-prerequisites runs against it, **Then** it exits 0 and reports the
   feature paths.
2. **Given** a feature directory that declares the full track and has no `plan.md` yet
   while the work is in progress, **When** check-prerequisites runs against it, **Then**
   it exits 0, because artifact requirements apply only once the feature is finished.
3. **Given** a feature directory that declares the full track and is marked finished but
   has no `plan.md`, **When** check-prerequisites runs against it, **Then** it fails and
   names the missing artifact.

---

### User Story 2 - An undeclared spec is caught, not guessed at (Priority: P1)

Someone adds a spec that says nothing about its shape. The tooling refuses it with a
message naming what is missing and what the allowed values are, rather than assuming.

**Why this priority**: the whole design rests on the declaration being present. A silent
default would put the tooling back to guessing, which is the failure this feature exists
to remove. It ships alongside story 1 because the same parser serves both.

**Independent Test**: run check-prerequisites against a spec with no declaration, a spec
with an unknown track value, and a spec with an unknown status value. Each fails with a
distinct message naming the offending field and its allowed values.

**Acceptance Scenarios**:

1. **Given** a spec with no declaration block, **When** check-prerequisites runs, **Then**
   it fails and names the missing field and the allowed values.
2. **Given** a spec declaring a track value that is not recognized, **When**
   check-prerequisites runs, **Then** it fails with a message naming the track field
   specifically, not the status field.
3. **Given** a spec declaring an unrecognized status value, **When** check-prerequisites
   runs, **Then** it fails with a message naming the status field specifically.

---

### User Story 3 - Every existing spec says what it is (Priority: P2)

Every directory under `specs/` carry a declaration that matches what is already on
disk. Nobody writes a plan after the fact to satisfy the tooling.

**Why this priority**: without it, every spec in the repository is one the new rules would
reject, so the guard rail in story 4 cannot be turned on. It is P2 because stories 1 and 2
already unblock day-to-day work.

**Independent Test**: every directory under `specs/` declares a track and a status, and
those declarations match the files present. No directory gains or loses an artifact.

**Acceptance Scenarios**:

1. **Given** the feature directories that existed then (21 of them), **When** the backfill is complete,
   **Then** each declares a track that matches the artifacts it already contains.
2. **Given** a directory that carries only `spec.md`, **When** it is backfilled, **Then**
   it declares the quick track and no `plan.md` or `tasks.md` is created for it.
3. **Given** the one feature with unfinished work, **When** it is backfilled, **Then** it
   declares in progress as an interim value, and it is resolved to finished or abandoned
   before the check of story 4 is enabled, because that check allows only the feature the
   pointer names to be in progress.

---

### User Story 4 - The scaffold fails loudly when it stops matching reality (Priority: P2)

A change that leaves the scaffold describing something that is not true fails in CI
instead of being discovered months later.

**Why this priority**: this is what separates this feature from a one-off repair. It is
P2 because it depends on stories 1 through 3 being in place first.

**Independent Test**: break each guarded condition one at a time in a scratch checkout and
confirm the check fails; restore and confirm it passes on `main`.

**Acceptance Scenarios**:

1. **Given** `.specify/feature.json` naming a directory that does not exist, **When** the
   check runs, **Then** it fails and names the missing directory.
2. **Given** a feature directory with no declaration, **When** the check runs, **Then** it
   fails and names that directory.
3. **Given** the agent context block in `CLAUDE.md` naming a different feature than
   `.specify/feature.json`, **When** the check runs, **Then** it fails and reports both
   values.
4. **Given** a finished directory declaring the full track with no plan present, **When**
   the check runs, **Then** it fails and names the missing artifact.
5. **Given** a directory in progress that the pointer does not name, **When** the check
   runs, **Then** it fails and names both that directory and the pointed one.
6. **Given** an unmodified `main`, **When** the check runs, **Then** it passes on every
   supported platform, including on a shallow checkout.

---

### Edge Cases

- A feature directory exists with no `spec.md` at all. The check treats a missing spec as a
  missing declaration and fails, naming the directory.
- Two directories share a number prefix. Out of scope: numbering is assigned at creation by
  the existing tooling, which scans for the highest number in use.
- A declaration exists but the file is unreadable or malformed. The check fails with the
  same class of message as a missing declaration rather than crashing with a parser error.
- The repository is checked out with partial history. No check reads history (FR-022), so
  a shallow checkout changes nothing.
- A finished quick-track spec also contains a plan file. Not an error: FR-018 requires the
  promised artifacts to be present, not that no others exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every feature specification MUST declare a track and a status in a single,
  machine-readable location at the top of its spec file.
- **FR-002**: The track MUST be one of exactly two values: one meaning the spec alone is
  the complete artifact set, and one meaning the spec, a plan, and a task list together
  are the complete artifact set.
- **FR-003**: The status MUST be one of exactly three values, meaning in progress,
  finished, and abandoned.
- **FR-004**: The prerequisite check MUST require only the artifacts the declared track
  promises, and MUST enforce that requirement only when the status says the feature is
  finished.
- **FR-005**: The prerequisite check MUST treat an abandoned feature as requiring no
  artifacts beyond its spec.
- **FR-006**: A missing declaration, a missing field, or an unrecognized value MUST be a
  hard failure, never a silent default.
- **FR-007**: A failure message MUST name the offending field and list that field's
  allowed values, so a track problem and a status problem are distinguishable.
- **FR-008**: Every component that today assumes a plan file exists MUST read the
  declaration instead. As of this spec those are the prerequisite check, the shared helper
  it uses, and the task-setup script.
- **FR-009**: Components that only summarize a plan when one is present MUST keep working
  unchanged when it is absent.
- **FR-010**: Every directory under `specs/` MUST carry a declaration matching the
  artifacts already on disk, and no artifact may be created retroactively to satisfy the
  new rules.
- **FR-011**: An automated check MUST verify that the recorded current feature names a
  directory that exists and satisfies its declared track at its declared status.
- **FR-012**: The same check MUST verify that every feature directory carries a valid
  declaration.
- **FR-013**: The same check MUST verify that the agent context block in the project
  instructions names the same feature as the recorded current feature.
- **FR-014**: The check MUST run as part of the existing test entry point, on every
  supported platform, and MUST NOT depend on network access.
- **FR-015**: New specifications created through the tooling MUST arrive already carrying
  a declaration, so the hard failure in FR-006 cannot be triggered by the act of creating
  a spec.
- **FR-016**: Enforcement MUST NOT be introduced before the declarations it enforces
  exist. FR-008 and FR-010 land together.
- **FR-017**: A check that cannot obtain what it needs to run MUST report that it did not
  run, rather than reporting success. Satisfied by construction rather than by a case:
  every check reads a file it requires, so a missing `CLAUDE.md` throws and a missing
  spec reads as an absent declaration. Nothing in this feature has a skip path to report,
  because nothing in it is conditional on the environment.
- **FR-018**: The automated check MUST verify that every finished feature directory
  contains the artifacts its declared track promises. Extra artifacts beyond those the
  track promises are not a failure.
- **FR-019**: The automated check MUST verify that at most one feature directory is in
  progress, and that it is the one the pointer names. This is what prevents a feature from
  being left in progress forever to escape the artifact requirement.
- **FR-020**: The feature pointer MUST always name an existing directory. A finished
  directory is a valid value; there is no representation for "no feature".
- **FR-021**: The workflow description file MUST describe both tracks, so that no file in
  the scaffold still claims a single mandatory cycle.
- **FR-022**: No check may read git history. The commit-scope convention is documented, not
  enforced by a test.

### Resolved during clarify

The approved design left seven questions open. Five were decided in the Clarifications
session above and are now requirements. The remaining two are recorded as assumptions
rather than requirements:

- Whether the workflow description file is updated: yes, and it became FR-021 rather than
  an assumption, because it is real work in the scaffold.
- Whether a finished quick-track feature carrying a plan file is an error: no. Stated
  once under Edge Cases, and required by FR-018.

### Key Entities

- **Feature declaration**: the track and status a specification claims for itself. The
  literals are `quick` and `full` for the track, and `active` (in progress), `done`
  (finished) and `abandoned` for the status. FR-002 and FR-003 name the meanings; these
  are the strings the tooling reads. Lives
  with the specification, is the only source for both values, and is read identically by
  the prerequisite check and the automated check.
- **Feature pointer**: the recorded current feature. Exists in two places today, the
  machine-readable record and the agent context block, which must agree.
- **Artifact set**: the files a track promises. Quick promises the spec. Full promises the
  spec, the plan, and the task list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The prerequisite check succeeds on `main`, where today it fails.
- **SC-002**: A maintainer can take a new feature from idea to a specification the tooling
  accepts without editing any tooling file or repairing any pointer by hand.
- **SC-003**: Every directory under `specs/` pass the new checks without any of them
  gaining a plan or a task list.
- **SC-004**: Each of the three guarded conditions, when broken one at a time, produces a
  failing check that names what is wrong; unbroken, all three pass on all three supported
  platforms.
- **SC-005**: A person reading a failure message can tell which field is wrong and what
  values are allowed, without opening the tooling source.
- **SC-006**: No behavior of the status bar changes. The existing suite passes unchanged.
- **SC-007**: A feature left in progress after the pointer has moved on is caught by the
  check, so the artifact requirement cannot be escaped by never declaring a feature done.
- **SC-008**: The checks run identically on a shallow checkout and a full clone, because
  none of them read history.

## Assumptions

- The declaration lives in the spec file rather than in a separate index, because a spec
  moved or copied without its declaration would be a spec the tooling then guesses about.
- Quick is the value new specs start with, because it describes four of the last five
  features. An author who needs the full track changes one line. This is a seeded value in
  a file the author is already editing, not a default applied by the tooling when a
  declaration is absent.
- The one feature with unfinished work was backfilled as in progress, and its fate had to
  be settled before the automated check could be enabled, because FR-019 allows only the
  pointed feature to be in progress. This was written expecting a maintainer decision.
  There was none to make: `specs/003-status-change-animations/decisions.md` already said
  "User Story 2 and User Story 3 are closed by this decision rather than by
  implementation", and `src/changeTracker.js` carries the reasoning at its `HIGHLIGHTED`
  set. It is recorded `done`. The sixteen unchecked boxes stay unchecked because nobody
  built them.
- There is no PowerShell counterpart to the prerequisite check in this repository, so this
  work touches shell scripts only. The single PowerShell file present updates agent
  context and is covered by FR-009.
- No runtime code changes. This feature touches the development scaffold, not the renderer.
- The specification and all artifacts are written in English, per Constitution
  Principle VI.

## Dependencies

- Constitution Principle VI: all documentation in English.
- Constitution Principle IX: the check runs on Linux, macOS and Windows, across the Node
  versions the matrix covers.
- Constitution Principle VIII is the precedent this feature follows: documentation that
  disagrees with reality is a defect that fails the build.
- A new constitutional principle defining the two tracks landed with this feature rather
  than after it (Principle XII, version 6.0.0 to 6.1.0). Deferring it would have left the
  tooling enforcing a rule no principle stated. Principle XI, which describes a tag-driven
  release flow that has not run since v1.2.7 while `package.json` reads 1.18.0, is
  explicitly not touched: resuming tags and rewriting the principle are opposite repairs
  and only one is right.
- Commit scopes `(022)` and `(023)` name no directory today. Under the rule decided in
  clarify that is historical drift, left as it is. No commit is rewritten and no test
  looks for it.
- Story 4 cannot be enabled until the one unfinished feature is resolved, because a second
  in-progress directory would fail FR-019.
