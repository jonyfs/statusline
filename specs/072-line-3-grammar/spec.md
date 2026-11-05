---
track: quick
status: done
---

# Line 3 grammar: the icon says what, the number says how much

**Feature Branch**: `feat/069-usage-credits` (same pull request as specs/069 to 071)

**Created**: 2026-11-05

**Input**: "rever o design da linha 3 usando nerd fonts e melhorias possíveis para deixar a linha mais
fácil de entender e ocupando menos espaço" (review line 3's design with Nerd Font glyphs so it reads
more easily and takes less room). Three variants were drawn; the owner chose the moderate one, for
every harness, with a switch that brings the words back.

## Why this exists

By specs/071 a credits seat's line 3 ran to about 118 columns, and a third of that was words the
icon beside them already said: `󰖄 credits 11%` where `󰧑 81%` has long stood for the context with
no word at all, `󱙹 rtk 81% saved`, `󰞌 cache 82%` next to a second `󰜗 cache cold` chip, and
`Acme · credits` one chip before the credits themselves. The grammar the context chip set, icon
then number, is extended to the chips that repeated their icon in words. A label stays where it
carries what the icon does not: the window's length (`5h`, `7d`, `30d`), a quota's name
(`month premium`), and `spend`, which shares the wallet with the credits and would be read as them.

## Requirements

- **FR-001**: The credits chip reads `󰖄 11%`; its unknown and off forms `󰖄 —` and `󰖄 off`.
- **FR-002**: The savings chip reads `󱙹 81%`, its former short form, with no shorter one.
- **FR-003**: The cache hit chip reads `󰞌 82%`, and its icon follows the prompt cache's state: the
  snowflake when cold, the emptying hourglass when a warm cache is closing, the full hourglass
  otherwise. While it draws, the prompt cache state chip keeps only what the icon cannot say, in
  its bare form: `󰜗 184k`, the tokens a cold cache writes again, or `󰔟 4m`, the minutes a closing
  one has left; a cold cache with nothing to add draws nothing beside the ratio.
- **FR-004**: The account chip drops the kind word when the kind is `credits` and the credits chip
  is on the line: `󰀄 Acme Robotics`. Any other kind keeps its word, since no chip implies it.
- **FR-005**: `CLAUDE_STATUSLINE_LABELS=on` restores every word above and the separate cache chips.
- **FR-006**: README documents the grammar and the switch; the goldens and previews move with it.

## Out of scope

The effort as a glyph alone, and glyphs in place of `+0.4%/h` and `session`: the compact variant
the owner did not choose.
