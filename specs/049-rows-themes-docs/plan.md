# Plan: rows, themes, accessibility modes and docs

**Spec**: [spec.md](./spec.md)

## Decisions

1. **Rows.** `TIERS` in `src/taskRows.js` is by family: `mauve`, `lavender`, `teal`. The cell
   list gets the brief first, so `SHED_ORDER` and `REMEMBERED_COLUMNS` are renumbered by the
   same map (what 0, tier 1, status 2, type 3, skills 4). `alignTaskRows` puts a task after
   its `parentId` and passes a `treePrefix`; most harnesses send none and the rows stay flat.
   The remembered column widths stay, since they are the owner's decision of 2026-09-08.
2. **Gate rows.** `hookGlyph` picks the commit glyph, the push glyph or the waiting glyph from
   the hook's name and state, with the running glyph as the fallback.
3. **Five palettes and `terminal`.** Added to `PALETTES` with all 18 tokens. The terminal's
   tokens are `ansi:N`; `sgr` turns one into the 30s/40s/90s/100s sequences, `chipOf` gives it
   black or bright white text with no ratio, and `readable` passes it through.
4. **High contrast is a mode of the same function.** `chipColours` takes a mode (`HIGH`:
   black and white, 7:1) and keeps its memo per mode. `quietText` returns the strong colour in
   it, since a quieter one would be a lower ratio.
5. **cvd is one branch in `gaugeChip`.** Blue icon, yellow fill, red fill.
6. **Images without a browser.** `scripts/generate-images.js` draws frames with
   `renderPayload` under a throwaway HOME, so the tracker's counter and highlight are real,
   and `scripts/rasterise-ansi.py` paints them with Pillow and the Nerd Font. The Medium
   script's output moves to `docs/article-images/` and is ignored.
7. **The page gets three controls.** The inlined `theme.js` already has `PALETTES`, so the
   page indexes it; the separator is set on the shimmed `process.env` before each draw; the
   emoji pool is built under `CLAUDE_STATUSLINE_ICONS=emoji`. `terminal` is left off the page,
   which draws SVG from RGB.

## Files

| File | Change |
|---|---|
| `src/taskRows.js`, `src/gateRows.js` | rows |
| `src/theme.js`, `src/contrast.js`, `src/ramp.js` | palettes, terminal, high contrast, cvd |
| `scripts/generate-images.js`, `scripts/rasterise-ansi.py` | images |
| `scripts/generate-composer.js` | the page |
| `scripts/preview-fixtures.js` | the new flavor previews |
| `scripts/tests/rows-themes.test.js` | new |
| `README.md`, `docs/images/*`, `.gitignore` | docs |

## Risks

- The editor palettes are mapped from memory of each theme's published colours; the contrast
  algorithm makes the text legible on any of them, so a hex that is a shade off is cosmetic.
- Pillow and a Nerd Font are needed to regenerate the images, and not to use the bar.
