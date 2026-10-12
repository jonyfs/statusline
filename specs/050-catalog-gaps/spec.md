---
track: quick
status: done
---

# Catalog gaps from the 2026-10 design review

**Feature Branch**: `feat/050-catalog-gaps`

**Created**: 2026-10-12

**Status**: Done

**Input**: A pass over the review's catalog (items A01 to J100) after features 039 to 049
merged. Six items the catalog states and the earlier features did not carry.

**Track**: `quick`: six small behaviours, one test additions file, no new data shape.

## Requirements

- **FR-001** (A07): With `COLORTERM` unset and `TERM` ending in `-256color`, colour depth is 256.
  Windows Terminal (`WT_SESSION`) and the terminals that name themselves by `TERM_PROGRAM`
  (iTerm, WezTerm, VS Code, Ghostty, Hyper) keep 24-bit, since they draw it and set neither.
- **FR-002** (A08): `CLAUDE_STATUSLINE_UNDERLINE=0` (or `off`, `false`) turns the dotted link
  underline off.
- **FR-003** (B16): In the Nerd Font tier the names on the skills chip are joined by `E0B5`;
  the other tiers keep the comma.
- **FR-004** (C29): A status read counts staged files (`F457`) and removed files (`F458`) beside
  the modified count and the untracked `?`.
- **FR-005** (F51): `CLAUDE_STATUSLINE_BLOCK=1` pads every line to the widest with spaces on
  `mantle`.
- **FR-006** (G68): With `CLAUDE_STATUSLINE_SPARKLINE=1` and eight context readings, the context
  chip's long form carries the last eight as a sparkline.

## Left as decided

- **A09**: `NO_COLOR` chips start with `▏` and carry no bold, so that the bar has no escape at
  all there (feature 044).
- **C26**: a review comment count has no data source in the payload.
- **F54**: optical padding, rejected in feature 045: nothing to measure in a terminal.
- **F59**: the hairline is a fourth line, which Principle II forbids.
- **A06**: the terminal background is read from `COLORFGBG` only; an OSC 11 reply cannot be
  read inside the redraw budget.

## Success criteria

- **SC-001**: Each requirement has a test in `scripts/tests/chip-copy.test.js`.
- **SC-002**: The suite and the 4.5:1 test pass; the redraw benchmark stays within budget.
