# Quickstart: validating the animations

**Date**: 2026-09-01 | **Plan**: [plan.md](./plan.md)

Everything below runs from the repository root and needs nothing installed
beyond Node 18+. The one exception is regenerating glyph outlines, which is
noted where it applies.

## 1. Look at the candidates (User Story 1)

```bash
node scripts/generate-animation-board.js
open specs/003-status-change-animations/animation-board.html
```

On Linux use `xdg-open`, on Windows `start`. The page is one self-contained
file: no server, no font, no network.

What to check against the story's acceptance scenarios:

- Every candidate plays, and the page states the interval it is playing at.
- The busy interval (about one frame every 5 to 6 seconds) and the idle one
  (60 seconds) can both be selected, and the idle setting visibly shows how
  little of a sequence survives it.
- Each candidate appears as a still strip of all its frames as well as
  playing, so the frames can be judged without waiting.
- Each candidate sits beside the segment as it renders today, in the same
  palette.
- Each candidate shows both its Nerd Font form and its substitute form.

Record the decisions in `decisions.md` beside the spec: which candidate was
chosen for each of the four segments, and which were rejected and why. Story 2
builds whatever that file names.

## 2. Watch a segment animate (User Story 2)

The bar renders once per invocation, so an animation is watched by invoking it
several times against a state that changed. The harness case does this without
a real session; to see it by hand:

```bash
node bin/cli.js render < specs/003-status-change-animations/sample-payload.json
```

The payload carries a fixed `session_id`, so every run reads and writes the
same change state. Run it once to lay down a baseline, switch branches in the
repository, then run it four or five more times. Expect:

- The first run after the switch draws frame 1 of the branch segment's sequence.
- Each further run advances exactly one frame.
- Thirty seconds after the switch, the segment is back to its settled icon, not
  parked on a frame.
- Nothing else on the line moves, and the line's width never changes.

Then check the cases the eye will not catch:

```bash
npm test
```

The suite covers first render (nothing animates), a change arriving
mid-animation (the sequence restarts), two segments changing at once (both
animate), expiry, the no-Nerd-Font substitute, and constant width across every
frame of every candidate.

## 3. Turn it off (User Story 3)

```bash
CLAUDE_STATUSLINE_ANIMATE=0 node bin/cli.js render < path/to/payload.json
```

Expect the bar the project renders today: the colour still brightens on a
change, and no icon moves. The suite asserts this render is byte-identical to
the same input rendered by the current release.

## 4. Confirm the documentation did not drift

```bash
node scripts/generate-previews.js
git diff --quiet -- docs/previews && echo "previews unchanged"
```

Generated previews render with change tracking off, so animation never reaches
them. Any diff here means animation leaked into a path that is supposed to be
reproducible, and CI fails on the same check.

## Regenerating glyph outlines

Only needed when a candidate's codepoints change:

```bash
python3 -m venv /tmp/statusline-venv
/tmp/statusline-venv/bin/pip install fonttools
/tmp/statusline-venv/bin/python scripts/extract-glyphs.py > src/preview/glyphs.json
```

Set `STATUSLINE_NERD_FONT` if the font is not at the extractor's default path.
