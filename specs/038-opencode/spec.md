---
track: full
status: done
---

# The bar inside OpenCode

**Feature Branch**: `feat/opencode`

**Created**: 2026-10-06

**Input**: The owner asked for the status line to work in OpenCode the way it works in Claude
Code, with an install option for it.

**Track**: `full`. A new harness brings a new data source, a new kind of install target and a
module that runs inside another program, so the plan records why each piece is built the way it is.

## Evidence

- OpenCode 1.18.35 is installed here (`~/.opencode/bin/opencode`). It runs no status line
  command. It does load TUI plugins: modules listed in `tui.json` whose default export is
  `{ id, tui }`. A plugin can register into host slots. `app_bottom` is drawn below the active
  screen on both the home and the session screen (OpenCode's own `specs/tui-plugins.md`).
- A probe plugin written as a `.tsx` file outside OpenCode's config directory, listed in a
  throwaway `tui.json` through `OPENCODE_TUI_CONFIG`, loaded and drew two coloured lines in
  `app_bottom`. A Solid signal ticking every second redrew it. The branch read
  `api.state.vcs.branch`.
- `api.state` carries what the bar needs: the session (`cost`, `time.created`,
  `summary.additions/deletions`), its messages (each assistant message has `providerID`,
  `modelID`, `tokens` and `variant`), its status (`idle`, `busy`, `retry`), its todo list, the
  providers with each model's `name` and `limit.context`, and the directory, worktree and branch.
- OpenCode's own context figure (its `internal:sidebar-context` plugin) is the last assistant
  message with output: `input + output + reasoning + cache.read + cache.write` tokens over the
  model's `limit.context`. The bar uses the same figure.
- OpenCode has no 5-hour or 7-day window. Providers meter their own way and OpenCode does not
  report it.

## User scenarios

### US1: The bar under OpenCode's prompt (P1)

After `install --harness opencode` and a restart of OpenCode, the bar's lines appear under
OpenCode's prompt, in the bar's own colours: directory and git, the session's state, and the
model with its context share.

**Acceptance**

1. On the home screen, before any session, the bar shows the directory and git line.
2. In a session, line 3 shows the model OpenCode last answered with, by the provider's name for
   it, and `Context N%` by OpenCode's own formula.
3. The 5-hour and 7-day chips are absent, not `?%`.
4. While OpenCode works on a turn the bar says working; when the turn ends it says idle.
5. The session's todo list shows as the todo chip, `current (done/total)`.
6. Lines changed come from the session's summary, and the session duration from its start.
7. The bar fits OpenCode's width and redraws when the terminal is resized.

### US2: Install and uninstall (P1)

`install --harness opencode` adds one entry to `tui.json` in OpenCode's global config directory,
pointing at this clone's plugin file. It backs the file up first, keeps every other key and
entry, and says so. Running it again changes nothing. `uninstall --harness opencode` removes
that entry and nothing else. `doctor` lists OpenCode and whether the bar is set up there.

### US3: Never in OpenCode's way (P2)

If the renderer fails, takes too long or `node` is missing, OpenCode keeps working and the slot
shows the last good bar or nothing. One render runs at a time. Redraws follow OpenCode's events
and a slow clock, never a busy loop.

## Requirements

- **FR-001** The plugin MUST build the payload from `api.state` only, in Claude Code's shape,
  marked by an `opencode` block. Nothing is estimated.
- **FR-002** Context MUST be OpenCode's own figure (Evidence). Without the model's
  `limit.context` the share is absent, and the bar shows `?%`.
- **FR-003** The model name MUST be the provider's `name` for the model, else its id. The effort
  MUST be the message's `variant` when there is one.
- **FR-004** Cost, duration and lines changed MUST come from the session record.
- **FR-005** Working MUST mean `session.status` is `busy` or `retry`.
- **FR-006** The 5-hour, 7-day and spend chips MUST be absent under OpenCode.
- **FR-007** The plugin MUST run the renderer in a child process, at most one at a time, with a
  deadline, and draw its ANSI output as coloured text. Links are dropped, text kept.
- **FR-008** Install MUST create `tui.json` when absent, and otherwise add the entry only when
  no entry for this plugin is there. An entry pointing at an older clone of this plugin is
  replaced. Uninstall MUST remove only entries that point at this plugin's file.
- **FR-009** Install MUST refuse when OpenCode's config directory does not exist.
- **FR-010** Claude Code, Copilot and Codex output MUST NOT change.

## Edge cases

- No session yet: no model chip from a message, no context figure, no cost.
- A session whose last assistant message has no output yet: context from the one before it.
- A model missing from the provider list: the id stands for the name, and no context share.
- `tui.json` with comments: the backup keeps them and install says so.
- `tui.json` that is not valid JSON: install refuses and changes nothing.
- An entry given as `[spec, options]`: matched by its spec.

## Success criteria

- **SC-001** A real OpenCode session shows the bar under its prompt with the same model name
  and context share OpenCode's sidebar shows.
- **SC-002** Install then uninstall leaves `tui.json` byte for byte as it was, or absent if it
  was absent.
- **SC-003** Every existing test passes, and the suite covers US1 to US3 and the edge cases.

## Assumptions

- OpenCode's global config directory is `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`.
  `OPENCODE_CONFIG_DIR` points elsewhere when set.
- `node` is on the PATH OpenCode was started with, as it is for Claude Code's status line.
