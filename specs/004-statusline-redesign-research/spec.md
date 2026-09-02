# Feature Specification: Research It, Then Let the Owner Build the Bar

**Feature Branch**: `004-statusline-redesign-research`

**Created**: 2026-09-02

**Status**: Closed 2026-09-02. The page shipped, the owner built with it and
chose the empty arrangement, so the bar is unchanged and story 3 is closed by
that decision. Stories 1, 2 and 4 are built. See [decisions.md](./decisions.md)

**Input**: User description: "faça uma pesquisa para que a statusline seja mais eficiente, confiável, informativa, estude e sugira melhores design, que sejam modernos e adequados além do atual, mostre-me as ideias para que eu possa escolher através no chrome, tudo o que quero, na ordem que quero, organizado conforme eu quiser, veja o que faz sentido, busque na internet e traga sugestões para que possa escolher o design final, me surpreenda."

## Context

The bar today draws twenty-four segments across four lines, and where each one
sits is decided in the source: a segment carries a line, an order within that
line, an alignment, a priority and a colour channel, and changing any of them
is a code change with a diff. That was the right call when the question was
"what gets dropped on an 80-column terminal", and it is still the right call
for the default. It is the wrong call for the person who wants the burn rate
first, the pull request last, and the token savings gone entirely.

Two of the three words in the ask already have numbers attached. *Efficient*:
a redraw is budgeted at 300 milliseconds and measures 25 at the 95th
percentile against a real 75 MB transcript, so efficiency here is not about
shaving milliseconds off a fast path. It is about the two calls that are not
fast, `gh pr view` at roughly half a second and `rtk` at a process launch,
both of which already sit behind a cache with a background refresh.

*Reliable* has a sharper edge. A cached pull request belongs to the branch it
was read on and is refused when the branch changes, git falls back to a
snapshot in a repository too big to answer in time, and the failure mode
people actually meet is a segment that quietly is not there. The bar already
has a diagnostic that explains every absence. Whether it explains them well
enough is a question this feature should answer rather than assume.

*Informative* is the open one, and it is where the outside world has moved.
The comparison research published on Claude Code statuslines counts at least
five distinct shapes: a configurable framework with a terminal editor, a
plugin-first themeable bar, a Rust binary, a Starship bridge, and a
transcript-aware operational HUD. The most widely adopted of them is the one
that reads the transcript and reports what Claude is *doing*, rather than the
one with the most segments. Meanwhile the shell-prompt world this bar borrows
its Powerline look from has been moving the other way, toward minimal left
sides with everything pushed to the right margin. Both trends are legible
advice and they point in opposite directions, which is why this should be a
choice made from a board rather than an argument settled in a pull request.

There is a precedent for how to settle it. Feature 003 asked a similar
question with six animation candidates, generated into a board, opened in the
browser and judged at the real redraw interval, and the answer came back "none
of them", which cost one script and no renderer changes to learn. That is the
mechanism this feature reuses and widens. This time the subject is the whole
bar rather than one segment's animation, the page is editable rather than a
gallery to read, and the outcome is expected to be an adoption rather than a
rejection.

## Clarifications

### Session 2026-09-02

- Q: does the browser page present finished designs to pick from, or does it
  let the owner assemble the bar directly? A: it lets them assemble it,
  moving segments between lines, reordering and toggling them with the bar
  redrawing as they go. Finished designs remain, as loadable starting points
  rather than as the only choice on offer.
- Q: does the chosen design replace the default everyone gets on install, or
  apply only to this owner's bar? A: both. The chosen design becomes the
  published default, and the arrangement mechanism stays available for
  anybody who wants something else, including the bar as it is drawn today.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build the bar in the browser (Priority: P1)

The owner opens a page in the browser and sees the bar as it is drawn today,
next to the full list of segments it could draw. Every segment can be turned
off, moved up or down within its line, or moved to a different line, and the
bar redraws as they do. A row of preset starting points sits above the
canvas: the current design, plus several complete alternatives that each take
a clear position on what a status bar is for, each with a short statement of
what it optimises for and what it gives up. Loading a preset replaces what is
on the canvas, and the owner is free to keep going from there. Width and
glyph mode are switches, so the same arrangement can be checked at a narrow
terminal and in the plain-text form before it is committed to. When the owner
is satisfied, the page hands back the arrangement they built, and that
outcome is written down with the reasons.

