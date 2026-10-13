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
three smaller deviations. The owner chose, on 2026-10-12, to apply F57, E41, B14, the section 5.2
colours and the pill's 0/1 padding as the guide writes them, and kept the J98 ramp.

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
  neutral run draws it in the chip's text colour instead of the failure mark.
- **FR-004** (G64): agent rows mark a window at 85% or more with F40C in the Nerd tier, as the
  gauges do. The other tiers keep `!`.
- **FR-005** (E49): the `…/` that marks a cut directory name is drawn in the quiet colour.
- **FR-006** (E41): the context chip names itself by its icon and carries no word, in every
  form.
- **FR-007** (B14): the closing-window cache chip draws its hourglass in peach.
- **FR-008** (section 5.2): the modified count is drawn in yellow, the staged count in green and
  the behind count in sapphire, inside the working-tree chip. Two new text markers carry the yellow and the sapphire; the green is `GOOD`, the marker a
  reset already uses.
- **FR-009** (section 5.5): the pill keeps no leading pad and one trailing column, so a chip
  costs one column more than before. The composer page counts the same column.
- **FR-010** (section 5.3): a blocked update draws its own `updateBlocked` glyph (F01DA, the
  download arrow) and a waiting update draws `updateReady` (F0394), so the new-box mark never
  sits on a failed install.
- **FR-011**: the colour budget in the constitution (8.7.0), the `ROLE` comments and the
  `doctor` legend say which roles colour an icon and which colour text.

## Left as recorded

- `projection`, `linesChanged` and `credits` have no key of their own: the burn chip carries the
  projection, the lines chip is text, and credits reuse `spend`.
- A09, E42 and E47 stay as 040 and 044 decided; the owner was asked about E41, B14, section 5.2
  and the pill padding only.
- J98 keeps blue, yellow and red (owner, 2026-10-12).
- `ramp.bar()` stays: the ramp tests exercise it.

## Success criteria

- **SC-001**: `npm test` passes, including the glyph-key and extractor tests and the golden bar.
- **SC-002**: Each requirement has a test in `scripts/tests/guide-gaps.test.js`.
- **SC-003**: `glyph-evidence.png` shows the eight changed codepoints and F40C, drawn from the installed
  font, with the names the font's own table gives them.
- **SC-004**: `F4A4` is now both the passed-CI mark and the clean-tree mark, as section 5.3 draws
  it; the CI chip is told apart by its workflow name.
