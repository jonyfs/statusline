---
track: quick
status: done
---

# One width table, generated from Unicode

**Feature Branch**: `feat/039-width-table`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, item D40. Every emoji the bar may draw must be measured as
two columns. Today some are measured as one, and the wide ranges in `displayWidth` are written by
hand, so the next emoji added to the glyph table can be wrong the same way.

**Track**: `quick`. One behaviour, one table, one test file. The emoji tier (feature 043) depends
on this, which is why it comes first.

## Evidence

- `displayWidth` in `src/theme.js` decides wide characters with a list of hand-written ranges.
  Run against Unicode 16.0 data (Python `unicodedata`), these characters are East Asian Width
  `W` and measure one column:

  | Character | Code point | Measured | Should be |
  |---|---|---|---|
  | ➕ | U+2795 | 1 | 2 |
  | ➖ | U+2796 | 1 | 2 |
  | ❔ | U+2754 | 1 | 2 |
  | 🆕 | U+1F195 | 1 | 2 |
  | 🟡 | U+1F7E1 | 1 | 2 |
  | 🟢 | U+1F7E2 | 1 | 2 |
  | 🟣 | U+1F7E3 | 1 | 2 |
  | 🟩 | U+1F7E9 | 1 | 2 |

- The design review names 🔴 as miscounted. It is not: U+1F534 sits inside a listed range and
  measures two. The review also misses ❔ and 🆕, which the emoji tier's glyph table uses. The
  list above comes from running the code, not from the review.
- Every other emoji in the emoji tier's table (📂 🏠 📦 🌿 📍 🌳 📝 🧮 🔼 🔽 💥 🔀 🚧 🚫 ✅ ❌ 🔄
  ⏩ 🚦 🔒 🧩 📋 🔨 💤 🔔 🤖 🎯 🐇 🧠 ⏳ 📊 🔥 📈 💰 🪙 🍵 🧊 🕐 🦀 🔓 💎 🔴 ⬜) already
  measures two. The bug is the ranges that were never written, not a systematic error.
- A wrong width is the failure the bar guards against everywhere else: a chip one column too
  short pulls every chip after it left of where the terminal draws it, and a line that was
  measured to fit wraps.

## User scenarios

### US1: Wide emoji keep their columns (P1)

A person whose bar shows an emoji icon sees every chip after it where the layout put it, and no
line wraps because it was measured one column short.

**Why this priority**: it is the whole feature. The emoji tier cannot ship while the measuring
function disagrees with the terminal about eight of its icons.

**Independent test**: measure the characters in the table above and the full set the emoji tier
will draw. Each is two columns.

**Acceptance scenarios**:

1. **Given** the characters 🟢 🟡 🔴 🟣 ➕ ➖ ❔ 🆕 🟩, **When** their width is measured, **Then**
   each is 2.
2. **Given** ✅ ❌ 🔄 ⏩ 🧠 🦀 🪙, which already measure two, **When** their width is measured,
   **Then** each is still 2.
3. **Given** a line of text with ➕ in it, **When** it is fitted to a width, **Then** the fitted
   line is no wider than that width in columns.

---

### US2: A future icon cannot be measured wrong by omission (P1)

A maintainer adds an emoji to the glyph table. They do not need to know which Unicode block it
sits in or add a range for it.

**Why this priority**: someone wrote the list by hand from the glyphs in use on one day. Fixing
eight characters and keeping that method only holds until the next icon.

**Independent test**: the width of any character is read from a table produced by a script from
Unicode's published data. Regenerating the table from the committed source files gives the
committed table byte for byte.

**Acceptance scenarios**:

1. **Given** the committed Unicode source files, **When** the generator runs, **Then** its output
   equals the committed table exactly.
2. **Given** a character the Unicode data lists as `W` or `F`, or as `Emoji_Presentation=Yes`,
   **When** its width is measured, **Then** it is 2.
3. **Given** the generator, **When** it runs, **Then** it reads local files only and makes no
   network request.

---

### US3: Nerd Font glyphs and the Ambiguous setting do not move (P1)

A person on the default setup sees the same bar as before. A person who sets
`CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1` gets the same behaviour as before.

**Why this priority**: the width function runs on every redraw, and every layout test depends on
it. A change that fixes eight emoji and shifts a Nerd Font glyph is a regression.

**Independent test**: every code point in the Nerd Font column of the glyph table measures one
column, with and without the Ambiguous setting.

**Acceptance scenarios**:

