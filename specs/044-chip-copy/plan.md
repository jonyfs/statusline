# Plan: tighter chip copy

**Spec**: [spec.md](./spec.md)

## Decisions

1. **Short forms are `variants`.** The width guard already steps a chip through
   `variants` before it drops it, so a chip's short form is one more entry there: context,
   rtk, the pull request, a warm cache and a cold cache. The long form keeps its words.
2. **One padding function.** `pad3` pads a figure to three characters with U+2007, and
   `figure(n)` adds the `%` and the bold marker. Every gauge chip and the credits level use it,
   so the padding cannot drift between them. U+2007 is East Asian Narrow and `displayWidth`
   counts it as one column already.
3. **Durations in two places.** `formatDuration` and `shortCountdown` in `src/tokens.js` drop
   the trailing `m` after an hour and the `0h` before minutes. `formatResetCountdown`, which
   `doctor` prints with its words, is unchanged.
4. **The reset glyph is a table key.** `reset` is in the nerd, emoji and plain columns
   (`F06B0`, `🔁`, `↺`), added to the extractor, and drawn on a proof sheet in
   `specs/044-chip-copy/`. It replaces the dot in the 5-hour, 7-day, Codex window, spend and
   Copilot quota chips. The dot that separates a cache's cause stays: it is not a reset.
5. **Lowercase at the source.** The weekday and month tables, the SDD step labels and the
   words in the builders are lowercase where they are written, not lowered afterwards, so
   data keeps its case.
6. **Model and effort share a colour, not a chip.** Effort is drawn on the model's identity
   colour beside it, so they read as one block, and each keeps its key for arrangements,
   shedding and the composer. The roles table gives `effort` the identity role.
7. **Branch and directory names live in `src/names.js`.** `abbreviateBranch` takes a prefix
   map (`DEFAULT_BRANCH_PREFIXES`, or `branchPrefixes` from `.statusline.json`) and
   `cutMiddle` keeps the head and the tail by columns. The link still names the whole branch.
   The directory's left cut gains `/` after the ellipsis and reserves its width.
8. **Weight and quiet are three markers.** `STRONG`, `QUIET` and `MARK_OFF` are C0 control
   characters, which the text boundary already removes from data. `renderRow` turns them into
   `SGR 1` and the quiet text colour of feature 041, `displayWidth` and the pool ignore them,
   and under `NO_COLOR` they are removed with nothing in their place.

## Files

| File | Change |
|---|---|
| `src/render.js` | chip text and variants, `pad3`, `figure`, markers, reset glyph, branch, effort colour, `…/` |
| `src/tokens.js` | durations |
| `src/timeIcons.js`, `src/copilotQuota.js`, `src/skills.js` | lowercase tables |
| `src/names.js` | new: prefixes and the middle cut |
| `src/theme.js` | markers, width |
| `src/config.js` | `branchPrefixes` |
| `src/colourRoles.js` | `effort` is identity |
| `scripts/extract-glyphs.py`, `src/preview/glyphs.json` | `F06B0` |
| `specs/044-chip-copy/glyph-sheet.py`, `glyph-evidence.png` | the proof |
| `scripts/tests/chip-copy.test.js` | new |
| `scripts/tests/*` | old copy updated; widths raised where a fixture sat at its limit |

## Risks

- Padding adds a column per two-digit figure, so a fixture that sat at its limit now sheds
  its last chip. Short forms recover that room at narrow widths.
- The lowercase rule changes text people may grep for (`Context`, `Implementing`). The README
  says so.
