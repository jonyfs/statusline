# Phase 0 Research: Building the Selected Redesign

**Feature**: `specs/002-statusline-design-review`
**Date**: 2026-08-26

The catalogue's research is in the page and in `spec.md`. This file covers what had to
be worked out to build the 55 selected items: the arithmetic that decides what fits,
the mechanisms three of them need, and the two defects found while checking.

## The arithmetic that governs everything

Counting the widest realistic form of every selected segment, at the column widths this
project already measures with `displayWidth`:

| Line | Segments after the change | Widest form |
|---|---|---|
| 1 | directory, project-dir marker, branch, worktree, working tree, conflicts, ahead/behind, PR with review state, CI | ~118 columns |
| 2 | skills as one chip, todo progress, working/idle marker | ~54 columns |
| 3 | model, effort with output style, agent, session name, fast/thinking markers | ~86 columns |
| 4 | context bar and number, tokens used of total, window size, 200k flag, 5h, burn rate, projection, 7d, one merged countdown, clock, rtk, session duration, api time, lines changed | ~210 columns |

Line 4 alone is nearly twice the budget on a 120-column terminal, and roughly two and a
half times what fits on the 80 columns a split pane leaves.

Three selected items are what make this survivable rather than a wrapped mess:

- **D2** reads the real width from `COLUMNS`, so the bar knows what it is working with
  instead of assuming.
- **D4** gives every segment a priority, so what survives on a narrow terminal is what
  matters rather than what came first in the source.
- **D1** lets the line count follow the terminal, so a short window sheds a whole line
  instead of wrapping four.

Everything else in the selection is subordinate to those three. The priority table is
therefore the single most consequential design decision in this feature, and it is set
out in `data-model.md` for review before anything is built.

## Decision 1: the priority table is the feature's real interface

**Decision**: Every segment carries an integer priority. Rendering fills each line by
descending priority until the next segment would exceed the available width, exactly as
iTerm2's status bar does. Priorities are declared in one table, in `data-model.md`, and
changing one is a reviewable change rather than an edit buried in a render function.

**Rationale**: With 34 segments and 120 columns, most redraws cannot show everything.
Source order decides that today, which means the last thing added is the first thing
lost, regardless of what it says. iTerm2 solved this years ago by making visibility a
declared property of the component rather than an accident of layout.

The ordering within a line stays independent of priority: priority decides whether a
segment appears, position decides where. Mixing them would make the bar's layout jump
as values change, which is the churn Principle X exists to prevent.

**Alternatives considered**:

- Fixed truncation order, as feature 001 built. It works for four items and does not
  scale to thirty-four, and it cannot express "on a wide screen show this, on a narrow
  one show that instead".
- Per-line overflow into a second line. Rejected: Claude Code truncates rather than
  wraps, and a bar that grows a line when a number changes is worse than one that drops
  a segment.

## Decision 2: shedding lines uses `LINES`, and restores as soon as it can

**Decision**: Read `LINES` alongside `COLUMNS`. Below a threshold, drop whole lines in
declared order: line 2 (skills) first, then line 3 (model), then line 1. Line 4 is never
dropped, because usage against a limit is the one thing with a consequence you cannot
undo. Restore immediately when the room returns.

**Rationale**: Claude Code sets both variables before running the command, as of
v2.1.153. The statusline occupies its own rows above the footer, so on a short window
four lines of bar leave very little conversation. The amended Principle II now allows
shedding, and requires it be by declared priority and reversible.

**Alternatives considered**: Merging lines instead of dropping them. Rejected: a merged
line is a different layout that has to be designed, tested and previewed separately, and
it still overflows the width the moment two lines' content is placed on one.

## Decision 3: colour carries one meaning per segment

**Decision**, following the owner's answer of 2026-08-26:

| Segment | Colour means |
|---|---|
| context, 5-hour, 7-day, burn rate | level, on a ramp at 60 and 85 |
| branch, pull request, skills, model | recently changed |
| everything else | segment identity only, as today |

