# Implementation Plan: Runs output and failure contract for a host

**Branch**: `feat/056-runs-output-contract` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/056-runs-output-contract/spec.md`

## Summary

Add an opt-in data output to the renderer: with `CLAUDE_STATUSLINE_OUTPUT=runs` or
`--format runs`, `bin/cli.js` prints one JSON object of styled runs instead of ANSI text, and a
failure becomes exit code 75 with one JSON error object. The default output does not change.

The runs come from one new module, `src/runs.js`, which converts the renderer's own final lines
into runs. The renderer already emits a closed set of sequences (truecolor SGR, bold, dim,
underline, overline and OSC 8), so a converter that lives in this repository, tested against the
renderer here, moves the escape parser from the host to the side that owns the escapes. A change
in how the renderer paints now fails a test in this repository. See `research.md`, decision 1.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18 or newer (`MIN_NODE_MAJOR` in `bin/cli.js`)

**Primary Dependencies**: None. Node's standard library only.

**Storage**: N/A

**Testing**: The repository's own harness (`scripts/test-harness.js`), run by `npm test`;
subprocess tests for `bin/cli.js`; one fixture of ANSI hashes made from main before the change.

**Target Platform**: Linux, macOS and Windows (Principle IX). Exit code 75 and JSON on stdout
behave the same on all three.

**Project Type**: CLI (a renderer run as a child process)

**Performance Goals**: runs mode costs no more than 10% over ANSI mode on the same payload
(SC-005); the 300 ms redraw budget is unchanged.

**Constraints**: Default output byte for byte (SC-004). Exit 0 with the legacy fallback lines in
the default mode. The version check and the runs switch run before any module is imported.

**Scale/Scope**: one new module (about 150 lines), edits to `bin/cli.js`, README and tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Result |
|---|---|
| I. Starship-compatible output | Not touched: the drawn bar and its colours do not change. |
| II. Three-line display | Not touched. Runs mode returns the lines the renderer drew, however many. |
| III. Token tracking grounded in real data | Not touched. |
| IV. Installable by clone | Not touched. The new flag needs no install step. |
| V. Documentation and configuration guide | Pass with work: README documents the variable, the flag, the object and the error codes. |
| VI. English-only | Pass: all new text, error messages and codes are English. |
| VII. MVP first | Pass: two requirements, nothing speculative. |
| VIII. Documentation shows generated output | Pass with work: the README example is produced by the renderer, not typed. |
| IX. Linux, macOS, Windows | Pass: no platform call; the tests run on the three CI platforms. |
| X. Icons carry live state | Not touched. `NO_COLOR` yields runs without colour, as the ANSI mode yields no escape. |
| XI. Releases are tag-driven | Not touched. Version bump 1.53.0 only. |
| XII. A spec declares what completes it | Pass: track `full`, so `spec.md`, `plan.md` and `tasks.md` are required at `done`. |

No violation, no complexity tracking.

Re-check after design: unchanged. The one tension is that Claude Code treats a non-zero exit as
a reason to stop calling the command; runs mode is opt-in for a host and never the mode Claude
Code runs, which `research.md` decision 5 records.

## Project Structure

### Documentation (this feature)

```text
specs/056-runs-output-contract/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── runs-output.schema.json
│   └── errors.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
bin/cli.js                       # reads the switch first, prints the object, exits 75
src/runs.js                      # NEW: ansiToRuns(), runsDocument(), errorDocument()
README.md                        # the runs mode and the error codes
scripts/tests/
├── runs-output.test.js          # NEW: SC-001, SC-002, SC-003, edge cases
├── runs-ansi-golden.test.js     # NEW: SC-004
└── fixtures/ansi-golden.json    # NEW: hashes of main's output, made before the change
scripts/bench.js                 # reports the runs overhead (SC-005)
```

**Structure Decision**: single project. The module is a pure function of a string, so it is
tested without a terminal, and `bin/cli.js` stays the only place that decides exit codes.

## Complexity Tracking

None.
