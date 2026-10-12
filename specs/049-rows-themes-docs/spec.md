---
track: full
status: done
---

# Feature Specification: Rows, themes, accessibility modes and docs

**Feature Branch**: `feat/049-rows-themes-docs`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items J91 to J100. Constitution v8.5.0 (amendment K11)
allows the `terminal` palette and exempts it from the contrast test. Features 040 to 048 are
merged. The review file `docs/designs/design-review-2026-10.md` is not in the repository, so
this spec carries its own evidence.

**Track**: `full`. It touches the agent and gate rows, the palettes, two accessibility modes,
the generated images and the composer page.

## Evidence

- The agent rows colour the model by tier: opus is `peach` or `red` by effort, sonnet `green`
  or `yellow`. After feature 041, red and green mean something else, and a row's colour says
  the effort and not the family.
- A row leads with the tier and the status, and its brief (what the agent was asked to do) is
  fifth. A reader scans for the brief first.
- Agents that spawn agents are drawn flat, so which belongs to which is a guess.
- Every gate row has the same running glyph, whether it is a commit hook or a push hook.
- Six palettes ship. The review asks for the five most used editor themes and for one that
  uses the terminal's own colours, so the bar cannot clash with a theme it does not know.
- A person with low vision has no way to ask for more contrast than 4.5:1, and a person with
  a colour vision deficiency has a ramp whose healthy colour is green and whose warning is
  red.
- `docs/images/*.png` are copies of SVGs from before the three-line layout, rasterised by a
  script that needs Chrome. They show a layout the bar no longer has.
- The composer page arranges segments but cannot change the palette, the icon tier or the
  separator, which are the three things a person chooses first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent rows read brief first, by family (Priority: P1)

A person scans the subagent rows for what each was asked to do, and sees the model family in
its colour.

**Why this priority**: the rows are the first thing read during a long agent run.

**Independent Test**: render a tick of three agents (opus, sonnet, haiku) and assert the order
of the cells and the colour of each model.

**Acceptance Scenarios**:

1. **Given** an agent with a brief, **When** its row is drawn, **Then** the brief is the first
   cell.
2. **Given** opus, sonnet and haiku, **When** drawn, **Then** their model cells are `mauve`,
   `lavender` and `teal`, whatever the effort.
3. **Given** a column no row in the tick fills, **When** drawn, **Then** it costs nothing; a
   column this session has shown keeps its reserved width, as it did.
4. **Given** an agent whose parent is another running agent, **When** drawn, **Then** it
   follows its parent with `├─` or `└─` before its brief, `└─` on the last child.
5. **Given** a gate row for `pre-commit`, `pre-push` and one waiting, **When** drawn, **Then**
   the icons are the commit glyph, the push glyph and the waiting glyph.

---

### User Story 2 - More palettes, one that is the terminal's own (Priority: P2)

A person picks `tokyonight`, `rosepine`, `dracula`, `solarized` or `onedark`, or `terminal`.

**Why this priority**: a bar that clashes with the terminal is a bar people turn off.

**Independent Test**: for each of the five, assert every token is defined and every emitted
foreground and background pair reaches 4.5:1; for `terminal`, assert it draws with the 16
ANSI colours and no truecolor sequence.

**Acceptance Scenarios**:

1. **Given** each of the five new flavors, **When** every segment is rendered, **Then** every
   pair reaches 4.5:1.
2. **Given** each, **When** its tokens are read, **Then** all 18 are defined.
3. **Given** `CLAUDE_STATUSLINE_FLAVOR=terminal`, **When** drawn, **Then** only the 16 ANSI
   colour sequences are emitted, and the contrast test does not apply.
4. **Given** the default, **When** nothing is set, **Then** it is still Catppuccin Mocha.

---

### User Story 3 - A person can ask for more contrast, or a safer ramp (Priority: P2)

A person sets `CLAUDE_STATUSLINE_CONTRAST=high` or `CLAUDE_STATUSLINE_RAMP=cvd`.

**Why this priority**: accessibility modes are for the people who cannot use the default.

**Independent Test**: render with each and assert the ratios and the colours.

**Acceptance Scenarios**:

1. **Given** `CONTRAST=high`, **When** drawn, **Then** every chip's text is pure black or
   pure white and every pair reaches 7:1.
2. **Given** `RAMP=cvd`, **When** a gauge is in each band, **Then** the healthy icon is blue,
   the warn fill is yellow and the critical fill is red, which differ in hue and in
   lightness and do not rely on red against green.
3. **Given** neither is set, **When** drawn, **Then** nothing changes.

---

### User Story 4 - The images show the bar (Priority: P2)

A person reading the README sees pictures of the bar that is installed.

**Why this priority**: the old PNGs show a layout that is gone.

