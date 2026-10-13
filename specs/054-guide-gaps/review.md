# Review of feature 054

A read-only code review of `git diff 65c6699..1011024` (pull requests 50 to 53), run by a
separate agent on 2026-10-13. It ran `npm test` (1005 passed) and reproduced each finding
marked confirmed against the 1.49.0 baseline. The findings and what was done with each:

| # | Finding | Status | Disposition |
|---|---|---|---|
| 1 | A failed update drew the waiting glyph (`state: "failed"` fell through to `updateReady`); plain tier used one mark for blocked and waiting | Confirmed | Fixed: only `ready` draws `updateReady`; blocked and failed draw `updateBlocked`; plain tier blocked is `⇩`. Tested for all four states and all three tiers. |
| 2 | The skills chip never used its shorter forms in the default layout: `fitToWidth` stopped before the last chip's variants; the short form dropped `+N` | Confirmed | Fixed: the lone survivor tries its variants before overflowing; the short form keeps `+N`. Tested at 40, 30 and 24 columns. |
| 3 | Directory and branch both went to bare icons before either was dropped, inverting priority | Confirmed | Fixed: an icon-only form (`iconLast`) is no longer used in the essentials pre-pass; it is tried when the loop reaches the chip. Tested at 40 columns. |
| 4 | The composer page counted a pill column it never drew in the emoji and plain modes | Plausible | Fixed: the page counts the column only in the nerd mode. |
| 5 | `criticalMark()` ignored the caller's tier and resolved settings per row | Plausible | Fixed: `harnessAgentRows` passes `asciiArrows`; settings are read only when the caller made no choice. Cost was about 60 microseconds a call, so no per-tick cache was added. Tested. |
| 6 | Extractor still listed F42E, F467, F4A0 and F035B with roles they no longer had | Plausible | Fixed: the four entries are removed and `glyphs.json` regenerated. F06A9 stays: the animation scripts draw it. |
| 7 | Two tests still checked the marker range `\u0001-\u0003` | Confirmed | Fixed: both check `\u0001-\u0006`. |

## Checked and found clean

- Every path that strips or measures markers handles `\u0001-\u0006`, including the pool, the
  composer's inlined copy and the `NO_COLOR` path.
- A width sweep from 24 to 220 columns (round, block, hairline, three tiers) found no
  overflow caused by the pill's trailing column.
- U+23E9 and U+23EC are Emoji_Presentation and two columns wide; the rejected look-alike is
  U+23ED.
- The remaining uses of the word `context` are `doctor`'s row key, Codex's own item text and
  two preview captions.

## Requirements with a weak test, now covered

FR-003 (colour of the skipped mark), FR-005 (the cut marker's colour and the return to the chip
colour), FR-006 (variants), FR-008 (another flavor) and FR-010 (failed state, all tiers) have
tests in `scripts/tests/guide-gaps.test.js`.