1. **Given** every glyph in the Nerd Font column of the glyph table, **When** each is measured,
   **Then** each is 1.
2. **Given** `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, **When** the characters in the Ambiguous set
   are measured, **Then** they are 2, and with the variable unset they are 1, as today.
3. **Given** the existing width, ambiguous-width and layout tests, **When** the suite runs,
   **Then** all of them pass unchanged.

## Edge cases

- **Emoji followed by U+FE0F**: still two columns, as today. The table decides the base
  character's width and the variation selector rule stays where it is.
- **Combining marks, variation selectors, zero-width joiner**: still zero columns.
- **Characters the old ranges called wide and the Unicode data does not**: the old ranges cover
  some code points that are not `W` or `F`, for example U+1F321 (🌡) and U+23F8 (⏸). Those
  measure one column without U+FE0F after this change, which is what the Unicode data says. The
  bar draws none of them without a selector.
- **Regional indicators (U+1F1E6 to U+1F1FF)**: the bar draws no flags, and nothing in this
  feature depends on how they measure. The table follows whatever the two source files say.
- **Unassigned code points**: measured one column, as today.
- **A character in both files**: one entry, no duplicate range.

## Requirements

### Functional requirements

- **FR-001**: Every character with East Asian Width `W` or `F`, and every character with
  `Emoji_Presentation=Yes`, MUST measure two columns.
- **FR-002**: The set of wide characters MUST come from a data file generated by a script from
  `EastAsianWidth.txt` and `emoji-data.txt`. `displayWidth` MUST NOT hold a hand-written list of
  wide ranges.
- **FR-003**: The two source files, reduced to the lines the generator reads, MUST be committed
  next to the generated table, and the table MUST record the Unicode version it came from.
- **FR-004**: The generator MUST read local files and MUST NOT make a network request. Neither
  `displayWidth` nor any other code on the render path MAY read the network or the source files.
- **FR-005**: Regenerating the table from the committed sources MUST reproduce the committed
  table exactly, and a test MUST check it.
- **FR-006**: The Ambiguous set and the `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE` behaviour MUST NOT
  change.
- **FR-007**: Every code point in the Nerd Font column of the glyph table MUST measure one
  column.
- **FR-008**: Zero-width handling (combining marks, variation selectors, joiner, keycap) and the
  U+FE0F emoji-presentation rule MUST NOT change.
- **FR-009**: A test MUST assert width 2 for 🟢 🟡 🔴 🟣 ➕ ➖ ❔ 🆕 🟩 ✅ ❌ 🔄 ⏩ 🧠 🦀 🪙.
- **FR-010**: Every string the change adds to the repository, including code comments and the
  generator's output messages, MUST be in English.

### Key entities

- **Width table**: the sorted list of code point ranges that measure two columns, with the
  Unicode version it was derived from.
- **Source extract**: the committed subset of a Unicode data file the generator reads.

## Success criteria

- **SC-001**: All 8 characters in the table under Evidence measure 2, and each is asserted by a
  test that failed before the change.
- **SC-002**: The existing suite passes with no test edited to fit the new behaviour.
- **SC-003**: No hand-written wide range remains in `displayWidth`.
- **SC-004**: The redraw benchmark stays inside its existing budget (p95 inside the budget `scripts/bench.js` enforces (300 ms; the guide's 25 ms target is not enforced)).
- **SC-005**: `npm run previews` leaves `docs/previews` unchanged, because the bar draws none of
  the eight characters today. If it does change, each changed preview is explained in the
  commit.

## Assumptions

- Unicode 16.0 is the version in use on the evidence machine, and the table is built from that
  version. A later version means regenerating the table, not editing code.
- The two source files are public Unicode data files, redistributable, and small once reduced to
  the `W`, `F` and `Emoji_Presentation=Yes` lines.
- Terminals draw `W`, `F` and `Emoji_Presentation=Yes` characters two columns wide. The bar
  already relies on this for every emoji it measures correctly today.
- The emoji tier (feature 043) is where the new icons are drawn. This feature changes only the
  measuring, so no visible output changes with it.

## Where it lands

Per design review item D40: `src/theme.js` (`displayWidth`), a generated `src/data/wide.js`, and
`scripts/generate-width-table.js`. A test under `scripts/tests/` covers FR-001, FR-005, FR-007
and FR-009. The design review file `docs/designs/design-review-2026-10.md` is not in the
repository yet, so this spec carries its own evidence.
