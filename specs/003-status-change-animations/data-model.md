# Phase 1 Data Model: Something Moves When Something Changes

**Date**: 2026-09-01 | **Plan**: [plan.md](./plan.md)

Three shapes, none of them persisted beyond a session except the state file
that already exists.

## Candidate animation

A named frame sequence proposed for one or more segments. Defined once in
`src/animations.js` and read by both the renderer and the preview generator,
so the page cannot show something the bar cannot draw.

| Field | Type | Rule |
|---|---|---|
| `key` | string | Unique. Lowercase, hyphenless, used in the setting and in tests |
| `label` | string | What a reader sees on the preview page |
| `describes` | string | One line on what the sequence is meant to convey |
| `nerd` | string[] | Frames in order, each a single Nerd Font glyph |
| `plain` | string[] | Frames in order, the no-Nerd-Font substitute. Same length as `nerd` |
| `segments` | string[] | Which of `branch`, `pr`, `skills`, `model` it is proposed for |

Validation:

- `nerd` and `plain` have the same length, and that length is at least 2.
- Every frame in `nerd` has the same display width, and so does every frame in
  `plain`. The two sets may differ from each other, since a substitute is
  allowed to be a different width from the glyph as long as it is constant.
- Every codepoint in `nerd` is present in `src/preview/glyphs.json`, or the
  preview page would draw a gap where a frame should be.
- Sequences do not loop within the window: with more frames than the window
  affords, the trailing frames simply never render, so the frames that matter
  most go first.

## Animation state

Per session, inside the change state file that already exists at
`~/.claude/statusline/state/<session>.json`. One field is added.

| Field | Type | Rule |
|---|---|---|
| `frames` | object | `{ [segmentKey]: number }`. Renders elapsed since that segment changed |

Transitions, evaluated once per render:

1. A tracked value differs from the previous snapshot: `changedAt[key] = now`
   and `frames[key] = 0`. A change arriving mid-animation lands here too,
   which is what restarts the sequence (FR-015).
2. A segment is still inside its window and did not change this render:
   `frames[key] += 1`.
3. `now - changedAt[key] > 30_000`: both `changedAt[key]` and `frames[key]`
   are deleted, and the segment renders its settled form (FR-011).
4. No previous state on file: no entry is written for any segment, so nothing
   animates on a first render (FR-014).
5. The file cannot be read or written: the render proceeds with no animation
   (FR-022). This already holds, since every access is wrapped.

The existing global `frame` field is removed. It advanced per render and
wrapped at 4, was never read, and cannot express a per-segment sequence
position.

## Settled form

What a segment renders when nothing has changed recently: its static icon from
the glyph table. Not stored anywhere. Named here because three requirements
are stated against it, and because "the animation ends" means "the segment
renders its settled form", not "the animation stops on its last frame".
