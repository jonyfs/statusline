# Implementation Plan: The bar keeps counting after the limit is lifted

**Branch**: `feat/extra-usage-limit` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-extra-usage-limit/spec.md`

## Summary

Read the payload's `rate_limits.spend_limit`, which Claude Code sends behind a Claude gateway
and which the bar has ignored until now, and draw it as a `spend` chip on line 3. Mark an
exhausted 5-hour or 7-day window with the word `full`, so a figure that cannot move reads as
used up rather than stuck. Report all three allowances in `doctor`. Amend Principle III to
list the new field. Research is in [research.md](research.md), shapes in
[data-model.md](data-model.md) and [contracts/output.md](contracts/output.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18+

**Primary Dependencies**: none at runtime. Python with fontTools and Pillow for glyph
extraction and the evidence sheet, dev only.

**Storage**: none new. The at-limit state is derived per render.

**Testing**: the in-repo harness, `npm test` (`scripts/smoke-test.js` runs `scripts/tests/*.test.js`)

**Target Platform**: Linux, macOS and Windows terminals (Principle IX)

**Project Type**: CLI statusline command

**Performance Goals**: stays inside the 300 ms redraw budget. The change adds two field reads
and no I/O.

**Constraints**: 120-column line limit with priority shedding. Plain mode and `NO_COLOR` must
stay complete. The only allowance data is what the payload carries.

**Scale/Scope**: about 6 source files, 1 new test file, README, constitution.

## Constitution Check

| Principle | Status |
|---|---|
| I. Starship-compatible output | Pass. The new chip is one more powerline segment. The glyph is a Nerd Font glyph with a recorded render. |
| II. Three-line structure | Pass. The chip belongs on line 3, which already carries the limits. |
| III. Real data only | **Amendment required** (FR-013). The field list gains `spend_limit`, and that figure may exceed 100%. No figure is estimated. Done as a MINOR bump in this feature, before the code ships. |
| IV. Installable by clone | Pass, no install change. |
| V. Integration docs | Pass once README documents the chip (FR-012). |
| VI. English-only | Pass. All strings and docs in English. |
| VII. MVP first | Pass. Story 1 and Story 2 each ship on their own. |
| VIII. Generated docs output | Pass once the README image is regenerated with `npm run previews`, never drawn. |
| IX. Cross-platform | Pass. No platform-specific code. |
| X. Icons carry live state | Pass. Glyph row with a plain substitute, codepoint added to `scripts/extract-glyphs.py`, evidence at `glyph-evidence.png`. The chip keeps the band mark, so its level is not carried by colour alone. |
| XI. Releases | Not affected. Ship by merge, no tag (project memory). |
| XII. Spec declares completion | Pass. `track: full`, so spec, plan and tasks complete it. |

Re-checked after design: no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/023-extra-usage-limit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── glyph-evidence.png
├── contracts/output.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── tokens.js      # getRateLimits gains spend-limit keys; formatResetCountdown gains a bound option
├── segments.js    # spendLimit registry row and its SEGMENT_ABOUT sentence
├── render.js      # readings, spend glyph rows, spendLimit chip, `full` on 5h/7d chips
└── doctor.js      # DESCRIBE row and the gateway absence reason
scripts/
├── extract-glyphs.py         # F0584 added
└── tests/spend-limit.test.js # new
src/preview/glyphs.json       # regenerated
README.md                     # chip documented, previews regenerated
.specify/memory/constitution.md  # Principle III amended, 6.2.0
```

**Structure Decision**: the existing single-project layout. Every change goes into a file that
already owns that concern. No new module.

## Complexity Tracking

No violations to justify.
