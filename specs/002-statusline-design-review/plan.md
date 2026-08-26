# Implementation Plan: The Selected Statusline Redesign

**Branch**: `002-statusline-design-review` (to be created) | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-statusline-design-review/spec.md`

## Summary

The review page returned 55 of 68 options. Twelve are payload fields the bar ignores
today, two of which it currently pays a subprocess to compute. Seven have to be computed.
Seven remove or merge something. Twenty-seven change how the bar is laid out and drawn.

Counted at their widest, the selected segments come to roughly 210 columns on line 4
alone, against a 120-column budget. Three of the selected items are what make the rest
possible: `COLUMNS` gives the real width, a per-segment priority decides what survives
when there is not enough of it, and the line count follows the terminal instead of being
fixed at four. Everything else is subordinate to those three, so the priority table in
[data-model.md](./data-model.md) is the decision to review before any code is written.

Four selected items contradicted binding rules. The constitution was amended to v4.0.0
on the owner's instruction: a plain separator may now be a declared fallback, palettes
from outside Catppuccin may ship beside the four flavors, four lines is a shape rather
than a count, and change highlighting may use colour. That last amendment brought a new
rule with it, because the selection also put a level ramp on colour: each colour channel
carries exactly one meaning, and the split is declared rather than assumed.

## Technical Context

**Language/Version**: JavaScript, ES modules, Node 18 or newer

**Primary Dependencies**: None, and none may be added. Node built-ins only.

**Storage**: The existing files under `~/.claude/statusline/`. The per-session state file
gains a bounded ring of at most 60 samples for the burn rate, the projection, the trend
and the rtk threshold. No new directory.

**Testing**: `npm test`, one file per concern under `scripts/tests/`. 145 cases today.

**Target Platform**: Linux, macOS and Windows. The reference machine runs Claude Code
2.1.231, which is past `COLUMNS`/`LINES` (2.1.153) and past per-task model fields
(2.1.205), but short of `pr.kind` for GitLab merge requests (2.1.234).

**Project Type**: CLI plugin, invoked per redraw and exiting, plus a second command for
subagent rows.

**Performance Goals**: The redraw budget stays 300 ms; measured p95 today is 47 ms. The
alignment pass and the priority fill are string work over content already in memory.

**Constraints**: No network on the redraw path. Every value inside its maximum age or
absent, except the usage figures, which keep their slot and show `?%`. Lines fit the real
terminal width. A colour means one thing.

**Scale/Scope**: 34 segments after the change, against 15 today.

## Constitution Check

*GATE: passed against v4.0.0, the amendment this feature required.*

| Principle | Gate | Status |
|---|---|---|
| I. Starship-compatible output | Powerline stays the default; a thin separator is a declared fallback, and Nord and Gruvbox ship beside Catppuccin without becoming the default | Pass, under the v4.0.0 wording. Every added palette defines every token the Catppuccin flavors define. |
| II. Line structure | Four lines when there is room; shed by declared order when there is not; width from `COLUMNS` | Pass, under the v4.0.0 wording. A terminal with room still shows four. |
| III. Token tracking grounded in real data | Every new usage figure comes from the payload. The burn rate and the projection are computed from real samples and render nothing until there are enough | Pass. A rate from two samples is not shown at all rather than shown badly. |
| IV. Clone install, zero dependencies | No dependency added. `refreshInterval` and the task-row command are additive and removable | Pass. |
| V. Integration docs | README covers the priority table, the new segments, the refresh interval and the themes | Pass, as tasks. |
| VI. English-only | All code, output and docs in English | Pass. |
| VII. MVP-first | Verified locally before any tag | Pass. |
| VIII. Generated previews | Every new segment and both new themes need previews; the converter now fails on a glyph it cannot draw | Pass, and stricter than before. |
| IX. Cross-platform | `COLUMNS`/`LINES` are environment reads; the task-row command spawns nothing; no new shell strings | Pass with attention. |
| X. Icons carry live state | Change highlighting moves to colour on four segments; the ramp owns colour on four others; no segment carries both | Pass, under the v4.0.0 wording, and the registry makes a violation visible in a diff. |
| XI. Tag-driven releases | Unchanged | Pass. |

**What the amendment cost**: v4.0.0 is a MAJOR bump because two binding rules were
rewritten. Every preview is regenerated, the README's four-line claim is restated, and
the tests that assert exactly four lines become tests that assert four-when-there-is-room.

## Project Structure

### Documentation (this feature)

```text
specs/002-statusline-design-review/
├── plan.md              # This file
├── spec.md              # The catalogue's spec, plus the selection itself
├── research.md          # Phase 0: the arithmetic, and the mechanisms three items need
├── data-model.md        # Phase 1: the segment registry and the priority table
├── review-board.html    # The page the selection came from
├── contracts/
│   ├── task-rows.md     # The second command, for subagent rows
│   └── settings.md      # What install writes: refreshInterval, the task-row command
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output, not created here
```

### Source Code (repository root)

```text
bin/
└── cli.js                    # + task-rows subcommand

