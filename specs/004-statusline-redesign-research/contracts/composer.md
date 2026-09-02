# Contract: the composer page

**Date**: 2026-09-02

What `scripts/generate-composer.js` must produce, stated as things a test can
assert. The page is a build artifact, so this is the contract between the
generator and the owner rather than a public API.

## The file

- One HTML file, written to `specs/004-statusline-redesign-research/composer.html`.
- Opens from `file://` with no server, no network request and no font
  installed.
- Contains no reference to any external host. Every style, script, glyph
  outline and palette value is inline.
- Regenerating without a source change produces a byte-identical file. The
  fixture is fixed, the clock is frozen and the timezone is pinned, as
  `generate-previews.js` already does.

## What it must contain

| Element | Requirement |
|---|---|
| Canvas | The bar, drawn from the current arrangement, at the current width and glyph mode |
| Segment list | Every registry key, including the ones the current arrangement has off |
| Toggle | Per segment, on and off |
| Reorder | Per segment, move within its line |
| Move | Per segment, move to another line |
| Width switch | At least a wide and a narrow setting, one of them 80 columns |
| Glyph switch | Nerd Font outlines and the declared plain substitutes |
| Presets | Six, each with its label, what it optimises for, what it gives up, who it is for, and any principle it conflicts with |
| Handover | The arrangement's JSON, copyable in one action, with both file paths named |
| Warnings | Shown when the arrangement has no segments on, or when a line cannot fit the narrowest offered width |

## What it must not do

- Probe the machine. No git state, no usage figures, no clock reading.
- Draw a bar by any means other than the renderer's own modules.
- Hand back an arrangement that the resolver would reject.
- Lose the arrangement being edited on a page reload.

## Assertions the test makes

Run by `scripts/tests/composer.test.js`, following
`animation-board.test.js`: the page is regenerated in place and asserted
against, so a stale committed page fails the suite rather than sitting there.

1. Generating twice produces identical bytes.
2. The file contains no `http://` or `https://` resource reference.
3. Every registry key appears in the page.
4. Every preset in `scripts/composer-presets.js` appears, with its three
   sentences and its conflict list.
5. Every preset's arrangement resolves without a warning against the
   registry, except `oneLine`, whose only reported conflict is Principle II.
6. The pool embedded in the page has one entry per key the fixture produces,
   and each entry's text matches what `renderReadings` returns for the same
   fixture.
7. For each preset, the bar the page would draw at 120 columns equals what
   the renderer draws for the same arrangement at the same width. Asserted in
   Node against the shared modules, not by driving a browser.
8. Every Nerd Font codepoint the pool emits has an outline embedded in the
   page, so a reader with no Nerd Font installed sees glyphs rather than
   boxes.
9. The inlined renderer carries no surviving `import`, `export` or `node:`
   reference, so the page is one script rather than a module graph it cannot
   resolve.
