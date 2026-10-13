---
track: quick
status: done
---

# Resolved configuration and contract version for a host

**Feature Branch**: `feat/059-print-config`

**Created**: 2026-10-13

**Status**: Done

**Input**: A host that draws next to the footer has to match it (the palette, the glyph set, the
separator) and has no way to ask what the renderer will use except reading the person's own
settings files. It also has no way to ask which contract a copy speaks without rendering. This is
the fourth of the separate specs named in spec 056 (resolved configuration) with FR-010 of the
host's original request (the contract version).

**Track**: `quick`: two read-only commands over what the renderer already resolves.

## Requirements

- **FR-001**: `--print-config` (also `print-config`) prints one JSON object and exits 0:
  `contract`, `version`, `flavor` and its `flavorSource` (`env`, `repo`, `terminal` or
  `default`), `ramp` (`default` or `cvd`), `contrast` (`normal` or `high`), `glyphs` (`nerd`,
  `emoji` or `plain`), `ascii`, `separator`, `colourDepth` (`truecolor`, `256` or `none`),
  `layout` (`origin`, `path`, `omitted`), and `passive` with `cacheDir`.
- **FR-002**: It honours the same environment, repository file and person's settings the renderer
  would, for the directory it is run in (or `--cwd <dir>`), and reads nothing a render does not.
- **FR-003**: `--version` (also `version`) prints `statusline <version> (contract <n>)`, and
  `--version --json` prints `{"contract":n,"version":"x.y.z"}`. `contract` is the number a runs
  object carries.
- **FR-004**: Both work without a payload on stdin, start no process, write no file, and never
  print a stack trace; a failure is `{"contract":n,"error":{...}}` and exit 75, as in runs mode.
- **FR-005**: Without these flags nothing changes.

## Success criteria

- **SC-001**: Each documented field is tested under a controlled environment.
- **SC-002**: `--print-config` equals what a render at the same environment uses (flavor, glyph
  set and separator checked against `resolveSettings`, `iconTier` and `separatorStyle`).
- **SC-003**: The two commands write nothing under a throwaway home and start no child process.
