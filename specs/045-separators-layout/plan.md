# Plan: separators and line 3 grouping

**Spec**: [spec.md](./spec.md)

## Decisions

1. **Styles are a table.** `SEPARATOR_GLYPHS` in `src/theme.js` maps `arrow`, `slant`, `thin`,
   `round` and `ascii` to the glyph between different backgrounds, between equal ones, and the
   glyphs that open and close a run. `separatorStyle()` picks one: ASCII for the plain tier,
   `thin` without colour, the named style when it is one of the four, else `arrow`.
   `separatorFor()` stays for callers that want the one glyph.
2. **`renderRow` builds the chips first, then joins them.** Each chip is a colour pair and a
   text, so the join looks at the previous and the next: a group change closes a run, leaves one
   column and opens another, equal backgrounds take the style's `same` glyph in the previous
   chip's text colour, and different ones take its `between` glyph. A run is closed with the
   style's own glyph, so a pill ends with `E0B4` and an arrow with `E0B0`.
3. **Groups are registry data.** Every line 3 row has `group`: `identity` (orders up to 24),
   `gauges` (30 to 52) and `savings` (53 to 60), which the registry order already keeps
   contiguous. `rowWidth` counts a blank column wherever the group changes, so the fit and the
   drawing agree, and a chip moved to another line takes that line's neighbours.
4. **The pill's caps are `extra`.** Each chip in the round style costs two columns the other
   styles do not, which the renderer puts on the segment as `extra` so `rowWidth` sees it.
5. **Icon-only forms are `variants`.** The CI, working, vim and update chips get their icon as
   the last variant, which `fitToWidth` already steps to before it drops a chip.
6. **The update chip aligns right in the renderer.** The chip carries `alignRight` and the
   registry puts it last on line 1 (order 90). `renderRow` is given the width and, for the last
   chip only, pads the run closed with spaces to the edge. With no room it follows as usual.
   The composer page inlines the same `renderRow`, and is passed the width.
7. **Compact is a composer preset.** One more entry in `PRESETS`, with `dir`, `branch`,
   `model`, `context` and `fiveHour` on line 1.
8. **Two items are rejected, not postponed.** The hairline above the bar is a fourth line,
   which Principle II forbids. Optical padding has no measurable form in a terminal.

## Files

| File | Change |
|---|---|
| `src/theme.js` | `SEPARATOR_GLYPHS`, `separatorStyle`, `renderRow` runs, groups and right alignment |
| `src/layout.js` | `rowWidth` counts group gaps and `extra` |
| `src/segments.js` | `group` on line 3, update at order 90 |
| `src/render.js` | icon-only variants, `alignRight`, `extra` for the pill |
| `src/doctor.js` | `separator:` line |
| `scripts/composer-presets.js` | `compact` |
| `scripts/generate-composer.js`, `scripts/generate-previews.js` | width to `renderRow`; two previews |
| `scripts/extract-glyphs.py`, `src/preview/glyphs.json` | `E0B4 E0B5 E0B6 E0BC` |
| `specs/045-separators-layout/separator-sheet.py`, `separator-evidence.png` | the proof |
| `scripts/tests/separators-layout.test.js` | new |

## Risks

- The thin arrow between equal backgrounds is a new mark on every bar, in every palette. The
  previews all change for it, and the 4.5:1 test still passes since it is a line in the chip's
  text colour.
- Fixtures sat at their width limit; a few were widened by a column or two.
