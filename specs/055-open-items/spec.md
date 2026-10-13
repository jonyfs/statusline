---
track: quick
status: active
---

# Open items left after feature 054

**Feature Branch**: `feat/055-open-items`

**Created**: 2026-10-13

**Status**: In progress

**Input**: What remained open once features 039 to 054 were merged: one width defect that
predates the review, two documents that only had a read-through, the reviewer's confirmation
of the last head, and a function nothing but its tests uses.

**Track**: `quick`: one correction, one dead-code removal and the records that go with them.

## Requirements

- **FR-001**: With `arrow`, `slant` or `thin`, no line is wider than the window. The
  right-aligned chip (the update notice) adds one space when the row has no room for it, which
  the width fit does not count, so a row that fits exactly overflows by one column. A sweep
  from 60 to 260 columns over the three styles draws no line wider than its width.
- **FR-002**: `specs/054-guide-gaps/review.md` and `audit.md` have been through the humanizer
  skill, and the result is applied.
- **FR-003**: `review.md` carries an addendum with the reviewer's check of the head that
  resolved its seven findings, one disposition per finding.
- **FR-004**: `bar()` and `barWidth()` leave `src/ramp.js` when nothing outside the tests
  calls them, and their tests go with them. Nothing did: the agent rows moved to the eighths
  bar in feature 046, and `render.js` only imported `bar`. The band table loses the fill
  characters only `bar()` read.

## Left as decided

These were reported by the audit and are not open. They are listed so they are not reported
again.

- **A09**: `NO_COLOR` chips start with `▏` and carry no bold (Principle X).
- **E42**: words are lowercase, including `thu 18:00` and `oct 17` (feature 051).
- **E47**: model and effort are two chips in one colour, side by side (feature 044).
- **J98**: the colour-vision ramp keeps blue, yellow and red (feature 051, owner 2026-10-12).
- **25 ms target**: informational. `scripts/bench.js` reports it; 300 ms is the enforced budget.
- **SGR 2 dim, wide padding, overline**: opt-in (`CLAUDE_STATUSLINE_DIM=sgr`,
  `CLAUDE_STATUSLINE_PADDING=wide`, `CLAUDE_STATUSLINE_HAIRLINE=1`), owner 2026-10-12.
- **Emoji tier against section 5.3**: rtk keeps `🪙`, the cache keeps `⏳` and `⌛`, the vim mode
  keeps `🔤`, and the green and white gauge cells stay in the table without being drawn: the
  emoji tier draws the plain track (feature 046). The emoji rules of feature 043 decide these.
- **`projection`, `linesChanged`, `credits`**: no key of their own (feature 054).

## Success criteria

- **SC-001**: A width sweep test over `arrow`, `slant` and `thin` passes, and the same sweep
  fails on the parent commit.
- **SC-002**: `npm test` passes and the bench stays within its budget.
- **SC-003**: Every pending item above has a disposition in the repository.
