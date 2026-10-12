---
track: full
status: active
---

# Feature Specification: Gauges that show a level and a pace

**Feature Branch**: `feat/046-gauges`

**Created**: 2026-10-12

**Status**: Draft

**Input**: Design review of 2026-10, items G61 to G70, with sections 5.6 of the review (the gauge
rules). Constitution v8.4.0 (amendment K6) names the band marks. Features 041 (colour budget),
042 (glyphs) and 045 (separators, groups) are merged. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence.

**Track**: `full`. It changes the figure on every gauge, the way a window is banded, one more
chip's meaning, the agent rows' bar and the width set, across the renderer, the ramp and the
task rows.

## Evidence

- Every gauge is a number and a mark. `62%▵` says a band was crossed; it does not say how far
  along the line is, and the mark is a triangle where the constitution now asks for an alert
  glyph (K6).
- A usage window is banded by what is used: 60% and 85%. That is wrong for a window that has
  elapsed: 62% used with 4 hours of 5 gone is behind pace, and 62% used with 20 minutes gone is
  well ahead of it. The person's decision is whether they will run out before it resets, which
  the used figure alone does not say.
- The context window is banded with the same thresholds as the usage windows, though it is a
  different kind of thing: it fills until compaction, and 70% is when a person should start to
  care.
- The burn rate (`35%/h`) and the projection (`5h limit ~13:05`) are two chips for one fact:
  how fast the window is going and when it runs out.
- An unknown figure is `?%`, which reads like a value. A dash with an empty track reads as
  "nothing here".
- The agent rows draw a 9-cell bar with the shade characters, `░▒▓█`, which are coarse and
  mix Ambiguous widths.
- The installed Nerd Font has a progress set, `EE00` to `EE05`, drawn as bracketed cells:
  empty and full for the left, middle and right cell. Rendered from FiraCode Nerd Font Mono,
  they join into a five-cell track one column each.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A gauge has a track (Priority: P1)

A person sees a short track before each percentage and reads how full it is without reading
the number.

**Why this priority**: it is the headline of the review, and the part of a gauge the eye
takes first.

**Independent Test**: render the context gauge at 0, 10, 50, 90 and 100 percent and unknown,
and assert the five cells.

**Acceptance Scenarios**:

1. **Given** a percentage, **When** drawn, **Then** the track is five cells, the first drawn
   with `EE03` or `EE00`, the middle three with `EE04` or `EE01`, the last with `EE05` or
   `EE02`, and cell `i` (counting from 0) is full when `pct >= (i + 0.5) * 20`.
