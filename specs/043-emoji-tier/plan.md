# Plan: an emoji icon tier

**Spec**: [spec.md](./spec.md)

## Decisions

1. **The column is picked once per render.** `iconTier({ env, asciiArrows })` in
   `src/config.js` returns `{ tier, source, unknown? }`. `render.js` takes `g = GLYPHS[tier]`,
   so no chip knows which tier it is in. ASCII wins; an unknown value keeps `nerd` and is
   returned for `doctor`.
2. **Fifty entries, chosen once.** The emoji column has the keys of the nerd column. Entries
   come from the review's set and are checked by a test against the committed
   `emoji-data.txt` extract, so a key cannot be given a text-presentation look-alike.
3. **Band marks take the tier.** `bandMark(pct, tier)` returns 🟡 and 🔴 in the emoji tier.
   Every call goes through one local `mark(pct)` in `renderReadings`.
4. **Events are three overrides on the nerd column.** With the switch on and the tier `nerd`,
   conflict, updateDone and the burn icon at a critical 5-hour level take the emoji. Nothing
   else moves.
5. **The separator follows the tier.** The emoji tier draws `▸` unless a separator was named,
   through the `asciiArrows` flag the separator already honours. Glyph choice and separator
   choice stay separate variables inside `renderReadings`.
6. **The preview is one more scenario.** `generate-previews.js` renders the flavor scenario
   with the variable set and writes `emoji-tier.svg`. Emoji are text in the SVG, as the Braille
   spinner already is, so the extractor needs nothing.

## Files

| File | Change |
|---|---|
| `src/config.js` | `iconTier` |
| `src/render.js` | `GLYPHS.emoji`, tier selection, event overrides, `mark` |
| `src/ramp.js` | `bandMark(pct, tier)` |
| `src/doctor.js` | the `icons:` line |
| `scripts/generate-previews.js` | `emoji-tier.svg` |
| `scripts/tests/emoji-tier.test.js` | new |
| `README.md` | three tiers, both variables |

## Risks

- A person on the emoji tier with a Nerd Font installed loses the Powerline arrow by choosing
  it. `CLAUDE_STATUSLINE_SEPARATOR` names one back, and the README says so.
- Emoji draw in the system emoji font, so their baseline can differ. Principle I already
  records that.
