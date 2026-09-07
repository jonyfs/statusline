# Tasks: Explaining a segment

## Phase 1: The map

- [X] T001 Add `SEGMENT_HELP` to `src/segments.js`: segment key to README anchor, beside the registry it mirrors
- [X] T002 Add `README_URL` for the public repository, since that is how this project is distributed

## Phase 2: The renderer

- [X] T003 [P] In `src/render.js`, attach a help link to any segment reaching the row without one
- [X] T004 [P] Honour `CLAUDE_STATUSLINE_NO_HELP_LINKS=1`, which drops the help links and keeps the three real ones

## Phase 3: The invariants

- [X] T005 Case: every segment in the registry is either help-linked or already linked
- [X] T006 Case: every anchor in the map matches a heading in README.md, slugified as GitHub slugifies it
- [X] T007 Case: `dir`, `branch` and `pr` keep their own targets
- [X] T008 Case: line widths are identical with the links on and off
- [X] T009 Case: the switch leaves only the three real links

## Phase 4: Proof

- [X] T010 Regenerate previews and the composer page; both must come back with no diff
- [X] T011 Document `CLAUDE_STATUSLINE_NO_HELP_LINKS` in the README settings table
- [X] T012 Run the full suite on this machine, then the three platforms in CI

## Order

T001 and T002 block everything. T003 and T004 are one file and land together.
T005 through T009 can be written against the finished renderer in any order.
T010 is the Principle VIII gate and must be green before the PR.