**Independent Test**: no `docs/images/*.png` the generator did not write; a PNG and an
animated GIF exist, drawn from the real renderer.

**Acceptance Scenarios**:

1. **Given** the repository, **When** `docs/images/` is read, **Then** the stale PNGs are gone
   and a PNG of the current bar and an animated GIF (spinner and change highlight) are there.
2. **Given** the generator, **When** it runs, **Then** it draws from `renderPayload` and
   needs no browser.

---

### User Story 5 - A playground for the three first choices (Priority: P3)

A person opens the composer and changes the theme, the icon tier and the separator, then
copies the environment variables.

**Why this priority**: it replaces reading the README to find the three names.

**Independent Test**: the generated page has the three controls and an export of the variables
that matches the choice.

**Acceptance Scenarios**:

1. **Given** the page, **When** a flavor, an icon tier and a separator are chosen, **Then** the
   bar on the canvas redraws with them.
2. **Given** a choice, **When** the export is read, **Then** it lists
   `CLAUDE_STATUSLINE_FLAVOR`, `CLAUDE_STATUSLINE_ICONS` and `CLAUDE_STATUSLINE_SEPARATOR`
   with the chosen values and leaves out the defaults.

---

### Edge Cases

- **Remembered column widths**: kept. The owner chose on 2026-09-08 that a sparse column
  reserves its width so nothing to its right moves; collapsing it on a quiet tick would move
  it. Within one tick an empty column already costs nothing.
- **No parent data**: most harnesses send none, so rows stay flat, as they are.
- **A `terminal` palette and `readableOn`**: the icon and tone colours are ANSI indexes there
  and are not adjusted.
- **`CONTRAST=high` with `terminal`**: the high-contrast text is still black or white, and the
  ratio is not computed.
- **`RAMP=cvd` in the emoji tier**: the band marks are circles whose colours are the emoji's
  own, so the mode changes only the fills and icons.
- **Localised text** (K9): rejected by Principle VI; nothing in this feature adds any.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Agent rows MUST lead with the brief, colour the model `mauve` for opus,
  `lavender` for sonnet and `teal` for haiku whatever the effort, and draw `├─` and `└─`
  before a child whose parent is a running agent.
- **FR-002**: Gate rows MUST use the commit glyph for `pre-commit`, the push glyph for
  `pre-push` and the waiting glyph for a waiting run.
- **FR-003**: `tokyonight`, `rosepine`, `dracula`, `solarized` and `onedark` MUST each define
  all 18 tokens and pass the 4.5:1 test.
- **FR-004**: `terminal` MUST map every token to one of the 16 ANSI colours, MUST emit no
  truecolor or 256-colour sequence, and MUST be exempt from the contrast test.
- **FR-005**: `CLAUDE_STATUSLINE_CONTRAST=high` MUST draw pure black or white text at 7:1 or
  more, darkening or lightening the background as feature 040 does.
- **FR-006**: `CLAUDE_STATUSLINE_RAMP=cvd` MUST draw the healthy icon blue, the warn fill
  yellow and the critical fill red.
- **FR-007**: The stale `docs/images/*.png` MUST be removed, and a PNG and an animated GIF
  MUST be generated from `renderPayload` without a browser.
- **FR-008**: The composer page MUST offer the flavor, the icon tier and the separator, and
  export the environment variables.
- **FR-009**: `doctor` MUST name the new flavors as known, and the README MUST document the
  palettes, both modes and the images.
- **FR-010**: Every string this feature adds MUST be in English.

### Key Entities

- **Palette**: 18 named tokens, hex or ANSI.
- **Accessibility mode**: contrast high or ramp cvd, chosen by environment variable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Eleven palettes are known to `doctor`.
- **SC-002**: Every emitted pair is at least 4.5:1 in the ten non-terminal palettes, and at
  least 7:1 in all of them with `CONTRAST=high`.
- **SC-003**: With `FLAVOR=terminal`, no `38;2`, `48;2`, `38;5` or `48;5` sequence appears.
- **SC-004**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The palette values are the published ones for each theme, mapped to the Catppuccin token
  names the bar uses; where a theme has no colour for a token the nearest is used.
- GIF and PNG are drawn with Python's Pillow from the renderer's own ANSI, with the installed
  Nerd Font, since the repository has no runtime dependencies and no browser is assumed.
- Rows have no parent data from Claude Code today, so the tree prefixes are drawn where a
  harness sends one.

## Where it lands

Per design review items J91 to J100: `src/taskRows.js`, `src/gateRows.js`, `src/theme.js`
(palettes, `terminal`), `src/contrast.js` (high mode), `src/ramp.js` (cvd), `src/doctor.js`,
`scripts/generate-images.py`, `scripts/generate-composer.js`, tests, docs and the README.
