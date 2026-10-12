---
track: full
status: done
---

# Feature Specification: Tighter chip copy

**Feature Branch**: `feat/044-chip-copy`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items E41 to E50. Feature 042 gave every chip an icon that
says what it is, which makes some of the words beside the icons redundant. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence.

**Track**: `full`. It changes the text of most chips, adds a reset glyph that needs rendered
proof, and a markup the renderer reads, across the renderer, the layout and the tests.

## Evidence

Read from the committed fixture bar (`scripts/tests/fixtures/composer-bar.txt`) and the code:

| Where | Now | Problem |
|---|---|---|
| context | `󰍛 Context 46%` | the icon is a brain; the word spends 8 columns |
| pull request | `PR #128  approved` | the mark beside "approved" says it |
| prompt cache | `cache cold · 184k` | the snowflake says cold |
| rtk | `rtk 81% saved` | "saved" is what the coin says |
| casing | `Context`, `Implementing`, `Thu 18:00`, `Sep 1`, `5h`, `PR` | three casings on one line |
| percentage | `5h 62%`, `7d 77%`, `Context 5%` | one or two digits, so the chip after shifts when the figure crosses 10 or 100 |
| duration | `2h09m`, `1h04m` | a trailing `m` after minutes that are already after an `h` |
| reset | `5h 62%▵ · 2h09m` | a dot between a figure and its reset says nothing about what the second part is |
| model, effort | two chips, `󰚩 Opus 5` and `󰡴 high` | one fact, drawn as two chips with an edge between |
| branch | `feature/004-statusline-redesign-research` | the prefix spends 8 columns and the cut falls on the end, which is the part that tells branches apart |
| directory | `…ksline` | a left-cut name looks like a word |
| emphasis | every chip is one weight | the figure and its unit read alike |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Words the icon already says are gone (Priority: P1)

A person reads `󰍛 46%` and knows it is the context window, without the word.

**Why this priority**: it is the largest saving of columns, and columns are what the bar runs
out of first.

**Independent Test**: render each chip with a payload that fills it and compare its text to the
snapshot of its long and short forms.

**Acceptance Scenarios**:

1. **Given** a context figure, **When** drawn, **Then** it reads icon, figure and percent, with
   no word.
2. **Given** a pull request with a review, **When** drawn, **Then** the review is the review
   glyph and the word is dropped from the short form.
3. **Given** a warm prompt cache about to close, **When** drawn, **Then** it reads icon and the
   minutes left.
4. **Given** rtk savings, **When** drawn, **Then** it reads icon and the percentage.
5. **Given** a width that fits the long forms, **When** drawn, **Then** the long form is kept
   and the short form is what the width guard steps down to before it drops a chip.

---

### User Story 2 - One casing rule (Priority: P1)

A person sees the words the bar writes in one case.

**Why this priority**: three casings on a line are noise a reader has to ignore.

**Independent Test**: scan the text the bar writes itself for a capital that is not an
acronym, a name from data or the first letter of a model name.

**Acceptance Scenarios**:

1. **Given** the bar's own words (`context`, `working`, `idle`, `spend`, `credits`,
   `premium`, `month`, weekdays, months, `update ready`), **When** drawn, **Then** they are
   lowercase.
2. **Given** acronyms (`PR`, `MR`, `CI`, `AIC`, `UTC`) and the units `h`, `d`, `m`, **When**
   drawn, **Then** they keep their case.
3. **Given** a model name, a branch, a directory, a skill, a vim mode or a workflow name from
   data, **When** drawn, **Then** it is as sent.

---

### User Story 3 - Figures do not move their neighbours (Priority: P1)

A person watches a percentage go from 9 to 10 to 100 and the chips after it stay put.

**Why this priority**: a chip that changes width on every digit makes the line jitter.

**Independent Test**: render a gauge at 5, 50 and 100 percent and assert the chip's width in
columns is the same.

**Acceptance Scenarios**:

