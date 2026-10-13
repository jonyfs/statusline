---
track: quick
status: done
---

# Gaps an item-by-item audit found against the 2026-10 guide

**Feature Branch**: `feat/054-guide-gaps`

**Created**: 2026-10-12

**Status**: Done

**Input**: An audit of every catalog item (A01 to J100) and section 5.3 against the code on
main at 1.49.0. No catalog item was wholly absent. The gaps were section 5.3 glyph rows and
three smaller deviations. The owner chose F57 to be applied as the guide writes it and kept the
J98 ramp.

## Requirements

- **FR-001** (F57): `dir`, `branch`, `skills` and `effort` carry an icon-only last form, so the
  width guard shortens them before it drops them. Skills first falls back to the newest skill
  alone. The `model` chip has no icon-only form: an icon alone names no model, so it goes whole
  by priority.
- **FR-002** (section 5.3, Nerd tier): `ciPass` F4A4, `ciFail` F530, `gateRunning` F52E,
  `updateReady` F0394, `todo` F0756, `context` F09D1, `model` F167A. Each is in
  `scripts/extract-glyphs.py` and `src/preview/glyphs.json`, rendered from the installed
  FiraCode Nerd Font Mono.
- **FR-003** (section 5.3): a new `ciSkipped` key (F517, `⏩`, `-`). A skipped, cancelled or
  neutral run draws it in the neutral icon colour instead of the failure mark.
- **FR-004** (G64): agent rows mark a window at 85% or more with F40C in the Nerd tier, as the
  gauges do. The other tiers keep `!`.
- **FR-005** (E49): the `…/` that marks a cut directory name is drawn in the quiet colour.

## Left as recorded

- `projection`, `linesChanged` and `credits` have no key of their own: the burn chip carries the
  projection, the lines chip is text, and credits reuse `spend`.
- A09, E41, E42, E47 and the pill's 0/1 padding stay as 040, 044 and 045 decided.
- J98 keeps blue, yellow and red (owner, 2026-10-12).
- `ramp.bar()` stays: the ramp tests exercise it.

## Success criteria

- **SC-001**: `npm test` passes, including the glyph-key and extractor tests and the golden bar.
- **SC-002**: `F4A4` is now both the passed-CI mark and the clean-tree mark, as section 5.3 draws
  it; the CI chip is told apart by its workflow name.
