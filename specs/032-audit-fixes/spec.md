---
track: quick
status: done
---

# Audit fixes

Fixes for the findings the 2026-10 audit confirmed, each pinned by a
regression test. This directory holds the evidence those fixes depend on.

## Renderer group

`scripts/tests/audit-render.test.js` covers findings #1, #2, #3, #4, #6, #7,
#25, #26 and #28, plus the `trimFromLeft` half of #27.

## Plain glyph evidence (#26)

Five glyphs in the no-Nerd-Font set were East Asian Ambiguous, so a terminal
that draws Ambiguous characters wide drew them two columns wide.
`plain-glyph-evidence.png` shows each one beside its Narrow candidates. Every
candidate is drawn from the first font in the chain a terminal on the
evidence machine uses for it: FiraCode Nerd Font Mono, then Menlo, then Apple
Symbols, then STIX Two Math. The sheet labels each with its East Asian Width
from Python's `unicodedata` (Unicode 16.0). `plain-glyph-sheet.py` regenerates
it.

| Key | Was | Now |
|---|---|---|
| calendar | `U+25A4` ▤ | `U+25F0` ◰ |
| working | `U+25CE` ◎ | `U+29BF` ⦿ |
| skills | `U+25C8` ◈ | `U+2756` ❖ |
| model | `U+25C7` ◇ | `U+25CA` ◊ |
| context | `U+25A6` ▦ | `U+229E` ⊞ |

The CI "running" mark (#25) moved from `U+F0997` to `U+F0996`. The evidence
for that is `specs/031-git-gate-rows/glyph-evidence.png`, which shows F0997
drawing md-progress_download and F0996 drawing a clock.

## Integration

The seven groups were written in separate worktrees and merged on
`fix/audit-integration`. Two review findings were closed there:

- #27: `U+2026` (the ellipsis every cut row and label ends with) joined the
  Ambiguous set in `src/theme.js`. Without it, the ellipsis was measured as one
  column on a terminal that draws it as two, so a cut row still overflowed,
  and the tests in `scripts/tests/row-clipping.test.js` could not fail.
  With the entry in place, the "ambiguous wide=1" case fails against the old
  `columns - 1` reservation.
- #17: the opt-out inference counted only `subagentStatusLine` as the task
  rows being on. An install from before fix 018 still holds them under
  `statusLine.taskCommand`, and the next update would have turned them off.
  The old key now counts as on, and `install-hook.test.js` pins it.
