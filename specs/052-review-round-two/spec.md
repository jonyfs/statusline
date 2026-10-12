---
track: quick
status: done
---

# A second review round, and the gaps it found

**Feature Branch**: `feat/052-review-round-two`

**Created**: 2026-10-12

**Status**: Done

**Input**: A second advisor pass over features 039 to 051, and a diff of sections 5.4 and
5.5 of the 2026-10 guide against what shipped.

**Track**: `quick`: corrections and small additions with one test file.

## Corrections

- **R1**: The composer page still gave the pill two columns a chip while the renderer gave it
  none (feature 051), so the page shed chips earlier than the bar. The page now fits as the
  renderer does, and a test runs both in the pill style.
- **R2**: A sleeping session drew line 2 in a quiet text colour that, on a flavor-filled chip,
  fell back to the chip's own colour and changed nothing visible. Line 2's chips now take the
  neutral fill while it sleeps.
- **R3**: The tree prefixes `├` and `└` (U+251C, U+2514) are East Asian Ambiguous and were
  not in the set, so nested agent rows misaligned under `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`.
- **R4**: A terminal background reply that arrived after the timeout would land in the shell.
  The OSC 11 query is now followed by a device attributes request, which a terminal answers in
  order; the reply to it says the colour reply is here or never coming. The query path has
  tests with a fake terminal.
- **R5**: The emoji column had no rendered proof. `specs/043-emoji-tier/glyph-evidence.png`
  shows every entry from the system colour emoji font, made by `emoji-sheet.py`.
- **R6**: `doctor` said "set COLORTERM=truecolor to force 24-bit" when the depth was already
  truecolor; the hint shows only at 256.
- **R7 (guide 5.4)**: the rejection list gains the shield and the label (🛡️ 🏷️), in the
  constitution (8.6.1) and the test.
- **R8 (guide 5.5)**: groups on line 3 are three columns apart, not one; the usage group holds
  the cache and the credit balance, and the savings group is the rtk figure with the
  session duration and the Copilot credits.

## Additions

- **A1**: A pull request read from `gh` carries its review decision (`APPROVED`,
  `CHANGES_REQUESTED`, `REVIEW_REQUIRED`) and its comment count. The decision maps onto the
  marks the payload already drew, the state (open, draft, merged, closed) is kept apart from
  the review word so a merged and approved request draws both, and the count shows beside the
  comments mark (catalog item C26).

## Not changed

- **Dim as SGR 2**: section 5.5 asks for dim units, resets and repo. The bar draws them in a
  quiet text colour that still reaches 4.5:1, which SGR 2 cannot promise (feature 044).
- **Arrow padding**: the review asks for two spaces before the icon after an arrow; the
  arrow keeps one, since the track already costs about six columns a gauge (feature 051).
