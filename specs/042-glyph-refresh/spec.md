---
track: full
status: done
---

# Feature Specification: Icons that say what they mean

**Feature Branch**: `feat/042-glyph-refresh`

**Created**: 2026-10-12

**Status**: Done

**Input**: Design review of 2026-10, items C21 to C30. Constitution v8.1.0 (amendment K5)
already names the Octicon arrows for push and pull. The review file
`docs/designs/design-review-2026-10.md` is not in the repository, so this spec carries its own
evidence.

**Track**: `full`. It adds glyph table keys, changes what several segments draw, and needs
rendered proof of every new codepoint (Principle X), so the plan lists the proof.

## Evidence

- The glyph table has 36 keys in `GLYPHS.nerd` and the same 36 in `GLYPHS.plain`. Keys the
  review asks for and the table lacks: `home`, `repo`, `worktree`, `removed`, `untracked`,
  `prDraft`, `prMerged`, `prClosed`, `reviewApproved`, `reviewComments`, `reviewRequested`,
  `effortLow`, `effortMedium`, `effortHigh`.
- Icons whose picture says another thing today:

  | Segment | Now | What it shows | Problem |
  |---|---|---|---|
  | effort | `F0E7` | a lightning bolt | effort is a level, and a bolt is speed |
  | fast mode | `F04C5` | a speedometer | the bolt belongs here; the two are swapped |
  | 5-hour window | `F051B` | a timer | a window is a stretch of time that runs out |
  | duration | `F252` | an hourglass | an hourglass is time remaining, and this is time elapsed |
  | rtk | `E7A8` | a language logo | it is not about the tool's meaning |
  | push, pull | `F40A`, `F409` | cloud up, cloud down | a cloud names a remote; ahead and behind are directions |
  | conflict | `F421` | a bug-like mark | a conflict is an alert |
  | directory | `F413` | a closed folder | the same icon for a project and for `$HOME` |
  | untracked | `F457` | the "added" box | untracked is not added; it shows as staged |

- All 22 codepoints in the request exist in the installed FiraCode Nerd Font Mono and draw a
  non-empty shape (checked by rendering each at 40 px). A name in a Nerd Font table is not
  evidence of a picture, and the constitution records four that were wrong, so the proof sheet
  is part of the change.
- Every new nerd glyph is in the private use area, which `displayWidth` counts as one column.
  The plain substitutes are East Asian Narrow where the table gives one, and the test measures
  them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Where I am is drawn as what it is (Priority: P1)

A person reads the first chip and the repository chip and sees a folder that is open, a house
when the directory is `$HOME`, and a repository box beside the repository name.

**Why this priority**: line 1 is the first thing read, and a wrong picture there is wrong on
every redraw.

**Independent Test**: render with the directory set to a project, to `$HOME`, and to a
worktree; assert the glyph before the label in each.

**Acceptance Scenarios**:

1. **Given** a project directory, **When** the bar is drawn, **Then** the directory chip
   starts with `F4D4`.
2. **Given** the directory is `$HOME`, **When** it is drawn, **Then** the chip starts with
   `F02DC`.
3. **Given** a repository is known, **When** it is drawn, **Then** the repository chip starts
   with `F401`.
4. **Given** the session is in a linked worktree, **When** it is drawn, **Then** the worktree
   chip starts with `E5FB`.
5. **Given** `CLAUDE_STATUSLINE_ASCII=1` or no Nerd Font, **When** it is drawn, **Then** the
   directory and home use `⌂`, the repository `⊡` and the worktree `⎇`.

---

### User Story 2 - A pull request says what state it is in (Priority: P1)

A person sees whether a pull request is open, a draft, merged or closed from its icon, and
what the review says.

**Why this priority**: the PR chip had one icon for four states, and the colour alone (feature
041) cannot be the only carrier.

**Independent Test**: render a pull request in each state and each review state and assert the
glyph.

**Acceptance Scenarios**:

