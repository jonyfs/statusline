# Phase 0 Research: Something Moves When Something Changes

**Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

Every codepoint named below was checked against the installed
FiraCodeNerdFontMono-Regular cmap table and then rendered from that font and
looked at, per Principle X. The sheet is committed as
[`glyph-candidates.png`](./glyph-candidates.png).

## Decision 1: the frame index is per segment, counted in renders

**Decision**: The change state file gains a `frames` map, one entry per
highlighted segment, holding how many renders have happened since that
segment's change. It is set to 0 when a change is detected, incremented on
every render while the segment is still highlighted, and dropped when the
thirty-second window expires.

**Rationale**: The state file already carries a single `frame` counter that
advances per render and wraps at 4. It is unused, and it cannot be used as it
stands: it is global, so a segment whose change arrives on render 7 would
start its animation on frame 3 and play the sequence from the middle. A reader
would see a puzzle piece that begins already assembled. Counting per segment
is the only way a sequence starts at its first frame.

Counting renders rather than dividing elapsed time by an assumed interval also
keeps the animation honest when the interval is not what we assumed. A session
that goes idle mid-animation advances one frame in the next minute instead of
jumping four frames because sixty seconds passed.

**Alternatives considered**:

- *Elapsed time divided by 5.5 seconds*: rejected. It bakes an assumption
  about the render interval into arithmetic, and it skips frames whenever the
  real interval is longer, which is exactly the case the spec's idle edge case
  is about.
- *Reusing the global counter with a per-segment offset*: rejected. The offset
  is the per-segment counter, arrived at by a longer route.

## Decision 2: what the candidates are

Eight families were checked. Four survived; the rejections are recorded
because a name in a Nerd Font table is not evidence of its glyph, and this
sweep produced four more examples of that.

### Survivors

| Candidate | Frames | Codepoints | Reads as |
|---|---|---|---|
| Pie fill | 4 | `F0A9E` `F0AA0` `F0AA2` `F0AA5` | a quarter, half, three-quarter and full disc. Mechanical, neutral, unmistakably progressing |
| Pac-Man | 2 or 4 | `F0BAF` `F0765` (+ `F02A0` ghost) | a mouth opening and closing, optionally chased by a ghost |
| Puzzle snap | 3 | `F1427` `F0431` `F1426` | an outline, then a filled piece, then a piece with a tick |
| Robot blink | 2 | `F06A9` `F167A` | two robot heads that differ enough to read as a blink |
| Twinkle | 2 | `F04D2` `F04CE` | an outline star filling in |

Pie fill is the only survivor with more than three frames, which matters:
the spec's budget is about five frames on a busy session, and a four-frame
sequence is the largest that completes inside the window without repeating.

Puzzle snap and robot blink are the two that mean something rather than just
moving: the puzzle piece is already the skills icon and the robot is already
the model icon, so their animations are the segment's own icon doing
something, not a foreign glyph borrowed for thirty seconds.

### Rejected, with what the glyph actually draws

| Codepoint | Table name | What it draws |
|---|---|---|
| `F01D5`-`F01DA` | `dice_1` .. `dice_6` | a boxed division sign, a list, a building, three dots, three vertical dots, a download arrow. No dice anywhere in the range |
| `F083A` | `space_invaders` | a crossed-out television |
| `F0BA9` | `puzzle_outline` | a comb |
| `F1683`-`F1687` | `robot_excited` and friends | bookmark icons |
| `F5FE` | `git_pull_request_draft` | absent from this font build |

**Alternatives considered**: a rotation sequence (`F04E6`, `F0450`, `F0453`
are sync, refresh and restore, but no font ships the same arrow at four
angles, so a "spinner" would jump between three unrelated shapes); the
Canadian syllabics Pac-Man pair `ᗧ`/`ᗤ`, rejected because Principle I now
requires a Nerd Font glyph where one exists and `F0BAF` is one.

## Decision 3: the no-Nerd-Font animation is the Braille spinner

**Decision**: The substitute set animates with Braille dot patterns
(`U+2801`-`U+28FF`), the eight-frame pattern every CLI spinner uses.

**Rationale**: Principle I requires every glyph to have a substitute, and
FR-016 requires the substitute to animate rather than falling back to a still
segment. Braille is plain Unicode, one column wide, present in essentially
every monospace font, and it is the one animation a terminal reader already
recognises. It is also the only candidate that keeps a constant width for
free, since every Braille cell in the range is the same width.

**Alternatives considered**: emoji sequences, rejected because they are two
columns wide and the whole animation would shove the line sideways; the ASCII
`-\|/` spinner, rejected because the backslash and the pipe are visually much
heavier than the dash and it reads as flicker rather than rotation.

## Decision 4: the preview page draws real glyph outlines, not a font

**Decision**: The preview page embeds the same extracted glyph outlines the
SVG previews already use (`src/preview/glyphs.json`), and is generated by a
script into the feature directory as a single self-contained HTML file.

**Rationale**: FR-007 requires the page to open in a browser with nothing
installed, and FR-005 requires it to show both the Nerd Font form and the
substitute. A page that relied on the reader having a Nerd Font would show
boxes to exactly the audience that has not installed one, which is the group
FR-005 exists for. The outlines are already extracted, already committed and
already proven to render on GitHub's own README renderer, so the mechanism is
borrowed rather than invented. The candidate codepoints above need adding to
`scripts/extract-glyphs.py`, which Principle X requires anyway for any glyph
the bar can emit.

Generating the page from a script rather than writing it by hand keeps the
frame tables in one place: the page and the renderer read the same candidate
definitions, so a page showing an animation the bar cannot draw is not
possible.

**Alternatives considered**: a hand-written HTML mockup, rejected because it
would drift from the real frame tables the moment either changed; a live
terminal recording, rejected because it cannot show the two intervals side by
side and cannot be regenerated.

## Decision 5: the switch is `animate`, and previews are already covered

**Decision**: A new setting, `CLAUDE_STATUSLINE_ANIMATE=0` and `"animate":
false` in `.statusline.json`, defaulting to on. Generated previews need no new
flag.

**Rationale**: The settings resolver already has the shape for this: an
environment variable wins, then the repository file, then the default. Nothing
new is needed but a key.

Preview generation already passes `trackChanges: false`, and that path returns
a tracker whose `isChanged` is always false and whose `iconFor` always returns
the static icon. Animation therefore cannot appear in a generated preview, and
FR-020 and SC-006 hold without a second switch. That is worth stating rather
than assuming, because it is the only reason regenerating previews stays
byte-reproducible.

**Alternatives considered**: per-segment switches, rejected as configuration
nobody asked for; making animation opt-in, rejected because a feature built to
catch the eye that nobody turns on has no effect.

## Decision 6: constant width is enforced by a test, not by care

**Decision**: Every candidate's frames are asserted to have equal display
width, and the animated segments are asserted to keep a constant line width
across a full animation.

**Rationale**: FR-012 and SC-003 both hang on this, and it is the failure mode
that would be most annoying and least obvious: every segment after the
animated one sliding a column back and forth once every five seconds. The
project already measures display width in columns, so the assertion is cheap.
Left to review, it would survive exactly until somebody added a frame whose
glyph happened to be two columns wide.
