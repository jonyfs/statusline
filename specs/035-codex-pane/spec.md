---
track: full
status: done
---

# Feature Specification: The full bar in a pane under Codex

**Feature Branch**: `feat/codex-pane`

**Created**: 2026-10-06

**Status**: Completed (the declaration above is authoritative)

**Input**: The workflow's computed task for feature 035. While using OpenAI Codex CLI 0.160.1,
see this plugin's full Claude-style bar (the same renderer, Powerline, icons, links, git and
gate rows) in a small pane under Codex, since Codex's own footer cannot run outside commands.
The evidence is the parity study of 2026-10-06, entries for the `codex` harness with the angle
`codex-outside`, checked again here against real rollouts on this machine.

**Track**: `full`. It adds a data source (Codex's rollout), a hook in a file other tools share,
a long-running process, a tmux launcher, and amends three principles.

## What the study found, and what was checked again

- Codex runs no outside status line command. Feature 034 chose Codex's built-in items. The
  only way to see this plugin's own bar while Codex runs is outside Codex: a pane next to it.
- The rollout has what the bar needs. Every Codex session writes
  `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl`, one `{timestamp, type, payload}`
  record per line. Read-only checks of the 24 rollouts on this machine (CLI 0.118 to 0.160):
  - `session_meta` (the first line) has `id`, `timestamp`, `cwd` and `cli_version`, followed by
    Codex's whole base instructions, so the line can be over 100 KB.
  - `turn_context` has `model`, `effort` and `cwd`, once per turn. In 0.142 it comes after the
    turn's `task_started`.
  - `event_msg` `task_started` has `model_context_window` (258400 here); `task_complete` ends
    the turn, and `turn_aborted` ends an interrupted one.
  - `event_msg` `token_count` has `info.last_token_usage` and `info.total_token_usage`
    (input, cached input, output, reasoning, total) and `info.model_context_window`, plus
    `rate_limits.primary` and `secondary`, each `{used_percent, window_minutes, resets_at}`,
    and `rate_limits.plan_type`.
  - Plus plan rollouts carry a 300-minute and a 10080-minute window. The free plan carries one
    43200-minute (30-day) window and `secondary: null`.
  - In the four newest rollouts (0.147 to 0.160), every `token_count` has `info: null`. Those
    sessions failed at their first request, so they never had token data, but a reader cannot
    count on `info`.
  - One real rollout is 12 MB.
- Codex hooks get the rollout path. The 0.160.1 binary embeds the hook input schemas:
  SessionStart gets `session_id`, `transcript_path`, `cwd`, `model`, `source` and
  `hook_event_name`. Each hook in `~/.codex/hooks.json` must be trusted once; the trust entry
  is keyed by `<file>:<event>:<group>:<hook>` and a hash of the command. The owner's
  `hooks.json` already holds another tool's hooks.
- tmux keeps what the bar draws. In a throwaway tmux 3.7c server, a 3-row pane kept the
  truecolor SGR, the Nerd Font glyphs and the OSC 8 links, and `split-window` given a command as
  several arguments runs it without a shell (`'a b; c'` and `'x$HOME'` arrived verbatim).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The bar under Codex (Priority: P1)

A developer starts Codex with `statusline codex` instead of `codex`. A 3-line pane opens under
Codex and shows the same bar Claude Code shows: the directory, branch and pull request, the
working or idle state, the model and effort, the context share, the usage windows the plan has,
the session length and the savings. It follows the session as it runs and closes when Codex
exits.

**Why this priority**: it is the feature. Everything else serves it.

**Independent Test**: run the wrapper inside a throwaway tmux server with a stand-in `codex`
that writes a rollout; the second pane shows the bar, changes from working to idle when the
turn ends, and both panes close when the stand-in exits.

**Acceptance Scenarios**:

1. **Given** a terminal inside tmux, **When** `statusline codex --model x` runs, **Then** a
   3-row pane opens under the current one running `codex-pane`, and `codex` runs in the current
   pane with `--model x` exactly as given.
2. **Given** a terminal outside tmux with tmux installed, **When** the same command runs,
   **Then** a tmux session starts with Codex and the pane.
3. **Given** no tmux on the PATH, **When** the command runs, **Then** it prints how to install
   tmux and starts Codex alone.
4. **Given** Windows, **When** the command runs, **Then** it says tmux does not run natively
   there, suggests WSL, and starts nothing.
5. **Given** the pane is open, **When** Codex exits, **Then** the pane exits too.
6. **Given** the pane is open, **When** the person presses Ctrl-C in it, **Then** it restores
   the cursor and exits without a stack trace.

### User Story 2 - The figures are Codex's own (Priority: P1)

The pane shows only what the rollout says, in the Claude payload's shape, and nothing invented
to fill a slot.

**Independent Test**: map real rollout fixtures (Plus, free, 0.160) and compare the payload and
the rendered bar with the figures in the files.

**Acceptance Scenarios**:

1. **Given** a Plus rollout, **Then** the 300-minute window is the 5-hour chip and the
   10080-minute window the 7-day chip, each with Codex's `resets_at`.
2. **Given** the free plan's 43200-minute window, **Then** neither chip is drawn, not even as
   `?%`.
3. **Given** `info: null`, **Then** the context chip reads `?%` and the window size is still
   known.
4. **Given** a turn that started and has not ended, **Then** the activity chip reads working;
   after `task_complete` or `turn_aborted` it reads idle.
5. **Given** no turn yet, **Then** the model chip reads `Codex`, never `Claude`.

### User Story 3 - The right session (Priority: P2)

Two Codex sessions in the same directory each get their own pane, after a one-time opt-in.

**Independent Test**: write two pointers from two tmux panes and resolve each pane's session.

**Acceptance Scenarios**:

1. **Given** `install --harness codex --pane`, **Then** `~/.codex/hooks.json` gets one
   SessionStart hook running `codex-hook`, appended after every existing group, with a backup.
2. **Given** the hook runs, **Then** it writes `{session_id, rollout, cwd, tmux_pane}` to
   `~/.claude/statusline/codex/<id>.json` atomically, prints nothing, and sweeps stale pointers.
3. **Given** a pointer from Codex's tmux pane, **Then** the pane uses it. Without one, the
   newest pointer for the directory; without that, the newest rollout whose cwd matches.

### User Story 4 - Install, uninstall and doctor (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `--pane`, **Then** install says Codex asks once to trust the hook.
2. **Given** a plain reinstall, **Then** the hook stays; `--no-pane` removes it.
3. **Given** `uninstall --harness codex`, **Then** only this plugin's hook is removed, and the
   rest of `hooks.json` comes back byte for byte; a `hooks.json` install created and emptied is
   deleted.
4. **Given** `doctor`, **Then** the Codex line says whether tmux is present, whether the hook is
   registered, and the last session a hook reported.

### Edge Cases

- The SessionStart hook can run before Codex writes the rollout's first line. A pointer to a
  missing rollout is kept for a day before the sweep removes it.
- A `session_meta` line longer than the head read: `id`, `timestamp`, `cwd` and `cli_version`
  are read from the part that was read, since they precede the instructions.
- A rollout that shrank or was replaced is read again from scratch.
- A half-written last line is not a record until its newline arrives.
- A `hooks.json` that is not JSON: install with `--pane` refuses before writing anything.
- The tmux server's environment is not the shell's: `CODEX_HOME` and `CLAUDE_STATUSLINE_*` are
  handed to the pane with `-e`.
- Codex's `/new` starts another session in the same pane: the pane looks the session up again
  every 5 seconds.

## Requirements *(mandatory)*

- **FR-001**: `src/codexRollout.js` MUST turn a rollout into the Claude payload: `cwd`,
  `workspace`, `model.id` and `display_name`, `effort.level`, `version`,
  `context_window.context_window_size`, `used_percentage` (last turn's `total_tokens` over the
  window), `total_input_tokens` and `total_output_tokens`, `rate_limits.five_hour` and
  `seven_day`, and `cost.total_duration_ms`, plus a `codex` block that marks the harness.
- **FR-002**: A window MUST map to `five_hour` only at 300 minutes and to `seven_day` only at
  10080 minutes. Any other length MUST be left out.
- **FR-003**: A field the rollout lacks MUST be absent from the payload.
- **FR-004**: Reads MUST be bounded: at most 1 MB of the head and 2 MB of the tail, then only
  the bytes appended since the last read.
- **FR-005**: Working MUST mean a `task_started` with no later `task_complete` or
  `turn_aborted`.
- **FR-006**: Under the Codex harness the renderer MUST NOT read Claude skills or subagents,
  MUST name a missing model `Codex`, and MUST leave out a usage window the payload lacks.
- **FR-007**: `codex-hook` MUST write the pointer atomically, print nothing, exit 0 on any
  input, and sweep pointers older than 7 days or naming a rollout missing for a day.
- **FR-008**: `codex-pane` MUST render with the real renderer at the pane's size, re-read on
  `fs.watch` or a 1-second tick, draw again on a resize, repaint in place without clearing
  first, skip a frame identical to the last, exit when `--pid` is gone or on SIGHUP, and restore
  the cursor on Ctrl-C.
- **FR-009**: `codex` MUST pass every argument as its own argv element to tmux and to Codex,
  never through a shell string.
- **FR-010**: `install --harness codex --pane` MUST append one SessionStart group after the
  existing ones, back the file up, and say Codex asks once to trust it. `--pane` with another
  harness MUST be refused.
- **FR-011**: Uninstall MUST remove only hooks whose command ends in `cli.js codex-hook`.
- **FR-012**: `doctor` MUST report tmux, the hook and the latest pointer.
- **FR-013**: The README MUST show a preview generated from a rollout fixture through the
  adapter and the real renderer.

## Success Criteria *(mandatory)*

- **SC-001**: In a throwaway tmux server with a stand-in Codex, the pane shows the model,
  effort, context, both windows and the working state from the rollout, switches to idle when
  the turn ends, keeps fitting after a resize, and closes when the stand-in exits.
- **SC-002**: A 12 MB rollout is read in at most 3 MB the first time and only its appended
  bytes after that.
- **SC-003**: `npm test` passes, with every case above covered.
- **SC-004**: The other previews are byte-identical after `npm run previews`.

## Out of scope

- A bar inside Codex's own footer. Codex 0.160.1 cannot run one.
- A pty proxy that needs no multiplexer. Node has no built-in pty, and the plugin has no runtime
  dependencies.
- Codex's plan tool as the todo chip, its subagents as rows, and a chip for the free plan's
  30-day window. Each needs its own decision.
- Reading `~/.codex/state_5.sqlite`. `node:sqlite` is not available on every Node this package
  supports.
