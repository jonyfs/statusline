---
track: full
status: active
---

# Feature Specification: Session state you can read at a glance

**Feature Branch**: `feat/048-state-feedback`

**Created**: 2026-10-12

**Status**: Draft

**Input**: Design review of 2026-10, items I81 to I90. Constitution v8.4.1 (amendment K7)
records the four-frame spinner. Features 041 (colour), 042 (glyphs), 044 (copy), 045 and 046
are merged. The review file `docs/designs/design-review-2026-10.md` is not in the repository,
so this spec carries its own evidence.

**Track**: `full`. It changes the working chip into an animated one, adds two states, per
segment highlight lengths, three chips' icons, the failure chip and the clean-tree mark.

## Evidence

- The working chip is a hammer that never moves. A session that is stuck and one that is busy
  look the same, and the bar redraws on a counter that nothing reads.
- Idle is a coffee cup whether the session has been quiet for ten seconds or two hours.
- When Claude Code asks a question or wants a plan approved, the bar says `idle`, which is
  the opposite of what is true: the session is waiting for the person.
- Every changed segment is marked for the same 30 seconds. A branch switch is over in a
  moment, a CI result is worth two minutes.
- The update chip carries `statusline updated · 1 feature, 2 fixes`, a sentence on the line
  that matters most for a fact `doctor` already prints.
- When the bar cannot run, it prints ` statusline unavailable ` in the one place a colour
  chip would be, as bare text.
- When `gh` is missing or offline the pull request chip is absent, which reads as "there is
  no pull request". Today a failed lookup writes nothing at all.
- Merge conflicts have priority 87, below the model (92) and the branch (98): on a narrow
  line a conflict goes before the model does, though it is the fact that stops everything.
- A clean working tree draws nothing, and nothing is also what a failed read draws.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A working session moves (Priority: P1)

A person sees the working chip's glyph turn one step each redraw.

**Why this priority**: it is the one signal that tells busy from stuck.

**Independent Test**: render the working chip on four consecutive redraws of one session and
assert each of the four frames in order, repeating.

**Acceptance Scenarios**:

1. **Given** a working session, **When** the bar is redrawn four times, **Then** the glyph is
   `EE06`, `EE07`, `EE09`, `EE0A` in turn and then repeats.
2. **Given** the frame counter, **When** the clock changes between redraws, **Then** the frame
   does not depend on it: it advances by one per redraw.