1. **Given** a percentage of one, two or three digits, **When** drawn, **Then** the figure is
   padded to three characters with U+2007 FIGURE SPACE on the left.
2. **Given** a figure of 100 or more, **When** drawn, **Then** no padding is added.
3. **Given** the padded figure, **When** measured, **Then** it is one column per character.

---

### User Story 4 - Durations are as short as they can be (Priority: P2)

A person reads `2h09` for two hours and nine minutes and `45m` for under an hour.

**Why this priority**: every chip with a time spends columns on punctuation that carries
nothing.

**Independent Test**: format 45 minutes, 1 hour, 2 hours 9 minutes and 26 hours.

**Acceptance Scenarios**:

1. **Given** under an hour, **When** formatted, **Then** it is minutes with `m` and no `0h`.
2. **Given** an hour or more, **When** formatted, **Then** it is `H`h`MM` with no trailing `m`.
3. **Given** a day or more, **When** formatted, **Then** the day form is unchanged.

---

### User Story 5 - The reset has its own icon (Priority: P2)

A person sees an icon where a dot sat, and the icon says that what follows is when it resets.

**Why this priority**: a dot only separates; an icon names.

**Independent Test**: render the 5-hour, 7-day, spend and Copilot quota chips and assert the
reset glyph precedes each reset.

**Acceptance Scenarios**:

1. **Given** a window with a reset, **When** drawn, **Then** the reset glyph, not `·`, sits
   between the level and the reset.
2. **Given** the plain and emoji tiers, **When** drawn, **Then** each uses its own substitute.
3. **Given** the reset is shed under width, **When** drawn, **Then** the glyph goes with it.

---

### User Story 6 - Model and effort read as one thing (Priority: P2)

A person sees the model and its effort as one block.

**Why this priority**: effort is a property of the model; two chips with an edge say they are
separate facts.

**Independent Test**: render a model with an effort and assert both sit on the model's colour
with no chip edge, and that each segment still has its own key.

**Acceptance Scenarios**:

1. **Given** a model and an effort, **When** drawn, **Then** they share the model's background
   and read as one block.
2. **Given** a model with no effort, **When** drawn, **Then** the model chip is unchanged.
3. **Given** an arrangement that moves or hides `effort`, **When** drawn, **Then** it is
   obeyed.

---

### User Story 7 - Names are cut where they tell apart (Priority: P2)

A person sees `f/004-statusline-redesign…research` and `…/projects`, not a clipped tail.

**Why this priority**: the part of a branch that differs is the middle or the end, not the
prefix, and a cut directory should read as cut.

**Independent Test**: render long branch names with each default prefix and a configured map,
and left-truncated directories.

**Acceptance Scenarios**:

1. **Given** a branch starting `feature/` or `fix/`, **When** drawn, **Then** the prefix is
   `f/` or `x/`.
2. **Given** `branchPrefixes` in `.statusline.json`, **When** drawn, **Then** that map is used
   instead of the defaults.
3. **Given** a branch longer than the limit, **When** drawn, **Then** it is cut in the middle
   with `…`, keeping its start and its end.
4. **Given** a directory cut from the left, **When** drawn, **Then** it begins with `…/`.

---

### User Story 8 - The figure is the loudest part (Priority: P3)

A person's eye lands on the number first, and the unit, the reset and the repository recede.

**Why this priority**: it is polish on what is already shorter and aligned.

**Independent Test**: render a gauge and assert its figure is wrapped in bold and its reset and
the repository in the quieter colour.

**Acceptance Scenarios**:

1. **Given** a gauge, **When** drawn, **Then** the figure is bold.
2. **Given** a reset, a unit or the repository, **When** drawn, **Then** it is in the quiet
   text colour that still reaches 4.5:1 where the palette has one.
3. **Given** `NO_COLOR`, **When** drawn, **Then** the text carries no escape at all: the
   bold goes with the colour, because the bar's contract there is plain text.
