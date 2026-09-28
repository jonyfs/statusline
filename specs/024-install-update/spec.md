---
track: quick
status: done
---

# Feature Specification: An install that says when it did not update

**Feature Branch**: `024-install-update`

**Created**: 2026-09-28

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "revise se o script de instalacao tem chance de falhar e não
atualizar corretamente conforme: git clone https://github.com/jonyfs/statusline.git
~/.claude/statusline-plugin / node ~/.claude/statusline-plugin/bin/cli.js install" (check
whether the install script can fail and not update correctly), followed by "prossiga"
(go ahead and fix what the review found).

**Track**: `quick`. The change stays inside the install path: `src/install.js`, `bin/cli.js`,
one new module for the update, a few lines in `doctor`, the README and their tests. No new
data shape and nothing a reviewer needs a plan to follow.

## Why this exists

A review on 2026-09-28 reproduced four failures in a throwaway HOME:

1. Running the two documented commands again over an existing install does not update it.
   `git clone` fails with `destination path ... already exists` (exit 128), `install` then
   runs the old code, and it prints `(was already installed — safe to run again)`. The clone
   stayed at `4fc8918`, behind the feature it had just been told about.
2. The documented update, `git pull`, aborts on any local edit in the clone
   (`Please commit your changes or stash them`), and starts a merge when the history has
   diverged.
3. On Node 14, `install` prints `Statusline installed.` and the bar then draws
   ` statusline unavailable `. `package.json` asks for Node 18 or newer, and nothing checks it.
4. A clone at a second path leaves the first path's skill hook behind. The review ended with
   two `note-skill` hooks in one settings file, one of them pointing at the wrong clone.

It also found three risks it did not reproduce. The hook and the subagent rows record the
exact interpreter that ran the install, which Principle IX requires, so removing that Node
version breaks them while the README says a `git pull` is all an update needs. The settings
file is written in place, so a process killed mid-write leaves it truncated. And the README
gives only a POSIX `~` path, which `cmd.exe` does not expand.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One command updates an existing install (Priority: P1)

A user who installed months ago wants the current version. They run one command and either
get it, with the old and new commit named, or get told exactly why not.

**Why this priority**: This is the reported failure. Everything else here is hardening.

**Independent Test**: In a temporary clone behind its origin, run the update and confirm the
clone moved to the origin's commit and the install ran from the new code.

**Acceptance Scenarios**:

1. **Given** a clean clone behind its origin, **When** the user runs
   `node <clone>/bin/cli.js update`, **Then** the clone fast-forwards, the install runs from
   the updated code, and the output names the commit before and after.
2. **Given** a clone already at its origin's commit, **When** the user runs the update,
   **Then** it says the clone is already current and still re-runs the install, which is
   idempotent.
3. **Given** a clone with an uncommitted edit, **When** the user runs the update, **Then**
   nothing is pulled or installed, the exit code is non-zero, and the message lists the edited
   files and how to set them aside.
4. **Given** a clone whose history has diverged from its origin, **When** the user runs the
   update, **Then** nothing is merged or installed, the exit code is non-zero, and the message
   says the history diverged. It does not run a destructive command on the user's behalf.
5. **Given** a directory that is not a git clone, **When** the user runs the update, **Then**
   it says so and names the clone command.

---

### User Story 2 - The install says which version it installed (Priority: P1)

A user who re-ran the two install commands needs to see that the second `git clone` failed
and that the install is still the old code.

**Why this priority**: It turns failure 1 from silent into visible, including for anyone who
never reads the README's update section.

**Independent Test**: Run install from a clone and confirm the output names the package
version and the clone's commit, and that the old reassurance is gone.

**Acceptance Scenarios**:

1. **Given** any install, **When** it finishes, **Then** it prints the package version and,
   when the directory is a git clone, the short commit and its date.
2. **Given** an install over an existing one, **When** it finishes, **Then** it no longer says
   "safe to run again". It says the settings were already in place and names the update
   command.

---

### User Story 3 - An unsupported Node is refused, not half-installed (Priority: P2)

**Why this priority**: The failure is complete when it happens, but only on old machines.

