---
track: full
status: active
---

# Feature Specification: One meaning per colour

**Feature Branch**: `feat/041-colour-budget`

**Created**: 2026-10-12

**Status**: Draft

**Input**: Design review of 2026-10, items B11 to B20. Constitution v8.0.0 (amendments K2 and
K8) holds the colour budget this spec applies. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence. Depends on feature 040, which chooses the text colour for whatever background a chip
has.

**Track**: `full`. It changes the colour of most segments, the ramp, the change highlight and
the doctor output, across the renderer, the palettes and the previews.

## Evidence

Each colour is drawn from the code in `src/render.js` and `src/ramp.js`, not from the review.

| Token | Roles today |
|---|---|
| `red` | model, merge conflicts, cold prompt cache, 5-hour projection, allow-all, critical band, failed CI |
| `green` | skills, working, ok band, passed CI, added files, premium quota |
| `yellow` | warn band, cache warm, CI running, context fallback |
| `mauve` | working-tree state, rtk, premium count |
| `teal` | worktree, update, spend, credits |
| `peach` | effort, fast mode, 5-hour fallback |
| `sapphire` | todo, chat quota, 7-day fallback |
| `lavender` | branch, vim |

- A person who sees red cannot tell whether the model is wrong, a limit is near, or a merge
  conflict is waiting. The one colour that should always mean "act now" is also the colour of
  the model name.
- `SKILL_CHIP_COLORS` rotates six colours through the skill chips, so a skill's colour says
  nothing about the skill and borrows the meaning of whatever colour it lands on.
- The three-band ramp draws a healthy gauge in solid green. On a bar with five gauges that is
  most of the line in the colour that is also "passed" and "working".
- When several gauges are critical, each one is a red block, and the one that matters is no
  louder than the rest.
- A changed segment is drawn lighter with `lighten()`, which moves the colour toward another
  role and does not survive `NO_COLOR`.
- `doctor --explain` explains segments one by one and has no place that says what a colour
  means.
- The palettes define `surface1` and `surface2` but no `surface0`, which the budget uses as the
  neutral fill.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Red means act now (Priority: P1)

A person who sees a red chip knows that a limit is critical or a merge conflict is waiting, and
nothing else.

**Why this priority**: the point of the budget. Every other change here serves it.

**Independent Test**: render every preview scenario and collect the segments drawn with a red
background or red text. They are the critical band of a gauge, merge conflicts, and a failed CI
run as an icon, and no other segment.

**Acceptance Scenarios**:

1. **Given** a payload with a model and no limit near, **When** the bar is drawn, **Then** no
   chip has a red background and the model chip is `lavender`.
2. **Given** a cold prompt cache, **When** it is drawn, **Then** it is `sapphire`, not red.
3. **Given** allow-all is on, **When** it is drawn, **Then** it is `peach`.
4. **Given** the 5-hour projection says the limit will be reached, **When** it is drawn,
   **Then** it uses the budget colour for that role and not red unless the 5-hour gauge itself
   is critical.
5. **Given** merge conflicts, **When** they are drawn, **Then** the chip is `red`.

---

### User Story 2 - Healthy gauges stay quiet (Priority: P1)

A person sees a healthy gauge as a calm neutral chip with a green icon, and the colour arrives
only when the level asks for attention.

**Why this priority**: it is what makes red readable on a line full of gauges.

**Independent Test**: render a bar with every gauge in the ok band and assert none has a
coloured background, and each has a green icon.

**Acceptance Scenarios**:

1. **Given** a gauge below 60%, **When** it is drawn, **Then** its background is `surface0`
   and its icon is `green`.
2. **Given** a gauge between 60% and 85%, **When** it is drawn, **Then** its background is
   `peach`.
3. **Given** a gauge at 85% or more, **When** it is drawn, **Then** its background is `red`.
4. **Given** several gauges at 85% or more, **When** they are drawn, **Then** only the one
   with the highest percentage has the red background, and the others show red text on
   `surface0` with the critical glyph.
5. **Given** two gauges tie for the highest percentage, **When** they are drawn, **Then** the
   first in line order has the red background.
6. **Given** `NO_COLOR` is set, **When** the bar is drawn, **Then** the band marks still tell
   the bands apart, as they do now.

---

### User Story 3 - A colour has one role, and a test says so (Priority: P1)

A maintainer adding a segment cannot give it a colour that already means something else.

**Why this priority**: the budget decays the first time someone picks a colour that looks right
for one segment. Without a check, the table in the constitution is a wish.

**Independent Test**: a test lists every segment key with the colour role it uses and fails if
one token is used for two roles, or if a segment uses a token the budget does not give it.

**Acceptance Scenarios**:

1. **Given** the roles in the budget, **When** the test maps every segment key to exactly one
   role, **Then** each token appears under one role only.
2. **Given** a segment key with no role, **When** the test runs, **Then** it fails and names
   the key.
3. **Given** the skill chips, **When** they are drawn, **Then** all of them are `flamingo`.

---

### User Story 4 - A changed segment stands out without changing its colour (Priority: P2)

A person notices a segment that just changed, and it keeps the colour that says what it is.

**Why this priority**: the old highlight shifted the colour toward another role and vanished
without colour. Bold plus underline survives both.

**Independent Test**: change the branch between two renders and assert the second draws it
bold and underlined, with its own colour, and that the mark clears after 30 seconds.

**Acceptance Scenarios**:

