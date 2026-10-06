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
