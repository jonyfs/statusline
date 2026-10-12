---
track: full
status: done
---

# Feature Specification: An emoji icon tier

**Feature Branch**: `feat/043-emoji-tier`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items D31 to D39. Constitution v8.2.0 (amendment K4)
defines the emoji column and its rules. Feature 039 made the width table correct for every emoji
the tier draws, and feature 042 completed the glyph keys the tier fills. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence.

**Track**: `full`. A third column in the glyph table, a new environment switch, a layout
that must hold at three widths, a new preview and a README section.

## Evidence

- Without a Nerd Font the bar falls back to `GLYPHS.plain`: `◊ ⊞ ◰ ↯ ⇄`. They are one column
  wide and correct, and a person who has never seen the bar cannot say what they mean.
- A terminal that draws emoji but has no Nerd Font is common (a stock terminal on a
  server, an SSH session, a browser terminal). The plain tier is the only thing it has.
- After feature 039 every emoji this tier draws measures two columns. Before it, 🟢 🟡 🟣 🟩
  ➕ ➖ ❔ 🆕 measured one and would have shifted every chip after them.
- Emoji that look like emoji and are not (`⚡ ☕ ⏭ ⚠️ 🌡️ ⌨️ 🗓️ ⏱️ 🛡️ 🏷️ 📅 📆`) draw as text on some
  terminals and as pictures on others. They lack `Emoji_Presentation=Yes`, and the constitution
  now rejects them by name.
- The repository already holds a committed extract of `emoji-data.txt` with every
  `Emoji_Presentation=Yes` range (feature 039), so a test can check every emoji in the table
  against Unicode's own data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A person picks the emoji tier (Priority: P1)

A person without a Nerd Font sets `CLAUDE_STATUSLINE_ICONS=emoji` and every icon on the bar
is a picture they can read.

**Why this priority**: it is the whole feature. A bar nobody can read without learning it
fails the bar's own rule in Principle X, that an icon be legible before it is learned.

**Independent Test**: render the full fixture with the variable set to each of `nerd`,
`emoji` and `plain` and assert each icon slot comes from that column of the table.

**Acceptance Scenarios**:

1. **Given** `CLAUDE_STATUSLINE_ICONS=emoji`, **When** the bar is drawn, **Then** every icon
   at the start of a chip is the emoji of its key.
2. **Given** `CLAUDE_STATUSLINE_ICONS=nerd` or the variable unset, **When** it is drawn,
   **Then** the bar is what it is today.
3. **Given** `CLAUDE_STATUSLINE_ICONS=plain`, **When** it is drawn, **Then** the bar is the
   plain tier.
4. **Given** `CLAUDE_STATUSLINE_ASCII=1`, **When** it is drawn, **Then** the bar is the plain
   tier, whatever `CLAUDE_STATUSLINE_ICONS` says.
5. **Given** any other value, **When** it is drawn, **Then** the bar is the nerd tier and
   `doctor` names the value it did not understand.
6. **Given** the emoji tier, **When** a gauge is past a band, **Then** its mark is 🟡 in the
   warn band and 🔴 in the critical band.

---

### User Story 2 - Every emoji is one Unicode draws as a picture (Priority: P1)

A maintainer cannot add an emoji that draws as text on some terminals.

**Why this priority**: an emoji that is text in one terminal is a column short in that
terminal, and the whole line after it moves.

**Independent Test**: a test reads the committed `emoji-data.txt` extract and asserts every
emoji in the table has `Emoji_Presentation=Yes`, and that none of the named rejects is in the
table.

**Acceptance Scenarios**:

1. **Given** the emoji column, **When** the test runs, **Then** every entry is a single
   codepoint with `Emoji_Presentation=Yes` and no variation selector.
2. **Given** `⚡ ☕ ⏭ ⚠️ 🌡️ ⌨️ 🗓️ ⏱️ 🛡️ 🏷️ 📅 📆`, **When** the test runs, **Then** none is in the
   column.
3. **Given** the emoji column, **When** the test runs, **Then** it has exactly the keys of the
   nerd column.
4. **Given** an emoji in the column, **When** it is measured, **Then** it is two columns.

---

### User Story 3 - The layout still fits (Priority: P1)

A person on the emoji tier sees a bar that is as wide as the terminal and no wider.

**Why this priority**: an emoji is two columns where a Nerd Font glyph is one, so the same
chips are wider, and the width guard has to shed what no longer fits.

**Independent Test**: render the full fixture in emoji mode at 80, 120 and 200 columns and
assert no line is wider than the width, and every chip kept is whole.

**Acceptance Scenarios**:

1. **Given** the emoji tier at 80, 120 and 200 columns, **When** the bar is drawn, **Then**
   every line is at most that wide in columns.
2. **Given** the emoji tier at 80 columns, **When** chips no longer fit, **Then** they are
   shed in the same priority order as in the nerd tier.
