# Implementation Plan: Something Moves When Something Changes

**Branch**: `003-status-change-animations` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-status-change-animations/spec.md`

## Summary

Four segments already brighten for thirty seconds when they change: branch,
pull request, active skills and model. This adds motion to that mark. The
segment's icon plays a short frame sequence, one frame per render, and settles
back when the window expires.

The work splits the way the spec does. First a generated HTML page plays every
candidate at the real frame rate so the owner can pick before anything is
wired in. Then the chosen sequences go into the renderer's glyph table, driven
by a per-segment frame counter added to the change state file. Then the off
switch.

Nothing new appears on the bar. No segment is added, no segment gets wider,
and with animation off the output is byte-identical to today's.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 18+, matching the rest
of the project

**Primary Dependencies**: None at runtime. The project ships with zero runtime
dependencies and this does not change that. The preview generator reuses
`src/preview/glyphs.json`; regenerating that file needs `fonttools` in a
throwaway virtualenv, which is already how the extractor works.

**Storage**: The existing per-session change state file under
`~/.claude/statusline/state/`, gaining one field. Disposable, pruned after a
week, never required for a render to succeed.

**Testing**: `node scripts/smoke-test.js`, the project's own harness, with
cases added under `scripts/tests/`

**Target Platform**: macOS, Linux and Windows terminals, per Principle IX

**Project Type**: CLI plugin for Claude Code's statusline

**Performance Goals**: No measurable cost per render. The frame lookup is an
array index and the state file is already read and written on every render.

**Constraints**: A frame advances only when Claude Code re-invokes the command:
roughly every 5 to 6 seconds during activity, every 60 seconds at the installed
refresh interval when idle. A thirty-second window is therefore about five
frames, or one. Every frame of a sequence must occupy the same number of
terminal columns. No terminal blink.

**Scale/Scope**: Four animated segments, five candidate sequences, one
generated preview page, one new setting.

## Constitution Check

*GATE: checked before Phase 0 and re-checked after Phase 1.*

| Principle | Gate | Status |
|---|---|---|
| I. Starship-Compatible Output | Every frame glyph is a Nerd Font glyph with a plain-mode substitute; the palette is untouched | Pass. Frames come from the same glyph table added in 4.2.0, and the substitute set animates too (research decision 3) |
| II. Four-Line Display Structure | No segment added, no placement changed, no width changed | Pass. Constant frame width is a requirement (FR-012) and a test (research decision 6) |
| III. Token Tracking Grounded in Real Data | No usage figure is read or displayed differently | Pass. Untouched |
| IV. Installable by Clone | The new setting installs with no extra step | Pass. It is a key in the existing resolver |
| V. Integration Documentation | The setting and its default are documented | Pass, via task T034 |
| VI. English-Only Codebase | All code, comments and docs in English | Pass |
| VII. MVP-First | The preview ships and can be judged before any renderer change | Pass. That is the story split |
| VIII. Documentation Shows Generated Output | Regenerating previews produces no diff | Pass. Preview generation already disables change tracking, which disables animation (research decision 5) |
| IX. Runs on Three Platforms | No platform-specific behaviour | Pass. Frame selection is arithmetic |
| X. Icons Carry Live State | One frame per render, never smooth, never blink; 30-second window; no false positive on first render; discrete state only; one glyph table with a fallback per entry; every glyph rendered and inspected | Pass. This feature is the icon-frame option Principle X already permits, and the sweep evidence is committed as `glyph-candidates.png` |
| XI. Releases Are Tag-Driven | No release mechanics change | Pass |

**Result**: No violations. The Complexity Tracking section is therefore
omitted.

One point worth stating rather than leaving implied: Principle X says the
change mark "MAY be an icon frame sequence advancing one frame per render, or
a colour shift", and this feature does both on the same segment. That is not
the "one meaning per channel" rule being bent. Both carriers say the same
thing, that this segment changed recently, and the rule they must not break is
the one keeping change and level apart. Level still lives only on the three
ramped segments, none of which animates.

## Project Structure

### Documentation (this feature)

```text
specs/003-status-change-animations/
├── plan.md                 # This file
├── spec.md
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/              # Phase 1
│   ├── animations.md       # The frame tables the bar and the page share
│   ├── settings.md         # The new setting
│   └── state.md            # The change state file's new field
├── checklists/
│   └── requirements.md
├── glyph-candidates.png    # Rendering evidence for Principle X
└── animation-board.html    # Generated by scripts/generate-animation-board.js
```

### Source Code (repository root)

```text
src/
├── animations.js           # NEW. Candidate frame tables, nerd and plain,
│                           # and the frame lookup. One place, read by both
│                           # the renderer and the preview generator
├── changeTracker.js        # frames-per-segment counter; iconFor returns
│                           # the frame instead of the static icon
├── config.js               # the `animate` setting
├── render.js               # the four animated segments ask for their frame
└── preview/
    └── glyphs.json         # regenerated with the candidate codepoints

scripts/
├── extract-glyphs.py       # candidate codepoints added
├── generate-animation-board.js  # NEW. Builds the preview page
└── tests/
    ├── animations.test.js  # NEW. Frame tables, widths, sequence order
    └── ...                 # existing cases extended
```

**Structure Decision**: The project is a single flat `src/` of small modules,
one concern each, and this follows it. The frame tables get their own module
rather than living in `render.js` for the same reason the segment registry
does: two consumers need them, and a table inside a render function is a table
nobody else can read.

## Phase 2 approach

Tasks are generated by `/speckit-tasks` from this plan. The intended order:

1. **The preview, end to end** (User Story 1). Candidate tables, the
   extractor's new codepoints, the generator, the page, and the owner's
   decision recorded beside the spec. Nothing in `render.js` is touched.
2. **The animation** (User Story 2). The frame counter in the change state,
   `iconFor` returning a frame, the four segments wired, and the tests for
   width, order, restart, first render and expiry.
3. **The off switch** (User Story 3). The setting, its default, the README,
   and the assertion that the disabled render matches today's bytes.

Story 1 ends at a decision, and story 2 cannot start until that decision
exists, because what it builds is whatever the decision names.
