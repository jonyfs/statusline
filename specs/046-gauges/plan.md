# Plan: gauges that show a level and a pace

**Spec**: [spec.md](./spec.md)

## Decisions

1. **Pure functions in `src/ramp.js`.** `track`, `paceBand`, `contextBand` and `eighthsBar`
   take numbers and a glyph column and return strings or a band, so the suite tests them at
   0, 10, 50, 90, 100 and unknown without a render. `gaugeChip(pct, band)` takes the band as
   an argument now, so pace and the context's own limits decide it and the absolute bands are
   the fallback.
2. **One builder for the chip text.** `gaugeChipText` in `src/render.js` composes icon, label,
   track, figure, pace note and reset, and returns the text and its variants: no track, then
   no reset. Every gauge (context, 5h, 7d, Codex window, spend, the Copilot quotas) goes
   through it, so they cannot drift.
3. **The band mark is part of the figure.** The critical alert glyph takes the place of the
   figure's leading space when it is one column, so a figure crossing 85 does not move its
   neighbours; the warn band is the bold figure, with no glyph. The emoji tier uses its
   circles, and the plain tier `!`.
4. **Pace needs a window length.** `elapsedPct` reads how much of a window has gone from its
   reset and its length: 300 minutes, 10,080, or the Codex window's own `window_minutes`.
   A reset in the past or further out than the window is unknown, and the absolute bands
   apply. The spend limit and the Copilot quotas have no length in the payload and keep them.
5. **The track is drawn from the plain set outside the Nerd Font tier.** The cells are
   private-use glyphs, so the emoji tier draws `|` and `.` too. The emoji column still has an
   entry for each track key so the three tables keep one set of keys.
6. **The projection is merged and its key removed.** The burn chip says the rate, then
   `full ~HH:MM` when the window would be full before it resets. The registry's `projection`
   row goes, because the pool test requires every row to draw something, and an arrangement
   that names it is ignored as any unknown key is.
7. **The sparkline is a function of the history.** `sparkline(samples, field, count)` in
   `src/samples.js` returns null below eight samples. It is drawn only with
   `CLAUDE_STATUSLINE_SPARKLINE=1`.
8. **The agent rows' bar is eight cells of eighths.** `eighthsBar` replaces the shade bar in
   `src/taskRows.js`; the critical band draws `!` before the figure. The shade `bar` stays
   exported for the width tests that cover it.
9. **The width set grows.** U+2589 to U+258F, U+2581 to U+2587 and U+2014 are Ambiguous and
   join `AMBIGUOUS`, with tests, so the switch widens them like the rest.

## Files

| File | Change |
|---|---|
| `src/ramp.js` | `track`, `paceBand`, `contextBand`, `eighthsBar`; `gaugeChip` takes a band; `bandMark` goes |
| `src/render.js` | `gaugeChipText`, `gaugeFigure`, `elapsedPct`; merged burn chip; glyph keys |
| `src/samples.js` | `sparkline` |
| `src/taskRows.js` | the eight-cell bar |
| `src/theme.js` | the Ambiguous set |
| `src/segments.js`, `src/colourRoles.js`, `scripts/composer-presets.js` | `projection` removed |
| `src/config.js` | `contextBands` |
| `scripts/extract-glyphs.py`, `src/preview/glyphs.json` | `EE00` to `EE05` |
| `specs/046-gauges/gauge-sheet.py`, `gauge-evidence.png` | the proof |
| `scripts/tests/gauges.test.js` | new |

## Risks

- The track adds six columns to every gauge, so a line that fitted now steps down sooner, and
  fixtures that sat at their width were widened. The order the guard steps in keeps the figure.
- The unknown dash replaces `?%`, which tests and the README described. Both are updated.
