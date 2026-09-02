# Feature Specification: Something Moves When Something Changes

**Feature Branch**: `003-status-change-animations`

**Created**: 2026-09-01

**Status**: Draft — the animation set is chosen from the browser preview before any of it reaches the bar

**Input**: User description: "considere adicinar animaçoes quando algum dos status muda, apenas para chamar a atençao do usuário que está olhando o console, simule alguma animaçao nerd e engraçada, considere mostrar o design no browser antes"

## Context

The bar already marks a change: when the branch, the pull request, the active
skills or the model differ from the previous render, that segment's colour
brightens for thirty seconds and then settles back. Colour was chosen over a
moving icon in August 2026 because a brighter block is noticed before it is
read.

What colour does not do is move. Somebody working with the terminal in the
corner of a second monitor sees a static bar, and a shade of green that got
slightly greener is not what pulls the eye back. The ask here is for the four
tracked segments to do something visibly different for a few seconds — with
enough personality that it is worth looking at rather than just detectable.

The honest budget is small, and every decision below is shaped by it. The
statusline is printed once per invocation and is then static text: this
process exits, and nothing redraws it. A frame can only advance when Claude
Code asks for the bar again, which it does roughly every 5 to 6 seconds while
work is happening, and every 60 seconds when it is not. A thirty-second
highlight window is therefore about five frames on a busy session and one
frame on an idle one. Nothing here can be smooth, and anything specified as
though it could be would ship as a promise the terminal cannot keep.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose the animation by looking at it, before it ships (Priority: P1)

The owner opens a page in a browser that plays every candidate animation side
by side, at the real frame rate the terminal will give them, and picks the
ones worth building. Rejected candidates cost nothing but the time it took to
look at them.

**Why this priority**: "Nerd and funny" is a judgement, not a requirement, and
it cannot be settled by writing it down. A candidate that reads as charming in
a description can read as a glitch on a real bar. The page is also the only
way to see the frame budget honestly: a candidate that needs ten frames to be
funny will visibly fall apart at five, and that is far cheaper to discover in a
browser than after it is wired into the renderer. This story stands alone
because a decision is the deliverable, and the decision has value even if
nothing is built afterwards.

**Independent Test**: Open the page with no part of the animation feature
implemented in the bar. Every candidate plays, each is labelled, and a reader
who has never seen the code can say which ones they want and why.

**Acceptance Scenarios**:

1. **Given** the preview page is open, **When** the reader looks at a
   candidate, **Then** it plays at the same interval a busy session gives
   (about one frame every 5 to 6 seconds) and states that interval on screen.
2. **Given** the preview page is open, **When** the reader wants to judge the
   idle case, **Then** they can see the same candidate at the 60-second
   interval, where it will show one or two frames and nothing more.
3. **Given** a candidate is playing, **When** the reader compares it against
   the segment as it renders today, **Then** both are visible together, so the
   comparison is against the current bar rather than against memory.
4. **Given** the reader has decided, **When** they record their choices,
   **Then** the decisions are written down beside the spec, naming which
   candidate was chosen for each segment and which were rejected and why.
5. **Given** a candidate uses glyphs the terminal needs a Nerd Font for,
   **When** it is shown on the page, **Then** its no-Nerd-Font substitute is
   shown too, because a candidate that only works for people with the font is
   half a candidate.

---

### User Story 2 - The bar moves when something changes (Priority: P2)

A tracked value changes while the reader is looking somewhere else. The
segment that changed plays its animation over the next few renders, so the
motion is what brings the eye back, and then it settles.

**Why this priority**: This is the feature. It ranks second because there is
nothing to build until story 1 has said what.

**Independent Test**: Drive a session through a branch switch, a pull request
appearing, a skill activating and a model change, capturing every render.
Each capture differs from the one before it in the animated segment only, and
the sequence ends back at the settled form.

**Acceptance Scenarios**:

1. **Given** a session with a known previous state, **When** the branch
   changes, **Then** the branch segment renders its first animation frame on
   the next render and advances one frame per render after that.
2. **Given** an animation is playing, **When** thirty seconds have passed
   since the change, **Then** the segment renders its settled form, with no
   half-played frame left behind.
3. **Given** two tracked values change in the same render, **When** the bar
   draws, **Then** both segments animate, and neither is suppressed to keep
   the line quiet.
