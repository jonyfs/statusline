# Implementation Plan: The bar says when the prompt cache goes cold, and why it did

**Branch**: `feat/prompt-cache-chip` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-prompt-cache-chip/spec.md`

## Summary

Read the payload's `prompt_cache` block and draw a chip on line 3 when the cache is cold, or
warm and about to go cold. A warm chip counts whole minutes down in the warning colour. A cold
chip shows the tokens the next request writes again and the likely cause of the loss, which
narrow terminals shed first. `doctor` reports the whole block. The block's shape was confirmed
from the builder in the installed Claude Code binary ([research.md](research.md) R1). Shapes are
in [data-model.md](data-model.md) and [contracts/output.md](contracts/output.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18+

**Primary Dependencies**: none at runtime. Python with fontTools and Pillow for glyph
extraction, dev only.

**Storage**: none. The state is derived on each redraw.

**Testing**: `npm test`, which runs in a throwaway HOME since 2026-09-29

**Target Platform**: Linux, macOS and Windows terminals

**Project Type**: CLI statusline command

**Performance Goals**: inside the 300 ms redraw budget; the change reads one payload block and
does no I/O

**Constraints**: 120-column line with priority shedding; plain mode and `NO_COLOR` complete;
only payload data on the bar

**Scale/Scope**: about 6 source files, one new test file, README, constitution

## Constitution Check

| Principle | Status |
|---|---|
| I. Starship-compatible output | Pass. One more powerline segment with Nerd Font glyphs. |
| II. Three-line structure | Pass. Line 3 already carries what is being spent. |
| III. Real data only | **Amendment required** (FR-012), to 6.3.0: `prompt_cache` joins the displayed fields. Nothing is estimated; minutes come from the payload's own `expires_at`. |
| IV. Installable by clone | Pass. |
| V. Integration docs | Pass once the README section lands (FR-011). |
| VI. English only | Pass. Cause phrases are English. |
| VII. MVP first | Pass. Story 1 or 2 alone is shippable. |
| VIII. Generated docs output | Pass with a new generated preview. |
| IX. Cross-platform | Pass. No platform code. |
| X. Icons carry live state | Pass. Two icons, one per state, rendered evidence in `glyph-evidence.png`, plain substitutes in the table, codepoints added to `scripts/extract-glyphs.py`. |
| XI. Releases | Not affected; ship by merge. |
| XII. Spec declares completion | Pass. `track: full`. |

Re-checked after design: no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/025-prompt-cache-chip/
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
├── tokens.js      # getPromptCache()
├── segments.js    # promptCache row and SEGMENT_ABOUT sentence
├── render.js      # reading, glyph rows, chip builder with variants
├── layout.js      # fitToWidth tries a segment's variants before dropping it
├── freshness.js   # MAX_AGE_MS entry
└── doctor.js      # DESCRIBE row and absence reasons
scripts/
├── extract-glyphs.py            # F050F, F0717
├── preview-fixtures.js          # a cold-cache preview
├── composer-fixture.js          # prompt_cache, so the pool draws the chip
└── tests/prompt-cache.test.js   # new
src/preview/glyphs.json          # regenerated
README.md
.specify/memory/constitution.md
```

**Structure Decision**: the existing single-project layout; every change goes into the file
that already owns that concern.

## Complexity Tracking

No violations to justify.
