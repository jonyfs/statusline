# Implementation Plan: The statusline tells you it has an update, and can take it

**Branch**: `feat/update-check` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-update-check/spec.md`

## Summary

Once a day, a redraw starts the existing detached refresh with a new job: fetch the clone's
upstream, classify the pending commits by their `feat:` and `fix:` prefixes, and, in the default
`auto` behaviour, apply them through the same `update()` the `update` command uses. The result
lives in the cache, and a chip on line 1 tells the user what happened: updated, ready, blocked
or failed. The spec expected a session-start message; the hooks reference shows Claude Code
discards a `SessionStart` hook's user message, so the notice is the chip the spec named as the
fallback ([research.md](research.md) R1). Shapes in [data-model.md](data-model.md), commands
in [contracts/cli.md](contracts/cli.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18+

**Primary Dependencies**: none at runtime; the user's `git`

**Storage**: the existing cache file (entry `update`), and `~/.claude/statusline/updates.json`
for the behaviour

**Testing**: `npm test`, throwaway HOME; update tests use real temporary git repositories

**Target Platform**: Linux, macOS and Windows

**Project Type**: CLI statusline command

**Performance Goals**: the redraw adds one cache read; everything else is in the detached
process

**Constraints**: no network or file change on the redraw path; fast-forward only; no credential
prompts; `CLAUDE_STATUSLINE_NO_REFRESH` disables it all

**Scale/Scope**: one new module, changes to five existing ones, one new test file, README

## Constitution Check

| Principle | Status |
|---|---|
| I. Starship-compatible output | Pass. One more segment with Nerd Font glyphs. |
| II. Three-line structure | Pass. Line 1 carries the repository and install state. |
| III. Real data only | Pass. Counts come from git; nothing is estimated. |
| IV. Installable by clone | Pass. A manual `git pull` still works; the automatic path is a pull plus the idempotent install. |
| V. Integration docs | Pass once README covers the behaviours and the trust `auto` implies (FR-013). |
| VI. English only | Pass. |
| VII. MVP first | Pass. `notify` alone is shippable. |
| VIII. Generated docs | Pass with a generated preview of the chip. |
| IX. Cross-platform | Pass. `spawnRefresh` already uses `process.execPath` and argument arrays; git runs the same on all three. |
| X. Icons carry live state | Pass. Two icons for two states, evidence in `glyph-evidence.png`. |
| XI. Releases | Pass. No tags; the check follows the branch. |
| XII. Spec declares completion | Pass. `track: full`. |

Research R9 records why the old note "the statusline deliberately never fetches" does not
conflict: that was about fetching on every redraw. Re-checked after design: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/026-update-check/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── glyph-evidence.png
├── contracts/cli.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── updateCheck.js   # new: behaviour, classify, check, apply, chip state
├── refresh.js       # new PROBES entry "update"
├── render.js        # redraw trigger, chip builder, glyph rows
├── segments.js      # "update" row and SEGMENT_ABOUT sentence
├── freshness.js     # MAX_AGE_MS / budget for "update"
├── install.js       # "Updates:" line
└── doctor.js        # "updates:" line
bin/cli.js           # "updates" and "check-updates" commands, "Updates:" line on update
scripts/
├── extract-glyphs.py
├── preview-fixtures.js
└── tests/update-check.test.js
README.md
```

**Structure Decision**: one new module for everything about updates, wired into the refresh,
render and CLI paths that already exist.

## Complexity Tracking

No violations to justify.