4. **Given** a session with no previous state on record, **When** the bar
   draws for the first time, **Then** nothing animates, because an absent
   baseline is not a change.
5. **Given** the animation is playing on a segment, **When** the line is
   measured, **Then** its width is the same in every frame, so no neighbour
   shifts sideways while the animation runs.
6. **Given** a terminal with no Nerd Font, **When** an animation plays,
   **Then** it plays in the substitute set rather than showing empty boxes or
   silently doing nothing.
7. **Given** a usage percentage or a working-tree count changes, **When** the
   bar draws, **Then** nothing animates, because those move on nearly every
   render and a bar permanently in motion says nothing at all.

---

### User Story 3 - It never gets in the way (Priority: P3)

Somebody who finds the motion distracting turns it off and gets the bar as it
renders today. Somebody generating documentation gets a still bar without
having to think about it.

**Why this priority**: The motion is there to be noticed, which is exactly
what makes it a problem for a reader who does not want to be interrupted. A
feature whose whole purpose is to catch the eye needs a way to stop catching
it. It ranks third because the default is the interesting case and this is the
escape hatch.

**Independent Test**: Render the same changed state twice, once with animation
enabled and once disabled, and confirm the disabled render is identical to
what the bar produces today.

**Acceptance Scenarios**:

1. **Given** animation is turned off, **When** a tracked value changes,
   **Then** the segment marks the change the way it does today and nothing
   moves.
2. **Given** a documentation preview is being generated, **When** it renders,
   **Then** it produces the same bytes on every run, with no frame depending
   on when it happened to be generated.
3. **Given** the reader has never configured anything, **When** they install
   the plugin, **Then** the setting has a stated default and the README says
   what it is and how to change it.

---

### Edge Cases

- **A change lands while an animation is already playing on the same
  segment.** The branch changes, and two renders later it changes again. The
  animation restarts from its first frame and the thirty seconds restart with
  it, because the second change is the one worth looking at.
- **The session goes idle mid-animation.** Renders drop to one a minute, so a
  five-frame animation gets one more frame and then the highlight window
  expires. The segment must settle rather than sit on frame two indefinitely.
- **The terminal is too narrow for the segment.** An animated segment that
  gets dropped by priority is simply not there; the animation does not force
  it back onto the line.
- **Frames have different widths.** A candidate whose frames are not all the
  same width would shove every segment after it back and forth once per
  render. Either the candidate is padded to a constant width, or it is not a
  candidate.
- **The state file cannot be read or written.** The bar renders without
  animation rather than failing.
- **Two terminals share one session.** Both read the same change state, so
  both animate; neither is expected to be in step with the other.
- **The clock jumps backwards.** A change stamped in the future must not hold
  a segment animating forever.

## Requirements *(mandatory)*

### Functional Requirements

**The preview**

- **FR-001**: The preview MUST show every candidate animation playing, one
  frame at a time, at the interval a busy session produces.
- **FR-002**: The preview MUST let the reader switch to the idle interval, so
  the worst case is visible rather than described.
- **FR-003**: The preview MUST show, for each candidate, every frame at once
  as a still strip, so a reader can judge the frames without waiting for them.
- **FR-004**: The preview MUST show each candidate beside the segment as it
  renders today, in the same palette.
- **FR-005**: The preview MUST show each candidate in both the Nerd Font form
  and the substitute form.
- **FR-006**: The preview MUST name, for each candidate, which segment it is
  proposed for and how many frames it needs.
- **FR-007**: The preview MUST be openable in a browser with nothing
  installed and no server running.
- **FR-008**: The choices made from the preview MUST be recorded in writing
  beside this spec, including the rejections and the reason for each.

**The animation**

- **FR-009**: When a tracked value differs from the previous render, its
  segment MUST begin its animation on the next render.
- **FR-010**: An animation MUST advance exactly one frame per render.
- **FR-011**: An animation MUST end within thirty seconds of the change and
  leave the segment in its settled form.
- **FR-012**: Every frame of an animation MUST occupy the same number of
  terminal columns.
- **FR-013**: The animated segments MUST be exactly those already tracked for
  change: branch, pull request, active skills and model. No usage percentage,
  working-tree count or reset countdown animates.
- **FR-014**: A session with no recorded previous state MUST render every
  segment settled.