**Why this priority**: This is the request as it was made: everything I want,
in the order I want, organised how I want, chosen in Chrome. A gallery of
finished designs would have answered a narrower question, since the odds that
any one of five presets is exactly the bar this owner wants are low, and the
part they would then have to describe in words is the part the page can just
let them do. Nothing else in the feature can be built until the target
arrangement exists, and it is the only part that cannot be deferred without
losing what was asked for.

**Independent Test**: Open the page, rearrange the bar, and confirm every
rendered state is real renderer output at each width and glyph mode. It
delivers value the moment the owner can produce an arrangement they would
actually use.

**Acceptance Scenarios**:

1. **Given** the page is open, **When** the owner first looks at it, **Then**
   the bar that ships today is what is loaded, labelled as such.
2. **Given** any segment, **When** the owner turns it off, **Then** it leaves
   the bar and the remaining segments keep their positions.
3. **Given** any segment, **When** the owner moves it within its line or onto
   another line, **Then** the bar redraws in that arrangement.
4. **Given** an arrangement on the canvas, **When** the owner switches to the
   narrow width, **Then** what the arrangement drops when columns run out is
   visible rather than described.
5. **Given** an arrangement on the canvas, **When** the owner switches to the
   plain-text form, **Then** every glyph shows its substitute rather than a
   missing box.
6. **Given** the presets, **When** the owner loads one, **Then** the canvas
   becomes that design and remains editable from there.
7. **Given** the preset row, **When** the owner reads it end to end, **Then**
   it spans genuinely different positions (denser, sparser, differently
   grouped) rather than variations on the current bar, and at least one is a
   design the owner would not have asked for.
8. **Given** a finished arrangement, **When** the owner is done, **Then** the
   page hands back exactly what is on the canvas, in a form the bar can be
   told to use.
9. **Given** the outcome, **When** it is recorded, **Then** the record holds
   the chosen arrangement, which presets were rejected, and why.

---

### User Story 2 - Arrange the bar the way I want it (Priority: P2)

The owner decides which segments appear, in what order, and grouped onto
which line, and the bar obeys, without editing source and without losing the
behaviour that keeps a narrow terminal readable. A segment turned off
stays off. A segment moved to the front stays at the front, including on the
redraw where its neighbour has nothing to say. An arrangement that asks for
more than the terminal can hold still drops the least important thing rather
than wrapping.

**Why this priority**: The page in story 1 can only hand back an arrangement.
Something has to obey it, and that something is what makes the choice real
rather than a picture of a choice. It is second because it is worth more once
there is an arrangement worth honouring, and because a configurable bar with
a bad default is worse than a fixed bar with a good one.

**Independent Test**: Write an arrangement by hand, redraw, and confirm the
bar matches it; remove the arrangement and confirm the default returns
unchanged. Testable without the page from story 1 and without any new
segment.

**Acceptance Scenarios**:

1. **Given** an arrangement that hides a segment, **When** the bar redraws,
   **Then** that segment is absent and the rest keep their positions.
2. **Given** an arrangement that reorders two segments on a line, **When**
   the bar redraws, **Then** they appear in the requested order and neither
   moves again when a third segment disappears.
3. **Given** an arrangement that moves a segment to a different line,
   **When** the bar redraws, **Then** it appears on that line and the line it
   left still renders.
4. **Given** an arrangement wider than the terminal, **When** the bar
   redraws, **Then** segments are dropped by priority and no line wraps.
5. **Given** an arrangement naming a segment that does not exist or asking
   for something contradictory, **When** the bar redraws, **Then** the bar
   still renders, and the diagnostic says which entry was ignored and why.
6. **Given** no arrangement at all, **When** the bar redraws, **Then** the
   output is identical to the shipped default.
7. **Given** an arrangement produced by the page in story 1, **When** it is
   put in place unedited, **Then** the bar matches what the page showed at
   the same width and glyph mode.

---

### User Story 3 - The chosen design becomes what everyone gets (Priority: P3)

The arrangement the owner settled on stops being personal and becomes the bar
the plugin ships. Someone installing it for the first time gets the new
design, the documentation shows that design rather than the old one, and
anybody who preferred the old one can have it back through story 2 rather
than by pinning an old version.

**Why this priority**: The owner asked for a better bar, not only for the
freedom to build one, and a default nobody chose is the thing this whole
feature set out to replace. It is third because it cannot be done before the
choice exists, and because it is the only story with a blast radius beyond
this machine, which makes it the one worth doing last and carefully.

**Independent Test**: Install into a clean environment with no arrangement
configured and confirm the bar drawn is the chosen design, and that the
committed documentation images show the same thing.

**Acceptance Scenarios**:

1. **Given** a fresh install with no arrangement, **When** the bar draws,
   **Then** it is the chosen design.
