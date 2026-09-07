# Feature Specification: Explaining a segment

**Feature ID**: `019-explaining-a-segment`

**Status**: Draft — the request as literally stated cannot be built; see Constraint

**Date**: 2026-09-07

**Input**: Add a tooltip on mouse hover over the statusline, explaining what
each piece of displayed information means.

## The need behind the request

The bar shows twenty-two segments across three lines. Several are legible only
once someone has been told what they are: `▴` beside a percentage, `+214 −87`,
`󰈸 35%/h`, `5h limit ~13:05`, a hammer against a coffee cup. A reader who did
not build it has no way to ask the bar itself what any of that means.

That need is real and is what this spec addresses. The mechanism asked for is
not available.

## Constraint: the terminal has no hover

The statusline is text printed by a process that then exits. It does not own
the screen, has no event loop, and never reads input — Claude Code owns the
terminal and calls this command for a string. Nothing is listening when a
pointer moves, so there is nothing that could raise a tooltip.

Nor is there a terminal escape sequence for one. OSC 8 attaches a *link* to a
run of text, and a terminal that supports it reveals the **target URL** on
hover; it carries no arbitrary tooltip text. There is no ANSI or OSC facility
for hover text, and inventing one would mean owning the terminal, which this
project cannot and should not do.

Building a hover tooltip would therefore require replacing the statusline with
a full-screen application, which is a different product.

## What can deliver the same need

Three routes, in descending fidelity to "hover and it tells you". They are
independent; any subset is worth having.

### A. Real hover, where hover exists — the composer page

`specs/004-statusline-redesign-research/composer.html` already renders the
real bar from real segment values and is opened in a browser. Hover works
natively there. Giving every segment a description shown on hover puts the
answer exactly where the gesture the request describes actually works, and
costs the terminal nothing.

### B. A link per segment, so the terminal's own hover says something

Every segment can carry an OSC 8 link at **zero display columns**. Pointed at
the README section that explains it, a terminal that previews link targets
shows something on hover, and clicking opens the explanation. Three segments
already carry links (directory, branch, pull request), so the mechanism is
proven here.

The cost is real and must be decided rather than assumed: several terminals
underline linked text, and underlining twenty-two segments would change how
the whole bar looks.

### C. Asking the bar in words

`doctor` already reports every segment with its value, source, age, cost and
why it is not shown. What it does not say is what any of them *means*. One
sentence per segment, from the same registry the bar renders from, turns the
existing diagnostic into the thing a reader can ask.

## Requirements

- **FR-001**: Every segment the registry defines has one plain-language
  sentence saying what it means, held in one place rather than repeated per
  route.
- **FR-002**: A segment added to the registry without a description fails a
  test, so the two cannot drift.
- **FR-003**: The composer page shows a segment's description on hover.
- **FR-004**: `doctor` reports the description beside each segment.
- **FR-005**: The bar's own appearance in the terminal is unchanged unless
  route B is explicitly chosen, since it is the only one with a visual cost.

## Success Criteria

- A reader who has never seen the bar can name what every segment shows,
  without reading the source.
- Adding a segment without describing it fails the suite.
- The rendered bar is byte-identical to today's unless route B is adopted.

## Assumptions

- The descriptions are the same text everywhere; a segment does not mean one
  thing in the diagnostic and another on the page.
- Wording follows the project's existing voice: what it shows and why it earns
  its width, not restating the label.

## Out of Scope

- Any mechanism requiring the statusline to own the terminal or read input.
- Translating the descriptions. Principle VI makes the codebase English-only.

## Open question for the owner

Route B is the only one that changes how the bar looks, and only on terminals
that underline links. It is also the only one that answers a hover *in the
terminal*, which is what was asked for. Whether that trade is worth making is
a decision, not a detail.