src/
├── segments.js               # NEW: the registry: key, line, order, align, priority, colour
├── layout.js                 # NEW: width from COLUMNS, priority fill, right alignment,
│                             #      column alignment, line shedding from LINES
├── ramp.js                   # NEW: level to colour and to bar shape, one place
├── samples.js                # NEW: the bounded sample ring, and the rates read from it
├── taskRows.js               # NEW: the subagent row command
├── render.js                 # renders from the registry rather than inline segment lists
├── git.js                    # payload-first PR and repo identity, gh and git as fallbacks
├── skills.js                 # + todo progress and activity from the same tail read
├── tokens.js                 # + token counts, window size, flags
├── theme.js                  # + Nord and Gruvbox, + thin separators, + bar glyphs
├── changeTracker.js          # colour highlighting instead of frames, on four segments
├── doctor.js                 # + priority, line, align, and why a segment was dropped
├── install.js                # + refreshInterval, + the task-row command
├── freshness.js              # + the new readings' maximum ages
└── cache.js, rtk.js, refresh.js, transcriptTail.js, skillEvents.js, openTerminalTab.js

scripts/
├── extract-glyphs.py         # + E0B1, E0B2, E0B3 for the right-aligned and thin separators
├── preview-fixtures.js       # + narrow terminal, shed lines, both new themes, new segments
└── tests/                    # + registry, layout, ramp, samples, task rows
```

**Structure Decision**: Four new modules, each holding one thing the current code has no
home for: what a segment is, how a line is laid out, what a level looks like, and what
happened recently. `render.js` stops holding segment definitions inline and starts
consuming the registry, which is what makes the priority table reviewable rather than
scattered.

## Implementation sequence

Ordered so each step is verifiable alone, and so the riskiest structural change lands
before anything depends on it.

1. **The registry** (`segments.js`), with `render.js` rewritten to consume it. No
   behaviour change: the same 15 segments, same order, same colours, now declared.
2. **Layout** (`layout.js`): real width from `COLUMNS`, priority fill, line shedding from
   `LINES`. Still 15 segments, but now they degrade by priority.
3. **Payload-first values** (A1, A2, C1, C2): the two subprocesses become fallbacks.
   This is the step that pays for itself immediately.
4. **The rest of the free payload values** (A4-A19), each a registry row.
5. **Encoding** (`ramp.js`, E1-E9): the bar, the ramp, the shape rule, abbreviated
   numbers, dimmed countdowns.
6. **Colour highlighting** (E10) and the channel split, in `changeTracker.js`.
7. **Merges and removals** (C3-C7), which are cheapest once the registry exists.
8. **Right alignment and column alignment** (D3, D8), plus the three embedded separators.
9. **Computed values** (`samples.js`, B1-B4, B8, B12) and the CI status (B10).
10. **Transcript-derived** (F6, F7), on the tail read that already runs.
11. **Themes** (F3), **config** (F5), **refresh interval** (F1), **task rows** (F2).
12. **Docs and previews**: README, every fixture, both new themes, and the diagnostic.

Steps 1 and 2 are the ones worth reviewing closely. Everything after them is a row in a
table and a test.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| A constitutional amendment, v4.0.0 | Four selected items contradicted binding rules, and the owner chose to amend rather than drop them | Dropping them was offered and declined. The amendment is scoped to exactly those four rules and says what replaces them. |
| Four new modules | The registry, layout, ramp and samples each hold something with no current home | Keeping them in `render.js` would put the priority table inside a render function, where a change to what a person sees at 80 columns would not be visible as a change. |
| A second command for subagent rows | Its input shape and tick are different from the statusline's | One entry point branching on which contract called it is how both contracts end up half-tested. |
| A sample ring in the session state file | Four selected items need history | A second store doubles the failure modes for the same data; the existing file is already swept and already fails safe. |
| Pre-existing: `install.js` writes a bare `node` | Not introduced here; carried from feature 001 | Recorded again so the next amendment can settle it. New command strings this feature writes use `process.execPath`. |
