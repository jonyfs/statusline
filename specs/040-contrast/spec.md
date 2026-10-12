---
track: full
status: done
---

# Feature Specification: Readable chips in every palette

**Feature Branch**: `feat/040-contrast`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items A01 to A10. Constitution v7.10.0 (amendment K1)
already allows choosing the text colour by contrast. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence.

**Track**: `full`. It changes the rule every chip is drawn with, adds terminal detection, and
touches the renderer, the palettes, the change highlight and the previews. A reviewer will ask
why each choice was made, so a plan and tasks are written before the code.

## Evidence

- `renderRow` in `src/theme.js` picks the text colour with one rule: `surface1` and `surface2`
  chips get `text`, every other chip gets `crust`. The rule does not look at the background.
- On Catppuccin Latte `crust` is `#dce0e8`, a pale grey. On the accents it gives 2.0:1 to 4.4:1,
  so every accent fails 4.5:1. Nord fails on red, blue, peach and mauve, Gruvbox on mauve, Frappé
  and Macchiato on `surface2`. Mocha passes everywhere.
- The best candidate among `crust`, `text`, `#11111b` and `#ffffff` reaches 4.5:1 on every
  Latte accent. Computed from the WCAG 2.2 formula, not copied from the review:

  | Latte background | Text colour | Ratio |
  |---|---|---|
  | peach `#fe640b` | `#11111b` | 6.3 |
  | yellow `#df8e1d` | `#11111b` | 7.2 |
  | green `#40a02b` | `#11111b` | 5.6 |
  | sapphire `#209fb5` | `#11111b` | 6.0 |
  | teal `#179299` | `#11111b` | 5.0 |
  | lavender `#7287fd` | `#11111b` | 5.9 |
  | pink `#ea76cb` | `#11111b` | 7.1 |
  | red `#d20f39` | `#ffffff` | 5.4 |
  | blue `#1e66f5` | `#ffffff` | 4.9 |
  | mauve `#8839ef` | `#ffffff` | 5.4 |

- The directory chip and the repository chip sit side by side on `surface1` and `surface2`. On
  Mocha their backgrounds differ by 1.37:1, and by 1.19:1 to 1.44:1 in the other palettes, so
  the edge between them is close to invisible and the two read as one block with two labels.
  Accent pairs sit closer still by luminance (Mocha red and peach are 1.31:1) and are plainly
  different, because they differ in hue.
- `lighten()` mixes each channel toward white in sRGB. It is the highlight for a segment that
  just changed, and it washes the hue out: a lightened red drifts toward pink.
- With no flavor set the bar draws Mocha, a dark palette, on any terminal. On a light terminal
  its dark chips are the most readable part of the screen and its text colours are not chosen
  for that background.
- A terminal without truecolor receives 24-bit colour sequences it may approximate badly.
- Linked text (directory, branch, repository) has no mark that it is a link.
- With `NO_COLOR` set, chips lose their backgrounds and nothing marks where one ends and the
  next begins; the thin separator is the only edge.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every chip text is readable (Priority: P1)

A person on any of the six palettes reads every chip, including on Latte, without squinting.

**Why this priority**: this is the whole point. A bar the person cannot read is a bar they turn
off, and Latte is the palette a person on a light terminal is most likely to pick.

**Independent Test**: render every segment key in each of the six palettes, extract each
emitted foreground and background pair, and compute the WCAG 2.2 contrast ratio. Each is at
least 4.5.

**Acceptance Scenarios**:

1. **Given** each chip background in Latte listed under Evidence, **When** the text colour is
   chosen, **Then** it is the colour in that table and the ratio is the value shown, to one
   decimal.
2. **Given** a background where `crust`, `text`, `#11111b` and `#ffffff` all fall below 4.5:1,
   **When** the text colour is chosen, **Then** the background is darkened in OKLCH, lightness
   lowered in steps, until one candidate reaches 4.5:1, and the chip is drawn with the darkened
   background.
3. **Given** the Mocha palette, **When** every accent chip is rendered, **Then** its text colour
   is what it was before this feature, because `crust` is already the best candidate there and
   wins ties. The `surface1` and `surface2` chips change from `text` to `#ffffff`, which has
   the higher ratio.