1. **Given** an open pull request, **When** it is drawn, **Then** the icon is `F407`.
2. **Given** a draft, **When** it is drawn, **Then** the icon is `F4DD`.
3. **Given** a merged one, **When** it is drawn, **Then** the icon is `F419`.
4. **Given** a closed one, **When** it is drawn, **Then** the icon is `F4DC`.
5. **Given** a review that is approved, has comments, or is requested, **When** it is drawn,
   **Then** the review word is preceded by `F4A4`, `F442` or `F441`.
6. **Given** the plain table, **When** a pull request is drawn, **Then** every state uses `⇄`,
   and the review marks are `✓`, `✉` and `⊛`.

---

### User Story 3 - Git directions look like directions (Priority: P1)

A person sees an arrow up for commits to push, an arrow down for commits to pull, an alert for
a conflict, and a `?` for files git does not track.

**Why this priority**: these are the glyphs read most often, and the repository's own
vocabulary rule (Principle X, v8.1.0) names them.

**Independent Test**: render a tree with ahead, behind, untracked and conflicts and assert the
glyph in each place.

**Acceptance Scenarios**:

1. **Given** commits ahead, **When** drawn, **Then** `F431` precedes the count.
2. **Given** commits behind, **When** drawn, **Then** `F433` precedes the count.
3. **Given** merge conflicts, **When** drawn, **Then** `F40C` precedes the count.
4. **Given** untracked files, **When** drawn, **Then** the count is preceded by the text `?`
   and not by a box glyph.
5. **Given** a count of removed files is available, **When** drawn, **Then** `F458` precedes
   it, and `-` in plain mode.

---

### User Story 4 - Effort, speed and time draw their own meaning (Priority: P2)

A person sees effort as a gauge that fills with the level, fast mode as a bolt, the 5-hour
window as a stretch of time and the session as elapsed time.

**Why this priority**: it is the smaller part of the line, but each wrong picture is read on
every redraw.

**Independent Test**: render effort at low, medium and high and assert the three glyphs;
render fast mode, the 5-hour window, the session duration and rtk and assert theirs.

**Acceptance Scenarios**:

1. **Given** effort `low`, `medium` or `high`, **When** drawn, **Then** the glyph is `F0875`,
   `F029A` or `F0874`.
2. **Given** an effort with no level in the table (`xhigh`, `max`, an unknown name), **When**
   drawn, **Then** the glyph is the high one and the word is the effort as sent.
3. **Given** fast mode, **When** drawn, **Then** the glyph is `F140B`.
4. **Given** the 5-hour window, **When** drawn, **Then** the glyph is `F051F`.
5. **Given** the session duration, **When** drawn, **Then** the glyph is `F520`.
6. **Given** rtk savings, **When** drawn, **Then** the glyph is `F1679`.

---

### User Story 5 - The proof and the tables stay in step (Priority: P2)

A maintainer can see that every new codepoint was rendered, that the plain table has every key
the nerd table has, and that the preview extractor knows every nerd codepoint.

**Why this priority**: the constitution makes rendered evidence part of adopting a glyph, and
a key in one table and not the other is a crash or a blank on the bar.

**Independent Test**: the glyph test compares key sets and asserts the extractor's list
contains every codepoint in `GLYPHS.nerd`.

**Acceptance Scenarios**:

1. **Given** the two tables, **When** the glyph test runs, **Then** their key sets are equal.
2. **Given** `GLYPHS.nerd`, **When** the extractor list is read, **Then** every private-use
   codepoint in the table is in it.
3. **Given** the spec folder, **When** it is read, **Then** `glyph-evidence.png` shows every
   new codepoint rendered from the installed FiraCode Nerd Font Mono next to its name and its
   plain substitute.
