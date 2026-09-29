---
track: full
status: active
---

# Feature Specification: The statusline tells you it has an update, and can take it

**Feature Branch**: `026-update-check`

**Created**: 2026-09-29

**Status**: Draft (the declaration above is authoritative)

**Input**: User description: "crie um script que cheque por updates no github do repositóro do
statusline e faça autmaticamente o update antes de carregar o statusline no claude, dando a
opçao do usuário atualizar, baseando-se nas melhorias e bug fixes existentes no repositório
remoto" (create a script that checks the statusline's GitHub repository for updates and updates
automatically before the statusline loads in Claude, giving the user the option to update,
based on the improvements and bug fixes present in the remote repository).

**Track**: `full`. It adds network access to a tool that has so far never reached the network
on its own, a new moment of execution (session start), a setting, and an update path that runs
code fetched from the internet. Each of those needs a recorded decision.

## Why this exists

The install is a clone, and since 024 `update` fast-forwards it safely. Nothing tells the user
that there is something to update to. This week alone, the remote gained the spend limit, the
`full` window marker, the install fixes and the prompt-cache chip; a user who installed last
week sees none of them until they happen to run `update`. The repository's commits are typed
(`feat:` for improvements, `fix:` for bug fixes, `docs:` and `chore:` for everything else), so
the difference between the clone and the remote can be described in the user's terms: how many
improvements and how many fixes are waiting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know that improvements and fixes are waiting (Priority: P1)

A user starts a Claude Code session. Their clone is behind the remote by two fixes and one
improvement. They are told, once, that an update is available, what it contains in those terms,
and the one command that applies it.

**Why this priority**: It closes the gap on its own, touches nothing the user did not ask for,
and every other story builds on the same check.

**Independent Test**: With a clone two `fix:` commits and one `feat:` commit behind its
upstream, start a session and confirm the user sees one notice naming 1 improvement and 2 fixes
and the update command, and that the clone is unchanged.

**Acceptance Scenarios**:

1. **Given** a clone behind its upstream by commits that include `feat:` or `fix:` commits,
   **When** a session starts, **Then** the user sees a notice with the number of improvements,
   the number of fixes, up to three of their subject lines, and the update command.
2. **Given** a clone behind only by `docs:`, `chore:`, `test:` or merge commits, **When** a
   session starts, **Then** no notice appears, since nothing the user runs has changed.
3. **Given** a clone that is current, **When** a session starts, **Then** no notice appears.
4. **Given** the same pending update, **When** the user starts several sessions in one day,
   **Then** the notice appears in the first one only, and again when the remote gains another
   improvement or fix.
5. **Given** the check has not finished, or cannot reach the network, **When** a session
   starts, **Then** the session starts without delay and without a notice.

---

### User Story 2 - Updates happen by themselves, when the user chose that (Priority: P2)

A user who wants to stop thinking about it turns on automatic updates. From then on, a pending
improvement or fix is applied at the start of a session, and they are told afterwards what
changed.

**Why this priority**: It is what the request asks for literally, but it runs code fetched from
the internet without a per-update decision, so it has to be something the user turns on, not
the default.

**Independent Test**: With automatic updates on and a clone behind by one `fix:` commit, start
a session and confirm the clone was fast-forwarded, the install re-ran, and the user was told
which fix arrived.

**Acceptance Scenarios**:

1. **Given** automatic updates on and a clean clone behind by a `feat:` or `fix:` commit,
   **When** a session starts, **Then** the clone is updated the same way `update` does it and
   the user is told what arrived.
2. **Given** automatic updates on and a clone with local edits or a diverged history, **When**
   a session starts, **Then** nothing is changed, and the user is told why and what to run.
3. **Given** automatic updates on and an update that fails part-way, **When** the session
   starts, **Then** the previous working version keeps running and the user is told the update
   failed.
4. **Given** automatic updates off (the default), **When** a session starts with an update
   pending, **Then** behaviour is Story 1's: a notice, no change.

---

### User Story 3 - Choose, and check on demand (Priority: P3)

**Acceptance Scenarios**:

1. **Given** any install, **When** the user runs the command that checks for updates, **Then**
   it fetches, prints what is pending in improvements and fixes with their subject lines, and
   changes nothing.
2. **Given** any install, **When** the user sets the update behaviour to off, notify, or
   automatic, **Then** later sessions follow it, and `doctor` shows the setting and the last
   check's result.

