# Implementation Plan: Passive mode for a host

**Branch**: `feat/057-passive-mode` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

## Summary

One module, `src/paths.js`, answers three questions for the render path: where state lives
(`stateRoot()`), whether a write is allowed (`canWrite()`), and whether the process is passive
(`isPassive()`). Every write site on the render path asks it, and `spawnRefresh` and the open-tab
script refuse in passive mode. The default (no variable) returns the old paths, so nothing moves.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18 or newer

**Primary Dependencies**: none

**Storage**: files under `stateRoot()`; in memory when writing is not allowed

**Testing**: the repository harness; a recorder preload for child processes and file writes

**Target Platform**: Linux, macOS, Windows (Principle IX)

**Project Type**: CLI

**Performance Goals**: no added cost on the render path (SC-004)

**Constraints**: default output and files unchanged (FR-007)

## Constitution Check

| Principle | Result |
|---|---|
| I, II, III | Not touched. |
| IV. Installable by clone | Not touched; no install step. |
| V. Documentation | Pass with work: README and `contracts/environment.md`. |
| VI. English-only | Pass. |
| VII. MVP first | Pass: one switch and one directory variable. |
| VIII. Generated output | Not applicable; no image changes. |
| IX. Three platforms | Pass: paths through `node:path`; the recorder test runs on all three. |
| X. Icons carry live state | Not touched. |
| XI. Releases | Version 1.54.0 only. |
| XII. Spec declares completion | Pass: track `full`, `spec.md`, `plan.md`, `tasks.md`. |

No violation.

## Project Structure

```text
src/paths.js                   # NEW: stateRoot(), canWrite(), isPassive()
src/cache.js                   # cache dir and locks through paths; spawnRefresh refuses in passive
src/changeTracker.js           # state dir through paths; no write when not allowed
src/taskRows.js, src/skills.js # task snapshots and width memory through paths
src/skillEvents.js             # events dir through paths (read on render)
src/copilotEvents.js           # event cache through paths
src/openTerminalTab.js         # no script in passive mode
src/render.js                  # debug dump through canWrite()
src/updateCheck.js             # no check in passive mode
README.md, specs/057-passive-mode/contracts/environment.md
scripts/tests/passive-mode.test.js, scripts/tests/fixtures/passive-recorder.mjs
```

**Structure Decision**: one new module and edits at the write sites, no new dependency.
