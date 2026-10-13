# Coverage of the 2026-10 design review

The review file is not in the repository. This map lists where each range of its catalog
(items A01 to J100) and each constitution amendment (K1 to K11) was handled. Item-level
requirements sit in the spec of the feature named in each row.

## Items

| Items | Feature | Notes |
|---|---|---|
| A01 to A10 | 040 contrast | A06 (terminal background) reworked in 051: `install` and `doctor` ask with OSC 11 and remember the answer. A07 (colour depth) added in 050, tmux case corrected in 051. A08 and A09 in 050 and 044. |
| B11 to B20 | 041 colour budget | B16 (skills joined by `E0B5`) in 050. |
| C21 to C30 | 042 glyph refresh | C29 (staged and removed counts) in 050. C26 (review comments) in 052, from the `comments` field of the pull request query. |
| D31 to D39 | 043 emoji tier | Rejection list recorded in the constitution (8.6.1). |
| E41 to E50 | 044 chip copy | E42 lowercase kept, decided in 051. |
| F51 to F60 | 045 separators and layout | F51 block mode in 050. F54 settled in 051 (pill drops inner padding). F59 is `CLAUDE_STATUSLINE_HAIRLINE=1`, an overline, decided in 051. Wide arrow padding is opt-in in 053. |
| G61 to G70 | 046 gauges | G68 sparkline opt-in in 050. |
| H71, H72, H75, H77 to H80 | 047 time and reset | |
| H73, H74, H76 | none | Rejected by Principle VI (localised weekday and month names, a locale setting). |
| I81 to I90 | 048 state feedback | Sleeping line 2 corrected in 051. |
| J91 to J100 | 049 rows, themes, docs | J98 kept blue, yellow, red, reason in 051. |
| Sections 5.4 to 5.7 | 052 | Second diff against the guide's drawings. |
| Section 5.3 rows, F57, G64, E49 | 054 | From the item-by-item audit of 2026-10-12. |

## Amendments

| Amendment | Disposition |
|---|---|
| K1 to K8, K10, K11 | Adopted. Constitution reports in `.specify/memory/constitution.md`, versions 7.10.0 to 8.6.1. |
| K9 | Rejected by Principle VI (localised text). |

## Opt-in or not enforced

Each row below was approved by the owner on 2026-10-12 (see the 053 spec).

- SGR 2 dim: `CLAUDE_STATUSLINE_DIM=sgr`. The default quiet colour keeps 4.5:1.
- Wide arrow padding: `CLAUDE_STATUSLINE_PADDING=wide`. Costs a column a chip.
- 25 ms redraw target: reported by `scripts/bench.js`, not enforced. p95 was 26.0 ms, so it
  reads not met. The 300 ms budget is the enforced one.
- Overline and rasterised proof images depend on the terminal and the machine.

## Owner decisions superseded

- Context figure colour-only exception, 2026-08-26 (retired in 051).
- No progress bar on the shared line, 2026-08-26 (superseded by the track in 051).
- Agent row column order, 2026-09-08 (the brief leads, feature 049).