- **FR-015**: A change arriving while an animation is playing MUST restart
  that animation and its window.
- **FR-016**: Every animation MUST have a substitute form for terminals with
  no Nerd Font, and the substitute MUST animate too rather than falling back
  to a still segment.
- **FR-017**: An animation MUST NOT use terminal blink.
- **FR-018**: An animation MUST NOT change what the segment says. The branch
  name, the pull request number, the skill list and the model name stay
  readable in every frame.

**Control**

- **FR-019**: Users MUST be able to turn animation off and get today's
  rendering.
- **FR-020**: Generated documentation previews MUST render with animation
  off, so regenerating them produces no diff.
- **FR-021**: The default state MUST be stated in the README along with how to
  change it.
- **FR-022**: A failure to read or write the change state MUST leave the bar
  rendering without animation rather than failing.

### Key Entities

- **Candidate animation**: a named set of ordered frames proposed for one
  segment, in both a Nerd Font form and a substitute form, with a stated frame
  count and a one-line description of what it is meant to convey.
- **Animation state**: per session, per segment, what changed and when, and
  which frame the segment is on. Disposable, pruned when stale, and never
  required for the bar to render.
- **Settled form**: what a segment looks like when nothing has changed
  recently — that is, what the bar renders today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader glancing at a terminal in peripheral vision notices
  that something changed within two renders of the change, without having read
  any segment.
- **SC-002**: The owner can pick the shipped animation set from the preview in
  a single sitting, with no code written and nothing installed.
- **SC-003**: Across a full animation on every animated segment, the width of
  each rendered line stays constant, so nothing on the bar moves sideways.
- **SC-004**: Thirty seconds after any change, the bar is indistinguishable
  from the bar as it renders today.
- **SC-005**: Turning animation off produces a bar byte-identical to today's
  output for the same input.
- **SC-006**: Regenerating the documentation previews twice in a row produces
  no difference.
- **SC-007**: A session that renders with animation costs no more time per
  render than a session that renders without it, within the render budget the
  project already holds itself to.
- **SC-008**: A reader with no Nerd Font sees the same animation, in
  substitute characters, with no empty boxes.

## Assumptions

- **The frame budget is five frames, not thirty.** Claude Code re-invokes the
  bar roughly every 5 to 6 seconds during activity, so a thirty-second window
  holds about five frames, and one frame when the session is idle at the
  installed 60-second refresh. Every candidate is designed against five and
  must still read at one.
- **Animation is added to the existing colour mark, not substituted for it.**
  The colour shift is what makes a change detectable in peripheral vision; the
  frames are what make it worth looking at. Both mean the same thing — this
  changed recently — so the rule that a colour carries one meaning is not
  disturbed.
- **The animated set is the set already tracked.** Branch, pull request,
  skills and model. Widening it is a separate decision, and the segments left
  out were left out on purpose: the working-tree counts change on every file
  save and the percentages change on nearly every render.
- **Animation is on by default.** Catching the eye is the entire point of the
  feature, and a default that does not do that ships a feature nobody sees.
  The off switch in story 3 is what covers the reader who disagrees.
- **The preview is a committed artifact, not a throwaway.** It is kept beside
  the spec the way the redesign review board was, so the decisions can be read
  against the thing they were made from.
- **The preview is a simulation, not the renderer.** It approximates the bar
  closely enough to judge an animation. It does not prove the real terminal
  output, which is what the acceptance scenarios in story 2 are for.
- **Frames are glyphs and characters, not colour cycling.** Colour is already
  spoken for. A candidate that animates by changing hue would collide with
  both the change mark and the level ramp.
- **Existing constraints hold.** Every glyph in a shipped animation goes
  through the renderer's glyph table with a substitute, gets rendered from the
  installed font and looked at before adoption, and none of this uses terminal
  blink. These are the project's standing rules rather than new requirements,
  and they bound what a candidate can be.

## Out of Scope

- Animating the subagent task rows. They run on their own tick with their own
  contract, and pulling them in doubles the surface for no additional signal.
- Changing how often Claude Code re-invokes the bar in order to buy more
  frames. The frame budget is a constraint to design against, not a number to
  raise.
- Sound, notifications, or anything that leaves the terminal.
- Animating any segment not already tracked for change.
