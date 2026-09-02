# Decisions: Something Moves When Something Changes

**Decided**: 2026-09-01, by the owner, from the generated board
**Board**: [animation-board.html](./animation-board.html) · published at
<https://claude.ai/code/artifact/e44a63d1-4a4b-412a-8288-19b5d6e5d7e7>

## Outcome: no candidate is adopted

| Segment | Chosen |
|---|---|
| branch | none |
| pull request | none |
| skills | none |
| model | none |

The four tracked segments keep the mark they have today: the colour brightens
for thirty seconds after a change and then settles back. Nothing moves.

This is the answer User Story 1 was built to get, and getting it cost one
module, one generator and no change to the renderer. The spec said so in as
many words: "If the answer turns out to be 'none of these are funny enough to
be worth the width', the project has spent one script and no renderer changes
finding that out, which is the cheapest possible place to learn it."

## Why each candidate was rejected

Judged from the board, playing at the real interval, in both the Nerd Font and
the substitute form.

| Candidate | Frames | Rejected because |
|---|---|---|
| Pie fill | 4 | Reads as progress, not as change. A disc filling up beside three percentages that are also filling up adds a fourth thing that looks like a level |
| Pac-Man | 2 | The funniest of the six and the one whose silhouette changes most, but two frames over thirty seconds is one wobble, and a Pac-Man on line 1 is a joke that stops being funny the fourth time you see it that hour |
| Puzzle snap | 3 | The most semantic: it is the skills icon assembling itself. Still not worth taking the icon away for thirty seconds when the colour already says the same thing |
| Robot blink | 2 | `F06A9` and `F167A` are too similar at one column. On the board they read as a tremor rather than a blink, which is the failure the board existed to expose |
| Twinkle | 2 | Legible, and the closest to a general vocabulary for "this changed". Rejected with the rest: a star is not the segment's own icon, so for thirty seconds the segment stops saying which segment it is |
| Braille spinner | 4 | The only candidate that works identically with and without a Nerd Font, and the only one every terminal reader already recognises. That recognition is the problem: it means "working", not "changed" |

## What was settled along the way

Recorded because a future attempt should not have to ask again.

**An animation replaces the segment's icon rather than sitting beside it.**
Confirmed by the owner. The text beside the icon stays readable in every
frame, so nothing is lost, and the alternative costs two permanent columns on
a bar that already drops segments by priority when the terminal is narrow.

**The frame budget is about five frames, or one.** Measured, not assumed:
Claude Code re-invokes the bar roughly every 5 to 6 seconds during activity
and every 60 seconds at the installed refresh interval. Any future candidate is
designed against five and must still read at one. Three of the six rejections
above are really this constraint biting.

**A codepoint's name is still not evidence of its glyph.** The sweep behind
these candidates rejected four more families on that ground: the whole
`dice_1`..`dice_6` range draws unrelated icons, `space_invaders` draws a
crossed-out television, `F0BA9` "puzzle_outline" draws a comb, and
`robot_excited` and its siblings draw bookmarks. The rendering is in
[`glyph-candidates.png`](./glyph-candidates.png).

## What this closes

User Story 2 and User Story 3 are closed by this decision rather than by
implementation. Story 2 builds whatever this file names, and this file names
nothing; story 3 is the off switch for a feature that does not exist.

## What was kept

- `scripts/animation-candidates.js` and
  `scripts/generate-animation-board.js`, so the board can be regenerated and
  the decision re-examined against the same frames.
- The candidate codepoints in `scripts/extract-glyphs.py` and their outlines in
  `src/preview/glyphs.json`, which is what lets the board render for a reader
  with no Nerd Font. Neither file ships to users: `package.json` excludes
  `src/preview`, and `scripts/` is not in its `files` list.
- Nothing in `src/` that the bar loads. The renderer, the change tracker and
  the settings resolver are untouched, so the shipped statusline is exactly
  what it was before this feature was specified.