4. **Given** two chips on the same background, **When** the text colour is chosen for each,
   **Then** both get the same colour, and the choice is computed once per palette and
   background.

---

### User Story 2 - Neighbouring chips are told apart (Priority: P1)

A person sees where the directory chip ends and the repository name begins.

**Why this priority**: two near-identical backgrounds side by side make a chip boundary that
the person cannot see, so the second chip's content is read as part of the first.

**Independent Test**: for every palette, take each pair of adjacent chips that both sit on a
neutral token (`crust`, `mantle`, `base`, `surface1`, `surface2`) with different backgrounds in
every preview scenario and assert their contrast is at least 1.6:1.

**Acceptance Scenarios**:

1. **Given** a repository whose owner and name are known, **When** line 1 is drawn, **Then**
   the repository sits on the directory chip's background, in a quieter text colour that still
   reaches 4.5:1 where the palette has one, so the two read as one block.
2. **Given** two adjacent chips on different neutral backgrounds less than 1.6:1 apart,
   **When** a segment is added to the bar, **Then** a test fails, so a later feature cannot
   reintroduce the pair.
3. **Given** two accent chips side by side, **When** they are drawn, **Then** nothing is
   asserted about their luminance ratio: accents are told apart by hue, and a ratio does not
   measure hue.

---

### User Story 3 - A light terminal gets a light palette (Priority: P2)

A person on a light terminal who never set a flavor gets Latte, and a person on a dark one
keeps Mocha.

**Why this priority**: Mocha on a light terminal is readable but harsh, and the person has no
way to know a flavor exists until they read the README.

**Independent Test**: set `COLORFGBG` to a light and a dark value with no flavor in the
environment or in `.statusline.json`, and render. Light gives the Latte palette, dark gives
Mocha.

**Acceptance Scenarios**:

1. **Given** no flavor set and `COLORFGBG` reporting a light background, **When** the bar is
   rendered, **Then** it uses Latte.
2. **Given** no flavor set and `COLORFGBG` reporting a dark background or unset, **When** the
   bar is rendered, **Then** it uses Mocha.
3. **Given** a flavor set in the environment or in `.statusline.json`, **When** `COLORFGBG`
   says anything, **Then** the flavor wins.
4. **Given** the result, **When** `doctor` is run, **Then** its flavor line says the palette
   was chosen from the terminal background.

---

### User Story 4 - A 256-colour terminal gets a palette it can draw (Priority: P2)

A person on a terminal that has no truecolor sees chips close to the intended colours, not a
muddy approximation.

**Why this priority**: it is the fallback that keeps the readability promise of story 1 on
older terminals and on some multiplexer setups.

**Independent Test**: set `COLORTERM` to something other than `truecolor` or `24bit`, render,
and assert no `38;2` or `48;2` sequence is emitted and every foreground and background pair is
still at least 4.5:1 in the 256-colour values.

**Acceptance Scenarios**:

1. **Given** `COLORTERM` is `truecolor` or `24bit`, **When** the bar is rendered, **Then** the
   output uses 24-bit sequences, as today.
2. **Given** `COLORTERM` is set to any other value, or unset in Apple Terminal, **When** the
   bar is rendered, **Then** every colour is emitted as the nearest 256-colour index, and the contrast test of story 1
   holds on those values.
3. **Given** `NO_COLOR` is set, **When** the bar is rendered, **Then** no colour of either kind
   is emitted.

---

### User Story 5 - A link looks like a link (Priority: P3)

A person sees that the directory or branch name can be clicked.

**Why this priority**: the OSC 8 links are already there and unmarked, so most people never
find them.

**Independent Test**: render with a terminal environment that supports styled underlines and
assert the linked text is wrapped in the dotted-underline sequence; render with one that does
not, and assert it is not.

**Acceptance Scenarios**:

1. **Given** a terminal known to support styled underlines, **When** a chip carries a link,
   **Then** its text is drawn with a dotted underline (SGR `4:4`) and the underline is turned
   off after the text.
2. **Given** a terminal not known to support them, **When** a chip carries a link, **Then** the
   text is drawn exactly as before.
3. **Given** `NO_COLOR` is set, **When** a chip carries a link, **Then** the dotted underline
   is still drawn, because it is not a colour.

