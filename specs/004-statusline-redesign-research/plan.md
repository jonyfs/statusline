# Implementation Plan: Research It, Then Let the Owner Build the Bar

**Branch**: `004-statusline-redesign-research` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-statusline-redesign-research/spec.md`

## Summary

The bar's shape lives in `src/segments.js`, where each of the twenty-four
segments declares a line, an order, an alignment, a priority and a colour.
This feature keeps that table as the default and lets an arrangement sit on
top of it: a small file saying which segments are on, what order they take,
and which line they belong to. Nothing else about a segment can be
overridden, so priority stays a decision taken once in source rather than one
taken again in every arrangement.

The arrangement is built in a browser page, generated the way the animation
board was for feature 003 and self-contained the same way. What is new is
that the page is editable. It carries the real segment values for a fixed
sample session, imports the renderer's own layout, palette and drawing
modules, and redraws the bar as segments are switched off, reordered or moved
between lines. Because the composition runs through the same
`fitToWidth`, `alignColumns` and `renderRow` the terminal runs through, the
page cannot show a bar the renderer would draw differently.

Six presets ship with it, from the bar as it stands today to a single-line
design that the four-line structure forbids and that is labelled as
requiring an amendment. The owner starts from whichever preset is closest,
edits from there, and copies out the arrangement. That arrangement then
becomes two things: the file anybody can use to get their own bar, and, once
the owner has settled, the new contents of the registry that a fresh install
draws.

The research runs alongside and lands as a record: what a redraw costs by
source, how each source fails, and what comparable tools show that this bar
does not.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 18+, matching the rest
of the project. The browser half is the same language and the same modules,
loaded as ES modules inside one generated HTML file.

**Primary Dependencies**: None at runtime, and none added. Principle IV makes
zero dependencies a structural requirement rather than a preference, so the
page ships no framework, no bundler output and no CDN reference. It reuses
`src/preview/glyphs.json` for Nerd Font outlines, as the SVG previews and the
003 board already do.

**Storage**: A new optional arrangement file. Two locations, the repository's
existing `.statusline.json` (new `layout` key) and a per-user
`~/.claude/statusline/layout.json`. Both are optional; absent means the
registry default, unchanged.

**Testing**: `node scripts/smoke-test.js`, the project's own harness, with
new cases under `scripts/tests/`. The page gets the same treatment the 003
board got in `animation-board.test.js`: generated in a temporary directory
and asserted against, rather than eyeballed.

**Target Platform**: macOS, Linux and Windows terminals for the bar, per
Principle IX. Any current browser opening a `file://` URL for the page, with
no server and no network.

**Project Type**: CLI plugin for Claude Code's statusline.

**Performance Goals**: No measurable redraw cost. Resolving an arrangement is
reading a small JSON file already on the same path as `.statusline.json` and
merging at most twenty-four entries over the registry. The measured 95th
percentile must not move against the recorded 25 ms baseline.

**Constraints**: The 300 ms redraw budget. The four-line structure and the
shedding order in Principle II. Priority is not arrangeable. Output with no
arrangement present must be byte-identical to the default. The page must
work with no Nerd Font installed, because half of what it exists to show is
the substitute set.

**Scale/Scope**: Twenty-four segments, one arrangement resolver, one
generated page, six presets, one config precedence rule, one registry change
at the end.

## Constitution Check

*GATE: checked before Phase 0 and re-checked after Phase 1.*

| Principle | Gate | Status |
|---|---|---|
| I. Starship-compatible output | Presets and arrangements keep the palette, the `[ $content ]` block shape and the Powerline separator; no preset introduces a colour outside the flavour's tokens | Pass. The page draws through `renderRow`, so a preset cannot use anything the renderer cannot |
| II. Four-line structure | An arrangement moves segments between the four lines and may empty one, which the structure already allows since an empty line is dropped. A preset that leaves the four-line shape is a violation | Pass with a recorded exception. The single-line preset is marked on the page as requiring an amendment (FR-038), and adopting it amends Principle II in the same change (FR-039). See Complexity Tracking |
| II. Placement is declared, not implied | Every segment still declares its default line, order, alignment, priority and colour in `src/segments.js`. The arrangement overrides line, order and presence only | Pass. Priority and colour stay in source, so narrow-terminal behaviour and colour meaning remain decisions taken once |
| III. Token tracking grounded in real data | No change to what any figure means or where it comes from | Pass |
| IV. Installable by clone, zero runtime dependencies | No dependency added. The page is generated by a plain Node script and is self-contained | Pass |
| V. Integration and configuration guide | README already promises module order as a customization option and now has to document it for real, plus the precedence between the two file locations | Gate: README section required before the feature closes |
| VI. English-only codebase | Spec, plan, code, page text and CLI output in English | Pass |
| VII. MVP-first | Story 1 alone is shippable and answers the question. Stories 2, 3 and 4 each stand on their own | Pass |
| VIII. Documentation shows generated output | The page is generated from the renderer, not drawn. Adopting a new default requires regenerated previews in the same commit | Gate: previews regenerated in the story 3 change |
| IX. Runs on Linux, macOS and Windows | The generator writes with `node:path` and `node:fs`, never a shell. The 003 board test is the precedent for asserting that on every platform | Pass |
| X. Icons carry live state | No glyph added, removed or changed. The page shows both the glyph and its declared substitute from the same table the renderer uses | Pass |
| XI. Releases are tag-driven and verified | Unchanged | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/004-statusline-redesign-research/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── arrangement.md   # The arrangement file, and how it is resolved
│   └── composer.md      # What the page must offer and hand back
├── checklists/
│   └── requirements.md
├── composer.html        # Generated by scripts/generate-composer.js
├── arrangements/
│   └── previous.json    # The bar as it was, kept restorable at story 3
├── decisions.md         # Written when the owner settles
└── tasks.md             # /speckit-tasks output, not created here
```

### Source Code (repository root)

```text
src/
├── arrangement.js       # New. Resolves an arrangement over the registry
├── config.js            # Gains the layout key and the user-level file
├── segments.js          # Default table. Rewritten once, at story 3
├── render.js            # renderReadings builds a pool, then arranges it
├── layout.js            # Unchanged. Reused as-is by the page
├── theme.js             # Unchanged behaviour; guarded for a browser global
├── doctor.js            # Reports the arrangement in force and what it ignored
└── preview/
    ├── ansiToSvg.js     # Gains a factory so the page can pass its own glyphs
    └── glyphs.json      # Unchanged