3. **Given** `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, **When** the bar is drawn in the emoji
   tier, **Then** the same holds.

---

### User Story 4 - Events can be pictures in the Nerd Font tier (Priority: P3)

A person who likes a loud signal turns on three emoji for events in the Nerd Font tier.

**Why this priority**: it is an opt-in for three moments that deserve more than a glyph.

**Independent Test**: set `CLAUDE_STATUSLINE_EVENT_EMOJI=1` in the nerd tier and render a
conflict, a critical burn and an applied update.

**Acceptance Scenarios**:

1. **Given** the variable set to `1` in the nerd tier, **When** there are conflicts, **Then**
   the conflict icon is 💥.
2. **Given** the same, **When** the burn rate chip is drawn in a critical band, **Then** its
   icon is 🔥.
3. **Given** the same, **When** an update was applied, **Then** the icon is 🚀.
4. **Given** the variable unset, **When** the same state is drawn, **Then** the nerd glyphs
   are used.

---

### User Story 5 - The tiers are documented and previewed (Priority: P3)

A person can see the three tiers side by side before choosing one.

**Why this priority**: the tiers exist for people who have not installed a Nerd Font, and
those people read the README before anything else.

**Independent Test**: `npm run previews` writes `emoji-tier.svg`, and the README's section on
icons names the three values and links it.

**Acceptance Scenarios**:

1. **Given** the previews are generated, **When** `emoji-tier.svg` is opened, **Then** it
   shows the full fixture in the emoji tier.
2. **Given** the README, **When** its icon section is read, **Then** it documents
   `CLAUDE_STATUSLINE_ICONS`, its three values, the plain override and the event switch.

---

### Edge Cases

- **`CLAUDE_STATUSLINE_ICONS=emoji` with `CLAUDE_STATUSLINE_ASCII=1`**: plain wins; ASCII is a
  stronger request.
- **An icon that is not at the start of a chip**: none exists today; the table's emoji fill
  only the icon slot, and a test checks no chip text carries an emoji elsewhere.
- **A key with no meaningful emoji**: the nerd column has no key without one. Where two keys
  share a picture (`sleeping` and `idle`), they share the emoji.
- **Animated indicators**: frames that are Nerd Font glyphs or Braille keep their frames in the
  emoji tier; the working indicator is the one hammer emoji, which does not animate.
- **Emoji font drawing at a different size**: out of the bar's control; the constitution
  already says emoji resolve to the system font and may differ in baseline.
- **A harness with its own palette of icons (Codex, OpenCode)**: they run this renderer and
  read the same environment, so they get the same tier.
- **The preview extractor**: emoji are drawn as text in the previews, as the Braille spinner
  already is, so they need no outline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `CLAUDE_STATUSLINE_ICONS` MUST select the glyph column: `nerd` (default),
  `emoji` or `plain`. `CLAUDE_STATUSLINE_ASCII=1` MUST still select `plain` and win.
- **FR-002**: `GLYPHS` MUST have an `emoji` column with exactly the keys of `nerd` and `plain`.
- **FR-003**: Every emoji in the column MUST be a single codepoint with
  `Emoji_Presentation=Yes` in the committed extract, and none of `⚡ ☕ ⏭ ⚠️ 🌡️ ⌨️ 🗓️ ⏱️ 📅
  📆` MUST be in it. A test MUST check both.
- **FR-004**: An emoji MUST appear only as the icon at the start of a chip, or as a band mark.
- **FR-005**: The band marks in the emoji tier MUST be 🟡 for the warn band and 🔴 for the
  critical band.
- **FR-006**: `CLAUDE_STATUSLINE_EVENT_EMOJI=1` MUST draw 💥 for conflicts, 🔥 for a critical
  burn and 🚀 for an applied update in the nerd tier, and MUST NOT change any other glyph.
- **FR-007**: A test MUST render the full fixture in the emoji tier at 80, 120 and 200
  columns, with and without `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, and assert no line is wider
  than its width.
- **FR-008**: `doctor` MUST say which tier is in force and where it came from, and MUST name
  a value of `CLAUDE_STATUSLINE_ICONS` it does not understand.
- **FR-009**: The README MUST document the three tiers and both variables, and
  `npm run previews` MUST write `emoji-tier.svg`.
- **FR-010**: Choosing the emoji tier MUST also draw the plain `▸` separator in place of the
  Powerline arrow, unless `CLAUDE_STATUSLINE_SEPARATOR` names one, because the tier is for a
  terminal that may have no Nerd Font to draw the arrow.
- **FR-011**: Every string this feature adds to the repository MUST be in English.

### Key Entities

- **Icon tier**: the column of the glyph table in force: nerd, emoji or plain.
- **Rejection list**: the emoji that look like pictures and are text, kept by name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The three columns have the same keys, 50 each.
- **SC-002**: Every emoji entry passes the `Emoji_Presentation=Yes` check, and none of the ten
  rejected ones is present.
- **SC-003**: The emoji tier fits at 80, 120 and 200 columns in both width settings.
- **SC-004**: With the variable unset, every preview other than `emoji-tier.svg` is unchanged.
- **SC-005**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The emoji for each key are chosen in the plan, from the set the review names, and each is
  checked against the extract.
- Two columns per emoji is correct in every terminal that draws it as a picture, which feature
  039's table encodes.
- The three event emoji are `Emoji_Presentation=Yes` and are allowed in nerd mode by the
  constitution, only when asked for.
- Colour is feature 041's. The emoji have their own colours, so the icon-colour channel of
  041 does not apply to them, and the chip text keeps its own.

## Where it lands

Per design review items D31 to D39: `src/render.js` (`GLYPHS`, tier selection, event emoji),
`src/ramp.js` (band marks), `src/doctor.js`, `scripts/generate-previews.js` and
`scripts/preview-fixtures.js` (the new preview), tests under `scripts/tests/`, and the README.
