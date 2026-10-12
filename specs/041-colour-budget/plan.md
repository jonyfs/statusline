# Plan: one meaning per colour

**Spec**: [spec.md](./spec.md)

## Decisions

1. **The budget lives in one module.** `src/colourRoles.js` exports `ROLE` (role name to token,
   one token per role) and `SEGMENT_COLOURS` (segment key to the roles its fill and its icon may
   take). `src/render.js` reads tokens from `ROLE`, so a colour name is written once. The test
   checks that no token is claimed by two roles, that every segment key has an entry, and that
   every fill a render pool carries is one its key may take.
2. **A fill, an icon and a tone are three fields.** A segment already has `color` (the fill).
   It gains `icon`, the token for the first word of its text (the glyph, or `+N` on the lines
   changed chip), and `tone`, a token for all of its text. Both are drawn through `readableOn`,
   which moves a token's lightness in OKLCH until it reaches 4.5:1 on the chip, so a green icon
   on Latte's `surface0` is a darker green rather than a failing one. The fill's own text still
   comes from feature 040.
3. **One gauge helper.** `gaugeChip(pct, text, variants)` in `src/ramp.js` returns the fill, the
   icon and the band: ok is `surface0` with a `green` icon, warn is `peach`, critical is `red`,
   unknown is `surface0` with no icon. Every ramped chip (context, 5h, 7d, spend, quotas, Codex
   window, AI credits, burn rate) goes through it, so the colours cannot drift between them.
4. **The single red is decided after the lines are built.** Each gauge carries `pct` and `band`.
   A pass over the finished segments finds the critical ones, keeps the highest percentage red
   (the first in line order on a tie), and gives the rest `surface0` with `tone: red`. It runs
   before shedding, so a shed gauge cannot hand the red to another by being absent.
5. **`surface0` joins the palettes.** The four Catppuccin values, Nord's `#434c5e` and Gruvbox's
   `#3c3836`. The composer page reads its colours from the palettes, so it needs no change.
6. **The highlight is a flag.** `changeTracker` gains `recent(key)`; `colourFor` returns the
   base colour unchanged. A segment with `emphasis: true` is drawn with SGR 1 and 4 around its
   text and 22 and 24 after. `lighten()` stays exported for anything else that calls it, and
   the change highlight no longer does.
7. **The legend is built from `ROLE`.** `doctor --explain` prints one line per role with a
   swatch (a filled chip in the role's token through the same `fg`/`bg` emitters), the token
   name and the meaning. Under `NO_COLOR` the swatch is omitted.
8. **Where a role is silent.** Segments whose old colour left the budget go to `surface0`:
   projectDir, worktree, update, vim, duration, effort, fast, premium count, working-tree
   state, dir, repo. `gates` stays `peach` (a gate holding the repository asks for attention).
   `projection` becomes `peach`: it is a forecast of the limit, and red belongs to a limit
   reached.

## Files

| File | Change |
|---|---|
| `src/colourRoles.js` | new: `ROLE`, `SEGMENT_COLOURS` |
| `src/theme.js` | `surface0` in six palettes; `icon`, `tone`, `emphasis` in `renderRow` |
| `src/contrast.js` | `readableOn(hex, bg)` |
| `src/ramp.js` | band colours; `gaugeChip` |
| `src/render.js` | every segment's colour from `ROLE`; the single red pass; skills flamingo; PR merged |
| `src/changeTracker.js` | `recent(key)`; no lightening |
| `src/doctor.js` | the legend in `--explain` |
| `scripts/tests/colour-budget.test.js` | new |
| `scripts/tests/*` | tests that encode the old colours are updated to the budget |
| `docs/previews/*`, `README.md` | regenerated, colour section |

## Risks

- Existing tests assert the old colours (`ramp`, `render`, `bar-polish`). Each is updated to
  the budget in the same commit, and the diff says which.
- The composer page and its pool carry a token per segment; `surface0` must be known to its
  swatches. The `composer-current` check proves it.
- A tie for the highest critical percentage must be stable across redraws or the red would
  flicker; line order is fixed, so it is.