2. **Given** the chosen design is adopted, **When** the documentation is
   read, **Then** every illustration in it was regenerated from the renderer
   in the same change.
3. **Given** someone who preferred the previous bar, **When** they write it
   as an arrangement, **Then** they get it back exactly.
4. **Given** the chosen design conflicts with a standing principle, **When**
   it is adopted, **Then** the principle is amended in the same change, with
   the reason recorded, rather than left contradicted.

---

### User Story 4 - Know what is slow, what is fragile, and what is missing (Priority: P4)

The research behind the redesign is written down rather than implied: what a
redraw actually costs and where, which sources fail and how the bar behaves
when they do, and which pieces of information the bar does not show that
comparable tools do. Each finding either becomes an adopted change with a
measurement beside it, or is recorded as considered and declined with the
reason.

**Why this priority**: It feeds the other three stories and it has lasting
value as a record, but it changes nothing on screen by itself, and the owner
asked to *see* ideas before reading about them. Last by sequencing, not by
importance.

**Independent Test**: Read the record and re-run the measurements it cites.
Every number in it must be reproducible on the reader's machine.

**Acceptance Scenarios**:

1. **Given** the efficiency findings, **When** a reader re-runs the cited
   measurement, **Then** they get the same shape of answer on their own
   machine.
2. **Given** a reliability finding, **When** the failure it describes is
   forced, **Then** the bar behaves as the finding says it does.
3. **Given** an informativeness finding, **When** it names something the bar
   does not show, **Then** it also names who shows it and what it costs to
   show.
4. **Given** any finding, **When** the feature closes, **Then** it is marked
   adopted with evidence, or declined with a reason.

---

### Edge Cases

- The arrangement the owner builds is one the four-line structure forbids.
  The structure is a governance rule, not a rendering accident, so the
  outcome must be either an arrangement that fits it or an explicit
  amendment, never a silently non-conforming bar.
- The owner builds something, walks away, and comes back. The page must not
  be the only copy of the work: an arrangement that exists only in an open
  tab is lost to a refresh.
- The owner ends where they started, keeping today's bar. The record must be
  able to say so, and nothing must change, as happened in feature 003.
- The arrangement puts everything on one line. The bar must fit or drop, and
  must not wrap.
- The arrangement empties a line entirely. That line is already dropped
  rather than rendered blank; the remaining lines must not shift meaning.
- The arrangement turns off every segment. The page must not present an empty
  bar as a finished design.
- Two arrangements exist at once, one for the repository and one for the
  person. The rule for which wins must be stated, not discovered.
- The page is opened on a machine with no Nerd Font installed. It must stay
  readable, since it is a document about glyphs.
- The page is opened on a day when the network is down. It must work, because
  its inputs are fixed rather than probed.
- A segment's real text is longer in one session than another, for instance a
  long branch name. The page must not let an arrangement look like it fits
  when it only fits the sample it was built against.

## Requirements *(mandatory)*

### Functional Requirements

**The page**

- **FR-001**: The feature MUST produce a single self-contained page the owner
  can open in a browser without a server.
- **FR-002**: Every bar the page draws MUST be output from the same renderer
  the installed bar uses, from fixed inputs, with no probing of the machine's
  live git state, usage or clock.
- **FR-003**: The page MUST open on the design that ships today, labelled as
  such.
- **FR-004**: The page MUST list every segment the bar can draw, including
  the ones not currently on it.
- **FR-005**: The owner MUST be able to turn any segment off and back on, and
  the drawn bar MUST follow.
- **FR-006**: The owner MUST be able to change a segment's position within
  its line, and the drawn bar MUST follow.
- **FR-007**: The owner MUST be able to move a segment to a different line,
  and the drawn bar MUST follow.
- **FR-008**: The page MUST let the owner switch terminal width between at
  least a wide and a narrow setting, so what the current arrangement sheds
  under pressure is visible rather than described.
- **FR-009**: The page MUST let the owner switch between Nerd Font glyphs and
  the plain-text substitute form.
- **FR-010**: The page MUST offer preset starting points, including the
  current design and at least three complete alternatives that differ in line
  structure or density rather than in colour or icon choice.
- **FR-011**: At least one preset MUST depart sharply from the current bar
  rather than refine it, and the page MUST say what that departure costs.
- **FR-012**: Each preset MUST carry a written position: what it optimises
  for, what it gives up, and who it is for.
- **FR-013**: Loading a preset MUST replace what is on the canvas and MUST
  leave it editable.
