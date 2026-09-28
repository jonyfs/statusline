---
track: full
status: done
---

# Feature Specification: The bar keeps counting after the limit is lifted

**Feature Branch**: `023-extra-usage-limit`

**Created**: 2026-09-28

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "revise o statusline pois quando chego no limite de tokens e o
admin libera, o statusline fica congelado e não mostra quanto tenho deste novo limite de
tokens que o admin enviou pra mim" (review the statusline: when I hit my token limit and the
admin lifts it, the statusline freezes and doesn't show how much of the new allowance the
admin granted me I have left).

**Track**: `full`. The change adds a figure the payload carries but the bar has never read,
which reaches the payload reader, the line-3 composition, the width priorities, the doctor
report, the README, and Principle III of the constitution. A reviewer will ask why the new
figure is allowed to pass 100% when the other two are not.

## Why this exists

The bar reads two allowances from the payload, the 5-hour window and the 7-day window. When
one of them reaches its limit and an administrator grants more, the user keeps working, but
the bar keeps printing the same exhausted figure (`5h 100%`) until the window resets. Nothing
on the line moves, so it looks like the bar has stopped updating. The one number the user
now cares about, how much of the granted allowance is left, never appears.

The data is already there for part of this. Claude Code 2.1.283 builds the statusline
payload with a third entry, `rate_limits.spend_limit`, holding `used_percentage` and
`resets_at`. Its documented schema describes it as "behind a Claude gateway, your fullest
spend limit (present only while the gateway reports it and its resets_at has not passed)",
with a `used_percentage` that goes "above 100 once exceeded". The bar ignores this entry
completely. In every other setup the payload says nothing about a granted allowance, so no
honest figure exists for it there.

## Clarifications

### Session 2026-09-28

The owner asked for the work to continue through implementation without stopping for
answers, so each question below was settled with the recommended option. Any of them can be
reversed by editing this section and the requirement it points to.

- Q: How does an exhausted 5-hour or 7-day window read? → A: It keeps its percentage and band
  mark and adds the word `full` before the reset, as in `5h 100%▴ full · 2h09m`. The number
  stays because Principle III shows percentages, and a word needs no new glyph (FR-006).
- Q: What is the spend-limit chip called on the bar? → A: `spend`, the payload's own name for
  it, with an icon of its own adopted under Principle X's evidence rule (FR-002, FR-011).
- Q: How does the spend-limit reset read? → A: Like the 7-day reset: a countdown inside a
  day, the weekday within six days, and the date beyond that. A spend period can be a month,
  so its plausibility bound is 32 days rather than the 30 used for the windows (FR-014).
- Q: Do the burn rate and the run-out projection follow the spend limit? → A: No. They stay
  on the 5-hour window. Projecting the spend limit is out of scope.
- Q: Where does the spend-limit chip rank when the terminal is narrow? → A: At a fixed
  priority above the 5-hour window and below the context figure. The chip only exists in
  gateway setups, where it is the allowance that decides whether work can continue, so a
  fixed rank is simpler than one that moves with the windows (FR-009).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how much of the granted allowance is used (Priority: P1)

A user on an organisation plan hits their limit. The administrator raises it. The user keeps
working and glances at the bar to see how much of the new allowance they have spent and when
it resets, the same way they already read the 5-hour and 7-day figures.

**Why this priority**: This is the complaint. Without it the user works blind on an
allowance that will run out, while the bar shows a number that can no longer change.

**Independent Test**: Feed the statusline a payload that carries a spend-limit entry
alongside an exhausted 5-hour window and confirm line 3 shows the spend-limit figure and its
reset. Then feed a second payload with a higher spend-limit figure and confirm the displayed
number follows it.

**Acceptance Scenarios**:

1. **Given** a payload whose 5-hour window reads 100% and whose spend-limit entry reads 12%
   with a reset three days out, **When** the bar renders, **Then** line 3 shows the
   spend-limit figure as 12% with the day it resets, marked so it cannot be mistaken for
   the 5-hour or 7-day window.
2. **Given** two consecutive payloads whose spend-limit entry moves from 12% to 30%,
   **When** the bar redraws on each, **Then** the figure moves from 12% to 30%.
3. **Given** a spend-limit entry above 100% (for example 115%), **When** the bar renders,
   **Then** it shows 115% as reported, in the exhausted band, rather than capping it at 100%
   or hiding it.
4. **Given** a payload with no spend-limit entry, **When** the bar renders, **Then** line 3
   looks exactly as it does today, with no empty slot or placeholder for the missing figure.

---

### User Story 2 - An exhausted window reads as exhausted, not frozen (Priority: P2)

