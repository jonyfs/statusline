---
track: full
status: done
---

# Feature Specification: Separators and line 3 grouping

**Feature Branch**: `feat/045-separators-layout`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items F51 to F60. Constitution v8.3.0 (amendment K3)
defines the separator styles and the equal-background rule. Features 040 and 044 are merged.
The review file `docs/designs/design-review-2026-10.md` is not in the repository, so this spec
carries its own evidence.

**Track**: `full`. It changes how every chip joins the next, groups line 3, adds chip forms to
the layout and one preset, and needs rendered proof of the new separator glyphs.

## Evidence

- Two chips on the same background are joined by a solid arrow drawn in that same colour: it
  is invisible and leaves a one-column gap. After features 041 and 044, the directory and the
  repository, the model and its effort, and every healthy gauge (all `surface0`) sit this way.
- `CLAUDE_STATUSLINE_SEPARATOR` knows `thin` only. Powerline Extra Symbols gives a pill
  (`E0B6`, `E0B4`, `E0B5` inside) and a slant (`E0BC`), which people theme their terminals
  with.
- Line 3 is one run of chips. Model and effort, the usage gauges and the savings are three
  different kinds of fact, and nothing on the line says where one kind ends.
- A chip has a long form and a short form. When the short form does not fit either, the chip
  is dropped, though its icon alone would fit and still say what it is.
- The update chip says `update ready · 1 fix` in the middle of line 1 and pushes out chips
  that matter more. It is the least urgent thing on the line.
- The composer's presets have no one-line design, which is what a narrow terminal or a small
  tmux pane wants.
- The slant, pill and thin glyphs were rendered from FiraCode Nerd Font Mono and checked on a
  proof sheet before this spec relied on them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same-colour chips still have an edge (Priority: P1)

A person sees a thin arrow between two chips that share a background, instead of a gap.

**Why this priority**: it fixes something every bar has today, in every palette.

**Independent Test**: render a row of two chips on one background and assert the separator is
`E0B1` in the text colour of the first, and that two chips on different backgrounds still use
the solid arrow.

**Acceptance Scenarios**:

1. **Given** two adjacent chips on one background, **When** the row is drawn, **Then** `E0B1`
   in the first chip's text colour sits between them.
2. **Given** two chips on different backgrounds, **When** drawn, **Then** the separator is
   the style's solid glyph.
3. **Given** the plain separator (`CLAUDE_STATUSLINE_ASCII=1`), **When** drawn, **Then** the
   plain arrow is used for both cases, as today.
4. **Given** `NO_COLOR`, **When** drawn, **Then** every separator is the thin one, as today.

---

### User Story 2 - A person picks a separator style (Priority: P2)

A person sets `CLAUDE_STATUSLINE_SEPARATOR` to `round`, `slant`, `arrow` or `thin`.

**Why this priority**: terminals are themed, and a bar that clashes with its terminal is a bar
people turn off.

**Independent Test**: render with each value and assert the glyphs.

**Acceptance Scenarios**:

1. **Given** `arrow`, **When** drawn, **Then** the bar is the default.
2. **Given** `slant`, **When** drawn, **Then** chips are joined by `E0BC` with the previous
   background as foreground and the next as background.
3. **Given** `round`, **When** drawn, **Then** each chip starts with `E0B6` and ends with
   `E0B4`, with one column between chips, and equal-background neighbours are joined by
   `E0B5`.
4. **Given** `thin`, **When** drawn, **Then** every separator is `E0B1`.
5. **Given** any other value, **When** drawn, **Then** the default is used and `doctor`
   names the value it did not understand.
6. **Given** each style, **When** the row is measured, **Then** it is the same number of
   columns for a given set of chips, plus the caps of `round`.

---

### User Story 3 - Line 3 reads in three groups (Priority: P2)

A person sees the model and effort, then the usage gauges, then the savings, with a gap
between them.

**Why this priority**: it makes the longest line scannable.

**Independent Test**: render line 3 of the full fixture and assert a blank column where the
group changes.

**Acceptance Scenarios**:

1. **Given** the full fixture, **When** line 3 is drawn, **Then** the model, effort, fast mode
   and allow-all are one group, the gauges and their forecast another, and the money and
   savings a third.
2. **Given** a group has no chip drawn, **When** drawn, **Then** no gap is left for it.
3. **Given** an arrangement that moves a chip to another line, **When** drawn, **Then** the
   chip takes the group of the line it lands on, or none.

---

### User Story 4 - A chip steps down before it disappears (Priority: P1)

A person on a narrow terminal still sees each chip's icon where its words would not fit.

**Why this priority**: an icon alone is better than nothing, and the icons now say what they
are.

**Independent Test**: render the fixture from 120 down to 40 columns and assert that a chip
whose long and short forms do not fit is drawn as its icon before it is dropped, and no line is
wider than its width.

**Acceptance Scenarios**:

