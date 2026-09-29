---
track: quick
status: done
---

# Feature Specification: The bar sheds what the README says it sheds, and names two modes

**Feature Branch**: `027-bar-polish`

**Created**: 2026-09-29

**Status**: Completed (the declaration above is authoritative)

**Input**: The owner asked for four follow-ups from the 2026-09-29 investigation to be done
without stopping: the width ladder that does not run, the stale Principle IV text, chips for
the payload's `vim` and `fast_mode`, and removing the merged branches. The last one is
housekeeping outside the code and has no requirement here.

**Track**: `quick`. Each change stays in the file that already owns it, and the one behaviour
change is making existing code do what its own comments and the README say.

## Why this exists

The README's width table says that at 60 columns "the reset text" goes, and the renderer has
a four-step `TRIM_STEPS` ladder for exactly that. The ladder almost never runs. Its loop stops
as soon as every row fits, and `fitToWidth` always makes a row fit by dropping segments, so the
check passes before the first step. On a narrow line the bar drops the model whole while the
5-hour chip keeps `· 1h00m`. This was found while building the prompt-cache chip (specs/025,
research R6) and measured there.

Principle IV says install sets "only the `statusLine` key". Install has also written the skill
hook, the subagent rows and the refresh interval for a long time.

Claude Code's payload carries `vim.mode` when vim mode is on and a `fast_mode` boolean. The bar
reads neither, so a user in vim mode cannot see which mode they are in without looking at the
prompt, and a session in fast mode, which spends faster, looks the same as one that is not.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A narrow bar gives up reset text before it gives up the model (Priority: P1)

**Independent Test**: Render the width suite's widest payload at 70 columns and confirm the
model is still there and the reset countdowns are gone.

**Acceptance Scenarios**:

1. **Given** a line where keeping every essential segment (priority 90 or more) needs the reset
   text removed, **When** the bar renders, **Then** the 7-day reset goes first, then the
   5-hour countdown, and the essential segments stay.
2. **Given** a line where dropping low-priority segments is enough, **When** the bar renders,
   **Then** those segments go and every reset text stays, as today.
3. **Given** a line too narrow for the essential segments even without reset text, **When** the
   bar renders, **Then** the lowest essential segment is dropped, as today.
4. **Given** an exhausted window, **When** its reset text is shed, **Then** the word `full`
   stays.

### User Story 2 - Vim mode is on the bar (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `vim.mode` of `NORMAL`, `INSERT`, `VISUAL` or `VISUAL LINE`, **When** the bar
   renders, **Then** line 2 shows the mode.
2. **Given** no `vim` block, or a mode that is not a string, **When** the bar renders, **Then**
   there is no vim chip and line 2 is unchanged.

### User Story 3 - Fast mode is on the bar (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `fast_mode: true`, **When** the bar renders, **Then** line 3 shows `fast` next to
   the effort level.
2. **Given** `fast_mode` false or absent, **When** the bar renders, **Then** there is no chip
   and line 3 is unchanged.

### Edge Cases

- A vim mode string with control characters or of unusual length goes through the text
  boundary and is shown as sent.
- Plain mode and `NO_COLOR`: both chips stay readable with plain substitutes.
- The two new chips are shed by priority like any other segment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The trim ladder MUST take its next step while any segment in the essential band
  was dropped to make its line fit, and stop at the first step that keeps them all or when the
  ladder runs out.
- **FR-002**: Segments below the essential band MUST still be dropped before any reset text is
  shortened.
- **FR-003**: The README width table MUST match what the renderer does at each width it lists,
  measured, not assumed.
- **FR-004**: Line 2 MUST show `vim.mode` when it is a usable string, with its own icon.
- **FR-005**: Line 3 MUST show `fast` when `fast_mode` is `true`, with its own icon.
- **FR-006**: Principle IV MUST list what install actually writes.
- **FR-007**: Both icons MUST be adopted with rendered evidence and plain substitutes
  (Principle X). Evidence: `specs/027-bar-polish/glyph-evidence.png`; `U+E62B` nf-custom-vim
  with `⌨`, `U+F04C5` nf-md-speedometer with `⇶`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 70 columns, the widest fixture (a 23-character model name, both windows
  exhausted) keeps the model and loses both reset countdowns. At 60 the model no longer fits
  even without them, and goes by priority.
- **SC-002**: A payload without `vim` or `fast_mode: true`, at a width with no pressure,
  renders exactly as before.
- **SC-003**: The full suite passes.

## Assumptions

- Shortening essential segments before dropping one is what the ladder's comments, the README
  and the width tests' own descriptions already say. This spec restores that; it does not
  choose a new rule.
- The vim chip belongs with the session's working state on line 2; fast mode belongs with the
  model and effort on line 3.
