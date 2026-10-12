# Plan: readable chips in every palette

**Spec**: [spec.md](./spec.md)

## Shape

```
renderRow(palette, segments)
  for each chip: colours = chipColours(palette, bgHex)      src/contrast.js, memoised
                 { fg, bg }  bg darkened in OKLCH if no candidate reaches 4.5:1
  emit: depth = colourDepth()                               truecolor | 256 | none
        sgr(fg), sgr(bg)                                    one emitter, shared with taskRows, gateRows

flavor: env > .statusline.json > COLORFGBG light -> latte > mocha          src/config.js
```

## Decisions

1. **Colour maths in one pure module.** `src/contrast.js` holds sRGB luminance, the WCAG ratio,
   hex to OKLab and OKLCH and back, `chipColours(palette, bg)` and `lightenOklch(hex, ratio)`.
   It imports nothing, so the suite tests it directly with the ten Latte values.
2. **Candidates in a fixed order.** `crust`, `text`, `#11111b`, `#ffffff`, and the first one
   with the highest ratio wins, so a tie goes to `crust`. Mocha accents keep `crust`; the
   `surface` chips take `#ffffff`, which beats `text`. Frappé, Macchiato, Nord and Gruvbox
   accents may move from `crust` to the slightly darker `#11111b`.
3. **Darkening.** OKLCH lightness drops 0.04 per step, chroma and hue kept, clipped to sRGB.
   The result is `{ fg, bg }`, and `bg` replaces the palette colour for that chip only. The
   separator arrow takes its colours from the same result, so no seam appears.
4. **Memoise per palette object.** A `WeakMap` from palette to a `Map` from background hex to
   the result. No key string is built on the hot path beyond the hex.
5. **256 colours without a generated file.** The spec planned a committed table. Deriving the
   quantised palette once at load is simpler and cannot drift: each token maps to the nearest
   index in 16 to 255 by OKLab distance, and `chipColours` runs on the quantised colours, so
   the 4.5:1 guarantee holds on what the terminal draws. Literal hex and lightened colours are
   quantised on use and memoised. Indices 0 to 15 are never used, because themes remap them.
   The spec is edited to match.
6. **One emitter.** `fg()` and `bg()` in `src/theme.js` become exported `fgSeq` and `bgSeq`
   taking the depth. `src/taskRows.js` and `src/gateRows.js` have their own 38;2 builders and
   switch to these, so a 256-colour terminal is not served truecolor by a side door.
7. **Depth from `COLORTERM`, per call.** `truecolor` or `24bit` gives 24-bit. Any other set
   value gives 256, and so does an unset one in Apple Terminal (`TERM_PROGRAM`). An unset
   `COLORTERM` elsewhere stays 24-bit, because Windows Terminal and some SSH setups draw
   truecolor and do not set it. `NO_COLOR` still wins. Read per call like `NO_COLOR`, so a test sets it around
   one render.
8. **Flavor from the terminal.** `resolveSettings` gets `flavorSource` and falls back to
   `COLORFGBG` before `mocha`. `doctor` reports the source. No OSC 11: the command cannot read
   a terminal reply inside its budget, and its output is piped.
9. **Repository text moves into the directory chip.** The chip's text becomes
   `<icon> <dir>` then a dim `owner/repo`. Links are embedded, not whole-chip, because a chip
   has one `url` and the two parts go to different places. `link(url, text)` is exported from
   `src/theme.js` and draws the dotted underline where supported. `displayWidth` already strips
   OSC 8; its CSI pattern gains `:` so `\x1b[4:4m` is not counted as text.
10. **Underline support is a table.** Environment markers for kitty, WezTerm, iTerm2, Windows
    Terminal, VTE 5000 or later and Ghostty, in one array in `src/theme.js`. Unknown means no
    underline.
11. **NO_COLOR edge.** Under `NO_COLOR`, `renderRow` prefixes each chip with `▏` and U+258F
    joins `AMBIGUOUS`, so width follows `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE`.
12. **The neighbour rule is a test.** A fixture with every segment present is rendered in each
    palette and adjacent different backgrounds are asserted at 1.6:1 or more.

## Files

| File | Change |
|---|---|
| `src/contrast.js` | new: luminance, ratio, OKLab, `chipColours`, `lightenOklch` |
| `src/theme.js` | `renderRow`, `fgSeq`/`bgSeq`, depth, `link`, `lighten` via contrast, AMBIGUOUS, CSI pattern |
| `src/taskRows.js`, `src/gateRows.js` | use the shared emitter |
| `src/config.js` | flavor from `COLORFGBG`, `flavorSource` |
| `src/doctor.js` | flavor line names the terminal as the source |
| `src/render.js` | repo text inside the directory chip; trim drops it first |
| `scripts/tests/contrast.test.js` | new: ratios, Latte table, all segments x six palettes, neighbours, depth, `NO_COLOR` |
| `docs/previews/*` | regenerated |
| `README.md` | flavor and `COLORTERM`, `COLORFGBG` |

## Risks

- A palette that cannot reach 4.5:1 even at lightness 0. None here; the test names it.
- A terminal that sets `COLORFGBG` wrongly picks Latte unasked. A set flavor always wins and
  `doctor` says where the choice came from.
- Dropping the repository chip removes its separate link. The branch chip keeps the remote
  link, and the repository text inside the directory chip carries its own.
- Redraw budget: memoisation keeps the added work to a map lookup per chip.
