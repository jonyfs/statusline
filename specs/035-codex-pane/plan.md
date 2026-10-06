# Implementation Plan: The full bar in a pane under Codex

**Branch**: `feat/codex-pane` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/035-codex-pane/spec.md`

## Summary

Codex CLI cannot run this plugin's bar in its footer, so the bar runs next to Codex instead. A
new adapter reads Codex's session rollout and builds the payload Claude Code would have sent.
A long-running `codex-pane` command renders that payload with the real renderer in a 3-row tmux
pane and redraws it in place. A `codex` wrapper opens the pane and starts Codex. An opt-in
SessionStart hook tells the pane exactly which rollout is its session; without it, the pane
picks the newest rollout for its directory.

## Technical Context

**Language/Version**: JavaScript ES modules, Node 18+

**Primary Dependencies**: none at runtime. tmux 3.x for the pane (not a package dependency; the
wrapper explains how to install it).

**Storage**: pointer files `~/.claude/statusline/codex/<session>.json`; a record of a
`hooks.json` install created, `~/.claude/statusline/codex-hooks.json`; backups in
`~/.claude/statusline/backups/codex-hooks.*.json`.

**Testing**: `npm test`, with four fixtures derived from real rollouts on this machine
(read-only), every prompt, answer, tool call, instruction and account id removed:
`scripts/tests/fixtures/codex-rollout-{plus,free,0160,preview}.jsonl`.

**Target Platform**: macOS and Linux for the pane. Windows: the adapter, the hook and install
work; the wrapper explains that tmux does not run natively there and starts nothing.

**Project Type**: CLI

**Performance Goals**: the pane's tick is a `stat` of the rollout. A redraw reads only the
appended bytes. The bar is drawn again on a change, a resize, or every 5 seconds for git and the
clocks, never more than once per change.

**Constraints**: no runtime dependencies (IV); no argument in a shell string (IX); Claude Code
and Copilot output unchanged.

## Constitution Check

| Principle | Check |
|---|---|
| I. Starship-compatible output | The same renderer and theme. |
| II. Three-line display | The pane is the bar itself, three lines, with the same shedding and gate rows; nothing is added to the bar. II gets a note (7.6.0). |
| III. Real data | Every figure is Codex's, from its rollout. Windows map by their length only; the free plan's 30-day window has no chip. III is amended (7.6.0) to name the rollout as a data source. |
| IV. Install | `--pane` is opt-in, appends after existing hooks, backs the file up, and uninstall removes only this plugin's hook. IV is amended (7.6.0). |
| VI. English | Code, output and docs in English. |
| VIII. Generated docs | `codex-pane.svg` is rendered from a rollout fixture through the adapter by `npm run previews`. |
| IX. Three platforms | Paths through `node:path` and `node:os`; tmux and Codex started from argument vectors; tmux found on the PATH without a shell; Windows degrades with a message. |
| XII. Declared track | `track: full`. |

## Design decisions

1. **Adapter** (`src/codexRollout.js`). A fold over records into a small state: the first
   `session_meta`, the latest `turn_context`, the window from `task_started` or `token_count`,
   the latest token usage and rate limits, and whether a turn is open. A first read takes the
   head line (1 MB cap; a longer line gives its fields by pattern) and the last 2 MB; a read with
   the previous state takes only the appended bytes, up to 32 MB, and folds whole lines only.
   A file that shrank or changed inode is read again.
2. **Context share**. The last turn's `total_tokens` over `model_context_window`, both Codex's
   figures. Codex's own `context-used` item may differ by a few points, since it subtracts a
   baseline of its own; the bar does not copy a formula it cannot see.
3. **Usage windows**. 300 minutes is the 5-hour chip and 10080 the 7-day chip, whichever of
   primary or secondary carries them. Anything else is left out, and under the Codex harness
   the renderer leaves out a chip whose window the payload lacks, as it does for Copilot.
4. **Harness**. `detectHarness` returns `codex` for a payload with a `codex` object. Under it the
   probes return no Claude skills or subagents, and a missing model is named `Codex`.
5. **Session** (`src/codexSession.js`). The hook writes a pointer per session id (a hash when
   the id has other characters), tmp file then rename. Resolution order: `--rollout`,
   `--session`, the pointer whose `tmux_pane` is Codex's pane, the newest pointer for the
   directory, the newest rollout under `$CODEX_HOME/sessions` whose `session_meta.cwd` matches
   (14 day directories, 40 files at most). `--since` drops anything older than the pane.
6. **Pane** (`src/codexPane.js`). One process for the pane's life, so Node starts once. A 1 s
   tick stats the rollout, checks `--pid`, and looks the session up again every 5 s;
   `fs.watch` is the fast path. A frame is cursor home, each line followed by erase to end of
   line, then erase below, with no final newline; autowrap and the cursor are off while it runs
   and restored on exit. A resize clears once and redraws.
7. **Wrapper** (`src/codexLaunch.js`). Inside tmux: `split-window -v -d -l 3 -t $TMUX_PANE -P
   -F '#{pane_id}' -c <cwd> -- <node> <cli> codex-pane ...`, then `codex` with the arguments as
   given, then `kill-pane`. Outside tmux: `new-session -s codex-<pid> -c <cwd> -- <node> <cli>
   codex ...`, which takes the inside path. `CODEX_HOME` and `CLAUDE_STATUSLINE_*` are passed
   with `-e`, because a pane gets the tmux server's environment.
8. **Hook install** (`src/codexHooks.js`, `src/install.js`). Parse, append one group
   `{hooks: [{type: "command", command, timeout: 10}]}` to `SessionStart`, write back with
   two-space JSON (the form Codex and the other tools here write; the owner's file round-trips
   byte for byte). An existing hook of ours with another path is updated in place. The command
   is `"<node>" "<cli>" codex-hook`, stable across `git pull`.

## Project Structure

```text
src/codexRollout.js     rollout -> payload adapter, bounded and incremental (new)
src/codexSession.js     pointers, sweep, resolution, codex-hook (new)
src/codexPane.js        the pane loop and frame (new)
src/codexLaunch.js      the codex wrapper, tmux on PATH (new)
src/codexHooks.js       hooks.json add/remove (new)
src/harness.js          codex detection
src/render.js           codex probes, model name, absent windows
src/install.js          --pane, uninstall, harnessStatus pane readiness
src/doctor.js           pane line
bin/cli.js              codex, codex-pane, codex-hook; --pane/--no-pane
scripts/preview-fixtures.js   codex-pane.svg scenario
scripts/tests/codex-rollout.test.js, codex-pane.test.js
scripts/tests/fixtures/codex-rollout-*.jsonl
```

## Results

Recorded 2026-10-06 on macOS 15 (Darwin 24.6), Node 24.21.0, tmux 3.7c.

- `npm test`: 798 passed, 0 failed (759 before the feature).
- Throwaway tmux server (`tmux -L sl035`), the wrapper run inside it with a stand-in `codex`
  that writes the Plus fixture into a temporary `CODEX_HOME` and exits after 9 seconds. The real
  Codex TUI was never started.
  - `list-panes`: `%0 16x150 node` (Codex) and `%1 3x150 node` (the bar).
  - The stand-in received `["--model","a b; echo hi"]`, the arguments as typed.
  - The bar pane read, with the turn open:
    `gpt-5.5  medium  Context 20%  5h 11% · ?  7d 2% · ?` and `working`; after the stand-in
    appended `task_complete`, `idle`. The resets read `?` because the fixture's `resets_at` are
    in June.
  - `capture-pane -e` showed the truecolor SGR and the OSC 8 `file://` and GitHub links intact.
  - After `resize-window -x 90` and `resize-pane -y 5`, the bar was drawn again at 90 columns,
    shedding the session length first.
  - When the stand-in exited, both panes closed and the server ended.
- Outside tmux: the wrapper run with `TMUX` unset and `TMUX_TMPDIR` pointing at a temporary
  directory started session `codex-<pid>` with the same two panes on that private server, and
  the stand-in received `["resume","--last"]`. The session ended when the stand-in exited.
- First run without passing the environment: the pane, started by a tmux server whose
  environment lacked `CODEX_HOME`, looked in the wrong sessions directory and showed only the
  directory row. The wrapper now passes `CODEX_HOME` and `CLAUDE_STATUSLINE_*` with `-e`.
- `npm run previews`: only `docs/previews/codex-pane.svg` is new; every other preview is
  unchanged.
