---
track: full
status: active
---

# Feature Specification: Every reset says what it is

**Feature Branch**: `feat/047-time-reset`

**Created**: 2026-10-12

**Status**: Draft

**Input**: Design review of 2026-10, items H71, H72, H75 and H77 to H80, with section 5.7 of the
review (time). Items H73, H74 and H76 propose localised words and are rejected by Principle VI,
which keeps everything the bar writes in English. Features 042 (glyphs), 044 (copy) and 046
(gauges) are merged. The review file `docs/designs/design-review-2026-10.md` is not in the
repository, so this spec carries its own evidence.

**Track**: `full`. It changes how a moment is written, which chips show time, a glyph that
changes with the clock and one that needs rendered proof.

## Evidence

- A reset has an icon since feature 044, `F06B0` (a clock with an arrow). It is a clock, and
  the review asks for a sync mark (`F04E6`, two arrows) that says "comes back" and not "what
  time is it".
- `resetMomentLabel` says `tomorrow 09:00`, six characters longer than `tmrw 09:00`, and a
  date beyond six days as `05/09 12:00`, which reads as 5 September to one reader and 9 May
  to another.
- A reset ten minutes away on a window that is nearly full is the best news the bar can give,
  and it is drawn in the same quiet colour as a reset three days out.
- The session duration appears from the first minute, when it says nothing: `2m` tells a
  person what they already know.
- A warm prompt cache about to go cold is a thermometer, which says warm and not how long.
  An hourglass that empties says how long.
- The 7-day window and the other calendar-like chips use `F455`, an outlined calendar. A
  calendar with a week bar (`F0A33`) says "this window is a week".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reset is one icon and one clock (Priority: P1)

A person reads every reset the same way: the sync icon, then when.

**Why this priority**: it is the review's headline for time, and the rule every other story
here depends on.

**Independent Test**: render the 5-hour, 7-day, Codex window, spend and Copilot quota chips
and assert the sync icon precedes the moment in each.

**Acceptance Scenarios**:

1. **Given** a reset, **When** drawn, **Then** `F04E6` (🔄 in the emoji tier, `↻` in the plain
   tier) precedes the moment, and no `·` does.
2. **Given** less than 24 hours to the reset, **When** drawn, **Then** it is relative: `22m`,
   `2h09`, with no `0h` and no trailing `m` after an hour.
3. **Given** a reset today, **When** drawn, **Then** it is the clock time if it is 24 hours or
   more away, and relative otherwise.
4. **Given** tomorrow, **When** drawn, **Then** it is `tmrw 09:00`.
5. **Given** two to five days out, **When** drawn, **Then** it is the weekday and time, in
   English: `thu 18:00`.
6. **Given** six days or more, **When** drawn, **Then** it is the month and day in English:
   `oct 17`.
7. **Given** the words the bar writes, **When** drawn, **Then** they are English and follow the
   casing of feature 044, lowercase.

---

### User Story 2 - Good news is green (Priority: P2)

A person sees a reset under ten minutes away on a critical window in green.

**Why this priority**: it is the one moment where the countdown is a relief.

**Independent Test**: render a critical 5-hour window with 8 minutes left and 12 minutes
left; assert the first is in the healthy colour and the second is not.

**Acceptance Scenarios**:

1. **Given** a window in the critical band with the reset under ten minutes away, **When**
   drawn, **Then** the countdown is in the healthy colour, readable on the chip.
2. **Given** the same window at ten minutes or more, **When** drawn, **Then** it is the quiet
   colour as every other reset.
3. **Given** a window that is not critical, **When** drawn, **Then** the countdown is the
   quiet colour at any time.
4. **Given** `NO_COLOR`, **When** drawn, **Then** nothing about it is coloured.

---

### User Story 3 - Duration appears when it says something (Priority: P2)

A person sees the session duration only once it has passed half an hour.

**Why this priority**: a two-minute-old session is not information.

**Independent Test**: render a session at 29 and 30 minutes.

**Acceptance Scenarios**:

1. **Given** a session under 30 minutes, **When** drawn, **Then** no duration chip is drawn.
2. **Given** 30 minutes or more, **When** drawn, **Then** it is drawn with `F520`, in the
   form of feature 044.

---

