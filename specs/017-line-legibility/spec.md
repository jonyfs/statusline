# Feature Specification: Line 2 and Line 4 Legibility

**Feature ID**: `017-line-legibility`

**Status**: Implemented, then amended (see "What changed after" below)

**Date**: 2026-09-06

**Input**: Two owner requests. First, that line 2 show the agents running in parallel with what
each is doing. Second, that line 4 be easier to understand, because the amount of information on
it makes it hard to read.

## Problem

### Line 2 said nothing about the agents

Features 013 and 015 both claimed to put multi-agent activity on line 2 and neither did. The
aggregation they added ran only when `payload.activeAgents` was present, and Claude Code does not
send that field, so the branch never executed. A `src/lines.js` written for the same feature was
never imported by anything. Both shipped, were tagged and were installed.

What did reach the line came from feature 011, which folded the subagent labels into the skills
chip. A running agent therefore read as a skill, and once the agent chip existed the same name
could appear twice on one line.

Per-agent skills cannot be shown at all. The `PostToolUse` hook records `{skill, at}` against a
`session_id`, and nothing ties a skill invocation to a subagent, so `Agent-X: skill1, skill2`
would be invented rather than observed.

### Line 4 said the same things twice, in different units

Eight chips, four of them time-shaped and three of them percentages. The 5-hour window was told
in four pieces spread across the line, and both resets shared a segment two places away reading
`2h09m / 3d`:

- the slash read as a fraction, immediately beside `1h04m`, which really is one thing over another
- nothing said which half belonged to which window
- the 7-day reset was stated twice, as `3d` there and as `Thu 18:00` on its own chip
- the clock-face emoji carried the absolute reset hour beside a relative countdown of the same
  moment

### The working indicator could not move

The first attempt derived the frame from the clock: `floor(now / 1000) % 10`. At the real 5-to-6
second redraw that visits two of ten frames, and at the installed 60-second refresh `60 % 10` is
zero, so the indicator holds one frame forever while claiming to be a spinner.

## Requirements

- **FR-001**: Line 2 names the running subagents, each with the tier and age the tick reported,
  and counts any it cannot name.
- **FR-001a**: It names as many as the line has room for, up to three, rather than a fixed
  number. A window too narrow for both chips keeps the skills.
- **FR-002**: A field the tick did not report is omitted rather than guessed. An unresolved model
  shows no tier.
- **FR-003**: A subagent is named once on the line. Names are no longer folded into the skills chip.
- **FR-004**: No per-agent skill list is shown, since no attribution exists to read.
- **FR-005**: Each usage window on line 4 draws its own reset beside its own level.
- **FR-006**: A window resetting within a day counts down; one resetting beyond a day names the day.
- **FR-007**: A reset the payload did not carry renders as `?`, distinguishable from one shed for width.
- **FR-008**: The working indicator advances one frame per redraw from a persisted counter, never
  from the clock, and settles to a static mark under `CLAUDE_STATUSLINE_NO_SPINNER=1`.

## Success Criteria

- With four subagents running, line 2 names three from 134 columns up, two at 120 and one from
  90, always alongside the skills chip, and counts the rest at every width.
- Line 4 at its widest is 84 columns, down from 98.
- Every fact on line 4 appears once.
- All four spinner frames appear across four redraws with the clock held fixed.

## Out of Scope

The same research turned up three more problems, left alone here because each is a change of a
different kind and deserves its own decision: the mixed-width `█▓▒░` gauge in `src/ramp.js`, the
ambiguous-width `·` separator under a CJK-configured terminal, and `src/theme.js` emitting
truecolor with no fallback and no `NO_COLOR` support.

## What changed after

Written before the line had been lived with. Three of its requirements were
overtaken the same week, by the owner and by measurement, and the record is
worth more than the tidy version.

**The agent chip came off line 2 (FR-001, FR-001a).** It went on, grew to
three names with tiers and ages, and at about 134 columns crowded both the
skills chip and the working indicator off a 120-column window. The roster
moved to the subagent rows, which have a line each and now carry the tier,
the age, the context gauge and the skills. Line 2 is the session's own
skills, its todo and whether it is working. A running subagent still answers
that last question without being named.

**Per-agent skills turned out to be possible (FR-004).** The claim here was
that no attribution exists. Half right: nothing in Claude Code's contract
links the two, but the `PostToolUse` payload carries `agent_id` while
`session_id` stays the parent's, and a probe subagent invoking `humanizer`
recorded an agent id identical to its own row's task id. The rows show the
skills recorded against a running task's id, and show nothing where the ids
do not match — measured, not assumed, and degrading to silence rather than
to invention.

**A skill a subagent invoked is not the session's.** Recording the agent id
put every subagent's invocation in the file line 2 reads, which with four
agents running made that chip a list of things the reader is not doing.
Records carrying an agent are now excluded from the session's own list.

**The working indicator is a static glyph again.** The Braille pulse shipped
and came off; a hammer and a coffee cup replaced the filled and hollow discs,
chosen from a sheet of twelve candidate pairs rendered from the installed
font. The counter rule the pulse taught stays in the constitution even though
nothing animates: it cost a bug to learn.

## Also found, not fixed

Two of the three findings this spec listed as out of scope are still open. The
third is done.

- **Done**: `src/theme.js` now honours `NO_COLOR`, and drops the powerline
  separator with it, since a solid arrow is a shape cut out of two
  backgrounds and there are none without colour.
- **Done 2026-09-07**, and worse than recorded here. The set was not uniformly
  Ambiguous: `U+2591` LIGHT SHADE is Narrow while the three fills beside it are
  Ambiguous, so the gauge changed width *as it filled*; and `U+25B4` is Narrow
  while `U+25B2` is Ambiguous, so crossing 85% widened the band mark and
  shifted the busiest line of the bar. Both were self-inconsistencies rather
  than a uniform doubling, which is why they were worth fixing rather than
  documenting. The gauge's empty cell is now `U+2500`, Ambiguous like its
  fills; the marks are `U+25B5` and `U+25B4`, both Narrow. What remains
  genuinely uniform — every Ambiguous character drawn two columns wide — is
  answered by `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`, since nothing in the
  environment reports that setting.
