---
track: quick
status: done
---

# Codex items in the Claude bar's order

**Feature Branch**: `feat/codex-items`

**Created**: 2026-10-06

**Input**: The workflow's computed task for feature 034. Inside Codex CLI 0.160.1's own footer,
get as close as Codex allows to the Claude Code bar. The evidence is the parity study of
2026-10-06 (entries for the `codex` harness), checked again here against the installed binary.

**Track**: `quick`. One module owns the change (`src/codexConfig.js`), with its callers in
`src/install.js`, `src/doctor.js` and `bin/cli.js`.

## What Codex allows

Codex runs no external status line command. Its footer is one line of built-in items, listed
under `[tui] status_line` in `config.toml`, joined by a fixed ` · ` and cut at the right edge with
`…` when the line is wider than the terminal. The `[tui]` table also has
`status_line_use_colors`, `terminal_title` and `theme`. Nothing else in the table can carry
text from outside Codex.

Every id below was checked with `strings` on
`@openai/codex-darwin-x64/vendor/x86_64-apple-darwin/bin/codex` (`codex-cli 0.160.1`). All of
them appear in the item id table next to `hostname`, `approval-mode` and `workspace-headline`,
and the picker's descriptions sit beside it ("Project name (falls back to current directory
name)", "Current Git branch (omitted when unavailable)", "Percentage of context window used
(omitted when unknown)"). The four `catppuccin-*` themes are in the bundled theme list next to
`tui/src/render/highlight.rs`. A made-up id, `bogus-item-xyz`, has no match.

## The items, in the Claude bar's reading order

Claude's bar reads left to right and top to bottom: line 1 is where you are, line 2 what is
happening, line 3 the model and what it is spending. Codex has one line, so the list follows
that order on one line.

| # | Codex item | Claude segment | Why it is here |
|---|---|---|---|
| 1 | `project-name` | `dir` (line 1) | Claude's first segment is the folder name. `project-name` is the project, falling back to the folder name. It replaces `current-dir`, which printed the whole absolute path and, in the study's capture, pushed every later item past the `…`. |
| 2 | `git-branch` | `branch` | The same thing. Omitted outside a repository. |
| 3 | `branch-changes` | `linesChanged` | Claude counts lines this session changed; Codex counts committed changes against the default branch (`+12 -3`). The figures differ, but both say how big the change is. |
| 4 | `pull-request-number` | `pr` | The open pull request for the branch (`PR #123`). Omitted when there is none. |
| 5 | `task-progress` | `todo` (line 2) | `Tasks 2/5` from Codex's plan tool, Claude's todo progress. |
| 6 | `run-state` | `activity` | Ready, Working or Thinking, Claude's working or idle chip. |
| 7 | `model-with-reasoning` | `model` and `effort` (line 3) | The model with its reasoning level, `gpt-5.5 high`. |
| 8 | `fast-mode` | `fastMode` | Fast on or off. |
| 9 | `permissions` | `allowAll` | The permission profile, such as `Workspace` or full access. The bar shows allow-all where the harness reports it; Claude Code shows its own permission mode beside the bar. |
| 10 | `context-used` | `context` | `Context 34% used`, the share used, as Claude shows it. |
| 11 | `five-hour-limit` | `fiveHour` | The primary usage window. |
| 12 | `weekly-limit` | `sevenDay` | The secondary usage window. |

Left out, each for a reason:

- `current-dir`: replaced by `project-name` (row 1).
- `context-remaining`: the same figure as `context-used`, inverted. Claude shows the share used.
- `model` and `reasoning`: both are inside `model-with-reasoning`.
- `approval-mode`: Claude's bar has no approval chip, and the line is already long.
- `activity`: a spinner that duplicates `run-state`.
- `thread-name`, `thread-title`, `thread-id`: Claude's bar names no session.
- `used-tokens`, `total-input-tokens`, `total-output-tokens`, `context-window-size`: Claude
  shows a percentage, not token counts.
- `daily-limit`, `monthly-limit`, `annual-limit`, `usage-limit`, `secondary-usage-limit`: the
  first three are windows Claude has no chip for; the last two repeat the five-hour and weekly
  items under another name.