- **FR-014**: The page MUST warn, rather than silently accept, an arrangement
  that cannot work: no segments at all, or a line whose content cannot fit
  the narrowest supported width.
- **FR-015**: The page MUST hand back the finished arrangement in a form the
  bar can be told to use, without the owner transcribing anything by hand.
- **FR-016**: Work in progress MUST survive a page reload.
- **FR-017**: The page MUST be reproducible: regenerating it without a code
  change MUST produce no differences.
- **FR-018**: The page MUST remain readable on a machine with no Nerd Font
  installed.

**The decision**

- **FR-019**: The outcome MUST be recorded in the feature directory: the
  arrangement the owner settled on, which presets were rejected, and why.
- **FR-020**: The record MUST be able to express an arrangement that borrows
  from more than one preset, and an outcome that changes nothing.
- **FR-021**: No renderer change MUST be made before the outcome is recorded.

**The arrangement**

- **FR-022**: The owner MUST be able to choose which segments appear, without
  editing source.
- **FR-023**: The owner MUST be able to choose the order of segments within a
  line, without editing source.
- **FR-024**: The owner MUST be able to choose which line a segment belongs
  to, without editing source.
- **FR-025**: An arrangement MUST NOT disable width fitting: content wider
  than the terminal MUST still be dropped by priority rather than wrapped.
- **FR-026**: An arrangement MUST NOT make position depend on presence: a
  segment MUST NOT move because a neighbour disappeared.
- **FR-027**: An invalid or partially invalid arrangement MUST leave the bar
  rendering, MUST fall back to the default for the parts it cannot honour,
  and MUST be explained by the diagnostic.
- **FR-028**: With no arrangement present, output MUST be byte-identical to
  the shipped default.
- **FR-029**: When more than one arrangement applies, the precedence between
  them MUST be documented and MUST be visible in the diagnostic.
- **FR-030**: An arrangement handed over by the page MUST be usable as it
  stands, with no editing required to make it valid.

**The default**

- **FR-031**: The arrangement the owner settled on MUST become the design a
  fresh install draws with no arrangement configured.
- **FR-032**: The previous design MUST remain reachable as an arrangement, so
  nobody has to pin an old version to keep it.
- **FR-033**: Documentation illustrating the adopted design MUST be
  regenerated from the renderer in the same change, never hand-drawn.

**The research**

- **FR-034**: The feature MUST record what a redraw costs, broken down by
  source, with the command that reproduces the measurement.
- **FR-035**: The feature MUST record each way a source can fail and what the
  bar shows when it does.
- **FR-036**: The feature MUST record what comparable tools show that this
  bar does not, and what each would cost here.
- **FR-037**: Every finding MUST end as adopted with evidence or declined
  with a reason.

**Governance**

- **FR-038**: Any preset or arrangement that conflicts with a standing
  principle (the four-line structure, the glyph rules, or the meaning of a
  colour) MUST be marked on the page as requiring an amendment, so the owner
  is choosing with that cost in view.
- **FR-039**: Adopting a design that conflicts with a standing principle MUST
  amend that principle in the same change, with the reason recorded.

### Key Entities

- **Segment**: one thing the bar can draw. Has a name, the line and position
  it holds by default, its priority under pressure, and whether it is on.
- **Arrangement**: a complete bar. Which segments are on, in what order, on
  which line, plus where it came from and what precedence it has.
- **Preset**: a named arrangement offered as a starting point, with a written
  position and any principle it conflicts with.
- **Composer page**: the browser surface holding the segment list, the
  canvas, the presets, the width and glyph switches, and the handover.
- **Decision record**: the arrangement the owner settled on, the presets
  rejected, and the reasons.
- **Finding**: one research result about efficiency, reliability or
  informativeness, with its evidence and its disposition.

### Key Entities

- **Design candidate**: one whole-bar design. Has a name, a stated position,
  the rendered output at each width and glyph mode, and any principle it
  conflicts with.
- **Board**: the page holding every candidate plus the current baseline,
  generated from fixed inputs.
- **Decision record**: the owner's outcome. Winner, rejects, reasons, and any
  mixing of candidates.
- **Arrangement**: the owner's declared bar. Which segments, in what order,
  on which line, plus where it came from and what precedence it has.
- **Finding**: one research result about efficiency, reliability or
  informativeness, with its evidence and its disposition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can produce an arrangement they would actually use in
  one sitting, without asking for anything to be re-rendered or hand-edited.
- **SC-002**: Every segment the bar can draw is reachable from the page, and
  each one can be turned off, reordered and moved between lines.
- **SC-003**: Any arrangement on the canvas can be seen in at least four
  forms: two widths times two glyph modes.