1. **Given** a chip with an icon-only form, **When** neither the long nor the short form fits
   but the icon does, **Then** the icon is drawn.
2. **Given** a chip that is only worth its words (the branch, the directory), **When** it does
   not fit, **Then** it keeps the rules it has today.
3. **Given** the update chip, **When** line 1 has room, **Then** it is drawn at the right edge
   of the line, and when it does not have room for its words it is drawn as its icon.
4. **Given** line 1 with no room, **When** drawn, **Then** the update chip is the first thing
   dropped.

---

### User Story 5 - One line for a small window (Priority: P3)

A person with a small pane picks the compact design: directory, branch, model, context and the
5-hour window on one line.

**Why this priority**: it is the design the other three lines cannot be, for a window the three
lines do not fit.

**Independent Test**: the preset exists with exactly those keys on line 1, and the previews
include it.

**Acceptance Scenarios**:

1. **Given** the compact preset, **When** it is applied, **Then** the bar is one line with the
   five segments.
2. **Given** the composer, **When** it is opened, **Then** the preset appears beside the
   others with what it optimises for and gives up.

---

### Edge Cases

- **A separator style with no Nerd Font**: they all need the Powerline font the arrow needs.
  `CLAUDE_STATUSLINE_ASCII=1` and the emoji tier use the plain arrow whatever the style.
- **A group of one chip**: still separated from its neighbours.
- **`slant` and `NO_COLOR`**: thin, as for every style.
- **The first and last chip**: `round` draws caps on both; `arrow` and `slant` end with the
  closing glyph as today.
- **A chip with no icon-only form**: its short form is the last before it is dropped.
- **The hairline above the bar** (F59): rejected. A line above the bar is a fourth line, and
  Principle II fixes the display at three. The composer page already separates the bar from the
  rest of the screen.
- **Optical padding after arrows** (F54): not changed. A terminal draws columns, and a space
  of a different width is one column; there is nothing to measure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Between two chips on the same background the renderer MUST draw `E0B1` in the
  text colour of the chip it follows, in the arrow, slant and round styles' place.
- **FR-002**: `CLAUDE_STATUSLINE_SEPARATOR` MUST accept `arrow` (default), `round`, `slant` and
  `thin`; `round` MUST draw `E0B6` before and `E0B4` after each chip and `E0B5` between equal
  backgrounds; `slant` MUST use `E0BC`.
- **FR-003**: An unknown value MUST draw the default and be named by `doctor`.
- **FR-004**: ASCII mode, the emoji tier and `NO_COLOR` MUST keep the separators they draw
  today.
- **FR-005**: Line 3 MUST be drawn in three groups, `identity` (model, effort, fast, allow-all),
  `gauges` (every gauge, the burn rate and the forecast) and `savings` (rtk, credits, premium
  requests, duration), with one blank column between groups that have a chip.
- **FR-006**: The update, CI, working and vim chips MUST have an icon-only form, and the
  layout MUST step through long, short and icon-only before dropping a chip.
- **FR-007**: The update chip MUST be drawn at the right edge of line 1, MUST give up its words
  before it goes, leaving its icon, and MUST be the first chip dropped.
- **FR-008**: A `compact` preset MUST exist with the directory, branch, model, context and
  5-hour window on one line.
- **FR-009**: New glyph codepoints (`E0B4`, `E0B5`, `E0B6`, `E0BC`) MUST be in the extractor
  and on a proof sheet rendered from the installed font.
- **FR-010**: Tests MUST cover every style, the equal-background rule, the groups and the
  stepping down at 120, 80 and 40 columns, with and without Ambiguous wide.
- **FR-011**: `npm run previews` MUST be run, with previews for `round` and `compact`.
- **FR-012**: Every string this feature adds MUST be in English.

### Key Entities

- **Separator style**: the glyphs and the rule that join chips: arrow, round, slant, thin.
- **Group**: a run of line 3 chips of one kind, with a blank column between groups.
- **Chip forms**: long, short and icon-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the full fixture, no pair of adjacent chips on one background is joined by a
  glyph drawn in that background.
- **SC-002**: Each of the four styles draws the glyphs of FR-002 and is the same width for the
  same chips, apart from `round`'s caps.
- **SC-003**: At 40, 80 and 120 columns no line is wider than its width.
- **SC-004**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-005**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The pill and slant glyphs are in every Nerd Font and Powerline-patched font, so a person who
  has the arrow has them.
- Group membership is a property of the segment in the registry, so an arrangement that moves a
  chip does not need to know about groups.
- The compact preset is a composer preset (an arrangement), not a new mode of the renderer.

## Where it lands

Per design review items F51 to F60: `src/theme.js` (`separatorFor`, `renderRow`),
`src/segments.js` (groups), `src/render.js` (icon-only forms, the right-aligned update chip),
`src/layout.js` (the stepping), `scripts/composer-presets.js` (compact), `src/doctor.js`, the
extractor and proof sheet, tests, previews and the README.
