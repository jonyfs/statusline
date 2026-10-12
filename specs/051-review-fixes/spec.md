---
track: quick
status: done
---

# Fixes from the review of features 039 to 050

**Feature Branch**: `feat/051-review-fixes`

**Created**: 2026-10-12

**Status**: Done

**Input**: An advisor review of the whole run, which found places where the shipped features
contradict each other or the constitution, and four product questions left open.

**Track**: `quick`: small corrections and four decisions, one test file.

## Corrections

- **C1, constitution 8.6.0**: the K1 sentence that said Mocha output does not change is
  corrected; the context figure's colour-only exception of 2026-08-26 is retired (feature 046
  gives it the track and the alert glyph like every gauge); the progress-bar rule is marked
  superseded by the five-column track; the emoji icon-slot rule names the reset mark and the
  band marks as exceptions; the unknown mark is the dash, not `?%`.
- **C2, feature 048 FR-002**: a sleeping session now draws line 2 in the quiet text colour.
  Before, only the glyph and the word changed.
- **C3, A07 inside tmux**: `TERM=tmux-256color` says nothing of the terminal outside, which is
  usually truecolor. With `TMUX` set and `COLORTERM` unset the bar keeps 24-bit. `doctor`
  prints the colour depth and why.
- **C4, README and the 040 spec** said an unset `COLORTERM` keeps 24-bit; they now say what
  feature 050 made true.

## Decisions

- **044 casing**: lowercase stays. Rule E42 is explicit, and the section 5.7 examples are
  capitalised by accident of where they were written.
- **F54**: the pill drops its inner padding (its caps are its edges), so it costs what an arrow
  chip costs. The arrow keeps one column of padding, because the track already costs about six
  columns a gauge.
- **F59**: still not a fourth line. `CLAUDE_STATUSLINE_HAIRLINE=1` draws an overline (SGR 53)
  on line 1, which a terminal that does not draw it ignores.
- **A06**: `install` and `doctor`, which own an interactive terminal, ask for the background
  with OSC 11 (raw mode, 400 ms) and remember the answer per terminal. A render never asks,
  because the reply would arrive on Claude Code's own input. It reads the answer after the
  environment, the repository file and `COLORFGBG`.
- **J98**: the cvd ramp stays blue, yellow and red. Blue and yellow are the axis colour vision
  deficiencies keep, and red for critical is the colour the budget gives that band; peach as
  critical would sit beside the warn yellow in lightness.

## Owner decisions this review superseded

- The context figure's colour-only exception (2026-08-26): retired.
- The "no progress bar on the shared line" rule (2026-08-26): superseded by the track.
- The agent row column order (2026-09-08): the brief leads (feature 049).