---

### User Story 6 - Chips keep an edge without colour (Priority: P3)

A person with `NO_COLOR` set can tell where each chip ends.

**Why this priority**: `NO_COLOR` removes every background, and the thin separator alone does
not say which words belong together.

**Independent Test**: render with `NO_COLOR=1` and assert each chip is delimited by `▏`
(U+258F) on its left edge, with the same text as before inside.

**Acceptance Scenarios**:

1. **Given** `NO_COLOR` set, **When** a row is drawn, **Then** each chip starts with `▏`.
2. **Given** `NO_COLOR` unset, **When** a row is drawn, **Then** no `▏` appears.
3. **Given** `NO_COLOR` set, **When** a row's width is measured, **Then** the `▏` counts as
   one column, or two when `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1` is set, because U+258F is East
   Asian Ambiguous.

---

### User Story 7 - A change highlight keeps its hue (Priority: P3)

A person sees a changed segment brighter, still the same colour.

**Why this priority**: the highlight says "this just changed". A red chip that turns pink says
something else.

**Independent Test**: lighten each palette accent and assert the OKLCH hue moves by no more
than 3 degrees and lightness rises.

**Acceptance Scenarios**:

1. **Given** any palette colour, **When** it is lightened, **Then** its OKLCH lightness is
   higher, its hue is within 3 degrees of the original, and its chroma is not above the
   original.
2. **Given** a lightened background, **When** the text colour is chosen, **Then** the 4.5:1
   rule of story 1 holds on the lightened colour too.

---

### Edge Cases

- **A background that no candidate reaches and darkening cannot fix**: darkening stops at
  OKLCH lightness 0. At that point the best candidate is used, and the test of story 1 names
  the colour. No palette in the repository is expected to reach it.
- **A literal hex colour in a segment**: `resolveColour` passes hex strings through. They get
  the same contrast choice as a palette name.
- **`COLORFGBG` malformed or with a single value**: treated as unset.
- **`COLORFGBG` set by a terminal that is wrong**: the person sets a flavor, which always wins.
- **A flavor name that is unknown**: falls back as it does today.
- **`COLORTERM` unset**: the bar keeps 24-bit colour, as today, except in Apple Terminal, which
  draws 256 colours and does not set it. Windows Terminal and several SSH setups draw truecolor
  and do not set it either, so an absent variable is not read as "no truecolor".
- **Truecolor reported by `COLORTERM` but unsupported**: not detectable; the person sets
  `COLORTERM` or accepts the approximation.
- **A chip with no link under `NO_COLOR`**: only the `▏` marks it.
- **The bar is piped**: no terminal is attached, `COLORTERM` and `COLORFGBG` come from the
  inherited environment, and the output is deterministic for a given environment.
- **`NO_COLOR` with `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`**: the `▏` replaces the chip's leading
  space and measures two columns there, so a chip may be one column wider than the layout
  counted. The bar is still drawn, and the redraw trims as it does for any overflow.
- **The `terminal` palette** (amendment K11): not part of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The text colour on every chip MUST be the candidate with the highest WCAG 2.2
  contrast ratio against the chip background among the palette's `crust` and `text`,
  `#11111b` and `#ffffff`, and it MUST reach 4.5:1.
- **FR-002**: When no candidate reaches 4.5:1, the background MUST be darkened in OKLCH,
  lightness lowered in steps of 0.04, until one does, and the chip MUST be drawn with the
  darkened background.
- **FR-003**: The choice MUST be computed once per palette and background and reused. The
  redraw benchmark MUST stay at or under 25 ms at p95.
- **FR-004**: The fixed rule that gives `surface1` and `surface2` the `text` colour and every
  other chip the `crust` colour MUST be removed from `renderRow`.
- **FR-005**: Mocha accent chips MUST keep their text colour. Any other chip whose text colour
  changes MUST be explained by a higher ratio than before.
- **FR-006**: The repository chip MUST be drawn on the directory chip's background with a
  quieter text colour. It keeps its own segment key, so arrangements and the composer still
  address it.
- **FR-007**: A test MUST fail when two adjacent chips on different neutral backgrounds are
  under 1.6:1 apart in any palette. Chips of the same background are the concern of feature
  045 and are excluded, and so are accent pairs.