### User Story 4 - A warm cache is an hourglass that empties (Priority: P3)

A person sees how much of the prompt cache's life is left.

**Why this priority**: it is the only chip that predicts a cost, and a glyph that changes is a
progress bar for it.

**Independent Test**: render a warm cache at 70%, 50% and 20% of its TTL.

**Acceptance Scenarios**:

1. **Given** a warm cache with more than two thirds of its TTL left, **When** drawn, **Then**
   the glyph is `F078C`.
2. **Given** between one and two thirds, **When** drawn, **Then** it is `F051F`.
3. **Given** less than a third, **When** drawn, **Then** it is `F06AD`.
4. **Given** the emoji and plain tiers, **When** drawn, **Then** each uses its own set: the
   hourglass emoji and `⧗`.

---

### User Story 5 - The week has its own calendar (Priority: P3)

A person sees a week calendar on the 7-day window.

**Why this priority**: it is a small thing that says what the window is.

**Independent Test**: render the 7-day chip and assert `F0A33`.

**Acceptance Scenarios**:

1. **Given** the 7-day window, **When** drawn, **Then** its icon is `F0A33`.
2. **Given** the other windows that use the calendar glyph, **When** drawn, **Then** they use
   it too, since one key serves them.

---

### Edge Cases

- **Clock changes and time zones**: the labels use local time, as today; tests freeze the
  clock and the zone to UTC.
- **A reset exactly 24 hours away**: it is a clock time or `tmrw`, never `24h00`.
- **A reset in the past within the grace period**: `now`, as today.
- **Beyond a window's own length**: `?`, as today.
- **A month name and the locale**: English only; the weekday and month tables are fixed, and a
  person's locale does not change them.
- **H73, H74 and H76** are rejected: localised weekday and month names, a locale setting and a
  24 or 12-hour switch each put non-English text on the bar, which Principle VI does not
  allow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reset glyph MUST be `F04E6` (emoji 🔄, plain `↻`) and MUST precede every
  reset; `F06B0` MUST leave the glyph table and the extractor.
- **FR-002**: A reset under 24 hours MUST be relative, `22m` or `2h09`; tomorrow MUST be
  `tmrw HH:MM`; two to five days out MUST be the weekday and time; six days or more MUST be
  the month and day; all in English and lowercase.
- **FR-003**: A countdown under ten minutes on a window in the critical band MUST be drawn in
  the healthy colour made readable on the chip.
- **FR-004**: The session duration MUST be drawn only from 30 minutes, with `F520`.
- **FR-005**: The warm cache glyph MUST be `F078C`, `F051F` or `F06AD` by thirds of its TTL
  left, with an emoji and a plain substitute for each tier.
- **FR-006**: The calendar glyph MUST be `F0A33`.
- **FR-007**: The new codepoints MUST be on a proof sheet rendered from the installed font,
  and in the extractor.
- **FR-008**: Tests MUST cover `resetMomentLabel` with a frozen clock in UTC, the 10-minute
  rule, the duration threshold and the three hourglass states; previews MUST be regenerated.
- **FR-009**: Every string this feature adds MUST be in English.

### Key Entities

- **Moment label**: the text that says when a window comes back.
- **Hourglass state**: full, half or empty by thirds of the cache's TTL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `resetMomentLabel` returns the form of FR-002 for each of today, tomorrow, three
  days out and nine days out.
- **SC-002**: No chip contains `·` before a reset.
- **SC-003**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-004**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- Weekday and month names stay lowercase after feature 044's casing rule, which the review's
  own rule (E42) states; the section 5.7 examples are capitalised, and the casing rule wins
  because it is the later and the more general.
- A reset 24 hours or more away on the same calendar day cannot happen; the clock time is only
  used for resets less than 24 hours away on another calendar day (a reset at 02:00 tomorrow is
  `tmrw 02:00`).
- The healthy colour is the budget's `green`, used as a text colour on the chip.

## Where it lands

Per design review items H71, H72, H75 and H77 to H80: `src/timeIcons.js`
(`resetMomentLabel`), `src/render.js` (the glyph keys, the duration threshold, the cache
glyph, the green countdown), `src/theme.js` (one more text marker), the glyph tables and
extractor, a proof sheet, tests, previews and the README.
