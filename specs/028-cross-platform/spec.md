---
track: full
status: done
---

# Feature Specification: The same statusline on Linux and Windows

**Feature Branch**: `028-cross-platform`

**Created**: 2026-09-30

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "crie uma spec para que o statusline funcione da mesma forma em
outros sistemas operacionais como linux e windows, veja o que precisa ser ajustado para se
adequar a estes sistemas operacionais. implemente a spec", followed by a screenshot of a Linux
machine whose bar is not this project's, and "aproveite para atualizar a documentação dando o
passo a passo para instalar corretamente no linux e no windows".

**Track**: `full`. It changes the command strings install writes, which Principle IX governs,
adds CI jobs, and rewrites the install documentation.

## Why this exists

The test suite already passes on Linux, macOS and Windows in CI (Node 18, 20 and 22), and a
Linux container run on 2026-09-30 passed all 575 cases. Tests do not run Claude Code, though,
and three gaps sit outside them:

1. **Windows without Git Bash cannot run the installed bar.** Claude Code's statusline docs
   say: "On Windows, Claude Code runs status line commands through Git Bash when Git Bash is
   installed, or through PowerShell when Git Bash is absent", and "Write file paths in the
   `command` string with forward slashes". Install writes `"node" "C:\...\cli.js" render`.
   Run in PowerShell 7 on 2026-09-30, that form is a `ParserError` and node never starts,
   while `node "…/cli.js" render` runs in both PowerShell and bash. A leading `&`, which
   PowerShell accepts for a quoted interpreter, is a syntax error in bash, so the only form
   both accept is an unquoted interpreter. The skill hook and subagent rows use the absolute
   interpreter, which on Windows is usually `C:\Program Files\nodejs\node.exe`, with a space,
   so it cannot be unquoted there.
2. **Messages hand Windows users commands that do not work.** The refusal from `update`, the
   refusal to install from an npx cache, and the output of `updates` show `~/.claude/...`,
   which `cmd.exe` does not expand.
3. **A bar that is not this project's gives no clue why.** On the owner's Linux screenshot the
   bar is another tool's. A `statusLine` in a project's `.claude/settings.json` or
   `.claude/settings.local.json` takes precedence over the user's, and `doctor` says nothing
   about it.

The README gives one install path, POSIX first, with a short Windows note.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The installed bar runs on Windows in either shell (Priority: P1)

**Independent Test**: In CI on Windows, install into a temporary profile, then run the
`statusLine` command it wrote through PowerShell and through Git Bash with a payload on stdin,
and confirm both draw a bar.

**Acceptance Scenarios**:

1. **Given** a Windows install, **When** Claude Code runs the status line through PowerShell,
   **Then** the bar is drawn.
2. **Given** the same install, **When** it runs through Git Bash, **Then** the bar is drawn.
3. **Given** a Windows install, **When** the skill hook and the subagent rows run through
   either shell, **Then** they run.
4. **Given** Linux or macOS, **When** the commands run through `sh`, **Then** they run, and an
   interpreter path with a space is still quoted.

### User Story 2 - Every command the tool prints works where it is printed (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Windows, **When** `update` refuses a directory that is not a clone, **Then** the
   clone command it prints names the real profile path with forward slashes, not `~`.
2. **Given** any platform, **When** `updates` reports its source, **Then** it names the real
   settings file path.

### User Story 3 - The bar that is not this one says why (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a project whose `.claude/settings.json` or `.claude/settings.local.json` sets a
   `statusLine` that is not this plugin, **When** the user runs `doctor` from that project,
   **Then** it names the file that takes precedence.
2. **Given** no such file, **When** the user runs `doctor`, **Then** nothing is added.

### User Story 4 - Step-by-step install for each platform (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the README, **When** a user on macOS, Linux or Windows follows their section,
   **Then** they have what to install first, the exact commands for their shell, how to check
   it worked, and what to do if it did not.

### Edge Cases

- On Windows, `node` is not on the PATH of the shell that installs: the hook falls back to the
  absolute interpreter, quoted, and install says PowerShell cannot run it without Git Bash.
- An existing install with the old command form is rewritten by the next `install` or
  `update`, and the daily automatic update runs install, so it heals on its own.
- `doctor` finds a project `statusLine` that is this plugin's at another path: it is not
  reported as foreign.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every command install writes MUST parse in POSIX `sh`, Git Bash and PowerShell:
  the script path quoted, the interpreter unquoted, forward slashes on Windows.
- **FR-002**: The interpreter MUST stay `process.execPath` for the skill hook and subagent
  rows, except on Windows when it contains whitespace, where it MUST be `node` if `node` runs
  from the installing shell. On POSIX a path with whitespace MUST be quoted.
- **FR-003**: Commands and paths printed by `update`, the npx refusal and `updates` MUST be
  real paths, with forward slashes on Windows, never `~`.
- **FR-004**: `doctor` MUST report a `statusLine` in the working directory's
  `.claude/settings.json` or `.claude/settings.local.json` that is not this plugin's.
- **FR-005**: CI MUST install on Windows and run the written commands through PowerShell and
  Git Bash, and on Linux through `sh`.
- **FR-006**: The README MUST give, for macOS, Linux and Windows, prerequisites, the exact
  install commands, verification, and troubleshooting.
- **FR-007**: Principle IX's rule on spawned commands MUST be amended to FR-001 and FR-002.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CI Windows job draws the bar through both PowerShell and Git Bash from the
  command install wrote.
- **SC-002**: The full suite passes on all nine CI combinations.
- **SC-003**: `doctor` names the overriding file in 100% of tested cases.

## Assumptions

- Claude Code's documented Windows behaviour (Git Bash, else PowerShell) is current; cmd.exe is
  not used to run status line commands.
- Terminals on all three platforms need a Nerd Font for the icons; `CLAUDE_STATUSLINE_ASCII=1`
  covers the rest, as today.
- The Linux machine in the screenshot is not reachable from here; the spec addresses the causes
  that can produce that screen, and `doctor` tells them apart on the machine itself.