2. **Given** 0, 10, 50, 90 and 100 percent, **When** drawn, **Then** the full cells are 0, 0,
   2, 4 and 5 (0% and 10% have none: 10 is below 10 for cell 0's threshold).
3. **Given** an unknown figure, **When** drawn, **Then** the track is `EE00 EE01 EE01 EE01
   EE02` and the figure is a dim `—`.
4. **Given** the plain and emoji tiers, **When** drawn, **Then** the track is `|` and `.`
   characters, five columns, since the cells need a Nerd Font.
5. **Given** the track is the first thing a narrow line gives up, **When** the width guard
   steps a chip down, **Then** the track goes before the reset, and the figure goes last.

---

### User Story 2 - Band marks follow the amendment (Priority: P1)

A person sees an alert glyph before a critical figure and a bold figure in the warn band.

**Why this priority**: Principle X changed in v8.4.0, and the code still draws the triangles.

**Independent Test**: render a gauge at 30, 70 and 95 percent and assert the mark.

**Acceptance Scenarios**:

1. **Given** the critical band, **When** drawn, **Then** `F40C` precedes the number (`!` in
   the plain tier, 🔴 in the emoji tier).
2. **Given** the warn band, **When** drawn, **Then** the number is bold and no glyph is added
   (🟡 in the emoji tier).
3. **Given** the ok band, **When** drawn, **Then** nothing is added.
4. **Given** the retired triangles, **When** any chip is drawn, **Then** neither appears.

---

### User Story 3 - A window is banded by pace (Priority: P1)

A person sees a window marked critical when it will run out, not only when a lot is used.

**Why this priority**: it is the decision the gauge exists to inform.

**Independent Test**: for the 5-hour window, assert the band at given used and elapsed
percentages, and that `+17pp` appears when ahead by more than five points.

**Acceptance Scenarios**:

1. **Given** `pace = used - elapsed`, **When** `pace <= 0`, **Then** the band is ok.
2. **Given** `0 < pace <= 15`, **Then** the band is warn.
3. **Given** `pace > 15` or `used >= 90`, **Then** the band is critical.
4. **Given** `pace > 5`, **When** drawn, **Then** `+Npp` follows the figure, N rounded.
5. **Given** a window whose reset is unknown, **When** banded, **Then** the absolute
   thresholds of 60 and 85 are used, since there is no elapsed time to compare.
6. **Given** a 5-hour, 7-day or Codex window, **When** the reset is known, **Then** elapsed is
   `1 - remaining / length` of the window's own length.

---

### User Story 4 - The context has its own thresholds (Priority: P2)

A person sees the context gauge turn warn at 70% and critical at 85%, and can change both.

**Why this priority**: the context is the one gauge whose limit is a cliff, compaction, and
the earlier warning matters.

**Independent Test**: render at 69, 70, 84 and 85, and with a `.statusline.json` that sets
`contextBands`.

**Acceptance Scenarios**:

1. **Given** no configuration, **When** drawn, **Then** warn starts at 70 and critical at 85.
2. **Given** `contextBands: { "warn": 60, "critical": 80 }`, **When** drawn, **Then** those
   are used.
3. **Given** a value that is not a number in order, **When** drawn, **Then** the defaults are
   used.

---

### User Story 5 - One chip says when the window runs out (Priority: P2)

A person reads `35%/h` and when the window will be full in one chip.

**Why this priority**: two chips said one thing, and one of them was a time with no subject.

**Independent Test**: render a history that projects to full before the reset and assert one
chip carries both; render one that does not and assert it is only the rate.

**Acceptance Scenarios**:

1. **Given** a rate and a projected moment before the reset, **When** drawn, **Then** one chip
   reads the rate and the moment.
2. **Given** a rate and no projected moment, **When** drawn, **Then** the chip is the rate.
3. **Given** no rate, **When** drawn, **Then** neither is drawn.
4. **Given** an arrangement that addresses `projection`, **When** drawn, **Then** the key is
   still valid and draws nothing of its own.

---

### User Story 6 - Agent rows get a finer bar (Priority: P3)

A person sees an agent's context fill in eighths of a cell.

**Why this priority**: eight cells with eighths read as a smooth bar, where nine shade cells
read as a step.

**Independent Test**: render a row at 0, 12, 50 and 100 percent and assert the cells.

**Acceptance Scenarios**:

1. **Given** a task's context percentage, **When** its row is drawn, **Then** the bar is
   eight cells: full blocks, one partial block from `▏▎▍▌▋▊▉` for the remainder, and empty
   cells as spaces.
2. **Given** U+2589 to U+258F, **When** measured, **Then** they are one column, two with
   `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`.

---

### User Story 7 - A sparkline for the burn (Priority: P3)

A person who wants it sees the last eight samples of the 5-hour figure beside the rate.

**Why this priority**: optional; it answers whether the rate is steady or rising.

**Independent Test**: set `CLAUDE_STATUSLINE_SPARKLINE=1` with a history and assert eight
characters from `▁` to `█`; unset, assert none.

**Acceptance Scenarios**:

1. **Given** the switch and eight samples, **When** the burn chip is drawn in its long form,
   **Then** eight sparkline characters follow the rate.
2. **Given** fewer than eight samples, **When** drawn, **Then** none is drawn.
3. **Given** the switch unset, **When** drawn, **Then** none is drawn.

---

### Edge Cases

- **A gauge over 100**: the track is full and the figure is as sent (the spend limit can).
- **Pace with a reset in the past or beyond the window**: treated as unknown, absolute bands.
- **`—` and the width table**: U+2014 is East Asian Ambiguous and joins the set.
- **The sparkline's characters**: U+2581 to U+2587 are Ambiguous and join the set.
- **Copilot's monthly quota** has no elapsed fraction in the data, so it keeps absolute bands.
- **Arrangements**: no key is removed. `projection` stays valid and draws nothing once its
  fact is in the burn chip.
- **`NO_COLOR`**: the track, the alert glyph and the bold stay; the bold is dropped as in
  feature 044, so the alert glyph carries the band.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each gauge chip MUST show a five-cell track before its percentage, built from
  `EE00` to `EE05` in the Nerd Font tier, with cell `i` full when `pct >= (i + 0.5) * 20`, and
  an empty track plus a dim `—` for an unknown value.
- **FR-002**: The critical band MUST draw the alert glyph before the number and the warn band
  MUST draw the number in bold; the triangles MUST be gone.
- **FR-003**: The 5-hour, 7-day and Codex windows MUST be banded by pace when the reset is
  known, with the thresholds in User Story 3, and MUST show `+Npp` when `pace > 5`.
- **FR-004**: The context MUST be banded at 70 and 85 by default and from `contextBands` in
  `.statusline.json` when valid.
- **FR-005**: The burn rate and the projection MUST be one chip, and an arrangement key
  `projection` MUST remain valid.
- **FR-006**: An optional 8-sample sparkline MUST follow the rate with
  `CLAUDE_STATUSLINE_SPARKLINE=1`.
- **FR-007**: The agent rows MUST draw an eight-cell bar with eighth blocks, and U+2589 to
  U+258F, U+2581 to U+2587 and U+2014 MUST be in the Ambiguous set.
- **FR-008**: The width guard MUST drop the track before the reset and the reset before the
  figure.
- **FR-009**: The plain and emoji tiers MUST have their own track and band marks, and every
  glyph key MUST exist in all three tables.
- **FR-010**: Tests MUST cover the track at 0, 10, 50, 90, 100 and unknown, the pace bands,
  the context thresholds and the merged chip; previews MUST be regenerated.
- **FR-011**: The new glyphs MUST be on a proof sheet rendered from the installed font.
- **FR-012**: Every string this feature adds MUST be in English.

### Key Entities

- **Track**: five cells that show a percentage.
- **Pace**: used minus elapsed, in points, for a window with a known reset.
- **Band**: ok, warn or critical, from the used figure or the pace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The track is correct at 0, 10, 50, 90, 100 and unknown, with cells as FR-001.
- **SC-002**: A window at 62% used with 20% elapsed is critical and shows `+42pp`; at 62% with
  80% elapsed it is ok.
- **SC-003**: No chip contains `▴` or `▵`.
- **SC-004**: At 120 columns no line is wider than 120, and below that the track goes before
  the reset.
- **SC-005**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-006**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The window lengths are 300 minutes for the 5-hour window, 10,080 for the 7-day window and
  the window's own `window_minutes` for a Codex window.
- Bold is SGR 1 through feature 044's markers.
- `—` in a chip is the character the review asks for, in the bar's output, and not prose.
- Features 047 (time) and 048 (feedback) are not touched.

## Where it lands

Per design review items G61 to G70: `src/ramp.js` (track, pace, bands), `src/render.js`
(gauge chips, merged burn chip, sparkline), `src/taskRows.js` (the eight-cell bar),
`src/theme.js` (the Ambiguous set), `src/config.js` (`contextBands`), the glyph tables and
extractor, a proof sheet, tests, previews and the README.
