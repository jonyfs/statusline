---
track: quick
status: done
---

# Omit list for a host

**Feature Branch**: `feat/058-omit-list`

**Created**: 2026-10-13

**Status**: Done

**Input**: A host that draws part of the footer itself (Astrolabe draws the Spec Kit feature, the
phase, the deciding usage window and its own help hint) gets the same facts twice from the
renderer. The renderer can already switch a segment off through an arrangement file, but a host
has no file of its own to point at and should not write one. This is the third of the separate
specs named in spec 056.

**Track**: `quick`: one environment variable on top of the arrangement the renderer already has.

## Requirements

- **FR-001**: `CLAUDE_STATUSLINE_OMIT=<key>,<key>,...` switches the named segments off, as an
  arrangement entry `{ "on": false }` would. Names are the segment keys of the registry in
  `src/segments.js` (`dir`, `repo`, `branch`, `worktreeState`, `pr`, `ci`, `skills`, `activity`,
  `model`, `effort`, `context`, `fiveHour`, `burnRate`, `sevenDay`, `duration`, `rtk`, and the
  rest of that table). The set is the registry: a key is added there, in a diff, and the README
  lists it.
- **FR-002**: The list is applied before layout, so the width a segment would have taken goes to
  the others. A segment that starts a lookup when read (`pr`, `ci`, `rtk`, `update`, the Copilot
  quota pair and `gates`) is not read when it is omitted, so no refresh process starts for it.
- **FR-003**: It applies on top of whichever arrangement is in force (the environment file, the
  repository, the person's own, or the default) and wins over an entry that says `on: true`. It
  changes nothing else about that arrangement: lines and order stay. A file the renderer would set
  aside whole (not an object, or a version it does not know) does not take the list with it; the
  list applies to the default arrangement and `doctor` says the file was not understood.
- **FR-004**: Whitespace around a name is ignored and an empty list is no list. A name that is
  not a segment (including `__proto__` and `constructor`) is ignored, and `doctor` names it.
- **FR-005**: Without the variable nothing changes.

## Edge cases

- Omitting every segment leaves an empty bar, which the renderer already handles (it prints no
  lines; in runs mode `{"contract":1,"lines":[]}`).
- The gate rows are the segment `gates` (registered on line 1) and are omitted by that key. Copilot's
  agent rows are not a segment of their own: `activity` hides the chip, not the rows. Claude Code's
  own agent rows come from the `task-rows` command, which the list does not reach.

## Success criteria

- **SC-001**: With `CLAUDE_STATUSLINE_OMIT=dir,branch` the fixture bar at 120 columns has no
  directory or branch chip and every other chip it had.
- **SC-002**: At a width where the full bar drops a lower-priority chip, omitting a higher one
  keeps that chip.
- **SC-003**: An unknown name is reported by `doctor` and draws the default bar.
- **SC-004**: The default output hashes (`fixtures/ansi-golden.json`) are unchanged.