**Rationale**: The selection took E4 and E5 (ramps) and E10 (colour instead of animation
frames) together, which would have put two meanings on one channel: a red context
segment could mean "nearly full" or "just changed". Splitting by segment keeps a colour
on screen unambiguous wherever it is found, which is what the amended Principle X now
requires in writing.

The ramped segments are exactly the ones excluded from change tracking today, because
they move on nearly every redraw. So the split falls along a line the codebase already
draws.

## Decision 4: history lives in the session state file

**Decision**: Burn rate (B1), the projection (B2), the context sparkline (B4) and the
rtk five-point threshold (C5) all need previous values. They store a bounded ring of
samples in the existing per-session state file, alongside the change-tracking snapshot:
at most 60 samples of `{at, contextPct, fiveHourPct, rtkPct}`, which is about six minutes
of redraws.

**Rationale**: The file, its sweep and its failure behaviour already exist and are
already tested. A second store would double the failure modes for the same data.

Sixty samples bound the file at a few kilobytes. The ring is enough for a sparkline and
for a rate computed over the last few minutes, which is the horizon a burn rate is
useful over anyway.

**What this costs**: the first minute of a session has no rate and no trend. Both render
nothing rather than a number derived from two samples, because a rate from a 12-second
window swings wildly and would be read as fact.

## Decision 5: three more separators have to be embedded

**Decision**: Add U+E0B2 (left-pointing solid), U+E0B1 (right-pointing thin) and U+E0B3
(left-pointing thin) to `scripts/extract-glyphs.py`, and regenerate `glyphs.json`.

**Rationale**: D3 puts a group on the right of the line, and a right-aligned Powerline
group points the other way; using the right-pointing arrow there draws chevrons into the
segment they are supposed to separate from. D9's thin fallback needs the other two.

This is now enforced rather than remembered: the preview converter throws on a
private-use codepoint it cannot draw, so a missing separator fails the build instead of
shipping an invisible character.

## Decision 6: the subagent task rows are a second command

**Decision**: F2 ships as a separate command, declared alongside `statusLine`, receiving
the `tasks` array and a `columns` field on stdin and writing one JSON line per row it
overrides. It reuses the renderer's segment machinery for styling, and shares nothing
else with the redraw path.

**Rationale**: It runs on its own tick with its own input shape. Folding it into the
statusline command would mean one entry point branching on which contract it was called
under, which is how both contracts end up half-tested.

## Decision 7: two selected items depend on a newer Claude Code

**Decision**: Build A1 against `pr.number`, `pr.url` and `pr.review_state`, which this
machine's Claude Code 2.1.231 sends. Write the `pr.kind` branch for GitLab merge
requests, which needs 2.1.234, but do not treat it as testable here; guard it the same
way every other absent field is guarded.

**Rationale**: Version-gated fields are exactly the case the payload documentation warns
about, and the project already treats an absent field as "render nothing" rather than an
error. C1 keeps `gh` as a fallback, which covers the older-version case anyway.

## Two defects found while checking

**The commit glyph shipped as an invisible character.** U+F417, added for a detached
HEAD in feature 001, was never added to the preview's embedded glyph set. The converter
has two branches, embedded outline or text, and a Nerd Font codepoint with no outline
fell through to text. `docs/previews/detached-head.svg` therefore shipped a raw
private-use character, which shows as tofu to anyone without a Nerd Font, GitHub's
renderer included. Fixed before this plan was written: the glyph is embedded, the
converter throws on any private-use codepoint it cannot draw, and two tests cover it.

**F1 changes a settings file, not the code.** `refreshInterval` lives beside
`statusLine.command` in `settings.json`. Nothing in the statusline can set it at render
time; only the installer can write it, and only uninstall can take it away again. That
makes F1 an install-path change with the same reversibility requirement as the hook.

## What the previous feature's budget means here

The redraw budget is 300 ms and the measured p95 is 47 ms, which leaves room. Of the
selected items, three cost real time: B10 (CI status) is a network call and goes behind
the existing background refresh, B4 and B1 add a state write per redraw, and D8's column
alignment requires measuring every line before printing any of them. The alignment pass
is pure string work on content already in memory, so it is bounded by the number of
segments rather than by anything external.