3. **Given** the plain tier, **When** drawn, **Then** the frames are `|`, `/`, `-`, `\`.
4. **Given** the emoji tier, **When** drawn, **Then** the glyph is 🔨 and does not animate.
5. **Given** an idle session, **When** drawn, **Then** it does not animate.

---

### User Story 2 - Idle becomes sleeping (Priority: P2)

A person sees a coffee cup for the first five minutes of quiet and a sleeping mark after, and
line 2 dims.

**Why this priority**: a session that has gone quiet for a while should recede.

**Independent Test**: render with the last activity 2 and 6 minutes ago.

**Acceptance Scenarios**:

1. **Given** quiet for under five minutes, **When** drawn, **Then** the idle chip has the
   coffee cup.
2. **Given** quiet for five minutes or more, **When** drawn, **Then** it has `F04B2` and line
   2's chips are drawn in the quiet text colour.
3. **Given** a session with no known last activity, **When** drawn, **Then** it is idle and
   not sleeping.

---

### User Story 3 - A session waiting for a person says so (Priority: P1)

A person sees "your turn" when Claude Code has asked a question or is waiting for a plan to be
approved.

**Why this priority**: it is the state that wastes the most time when it is missed.

**Independent Test**: build a transcript whose newest entry is an unanswered question tool call.

**Acceptance Scenarios**:

1. **Given** the newest transcript entry is an unanswered `AskUserQuestion` or `ExitPlanMode`
   tool call, **When** drawn, **Then** a `your turn` chip shows with `F476` in the attention
   colour.
2. **Given** the call has an answer after it, **When** drawn, **Then** it does not.
3. **Given** a permission prompt, **When** drawn, **Then** nothing changes: the transcript does
   not record one, and the statusline is hidden by Claude Code while it is on screen.
4. **Given** the your-turn state, **When** the working chip is drawn, **Then** the working
   chip is not.

---

### User Story 4 - Each change is marked for as long as it matters (Priority: P2)

A person sees a branch switch marked for 10 seconds and a CI result for two minutes.

**Why this priority**: the mark is only useful while it is news.

**Independent Test**: change each tracked value and assert how long the mark holds.

**Acceptance Scenarios**:

1. **Given** the branch or the model changed, **When** 10 seconds pass, **Then** the mark is
   gone; at 9 seconds it is not.
2. **Given** the pull request or the CI result changed, **When** 120 seconds pass, **Then** the
   mark is gone.
3. **Given** the skills changed, **When** 30 seconds pass, **Then** the mark is gone.

---

### User Story 5 - Quieter, clearer chips (Priority: P2)

A person sees the update as an icon, a failed bar as a chip, an unknown pull request as a dim
icon, conflicts kept longer, a clean tree confirmed and allow-all in bold.

**Why this priority**: each is a small thing the bar says better.

**Independent Test**: one test per chip, below.

**Acceptance Scenarios**:

1. **Given** the update chip, **When** drawn, **Then** it is its icon only, `F12CC` after an
   update this session, and the sentence is in `doctor`.
2. **Given** the bar cannot render, **When** it prints its fallback, **Then** it is a neutral
   chip with `F00E8` and the words `statusline unavailable`.
3. **Given** `gh` failed on its last lookup, **When** drawn, **Then** a pull request icon is
   drawn dim with no number; given no failure, a branch with no pull request draws none.
4. **Given** merge conflicts, **When** the line narrows, **Then** the conflict chip outlasts
   every other chip on line 1 except the directory.
5. **Given** a clean working tree in sync with its upstream, **When** drawn, **Then** a green
   `F4A4` follows the branch.
6. **Given** allow-all, **When** drawn, **Then** its text is bold.

---

### Edge Cases

- **Frames and `NO_COLOR`**: the spinner is a glyph, so it stays.
- **A harness with no transcript** (Codex, OpenCode): no frame, no idle clock, no your-turn;
  the working chip draws as today.
- **A permission prompt**: not observable, so not a state here. Claude Code does not draw the
  statusline while one is on screen.
- **Several frames of one second**: the counter advances once per redraw, so a redraw
  cadence of 60 seconds is one frame a minute, as the constitution's rule predicts.
- **Clean tree with unknown git**: nothing is drawn; the mark only draws from a successful
  read.
- **The failure chip with no Nerd Font**: the glyph is a private-use character, and the
  fallback has no way to know; it uses the plain tier when `CLAUDE_STATUSLINE_ASCII=1`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The working chip MUST advance a four-frame spinner one frame per render on the
  session's own counter, never on the clock.
- **FR-002**: Idle MUST show the coffee cup for five minutes and `F04B2` after, and line 2
  MUST be drawn in the quiet text colour while sleeping.
- **FR-003**: A newest unanswered `AskUserQuestion` or `ExitPlanMode` tool call MUST draw a
  `your turn` chip with `F476` in the attention colour, and the working chip MUST not draw.
- **FR-004**: The highlight MUST last 10 seconds for the branch and the model, 120 for the pull
  request and CI, and 30 for skills.
- **FR-005**: The update chip MUST be its icon only (`F12CC` after an update), and its words
  MUST be in `doctor`.
- **FR-006**: The fallback MUST be a neutral chip with `F00E8`.
- **FR-007**: A failed pull request lookup MUST be recorded, and while it stands a dim pull
  request icon MUST be drawn with no number.
- **FR-008**: Conflicts MUST have priority 99.
- **FR-009**: A clean, in-sync working tree MUST draw a green `F4A4` after the branch.
- **FR-010**: Allow-all MUST be drawn in bold.
- **FR-011**: Every new glyph key MUST exist in the three tables, the codepoints MUST be on a
  proof sheet, and the extractor MUST list them.
- **FR-012**: Tests MUST cover the frame counter across renders, idle, sleeping, your turn,
  the highlight lengths and each chip; previews MUST be regenerated.
- **FR-013**: Every string this feature adds MUST be in English.

### Key Entities

- **Frame counter**: the per-session count that selects the spinner frame.
- **Session state**: working, idle, sleeping or your turn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Four redraws of a working session show the four frames in order.
- **SC-002**: The highlight is on at 9 and off at 11 seconds for the branch, on at 119 and off
  at 121 for the pull request.
- **SC-003**: The 4.5:1 test of feature 040 passes unchanged.
- **SC-004**: The redraw benchmark stays at or under 25 ms at p95.

## Assumptions

- The frame counter in the session's state file, which already advances once per render, is
  the counter the rule asks for.
- "Your turn" for a permission prompt is not observable, as the activity reader's own comment
  records; the two unambiguous waiting tool calls are.
- The failed-lookup record lives as long as the pull request cache's maximum age.

## Where it lands

Per design review items I81 to I90: `src/render.js` (the chips), `src/changeTracker.js` (frame,
per-key highlight), `src/skills.js` and `src/transcriptTail.js` (idle clock, awaiting),
`src/refresh.js` and `src/git.js` (the failed-lookup record), `bin/cli.js` and
`src/codexPane.js` (the fallback chip), `src/segments.js` (conflict priority), the glyph
tables and extractor, a proof sheet, tests, previews and the README.
