# Contract: the animation table

`src/animations.js` exports the candidate sequences and the frame lookup. Both
the renderer and `scripts/generate-animation-board.js` import it, so the
preview page and the bar can never disagree about what a candidate is.

## Exports

```js
/** Every candidate, in the order the preview page lists them. */
export const ANIMATIONS = [ /* Candidate objects, see data-model.md */ ];

/** One candidate by key, or undefined. */
export function animation(key);

/** Which candidate a segment plays. Undefined means the segment does not animate. */
export function animationFor(segmentKey);

/**
 * The glyph to draw for a segment on this render.
 *
 * `frame` is renders-since-change, from the change state. Past the last frame
 * the sequence holds on its final one rather than looping, so a window longer
 * than the sequence does not restart it.
 * Returns `settled` when the segment has no animation, when `frame` is null,
 * or when animation is off.
 */
export function frameFor(segmentKey, frame, { ascii = false, settled });
```

## Rules

- `frameFor` is total: every combination of arguments returns a string, and no
  argument makes it throw. A statusline that threw because a frame index was
  out of range would be a bar that vanished for a cosmetic feature.
- `frameFor` never returns a string of a different display width from
  `settled`. The tests assert this across every candidate and every frame.
- Adding a candidate means adding its codepoints to
  `scripts/extract-glyphs.py` and regenerating `src/preview/glyphs.json`.
  Principle X requires the two lists to agree, and the preview page reads the
  outlines.