**Independent Test**: Call the version check with `14.17.3` and `18.0.0`.

**Acceptance Scenarios**:

1. **Given** Node older than 18, **When** the user runs `install` or `update`, **Then** it
   exits non-zero without touching settings and names the Node version it needs.
2. **Given** Node older than 18, **When** Claude Code runs `render`, **Then** the bar reads
   ` statusline needs Node 18+ ` instead of ` statusline unavailable `, and still exits 0.

---

### User Story 4 - Settings stay clean and whole (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a settings file holding this plugin's skill hook from a clone at another path,
   **When** the user installs from a new path, **Then** the old hook is removed and exactly
   one skill hook remains. Hooks belonging to other tools are untouched.
2. **Given** any install, **When** it writes settings, **Then** it writes a temporary file in
   the same directory and renames it over `settings.json`, so a reader sees the old file or
   the new one and never half of either.

---

### User Story 5 - `doctor` notices an interpreter that is gone (Priority: P3)

**Acceptance Scenarios**:

1. **Given** settings whose hook or subagent command names an interpreter that no longer
   exists, **When** the user runs `doctor`, **Then** it reports which entry is broken and
   says to run the update or install again.
2. **Given** settings whose commands all resolve, **When** the user runs `doctor`, **Then**
   it reports the install as intact.

### Edge Cases

- `git` is not on the PATH: the update says git is needed and stops. Install still works, and
  prints the version without a commit.
- The clone was installed from a fork or another remote: the update pulls whatever the
  clone's own upstream is and assumes nothing about `origin/main`.
- The update succeeds but the re-run install fails: the exit code is the install's, and the
  message says the code was updated but the settings were not.
- A bare `node` in the `statusLine` command is not a path, so `doctor` does not check it for
  existence.
- A hook written by another tool whose command happens to contain `cli.js`: only commands
  ending in this plugin's own subcommand `note-skill` are treated as this plugin's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST offer `update`, which checks for a clean git clone, runs
  `git pull --ff-only` in the clone that holds the running CLI, and then runs `install` in a
  new process so the updated code does the installing. `install`'s flags pass through.
- **FR-002**: `update` MUST refuse, without pulling or installing and with a non-zero exit,
  when the directory is not a git clone, when git is missing, when the working tree has
  uncommitted changes, or when the pull cannot fast-forward. Each refusal names its cause and
  what the user can do, and none runs a destructive git command.
- **FR-003**: `install` MUST print the package version and, when available, the clone's short
  commit and date. When the settings were already in place it MUST say so and name the
  update command, and MUST NOT claim the code is current.
- **FR-004**: `install` and `update` MUST exit non-zero on Node older than 18 before writing
  anything. `render` MUST print a message naming the requirement and exit 0.
- **FR-005**: `install` MUST remove this plugin's skill hooks recorded at other clone paths,
  recognised by a command ending in `cli.js" note-skill`, and leave every other hook alone.
- **FR-006**: `install` and `uninstall` MUST write `settings.json` through a temporary file in
  the same directory and a rename.
- **FR-007**: `doctor` MUST check this plugin's entries in `settings.json` (status line,
  subagent rows, skill hook) and report any whose interpreter or CLI path does not exist.
- **FR-008**: The README MUST give the update command, say that repeating `git clone` over an
  existing install fails and does not update, say to re-run the install after removing the
  Node version it was installed with, and give Windows forms of the install commands.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the four reproduced failures has a test that fails on the code before
  this feature and passes after it.
- **SC-002**: After `update` in a clone behind its origin, the clone's commit equals the
  origin's in 100% of test runs.
- **SC-003**: No test touches the real `~/.claude/settings.json`.
- **SC-004**: The full suite passes.

## Assumptions

- Principle IX's rule that spawned commands name `process.execPath` stays. The interpreter
  risk is handled by detection in `doctor` and by the README, not by recording a bare `node`.
- Principle IV's "updating MUST be a `git pull` with no reinstall" still holds: a plain pull
  keeps working. `update` is a safer way to do the same thing, not a replacement.
- Windows instructions are written from the shells' documented behaviour and have not been
  run on a Windows machine here.