### Edge Cases

- No network, a slow network, or GitHub unavailable: the check gives up quietly within its
  time limit and tries again at the next opportunity; nothing on the bar or in the session
  waits for it.
- The clone has no upstream, or is not a git clone: no check runs, and `doctor` says why.
- The clone tracks a fork or another branch: the check compares against that upstream, not
  against the original repository.
- A remote commit's subject is not typed (`Merge …`, free text): it counts as neither an
  improvement nor a fix, and does not trigger a notice on its own.
- A remote commit subject contains control characters or is very long: it is cleaned and
  shortened before it is shown.
- Many sessions start at once (several terminals): at most one check runs at a time, and the
  others use its result.
- The user has set `CLAUDE_STATUSLINE_NO_REFRESH`, which already stops background work: no
  check runs either.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST be able to find out, without changing the clone, how many
  commits its upstream has that the clone does not, and the type and subject of each.
- **FR-002**: The check MUST never delay the statusline's own redraw or the start of a session.
  It runs in the background with a time limit, and its result is used by the next session that
  starts after it finishes.
- **FR-003**: The check MUST run at most once every 24 hours per clone, and at most one at a
  time.
- **FR-004**: Commits MUST be classified by their subject prefix: `feat` as an improvement,
  `fix` as a bug fix, anything else as neither. Only improvements and fixes trigger a notice or
  an automatic update.
- **FR-005**: The update behaviour MUST be one of `off`, `notify` and `auto`, with `notify` as
  the default.
- **FR-006**: In `notify`, at session start, the user MUST see a notice with the counts, up to
  three subject lines and the update command, once per distinct pending update.
- **FR-007**: In `auto`, at session start, a pending improvement or fix MUST be applied through
  the same path as the `update` command, with all of its refusals (local edits, diverged
  history, not a clone), and the user MUST be told the result either way.
- **FR-008**: An automatic update MUST only fast-forward to the clone's configured upstream. It
  MUST never reset, discard, or merge, and a failure MUST leave the previous version running.
- **FR-009**: The user MUST be able to check on demand, printing what is pending without
  changing anything.
- **FR-010**: The user MUST be able to set the behaviour without editing JSON by hand, and
  `doctor` MUST show the setting, the time of the last check and its result.
- **FR-011**: `CLAUDE_STATUSLINE_NO_REFRESH` MUST also disable the check and automatic updates.
- **FR-012**: Everything shown from a remote commit MUST pass through the bar's text boundary
  before it reaches the terminal.
- **FR-013**: The README MUST describe the check, the three behaviours, what `auto` trusts, and
  how to turn it off.

### Key Entities

- **Pending update**: the commits the upstream has and the clone does not, each with a type
  (improvement, fix, other) and a subject, identified by the upstream commit they end at.
- **Update check result**: when the check ran, whether it succeeded, and the pending update it
  found. Stored locally, one per clone.
- **Update behaviour**: `off`, `notify` or `auto`, a user setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user whose clone is behind by at least one improvement or fix learns about it in
  the first session they start after the check has run, without running any command.
- **SC-002**: Session start and the first redraw take no longer with the check than without it,
  on a machine with no network.
- **SC-003**: The same pending update is announced at most once per day.
- **SC-004**: With `auto` on, a clean clone behind by an improvement or fix is current after
  the next session start in 100% of test runs; a clone with local edits is untouched in 100%.
- **SC-005**: No check result, notice, or update ever discards a local change.

## Assumptions

- Claude Code offers a moment at session start where a command can run and show the user a
  message; planning will confirm the mechanism and what the message can look like. If it
  cannot show a message, the notice falls back to a chip on the bar.
- The check reaches the network through the user's own `git`, with its existing credentials and
  remote. No GitHub API token is needed for the public repository.
- `auto` trusts whoever can push to the clone's upstream, exactly as `update` already does when
  the user runs it by hand. That trust is stated in the README rather than hidden behind the
  default.
- Commit types follow the repository's existing convention; releases and tags are not involved,
  since this project ships by merge.
- A keyboard prompt ("update now? y/n") is out of scope for this spec: the statusline cannot
  read keyboard input at all, since Claude Code runs it with the payload on stdin, and planning
  has to confirm what a session-start command can do. The user's option is the behaviour
  setting, plus the command the notice names.