4. **Given** every new nerd glyph, **When** measured with and without
   `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, **Then** it is one column.

---

### Edge Cases

- **A key with data the bar does not have**: `removed`, `reviewRequested` and `prClosed` are
  table entries. A segment draws them only where its data says so; none is fabricated. A
  closed pull request is only drawn where the source reports `CLOSED`.
- **A pull request from the payload with no state**: drawn as open, as today.
- **An effort level the table does not name**: the high glyph, with the word as sent.
- **`$HOME` as a symlink or with a trailing slash**: compared after resolving, so both give the
  house.
- **A terminal without the codepoint**: `CLAUDE_STATUSLINE_ASCII=1` already swaps the table;
  nothing here changes how the choice is made.
- **The composer page and previews**: they draw from `src/preview/glyphs.json`, so the file is
  regenerated with the new codepoints or the previews show blanks.
- **Width**: no glyph here is wider than one column in either table.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The directory chip MUST use `F4D4`, and `F02DC` when the directory is `$HOME`.
- **FR-002**: The repository chip MUST use `F401` and the worktree chip `E5FB`.
- **FR-003**: Effort MUST use `F0875`, `F029A` or `F0874` for low, medium and high, and the
  high glyph for any other level.
- **FR-004**: Fast mode MUST use `F140B`, the 5-hour window `F051F`, the session duration
  `F520` and rtk `F1679`.
- **FR-005**: A pull request MUST use `F407` open, `F4DD` draft, `F419` merged and `F4DC`
  closed, and its review word MUST be preceded by `F4A4`, `F442` or `F441` for approved,
  comments and requested.
- **FR-006**: Push MUST use `F431`, pull `F433` and conflicts `F40C`. Untracked files MUST be
  shown with the text `?`, and removed files with `F458`.
- **FR-007**: Every new codepoint MUST be written as an escape, never a pasted literal.
- **FR-008**: `GLYPHS.nerd` and `GLYPHS.plain` MUST have the same keys, and the plain value of
  each new key MUST be the substitute named in this spec.
- **FR-009**: Every codepoint in `GLYPHS.nerd` MUST be in the extractor's `WANTED` list, and
  `src/preview/glyphs.json` MUST be regenerated from it.
- **FR-010**: `specs/042-glyph-refresh/glyph-evidence.png` MUST show every new codepoint
  rendered from the installed FiraCode Nerd Font Mono, with its name and its plain substitute,
  and it MUST be committed with the change.
- **FR-011**: Every new nerd glyph MUST measure one column, with and without
  `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, and every plain substitute MUST be East Asian Narrow
  or listed in the Ambiguous set.
- **FR-012**: `npm run previews` MUST be run and the previews committed.
- **FR-013**: Every string this feature adds to the repository MUST be in English.

### Key Entities

- **Glyph key**: a name in the glyph table with a nerd value and a plain value.
- **Proof sheet**: the image of every new codepoint rendered from the installed font.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The two tables have the same keys, 14 more than before (50 each), and the key
  sets are equal.
- **SC-002**: All 22 requested nerd codepoints and every plain substitute appear on the proof
  sheet and are visible in it.
- **SC-003**: No nerd glyph in the table measures other than one column, in both settings.
- **SC-004**: The preview extractor's list covers every private-use codepoint in the nerd
  table.
- **SC-005**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The installed font is FiraCode Nerd Font Mono, as in earlier proof sheets, and a person who
  uses another Nerd Font gets the same codepoints from its Symbols set.
- The plain substitutes are the ones the review's table names, and the proof sheet shows each.
- A segment is not given data it does not have: reviews other than approved and comments, and
  a removed-files count, are drawn where the source provides them and nowhere else.
- Colours are feature 041's and are not touched here. The band marks are feature 046's.
- Emoji and the third table column are feature 043.

## Where it lands

Per design review items C21 to C30: `src/render.js` (`GLYPHS`, the chips above),
`scripts/extract-glyphs.py` (`WANTED`), `src/preview/glyphs.json`, a test under
`scripts/tests/`, `specs/042-glyph-refresh/glyph-evidence.png` and its generator script, and
the previews.