- **SC-004**: The page offers at least four presets including the current
  design, and at least two of them differ in line structure or density rather
  than in colour or icon choice.
- **SC-005**: Regenerating the page twice in a row produces no differences.
- **SC-006**: An arrangement handed over by the page renders identically in
  the terminal at the same width and glyph mode.
- **SC-007**: A closed and reopened page still holds the arrangement that was
  being built.
- **SC-008**: With no arrangement configured, output is unchanged from the
  design that was adopted, and every documentation image shows that design.
- **SC-009**: An arrangement never causes a wrapped line at any terminal
  width down to 60 columns.
- **SC-010**: A redraw with an arrangement applied stays inside the same
  300-millisecond budget the bar already holds, and the measured 95th
  percentile does not regress against the recorded baseline.
- **SC-011**: The previous design can be restored as an arrangement and
  matches what shipped before, segment for segment.
- **SC-012**: Every failure mode named in the research can be forced, and in
  each case the bar renders and the diagnostic names the cause.
- **SC-013**: Every finding is closed as adopted or declined, with none left
  open when the feature closes.

## Research Inputs

Gathered 2026-09-02. These shaped the candidate set and belong in the record
rather than in the requirements.

- Claude Code statuslines have settled into at least five distinct product
  shapes rather than one house style: a configurable framework with an
  interactive editor, a plugin-first themeable bar, a compiled binary with
  built-in themes, a bridge that reuses an existing prompt configuration, and
  a transcript-aware operational display. The most-adopted of them is the one
  that reports what the agent is doing, not the one with the most segments.
  ([Claude Code Statuslines Compared](https://yigitkonur.com/research/claude-code-statuslines-compared))
- The advice repeated across write-ups is that a status line is a visibility
  layer rather than a second application, and that it should be short enough
  to read instantly, which argues against density and against this bar's
  twenty-four segments as a default.
  ([Level Up Your Claude Code With Statusline](https://medium.com/itnext/level-up-your-claude-code-with-statusline-49524efe3b88),
  [Top Claude Code Status Line Setups (2026)](https://mcsaguru.com/top-claude-code-statusline-setups-2026))
- The shell-prompt world this bar borrows its Powerline look from is trending
  toward minimal left content with the rest pushed to the right margin, and
  toward themes that do not require a Nerd Font at all.
  ([Why I Switched from Oh My Posh to Starship](https://corti.com/why-i-switched-from-oh-my-posh-to-starship-and-what-my-config-looks-like/),
  [Starship Prompt Complete Guide 2026](https://viadreams.cc/en/blog/starship-prompt-guide/))
- One documented lineage optimises explicitly for peripheral vision: a single
  large context bar in place of a number, aggressive colour severity, and
  fewer visual bands so the state registers without being read. This is the
  direct counter-argument to the decision taken here on 2026-08-26, when the
  context progress bar was removed for spending sixteen columns on what three
  columns already said.
- Colour-coded progress conventions are stable and worth not reinventing:
  green on track, amber attention, red urgent. That is the ramp this bar
  already uses.
  ([Progress bar design](https://prettyprogress.app/blog/progress-bar-examples))

## Out of Scope

- Any redraw loop, daemon or animation. The bar is printed once per
  invocation and stays static; feature 003 settled that motion is not worth
  its cost here.
- A configuration editor inside the terminal. The browser page is the
  building surface; the bar itself reads a declared arrangement and nothing
  more.
- Live coupling between the page and a running session. The page hands over
  an arrangement; it does not drive the installed bar.
- New data sources requiring network calls beyond the ones already cached.
- Changing what any existing segment means. This feature moves, hides and
  regroups; it does not redefine.

## Assumptions

- The owner is the sole judge of the design that ships. No wider user
  research is planned and none is needed, and story 2 is the answer for
  anybody who disagrees with the result.
- The page is generated into the feature directory and opened in the browser,
  following feature 003's shape, because that mechanism has already produced
  one clean decision in this project. What is new here is that it is editable
  rather than a gallery.
- Presets and arrangements are drawn from the segments that exist today.
  Inventing new information to display is a separate feature, and story 4
  will say if that turns out to be the real gap.
- The 300-millisecond redraw budget, the four-line structure, the priority
  model and the glyph rules stand unless the owner's choice explicitly
  requires amending them. Priority stays a property of the segment rather
  than something the arrangement sets, so what survives a narrow terminal
  remains a decision taken once rather than one taken per arrangement.
- The record and all code stay in English, as the project requires, even
  though the request was written in Portuguese.