scripts/
├── generate-composer.js # New. Writes specs/004-.../composer.html
├── composer-presets.js  # New. The six presets, shared with the tests
├── composer-fixture.js  # New. The fixed session the page draws from
├── generate-previews.js # Unchanged, rerun at story 3
└── tests/
    ├── arrangement.test.js
    ├── composer.test.js
    └── (existing cases, several extended)

docs/previews/*.svg      # Regenerated at story 3
README.md                # Configuration section, at story 2
```

**Structure Decision**: The existing single-project layout. One new module in
`src/`, three new scripts, two new test files. No new directory and no new
top-level concept: an arrangement is the registry with three of its columns
allowed to come from elsewhere.

## How the page stays honest

This is the part worth stating before any code is written, because it is
where a page like this usually goes wrong. The obvious build is a mockup
that approximates the bar in HTML and CSS. That page drifts from the renderer
the first time a segment changes, and Principle VIII exists because this
project has already decided not to accept that.

Instead the page is given two things at generation time. The first is a pool
of built segments for one fixed sample session: for every key, the exact
`{ key, text, color, url }` object the renderer would have produced, taken
from `renderReadings` rather than written by hand. The second is the
renderer's own code, inlined: `layout.js` for fitting and alignment,
`theme.js` for the palette and the Powerline chain, `arrangement.js` for
resolution, and a glyph-aware ANSI-to-SVG drawer built from the same
`glyphs.json` the committed previews use.

Composition in the browser is then the same call sequence as composition in
the terminal, on the same data, through the same functions. The page has no
opinion of its own about how wide a segment is or what gets dropped at 80
columns, because it does not implement either.

Two small changes make that possible, and both are worth doing on their own
merits. `renderReadings` gains a way to return the built pool before it is
arranged, which is also what a future diagnostic wants. And `ansiToSvg`
gains a factory taking the glyph table as an argument, so it stops reading a
file at module load, which is what makes it importable anywhere.

## Phase sequence

The stories are independent, and this is the order they are worth doing in.

**Story 1, the page.** Fixture, pool export, ANSI-to-SVG factory, presets,
generator, page. Ends with the owner producing an arrangement and
`decisions.md` recording it. Nothing in `src/render.js` changes behaviour
yet: the pool export is additive.

**Story 2, the bar obeys.** `src/arrangement.js`, the config precedence, the
row assembly change in `renderReadings`, the diagnostic reporting, the README
section. Ends with an arrangement copied out of the page rendering the same
bar in the terminal.

**Story 3, the new default.** The chosen arrangement is folded into
`src/segments.js`, previews are regenerated, README images and text are
updated, the previous bar is committed as a named arrangement anybody can
restore, and Principle II is amended if the choice requires it.

**Story 4, the record.** Measurements and failure-mode notes gathered while
the above happens, closed out as adopted or declined.

## Constitution re-check, after Phase 1

Re-run against the design artifacts rather than the summary. Nothing moved.

- The arrangement contract keeps priority, colour and alignment in source, so
  Principle II's declared-placement rule and Principle X's one-meaning-per-
  colour rule are unaffected by anything a person can write in a file.
- The composer contract forbids the page from probing the machine and
  requires byte-identical regeneration, which is Principle VIII's
  reproducibility rule applied to a page rather than to an image.
- No dependency appears anywhere in the design. The page's only inputs are
  files already in the repository.
- The one violation stays the one already recorded: a preset that is not four
  lines. It is labelled on the page, and adopting it amends Principle II in
  the same change.
- One gate is now explicit rather than implied: `README.md` gains a
  configuration section for the arrangement, including the precedence table,
  before the feature closes. Principle V requires module order to be
  documented, and until now the project has promised that without offering it.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| A preset that is not four lines | The spec asks for at least one design that departs sharply rather than refines, and every trend the research found argues for less density than this bar has. A departure that stays inside the current shape is not a departure | Offering only conforming presets would make the board unable to ask the one question worth asking. The cost is bounded: the preset is labelled on the page, and adopting it requires amending Principle II in the same change rather than quietly contradicting it |
| Renderer code running in a browser | It is the only way the page can be trusted to show what the terminal will draw, which is the requirement the whole feature rests on | A hand-built HTML mockup drifts from the renderer, which Principle VIII already refuses for documentation and which would be worse here, since the page is what a decision gets made from |
