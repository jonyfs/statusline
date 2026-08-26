# Phase 1 Data Model: The Segment Registry

**Feature**: `specs/002-statusline-design-review`
**Date**: 2026-08-26

Feature 001 introduced readings, maximum ages and source budgets. Those stay exactly as
they are. What this feature adds is a registry: one row per segment, carrying everything
that decides whether it renders, where, in what colour, and what happens when there is
not enough room.

## Segment

| Field | Meaning |
|---|---|
| `key` | Stable identifier, used by the diagnostic and the tests |
| `line` | Which line it belongs to, 1 to 4 |
| `order` | Position within that line, independent of priority |
| `align` | `left` or `right`. Right-aligned segments are drawn from the far edge inward |
| `priority` | 0 to 100. Higher survives a narrow terminal. See the table below |
| `colour` | `identity`, `ramp`, or `change`. Never more than one |
| `maxAge` | From feature 001's table |
| `source` | Which reading feeds it |
| `minVersion` | Claude Code version the field needs, when it needs one |

Two rules that follow from the fields rather than being written into the renderer:

- `order` decides position, `priority` decides presence. A segment never moves because
  something else disappeared, so the eye can learn where things are.
- A segment declares `colour: "ramp"` or `colour: "change"`, never both. The amended
  Principle X requires the split, and putting it in the registry means a future edit that
  breaks it is visible in a diff rather than buried in a render function.

## The priority table

**This is the decision to review before anything is built.** It decides what a person
sees on an 80-column terminal, which is what a split pane leaves. Priorities are grouped
in bands rather than assigned one by one, so the intent survives later edits.

**Band 90-100, never dropped.** What the session cannot be understood without.

| Priority | Segment | Why it is here |
|---|---|---|
| 100 | `context` (bar and number) | The limit that ends the conversation |
| 98 | `branch` | Which code you are about to change |
| 96 | `dir` | Where you are |
| 94 | `fiveHour` | The limit that ends the day |
| 92 | `model` | What is answering you |
| 90 | `sevenDay` | The limit that ends the week |

**Band 70-89, dropped only when the terminal is genuinely narrow.** Actionable state.

| Priority | Segment |
|---|---|
| 88 | `worktree` (which worktree, and what it came from) |
| 87 | `conflicts` (merge conflicts, from the records already parsed) |
| 86 | `worktreeState` (changed, untracked) |
| 84 | `upstream` (ahead, behind) |
| 82 | `pr` (number, state, review) |
| 80 | `resetMerged` (both countdowns, one segment) |
| 78 | `compaction` (warning past the threshold) |
| 76 | `skills` (one chip, comma separated) |
| 74 | `effortStyle` (effort with output style) |
| 71 | `agent` |
| 70 | `todo` (count and current item) |

**Band 40-69, the first to go.** Useful, not decisive.

| Priority | Segment |
|---|---|
| 68 | `activity` (working or idle) |
| 66 | `burnRate` |
| 64 | `projection` |
| 62 | `tokens` (used of total) |
| 60 | `contextSize` (200k or 1M) |
| 58 | `exceeds200k` |
| 56 | `ci` |
| 54 | `sessionName` |
| 52 | `trend` (sparkline) |
| 50 | `duration` |
| 48 | `linesChanged` |
| 46 | `apiTime` |
| 45 | `repo` (owner and name, from the payload) |
| 44 | `projectDir` (when it differs from cwd) |
| 42 | `clock` |
| 40 | `rtk` (only when it moved five points) |

The bands say what the ordering means, so a later addition can be placed by asking which
band it belongs in rather than picking a number. Anything that would change what a
person sees at 80 columns changes a band boundary, which is a reviewable decision.

At 120 columns the top two bands fit. At 80, most of the third band is gone and the
bar reads as the six essentials plus whatever git state is non-zero.

## Line shedding

Driven by `LINES`, in this order, and reversed the moment the room returns:

| Rows available for the bar | What renders |
|---|---|
| 4 or more | all four lines |
| 3 | lines 1, 3, 4 (skills go) |
| 2 | lines 1, 4 |
| 1 | line 4 only |

Line 4 survives to the end because it is the only line carrying a limit with a
consequence you cannot undo. Line 1 outlives line 3 because where you are and which
branch you are on decide whether an edit is safe.

## Colour channels

| Channel | Segments | Encoding |
|---|---|---|
| `ramp` | `context`, `fiveHour`, `sevenDay`, `burnRate` | green below 60, yellow 60 to 85, red above 85 |
| `change` | `branch`, `pr`, `skills`, `model` | the segment's own colour brightens for 30 seconds after a change |
| `identity` | everything else | the Catppuccin colour assigned to that segment |

The ramp thresholds are the ones selected in E4, applied to the rate limits too, as E5
asked. `burnRate` joins the ramp because it is a rate against the same limit, and a rate
that would exhaust the window before it resets is the definition of red.

Since colour alone may not carry meaning (E6, and Section 508), every ramped segment also
carries a mark: nothing below 60, `▴` from 60 to 85, `▲` above 85. The distinction
survives a screenshot in greyscale and a reader who cannot separate red from green.

This was the bar's job until 2026-08-26, when the bar was removed from the statusline for
costing ten to sixteen columns on the widest line to say what the number already said. It
remains in the subagent task rows, where a row has a whole line to itself.

## Bars

Used by the subagent task rows only. The statusline itself shows numbers.

| Field | Meaning |
|---|---|
| `width` | Scaled to the row: 8 columns below 100 columns wide, 10 up to 160, 16 above |
| `style` | Block characters, per E2 |
| `fill` | `█` for the filled part, `░` for the rest |

## Sample ring

Stored in the existing per-session state file. Bounded so the file cannot grow.

| Field | Meaning |
|---|---|
| `at` | Unix milliseconds |
| `contextPct` | For the sparkline |
| `fiveHourPct` | For the burn rate and the projection |
| `rtkPct` | For the five-point threshold that decides whether rtk renders |

At most 60 samples, oldest evicted. A rate needs at least 5 samples spanning 60 seconds;
below that, the burn rate, the projection and the sparkline render nothing rather than a
number computed from noise.

## New readings

Everything below joins feature 001's reading table with the same shape. Sources marked
`payload` cost nothing.

| Reading | Source | Max age | Notes |
|---|---|---|---|
| `pr` | payload | this redraw | `gh` remains a fallback when the field is absent (C1) |
| `repo` | payload | this redraw | `git remote` remains a fallback (C2) |
| `cost` | payload | this redraw | duration, api time, lines changed, dollars |
| `tokens` | payload | this redraw | input, output, window size, cache |
| `flags` | payload | this redraw | `exceeds_200k_tokens`, `fast_mode`, `thinking.enabled` |
| `agent` | payload | this redraw | |
| `sessionName` | payload | this redraw | |
| `worktree` | payload | this redraw | `workspace.git_worktree` and `worktree.*` |
| `conflicts` | git, already parsed | 5 s | the `u` records the parser already sees |
| `ci` | `gh run list` | 60 s | background refresh only |
| `todo` | transcript tail | one redraw | same read that already finds skills |
| `activity` | transcript tail | one redraw | same read |
| `rates` | sample ring | one redraw | burn rate, projection, trend |

## Diagnostic

`doctor` gains four columns, because the registry gives it four more things worth
knowing: `priority`, `line`, `align`, and `dropped` with the reason (`too narrow`,
`line shed`, or the existing absence reasons). A person asking why something is missing
now gets "priority 46, dropped at 92 columns" rather than only "not rendered".
