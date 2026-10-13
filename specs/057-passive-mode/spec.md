---
track: full
status: active
---

# Feature Specification: Passive mode for a host

**Feature Branch**: `feat/057-passive-mode`

**Created**: 2026-10-13

**Status**: In progress

**Input**: A host (Astrolabe) runs this renderer as a child process on every footer redraw. Today
that starts detached refresh processes (`gh`, `rtk`, `git`), writes the cache and the per-session
state under `~/.claude/statusline/`, and on macOS writes an open-tab script to the temporary
directory. A host that must be certain it starts nothing and writes only where it was told has no
single switch for that. This feature adds one. It is the second of the separate specs named in
spec 056 (passive mode, omit list, resolved configuration, render-only build, shared fixtures).

**Track**: `full`. It changes where state lives and gates every write on the render path.

## What the renderer does on a render today

Measured with a throwaway `HOME`, `CLAUDE_STATUSLINE_UPDATES=off` and `CLAUDE_STATUSLINE_DEBUG=0`
(the environment the host sets), in a repository with a remote:

- It starts detached refresh processes. `gh` wrote its own `device-id` and `rtk` wrote
  `history.db` under that home.
- It writes `~/.claude/statusline/cache/*` (git, remote, pr, ci, gates, gitCost, locks) and
  `~/.claude/statusline/state/<session>.json`.
- With `CLAUDE_STATUSLINE_NO_REFRESH=1` it starts nothing, and still writes `git.json`,
  `remote.json`, `gitCost.json` and the session state.
- On macOS in iTerm or Apple Terminal it writes `claude-statusline-open-tab-<hash>.command` to
  the temporary directory.

## User scenarios & testing

### User Story 1 - A render that touches nothing (Priority: P1)

A host sets one variable and is certain a render starts no process but read-only `git`, and
writes no file.

**Independent Test**: Render the fixture payloads with `CLAUDE_STATUSLINE_PASSIVE=1`, a throwaway
`HOME` and a recorder that logs every child process and every file the process opens for writing.

**Acceptance Scenarios**:

1. **Given** passive mode and no cache directory, **When** a render runs, **Then** no file is
   created or changed anywhere, and the only child process is `git` with `--no-optional-locks`.
2. **Given** passive mode and `CLAUDE_STATUSLINE_CACHE_DIR=<dir>`, **When** a render runs,
   **Then** every file it writes is under `<dir>`, and `~/.claude/statusline` is not created.

### User Story 2 - The same footer, with what the host already has (Priority: P1)

A host that keeps one state directory gets the cache and the session state it would have had,
and a person who never sets the variable sees no change.

**Independent Test**: Render twice in passive mode with a cache directory; the second render
reads what the first wrote. Compare the default output with the hashes of the previous release.

**Acceptance Scenarios**:

1. **Given** a cache directory, **When** two renders run in order, **Then** the second reads the
   git snapshot the first stored there.
2. **Given** neither variable, **When** the renderer runs, **Then** its output and the files it
   writes are what they were before this feature.

## Requirements

- **FR-001**: `CLAUDE_STATUSLINE_PASSIVE=1` MUST make a render start no child process other than
  read-only `git` commands. That covers the detached refresh, the update check, the gates lookup
  and every other background start. It also implies `CLAUDE_STATUSLINE_NO_REFRESH`, and an
  update check is never started.
- **FR-002**: In passive mode a render MUST NOT write a file outside the directory named by
  `CLAUDE_STATUSLINE_CACHE_DIR`. When that variable is unset or not an absolute path, a render
  writes no file at all and keeps what it needs in memory for the one process.
- **FR-003**: `CLAUDE_STATUSLINE_CACHE_DIR` MUST also work without passive mode: when it is set to
  an absolute path, the cache, the session state, the task snapshots, the skill events and the
  Copilot event cache live under it instead of `~/.claude/statusline`. Reads follow the same
  root. User configuration (the layout file, the update mode, the remembered terminal
  background) stays where it is and is only ever read on a render.
- **FR-004**: In passive mode the macOS open-tab script MUST NOT be written; the directory link is
  the plain `file://` URL.
- **FR-005**: The `git` calls on the render path MUST be read-only: `--no-optional-locks` and no
  command that changes the repository or its index.
- **FR-006**: Passive mode MUST NOT change what is drawn: the same payload gives the same text
  with or without it, except where a value needs a background lookup that was never made (the
  pull request, CI and `rtk` chips, which come from the cache) and which the cache directory, when
  given, may already hold.
- **FR-007**: Without either variable, behaviour and output are byte for byte what they were.
- **FR-008**: The variables are documented in the README and the contract is recorded in
  `contracts/environment.md`.

## Edge cases

- `CLAUDE_STATUSLINE_CACHE_DIR` set to a relative path or an unwritable one: ignored for writes
  (passive writes nothing) and reported by `doctor`, never by a render.
- A cache directory that does not exist: created on the first write, inside passive mode too,
  because the host named it.
- Two renders at once: the lock files live under the same root, so the existing single-writer
  rule holds.
- `CLAUDE_STATUSLINE_DEBUG=1` in passive mode: the payload dump is a write, so it follows
  FR-002.

## Success criteria

- **SC-001**: A recorder test over the fixture payloads finds no child process other than
  `git --no-optional-locks`, in passive mode, with and without a cache directory.
- **SC-002**: The same test finds no file created or modified outside the cache directory, and
  none at all when there is no cache directory.
- **SC-003**: The hashes of the default output at 80, 100, 144 and 200 columns equal the ones
  made before this feature, and a run with neither variable writes the files it wrote before.
- **SC-004**: Passive mode costs no more than the render does today.

## Assumptions

- A host that wants the pull request, CI, gates and `rtk` chips fills the cache directory by
  other means; this feature never starts that work.
- `git status` with `--no-optional-locks` is read-only enough for the host's purpose.

## Out of scope

- The omit list, `--print-config`, the render-only build and shared fixtures (separate specs).
- Any change to what is drawn, or to the install and doctor commands.
