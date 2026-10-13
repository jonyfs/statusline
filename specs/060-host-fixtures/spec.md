---
track: quick
status: done
---

# Shared fixtures for a host

**Feature Branch**: `feat/060-host-fixtures`

**Created**: 2026-10-13

**Status**: Done

**Input**: The fifth of the separate specs named in spec 056. A host that embeds the renderer
(Astrolabe vendors a copy) tests that copy against fixtures it wrote itself, so a change here
that moves a row is found only when the sync pull request fails. One folder both sides run
removes the guess.

**Track**: `quick`: a folder of data, a generator and a test.

## Requirements

- **FR-001**: `fixtures/host/payloads/*.json` are status payloads that need no repository, no
  transcript and no clock: a directory that does not exist, and no reset time.
- **FR-002**: `fixtures/host/expected/<payload>.<width>.txt` holds the text of each line of the
  runs form at 80, 100, 144 and 200 columns, trailing blanks trimmed, one file per pair.
- **FR-003**: The environment the rows were made in is written in `scripts/host-fixtures.js`
  (`fixtureEnv`) and documented in `fixtures/host/README.md`: passive mode, updates off, flavor
  `mocha`, truecolor, `TZ=UTC`, `COLUMNS`, a throwaway `HOME` and `USERPROFILE`, the glyph,
  separator, ramp and contrast choices pinned, and a working directory outside any project.
- **FR-004**: `node scripts/make-host-fixtures.js` rewrites the expected files. The suite renders
  every pair through `bin/cli.js` and fails when a row differs, when a file is missing or
  orphaned, when a row is wider than its width, or when a fixture names this machine.
- **FR-005**: Without these files nothing changes: the renderer is untouched.

## Success criteria

- **SC-001**: The suite passes on the three platforms, with the same expected files.
- **SC-002**: A host copies `fixtures/host/` and `scripts/host-fixtures.js`'s environment and
  gets the same rows from its copy of the renderer.

## Out of scope

- The render-only build (spec 061); any change to what is drawn.