4. **Given** the markup, **When** a width is measured, **Then** it adds no columns.

---

### Edge Cases

- **A branch name already shorter than the limit**: untouched apart from the prefix map.
- **A prefix map value of the empty string**: the prefix is removed.
- **A prefix that is the whole branch** (a branch named `feature/`): left as it is.
- **Padding and `?%`**: an unknown level `?` is padded the same as a figure, so the chip does
  not shift when the value arrives.
- **Data containing the markup characters**: removed at the boundary that already strips
  control characters, so data cannot style the bar.
- **A harness that draws its own rows** (Copilot agent rows, task rows): their copy follows the
  same rules where they share a function, and keeps their column layout where they do not.
- **The composer page and pool**: they carry plain text, without the markup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The context, pull request review, prompt cache and rtk chips MUST have a short
  form that is the icon and the figure, and the width guard MUST step through it before
  dropping the chip.
- **FR-002**: The text the bar writes itself MUST be lowercase, except acronyms, the units
  `h`, `d`, `m`, and text that comes from data.
- **FR-003**: A percentage MUST be padded on the left to three characters with U+2007, and an
  unknown level `?` likewise.
- **FR-004**: A duration under an hour MUST be minutes and `m`; an hour or more MUST be
  `H`h`MM`, no trailing `m`.
- **FR-005**: A reset MUST be introduced by the reset glyph instead of `·`, and the glyph MUST
  be in the nerd, emoji and plain tables with rendered proof for the nerd one.
- **FR-006**: The effort segment MUST be drawn on the model's background, adjacent, so that the
  two read as one block, and each MUST keep its own key.
- **FR-007**: A branch prefix MUST be abbreviated by a map, `feature/` to `f/` and `fix/` to
  `x/` by default, replaceable by the `branchPrefixes` key of `.statusline.json`; a branch
  longer than the limit MUST be cut in the middle with `…`.
- **FR-008**: A directory cut from the left MUST begin with `…/`.
- **FR-009**: The main figure of a gauge MUST be bold, and its reset, units and the repository
  MUST be in the quiet text colour.
- **FR-010**: The markup MUST add no columns, MUST NOT reach the pool or the composer, and MUST
  NOT be producible by data.
- **FR-011**: A test MUST hold a snapshot of the long and short form of each chip.
- **FR-012**: `npm run previews` MUST be run and the previews committed.
- **FR-013**: Every string this feature adds to the repository MUST be in English.

### Key Entities

- **Chip forms**: the long text, the short text and the shedding steps of a segment.
- **Markup**: the control characters the segment builders write and the renderer turns into
  weight and colour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 80 columns no line of the fixture is wider than 80, and a chip with a short
  form shows it before it is dropped. The long forms keep their length: padding adds a column
  to each two-digit figure, and the dropped words and units take back more than that on
  line 1.
- **SC-002**: A gauge at 5, 50 and 100 percent has the same width in columns.
- **SC-003**: No chip text the bar writes itself contains a capital that is not an acronym, a
  unit or data.
- **SC-004**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-005**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The reset glyph is chosen in the plan and proven on the sheet.
- "One chip" for model and effort is a visual unit with two keys, because arrangements, the
  composer and the registry address them separately.
- Bold is SGR 1. "Dim" is a text colour from the palette that keeps 4.5:1 and not SGR 2, so
  the floor of feature 040 stays measurable.
- The branch limit is 28 columns, a value the plan may change after measuring the fixture.
- Weekday and month names stay English (Principle VI) and become lowercase.

## Where it lands

Per design review items E41 to E50: `src/render.js` (chip text, effort colour, branch and
directory), `src/tokens.js` (durations), `src/timeIcons.js` (labels), `src/theme.js` (markup
and figure space in width), `src/config.js` (`branchPrefixes`), `src/text.js` (markup
characters), the glyph tables and proof sheet, tests under `scripts/tests/`, the previews and
the README.