- **FR-008**: `lighten()` MUST work in OKLCH: lightness rises, hue and chroma are kept.
- **FR-009**: With no flavor in the environment or in `.statusline.json`, a light background
  reported by `COLORFGBG` MUST select Latte and anything else Mocha. A set flavor MUST win.
  The render path MUST NOT query the terminal.
- **FR-010**: `doctor` MUST say that the flavor was chosen from the terminal background.
- **FR-011**: When `COLORTERM` is set and is neither `truecolor` nor `24bit`, or is unset in
  Apple Terminal, colours MUST be emitted as
  256-colour indices, each the nearest to the palette colour, and every pair MUST also reach
  4.5:1 as the terminal will draw it.
- **FR-012**: A chip with a link MUST draw its text with a dotted underline (SGR `4:4`, off
  with `24`) on a terminal known to support it, and MUST NOT on any other.
- **FR-013**: With `NO_COLOR` set, each chip MUST start with `▏` (U+258F). U+258F MUST be
  measured as one column, two with `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, and be in the
  Ambiguous set.
- **FR-014**: A test MUST render every segment in all six palettes and assert at least 4.5:1
  for every emitted foreground and background pair, and assert the values under Evidence for
  the Latte accents.
- **FR-015**: `npm run previews` MUST be run and the previews committed. Each changed preview
  MUST be explained by a ratio below 4.5:1, by the repository text folding into the directory
  chip, or by a Latte-specific colour.
- **FR-016**: Every string this feature adds to the repository, including code comments and
  output messages, MUST be in English.

### Key Entities

- **Contrast choice**: for a palette and a background, the text colour and, when the
  background was darkened, the darkened background.
- **Terminal profile**: the light or dark background and the colour depth the environment
  reports, used only when the person has not chosen.
- **256-colour palette**: each palette's tokens mapped to their nearest 256-colour index,
  derived the same way on every machine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every emitted foreground and background pair in all six palettes is at least
  4.5:1, asserted by a test that fails on the current renderer for Latte, Nord, Gruvbox,
  Frappé and Macchiato.
- **SC-002**: The ten Latte accent values under Evidence match to one decimal.
- **SC-003**: The Mocha previews change only where the repository text folds into the
  directory chip and where a `surface1` or `surface2` chip takes `#ffffff` text.
- **SC-004**: No adjacent pair of chips on different neutral backgrounds is under 1.6:1 in any
  palette.
- **SC-005**: The redraw benchmark stays at or under 25 ms at p95.
- **SC-006**: Rendering with `COLORTERM=256color` emits no 24-bit colour sequence, and rendering
  with `NO_COLOR=1` emits no colour sequence and one `▏` per chip.

## Assumptions

- Candidate colours are the palette's own `crust` and `text` plus `#11111b` and `#ffffff`, as
  amendment K1 states. The palette tokens themselves are not changed in this feature.
- Terminal background detection uses `COLORFGBG` only. OSC 11 needs a reply on the terminal's
  input and a wait on every redraw, which the status line command cannot do inside its budget
  and cannot do at all when its output is piped. A person whose terminal does not set
  `COLORFGBG` sets a flavor.
- `COLORFGBG` reports a light background when its last field is 7 or 15, and a dark one for
  0 to 6 and 8. Anything else is treated as unset.
- Terminals known to support styled underlines are recognised from the environment (kitty,
  WezTerm, iTerm2, Windows Terminal, VTE 5000 or later, Ghostty). The list is a table in one
  place and is extended by editing it.
- The 256-colour palette is derived from the same palettes by a fixed rule, so it needs no
  generated file.
- Same-background neighbours, the arrow separator and the thin separator are feature 045, and
  they are not in this feature.
- The colour roles of each segment (which colour means what) are feature 041. This feature
  changes the text on the colours that exist, not which segment uses which.

## Where it lands

Per design review items A01 to A10: `src/theme.js` (`renderRow`, `lighten`, new contrast and
OKLCH helpers, colour depth), `src/config.js` and `src/doctor.js` (flavor from terminal
background), `src/render.js` (repository text in the directory chip), a new colour module `src/contrast.js`, tests under `scripts/tests/`, and the previews.