A user whose setup does not report a granted allowance hits the limit and is given more. The
payload still says only `5h 100%`. The user needs to be able to tell from the bar that the
window is used up and that the figure will not move until the reset, so a static figure is
not taken for a broken statusline.

**Why this priority**: It does not give the user the number they asked for, because the
payload does not contain it. It does remove the reading that the bar has frozen, and it
applies in setups where Story 1 never can.

**Independent Test**: Feed a payload whose 5-hour window reads 100% with no spend-limit
entry and confirm the chip states the window is at its limit and when it comes back, and
that no figure for the granted allowance is invented.

**Acceptance Scenarios**:

1. **Given** a 5-hour window at 100% and no spend-limit entry, **When** the bar renders,
   **Then** the 5-hour chip shows the window as at its limit together with its reset
   countdown, in a form distinct from an ordinary high reading such as 97%.
2. **Given** the same state for the 7-day window, **When** the bar renders, **Then** the
   7-day chip shows the same at-limit form with the day it resets.
3. **Given** an exhausted window and no spend-limit entry, **When** the bar renders,
   **Then** no percentage, amount or count is shown for the granted allowance.
4. **Given** an exhausted window, **When** its reset time passes and the next payload reports
   a low figure, **Then** the chip returns to its ordinary form with the new figure.

---

### User Story 3 - Find out whether this setup reports the granted allowance (Priority: P3)

A user who sees no spend-limit figure wants to know whether that is because they have no
granted allowance or because their setup never reports one. The diagnostic command answers
the question.

**Why this priority**: It explains an absence rather than showing a value, so it matters only
once Stories 1 and 2 exist. It saves the user from filing a bug about a number the payload
cannot give.

**Independent Test**: Run the diagnostic with and without a spend-limit entry in the last
payload and confirm it names which allowances were present and says in plain words that a
granted allowance is reported only in gateway setups.

**Acceptance Scenarios**:

1. **Given** a last payload carrying a spend-limit entry, **When** the user runs the
   diagnostic, **Then** it lists the 5-hour, 7-day and spend-limit allowances as present,
   each with its figure and reset.
2. **Given** a last payload with no spend-limit entry, **When** the user runs the
   diagnostic, **Then** it lists the spend-limit allowance as absent and states that Claude
   Code reports it only behind a Claude gateway with spend limits.

### Edge Cases

- The spend-limit entry arrives without a reset time: the figure is shown and the reset reads
  `?`, the same convention the other two windows use.
- The spend-limit reset lies more than 32 days out, or is in milliseconds instead of
  seconds: the reset reads `?` rather than a nonsense countdown, as for the other two
  windows.
- The spend-limit figure is negative, not a number, or infinite: the entry is treated as
  absent rather than drawn.
- The entry disappears between redraws (its reset passed, or the gateway stopped reporting
  it): the chip goes away on the next redraw rather than holding its last value.
- A narrow terminal: the spend-limit chip is shed by the same priority rules as every other
  segment, and it outranks the 5-hour and 7-day chips, because in a gateway setup it is the
  allowance that decides whether work can continue.
- Plain mode (`CLAUDE_STATUSLINE_ASCII=1`) and `NO_COLOR`: the chip and the at-limit form stay
  readable without glyphs or colour. The band is still marked in characters.
- The window reads 100% only because of rounding (99.6% rounds to 100): the at-limit form
  follows the rounded figure the bar already shows, so the two never disagree on screen.
- The 5-hour window is at 100% with enough history for a burn rate: the run-out projection
  is not drawn, since it would forecast a limit the chip beside it already says was reached.
  Found while running the quickstart.
- Both windows are exhausted and a spend-limit entry is present: each window shows its
  at-limit form, and the spend-limit chip shows its own figure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST read `rate_limits.spend_limit.used_percentage` and
  `rate_limits.spend_limit.resets_at` from the payload when present, applying the same
  validation it already applies to the 5-hour and 7-day entries.
- **FR-002**: When the spend-limit entry is present and valid, line 3 MUST show it as its own
  chip with its figure and reset, labelled so it cannot be mistaken for the 5-hour or 7-day
  window.
- **FR-003**: The spend-limit figure MUST be shown as reported, including values above 100%.
  It MUST NOT be capped, rescaled, or combined with the other two windows.
- **FR-004**: The spend-limit chip MUST use the same band colouring and character band mark
  as the other allowance chips, with anything at or above 100% in the exhausted band.
- **FR-005**: When the spend-limit entry is absent or invalid, the statusline MUST show no
  chip for it and MUST NOT reserve space for it. This differs deliberately from the
  5-hour and 7-day chips, which show `?%` when absent: those allowances apply to every
  account, while the spend limit applies only to some.
