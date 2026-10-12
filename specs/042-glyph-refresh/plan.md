# Plan: icons that say what they mean

**Spec**: [spec.md](./spec.md)

## Decisions

1. **One table, two columns, 14 new keys.** `GLYPHS.nerd` and `GLYPHS.plain` in `src/render.js`
   gain `home`, `repo`, `worktree`, `removed`, `untracked`, `prDraft`, `prMerged`, `prClosed`,
   `reviewApproved`, `reviewComments`, `reviewRequested`, `effortLow`, `effortMedium`,
   `effortHigh`. `effort` stays as the high glyph for any caller that has no level.
2. **Chips read the table, never a codepoint.** Directory picks `home` when the working
   directory resolves to `os.homedir()`. The pull request picks its glyph from `pr.review`
   (`draft`, `merged`, `closed`, else `pr`) and a review mark from the same word (`approved`,
   `commented`, `review_required`). Effort picks by level, high for the rest. Untracked is
   drawn with `?` from the table, not the added box.
3. **Data the bar lacks stays absent.** `removed` and `reviewRequested` are table entries.
   Nothing computes a removed-files count, and a pull request has no requested-review state in
   the sources today, so neither is invented.
4. **Evidence is a generated image.** `specs/042-glyph-refresh/glyph-sheet.py` draws every new
   codepoint from FiraCode Nerd Font Mono beside the one it replaces and its plain
   substitute, with the substitute's East Asian Width. The image is committed.
5. **The extractor follows the table.** `WANTED` in `scripts/extract-glyphs.py` gains the
   new codepoints and loses the ones nothing emits. `src/preview/glyphs.json` is regenerated,
   and a test checks every private-use codepoint in the nerd table has an outline.
6. **Tests that encoded the old marks are updated** in the same change: push and pull
   codepoints, the untracked marker, the review mark in front of the review word, and the
   effort glyph per level.

## Files

| File | Change |
|---|---|
| `src/render.js` | `GLYPHS`, `effortGlyph`, `atHome`, PR and review marks, untracked, repo, worktree |
| `scripts/extract-glyphs.py`, `src/preview/glyphs.json` | the new codepoints |
| `specs/042-glyph-refresh/glyph-sheet.py`, `glyph-evidence.png` | the proof |
| `scripts/tests/glyph-refresh.test.js` | new |
| `scripts/tests/{render,segments,payload-first,pr-labels,copilot-parity}.test.js`, `fixtures/composer-bar.txt` | the old marks |
| `README.md`, `docs/previews/*`, composer | glyph tables and regenerated output |

## Risks

- A name in a Nerd Font table is not evidence. The sheet is the check, and it showed
  `F051F` is an hourglass and `F1679` a piggy bank, which are the pictures the review
  meant for "time left" and "savings".
- Effort low, medium and high gauges are close at small sizes. The word beside the glyph
  carries the level, so the glyph is a hint and not the only carrier.