- `codex-version`, `app-name`, `hostname`, `raw-output`: not on Claude's bar.
- `thread-credits`, `estimated-thread-cost`, `workspace-headline`: Enterprise only.

Codex cuts the end of the line, while Claude drops its least important segments first. Following
Claude's order puts the context and limit items last, so on a narrow terminal they are the
first to go. The study and the owner's request put the reading order first; the README says
what a narrow window loses.

## Colors

`status_line_use_colors = true` gives each item one foreground color from the active theme,
by category (the study captured truecolor foregrounds per item, no backgrounds, an uncolored
separator). Install writes it under `[tui]` only when the key is absent. A value the person set,
`true` or `false`, is left as it is. The plugin records in
`~/.claude/statusline/codex-config.json` that it added the key, and uninstall removes it only
when that record exists and the value is still `true`.

`theme` is not touched by default. It is safe as an opt-in: `install --harness codex --theme
catppuccin-mocha` (or `-macchiato`, `-frappe`, `-latte`) sets it, after recording the value it
replaces or that there was none. `--no-theme` and uninstall put that value back, unless the
theme was changed since (in `/theme` or by hand), and then the later choice stands. A second
`--theme` keeps the first record. `theme` also restyles syntax highlighting in diffs and code
blocks everywhere in Codex, and the README says so next to the flag.

## Terminal title: not written

The study put `terminal_title = ["project-name", "git-branch", "run-state"]` on the table as a
cheap extra, and its own judge scored the title route 2 out of 10: a title is plain text in the
system font, often cut in a tab, and the items only repeat what the footer already shows. Codex
already writes a title of its own by default. Replacing it would trade a setting the person may
rely on for no new information, so install leaves `terminal_title` alone and the README says
how to set it by hand.

## Existing installs

The plugin has written one other list, in `specs/029-multi-harness`:
`model-with-reasoning, current-dir, git-branch, context-used, five-hour-limit, weekly-limit,
fast-mode, run-state, task-progress`. `CODEX_ITEMS_HISTORY` keeps every list the plugin has
ever written, newest first. Install then:

- writes the list when `[tui]` has no `status_line`;
- replaces a list equal to any list in the history (compared item by item, so a reformatted or
  multi-line copy still counts as ours) with the current one;
- keeps any other list, because the person chose it, and says so with the line to use instead.

Uninstall removes a list equal to any list in the history. Every other byte of the file is kept:
the writer is still line-level, still follows quoted and spaced `[tui]` headers, quoted keys and
multi-line arrays, still refuses a root-level `tui` it cannot edit, and now keeps CRLF line
endings in the lines it adds.

## Requirements

- **FR-001**: `CODEX_ITEMS` is the twelve items above, in that order, and every one is in the
  0.160.1 binary.
- **FR-002**: Install writes `status_line_use_colors = true` under `[tui]` when the key is
  absent and records it; uninstall removes it only when recorded and still `true`.
- **FR-003**: `--theme <catppuccin-*>` is opt-in, records the previous value, and `--no-theme`
  or uninstall restores it unless it was changed since. Without a flag the theme is untouched.
- **FR-004**: `terminal_title` is not written.
- **FR-005**: Install upgrades a list from `CODEX_ITEMS_HISTORY` and keeps any other list.
- **FR-006**: Install then uninstall returns the file byte for byte, LF or CRLF.
- **FR-007**: `doctor` names the state of the Codex items (this plugin's current list, an older
  one, the person's own, or none), of the colors key, and of a theme this plugin set.
- **FR-008**: The README's Codex section and feature matrix describe the new list, the colors,
  the theme flag and its effect on code blocks, and why the title is not set.

Tests: `scripts/tests/codex-items.test.js`, plus the pinned list in
`scripts/tests/multi-harness.test.js`.

## Constitution

Principle IV said install manages only `[tui] status_line` in Codex's `config.toml`. It now also
writes `status_line_use_colors`, and with `--theme` the `theme` key, so IV is extended (7.5.0,
MINOR).