- **FR-006**: A 5-hour or 7-day window whose displayed figure is 100% or more MUST render in
  an at-limit form: its percentage and band mark followed by the word `full`, then the reset
  countdown or reset day as usual (for example `5h 100%▴ full · 2h09m`). The word is kept
  when the reset text is shed for width.
- **FR-007**: The statusline MUST NOT display any figure for a granted allowance that the
  payload did not carry. No figure may be derived from spend, message count, elapsed time, or
  the exhausted window's own percentage.
- **FR-008**: When a window's reset passes, the next redraw MUST reflect the payload's new
  state and MUST NOT keep showing the at-limit form or a stale spend-limit value.
- **FR-009**: The spend-limit chip MUST take part in width shedding like any other segment,
  at a fixed priority above the 5-hour window's chip and below the context figure. Its
  reset text is shed at the same step as the 7-day reset.
- **FR-010**: The diagnostic command MUST report, for each of the three allowances, whether
  the last payload carried it, and with what figure and reset. When the spend-limit
  allowance is absent it MUST explain that Claude Code reports it only behind a Claude
  gateway with spend limits.
- **FR-011**: The spend-limit chip and the at-limit form MUST stay legible in plain mode and
  with `NO_COLOR` set, with every glyph they use declared in the glyph table alongside a
  plain substitute.
- **FR-014**: The spend-limit reset MUST read as a countdown when it is less than a day
  away, as a weekday and time within six days, and as a date and time beyond that. A reset
  more than 32 days away MUST read as `?`.
- **FR-012**: The README MUST describe the spend-limit chip, the at-limit form, and the fact
  that a granted allowance can only be shown in setups whose payload reports it, with the
  illustration generated from the renderer rather than drawn by hand.
- **FR-013**: The constitution's Principle III MUST be amended, before the feature ships, to
  list `rate_limits.spend_limit` among the payload fields the statusline displays and to
  allow that figure to exceed 100%.

### Key Entities

- **Allowance**: a limit the payload reports on the user's usage. It has a name (5-hour,
  7-day, spend limit), a used percentage, and an optional reset moment. The 5-hour and
  7-day allowances apply to every account. The spend limit exists only where a gateway
  reports it.
- **At-limit state**: the condition of an allowance whose displayed percentage is 100 or
  more. For the 5-hour and 7-day windows it changes how the chip reads. For the spend limit
  it is simply the exhausted band, with the figure continuing past 100.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a spend-limit entry in the payload, the user can read how much of the
  granted allowance is used and when it resets from the bar alone, within one redraw of the
  entry appearing.
- **SC-002**: Across a sequence of payloads where the spend-limit figure changes, the bar's
  displayed figure matches the payload's rounded value on 100% of redraws.
- **SC-003**: For an exhausted window with no spend-limit entry, a reader shown the bar can
  say that the window is used up and when it returns, without taking the static figure for a
  broken statusline.
- **SC-004**: No render, in any tested state, shows a figure for a granted allowance that was
  not in the payload.
- **SC-005**: A payload with no spend-limit entry and no exhausted window renders
  byte-for-byte the same line 3 as before the change.
- **SC-006**: The diagnostic correctly reports the presence or absence of each of the three
  allowances in 100% of the tested payloads.

## Assumptions

- The organisation plan the user describes, where an administrator raises a limit, is served
  through a Claude gateway with spend limits, so the payload carries the spend-limit entry
  while the raised allowance is in use. If the user's setup is not a gateway setup, Story 1
  will not show anything for them, and Story 2 and Story 3 are what they get. This cannot be
  confirmed from the repository: the last captured payload predates hitting the limit and
  carries no spend-limit entry.
- The spend-limit entry is described from Claude Code 2.1.283's bundled schema and the
  public statusline documentation. Older Claude Code versions do not send it, and the bar
  behaves as today on them.
- Claude Code already redraws the statusline when a new message arrives, on the configured
  60-second refresh interval, and when a reported reset time passes, so no extra refresh
  mechanism is needed for the figure to move.
- "Freezing" in the report means the displayed figure stops changing at the limit, not that
  the statusline process stops running. If the process itself stops redrawing, that is a
  separate defect and out of scope here.
- Showing a remaining balance in currency or tokens is out of scope: the payload carries only
  a percentage for the spend limit, and nothing at all for granted allowances outside
  gateway setups.
- Other usage sources that Claude Code knows about internally but does not put in the
  statusline payload (such as per-model weekly windows or usage-credit balances) are out of
  scope. Principle III restricts the bar to what the payload carries.