1. **Given** a tracked segment changed within the last 30 seconds, **When** it is drawn,
   **Then** its text is bold and underlined and its colours are the same as unchanged.
2. **Given** 30 seconds have passed, **When** it is drawn, **Then** the mark is gone.
3. **Given** `NO_COLOR` is set, **When** a tracked segment changed, **Then** the mark is still
   there.

---

### User Story 5 - A person can see what each colour means (Priority: P3)

A person runs `doctor --explain` and finds a legend of the colours.

**Why this priority**: the budget is only useful if the reader can learn it without reading
the constitution.

**Independent Test**: run `doctor --explain` and assert the legend lists each budget role with
a swatch drawn in that colour, and none under `NO_COLOR`.

**Acceptance Scenarios**:

1. **Given** `doctor --explain`, **When** it runs, **Then** it prints each colour with a
   swatch, its name and its one meaning, in the order of the budget.
2. **Given** `NO_COLOR` is set, **When** it runs, **Then** the legend prints the names and
   meanings without swatches.

---

### Edge Cases

- **A segment whose old colour left the budget**: effort, fast mode, worktree, update, vim,
  working, chat quota, premium quota, working-tree state and duration take `surface0` unless
  the budget names a role for them. They are identity or state chips that do not need a hue.
- **A ramped segment with an unknown value**: it keeps the neutral fill. An unknown level is
  not a level, as `rampColour` already says.
- **CI**: passed is a `green` icon, running a `yellow` icon, failed a `red` icon, on `surface0`.
  A failed run is not the critical band of a gauge, and it does not take the red background.
- **The change highlight on a chip with a `quiet` part**: bold and underline apply to the whole
  chip's text.
- **Palettes without a `surface0`**: Nord and Gruvbox have none in their published sets, so one
  is chosen from their neutrals and recorded.
- **Text colour on `surface0`**: chosen by contrast, as feature 040 does, so the green and red
  icons are checked at 4.5:1 against it.
- **Subagent rows**: the model family is `mauve` for Opus, `lavender` for Sonnet and `teal` for
  Haiku, in the rows only, because the budget says so. Their other colours are unchanged.
- **`CLAUDE_STATUSLINE_FLAVOR` of any palette**: every palette defines every token the budget
  uses.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every segment MUST be drawn with the colour the budget in Principle I gives its
  role, and no token MUST be used for two roles.
- **FR-002**: The model chip MUST be `lavender`, a cold prompt cache `sapphire`, allow-all
  `peach`, rtk `teal`, pull request merged `mauve`, skills `flamingo`, and merge conflicts and
  the critical band `red`.
- **FR-003**: A ramped gauge in the ok band MUST have a `surface0` background and a `green`
  icon. In the warn band its background MUST be `peach`. In the critical band it MUST be `red`.
- **FR-004**: When more than one gauge is in the critical band, only the one with the highest
  percentage MUST have the red background, ties to the first in line order. The others MUST
  show red text and the critical glyph on `surface0`.
- **FR-005**: `SKILL_CHIP_COLORS` MUST be removed.
- **FR-006**: The change highlight MUST be bold plus underline on the segment's text, with its
  own colours unchanged, for 30 seconds, and `lighten()` MUST no longer be used for it.
- **FR-007**: Every palette MUST define `surface0`, and every colour the budget uses.
- **FR-008**: A test MUST map every segment key to one colour role and fail on a token used for
  two roles, on a key with no role, and on a colour outside the budget.
- **FR-009**: `doctor --explain` MUST print a legend of the budget with an ANSI swatch for each
  colour, and plain names under `NO_COLOR`.
- **FR-010**: Every emitted foreground and background pair MUST still reach 4.5:1 (feature
  040), including green and red icons on `surface0`.
- **FR-011**: `npm run previews` MUST be run and the previews committed. The near-limit preview
  MUST show a single red chip.
- **FR-012**: Every string this feature adds to the repository MUST be in English.

### Key Entities

- **Colour role**: the single meaning a token has on the bar, one of those in the budget.
- **Gauge band**: ok, warn or critical, from the percentage, with the colours of FR-003.
- **Legend**: the doctor output that lists each role with its swatch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every preview scenario, red appears only on critical gauges, merge conflicts
  and failed CI icons.
- **SC-002**: The near-limit preview has exactly one chip with a red background.
- **SC-003**: The role test passes with zero tokens under two roles, and fails when a segment
  is given a second role.
- **SC-004**: Every ok-band gauge in the previews has a `surface0` background.
- **SC-005**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-006**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The budget in Principle I of the constitution is final for this feature. A role it does not
  name goes to `surface0`.
- `surface0` values are Catppuccin's for the four Catppuccin flavors, and the nearest neutral
  step for Nord and Gruvbox, recorded in the palette file.
- A failed CI run keeps `red` as an icon colour because the budget lists red for merge
  conflicts and the critical band only as backgrounds, and an icon on a neutral chip is the
  channel the budget gives to pass and fail.
- The glyph of the critical band is the existing band mark. Feature 046 replaces it.
- Glyphs are not changed here (feature 042).

## Where it lands

Per design review items B11 to B20: `src/theme.js` (palettes, `surface0`), `src/render.js`
(segment colours, the gauge band and the single red rule), `src/ramp.js` (band colours),
`src/changeTracker.js` and `src/theme.js` (the highlight), `src/doctor.js` (legend), a test
under `scripts/tests/`, and the previews.
