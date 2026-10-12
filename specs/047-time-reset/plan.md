# Plan: every reset says what it is

**Spec**: [spec.md](./spec.md)

## Decisions

1. **One function writes a moment.** `resetMomentLabel` in `src/timeIcons.js` returns the clock
   time for later today, `tmrw HH:MM`, the lowercase weekday and time for two to five days, and
   the lowercase month and day from six. Every window that names a far-out moment already goes
   through it, so the five chips change together.
2. **The reset glyph is replaced, not added.** `reset` becomes `F04E6` (sync), with `🔄` and
   `↻`; `F06B0` leaves the table and the extractor, so no chip can still draw the clock.
3. **Good news is a fourth marker.** `GOOD` joins `STRONG`, `QUIET` and `MARK_OFF` in
   `src/theme.js`. `renderRow` draws the text after it in `green` made readable on the chip's
   own background (feature 041's `readableOn`), so the 4.5:1 floor holds on a red chip too.
   `gaugeChipText` uses it for a reset under ten minutes on a critical window.
4. **The hourglass is chosen from the cache's TTL.** The glyph is `F078C`, `F051F` or `F06AD`
   by `secondsLeft / ttl` above two thirds, above one third, below. The chip still draws only
   in the cache's closing window, so for a 5-minute TTL it shows the middle and the last third.
   The keys are `cacheWarm`, `cacheWarmHalf` and `cacheWarmLow` in all three tables.
5. **Duration is a threshold.** The chip is built only from 30 minutes, with the glyph of
   feature 042.
6. **The calendar key changes glyph.** `calendar` is `F0A33`, which serves the 7-day window,
   the Codex windows and the Copilot quotas, as it did before.
7. **Casing keeps feature 044's rule.** The review's examples are capitalised and its rule is
   lowercase. The rule, applied in 044, wins.

## Files

| File | Change |
|---|---|
| `src/timeIcons.js` | `resetMomentLabel` forms and the months table |
| `src/render.js` | glyph keys; `good`; duration threshold; hourglass by thirds |
| `src/theme.js` | `GOOD` |
| `scripts/extract-glyphs.py`, `src/preview/glyphs.json` | new codepoints in, old ones out |
| `specs/047-time-reset/glyph-sheet.py`, `glyph-evidence.png` | the proof |
| `scripts/tests/time-reset.test.js` | new |

## Risks

- A test that read `05/09 12:00` or `tomorrow` is moved to the new forms.
- The hourglass in the plain tier is one glyph for three states, since no narrow set has
  three hourglasses; the emoji tier has two.
