# Item-by-item audit of the 2026-10 design review

Taken against main at 1.49.0 by reading code, specs and tests, then updated for what feature
054 changed. Status: I implemented, O opt-in, R rejected, D deviates from the guide's literal
wording by a recorded decision, F fixed by 054.

| Item | Requirement | Status | Where |
|---|---|---|---|
| A01, A02, A05 | Text colour by contrast, darken in OKLCH | I | `contrast.js`, `theme.js` |
| A03, A04 | Repo into dir chip, neutral chips by default | I | `render.js`, `colourRoles.js` |
| A06 | Flavor from the terminal background | I | `config.js`, `terminalBackground.js` (OSC 11 in install and doctor, 051) |
| A07 | 256-colour fallback | I | `theme.js` colourDepth |
| A08 | Dotted underline on links | O | `CLAUDE_STATUSLINE_UNDERLINE=0` turns it off |
| A09 | NO_COLOR chip edges | D | `▏`, no bold (Principle X); owner kept |
| A10 | Contrast test in CI | I | `contrast.test.js` |
| B11 to B13, B15 to B20 | Colour budget | I | `colourRoles.js`, `ramp.js` |
| B14 | Warm cache icon peach | F | 054 FR-007 |
| C21 to C25 | dir, repo, effort, window, duration, rtk glyphs | I | `GLYPHS` |
| C26 | PR states, review marks, comment count | I | 042, 052 |
| C27 to C30 | push, pull, conflict, untracked, removed, worktree | I | 042, 050 |
| D31 to D40 | Icon tiers, emoji rules, width table | I | 043 |
| E41 | Drop the word `context` | F | 054 FR-006 |
| E42 | Lowercase words | D | 051; owner kept |
| E43 to E46, E48 | Long-form words, figure padding, durations, branch prefixes | I | 044 |
| E47 | Model and effort in one chip | D | two chips, one colour (044); owner kept |
| E49 | `…/` quiet | F | 054 FR-005 |
| E50 | Bold figure, quiet units | I | `STRONG`, `QUIET` (SGR 2 with `CLAUDE_STATUSLINE_DIM=sgr`) |
| F51 | Block mode | O | `CLAUDE_STATUSLINE_BLOCK=1` |
| F52, F53, F55, F56, F60 | Same-bg thin arrow, styles, groups, update chip, compact preset | I | 045 |
| F54 | Optical padding | F | 054 FR-009; `CLAUDE_STATUSLINE_PADDING=wide` for arrows (053) |
| F57, F58 | Long, short and icon form of every chip | F | 054 FR-001; the model chip has none |
| F59 | Hairline | O | `CLAUDE_STATUSLINE_HAIRLINE=1`, an overline |
| G61 to G63, G65 to G67, G69, G70 | Track, eighths, context bands, pace, projection | I | 046 |
| G64 | Alert glyph at critical | F | 054 FR-004 for agent rows |
| G68 | Sparkline | O | `CLAUDE_STATUSLINE_SPARKLINE=1` |
| H71, H72, H75, H77 to H80 | Reset glyph, relative time, tomorrow, relief, cache hourglass | I | 047 |
| H73, H74, H76 | Localised names, locale, 12-hour clock | R | Principle VI |
| I81 to I90 | Spinner, sleeping, your turn, highlight hold, failures, clean tree | I | 048 |
| J91 to J97, J99, J100 | Agent rows, themes, contrast mode, images, composer | I | 049 |
| J98 | cvd ramp blue to orange | D | blue, yellow, red kept (owner, 2026-10-12) |
| K1 to K8, K10, K11 | Constitution amendments | I | 7.10.0 to 8.5.0 |
| K9 | Localised text | R | Principle VI |

## Section 5.3 and 5.2 rows

| Row | Status |
|---|---|
| ciPass F4A4, ciFail F530, ciSkipped F517 | F, 054 FR-002 and FR-003 |
| gateRunning F52E, updateReady F0394, todo F0756, context F09D1, model F167A | F, 054 FR-002 |
| `projection`, `linesChanged`, `credits` as their own keys | not added: the burn chip carries the projection, the lines chip is text, credits reuse `spend` |
| Yellow modified, green added, sapphire behind | F, 054 FR-008 |
| Emoji 🪙 for rtk, 🍵 for cache, text for vim mode | D, the emoji tier's rules (043) |

The code review that followed is in [`review.md`](review.md).
