# Tasks: Runs output and failure contract for a host

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Tests are in the tasks because the spec's success criteria are tests.

## Phase 1: Setup

- [x] T001 Make `scripts/tests/fixtures/ansi-golden.json` from main before any source change: the sha256 of the ANSI output of each composer fixture payload at 80, 100, 144 and 200 columns (`scripts/make-ansi-golden.js`, run with the environment pinned as the golden bar is).

## Phase 2: Foundational

- [x] T002 Write `src/runs.js`: `ansiToRuns(line)`, `runsDocument(lines)` and `errorDocument(code, message)` per `data-model.md` (truecolor SGR, bold, dim, underline, `39`/`49`, `0`, OSC 8 with BEL or ST, `href` allow-list, control characters removed, empty runs dropped, equal neighbours merged, code points never split).
- [x] T003 [P] Unit tests for the converter in `scripts/tests/runs-output.test.js`: every sequence in the table, an unknown scheme, an OSC 8 `id`, a wide character, a run of spaces with `bg`, an unstyled run, an empty line.

## Phase 3: User Story 1 - the footer as data (P1)

**Goal**: `CLAUDE_STATUSLINE_OUTPUT=runs` or `--format runs` prints one JSON object of runs.

**Independent test**: the object parses, validates against `contracts/runs-output.schema.json`, and its text joins to the ANSI plain text.

- [x] T004 [US1] In `bin/cli.js` read the switch at the top (argv `--format runs`, then `CLAUDE_STATUSLINE_OUTPUT`), force `COLORTERM=truecolor` in runs mode, import `src/runs.js` on the runs path only, and print `runsDocument` plus a newline.
- [x] T005 [US1] Join test (SC-001) in `scripts/tests/runs-output.test.js`: for the composer fixture at 80, 100, 144 and 200 columns the runs joined by line equal the ANSI plain text, in the nerd tier and with `CLAUDE_STATUSLINE_ASCII=1`.
- [x] T006 [US1] Replay test (SC-002): render the runs back to SGR and OSC 8 and compare the picture with the ANSI output through the same converter, so colours, bold, dim, underline and links match.
- [x] T007 [US1] `NO_COLOR` and the `terminal` palette give runs without `fg` or `bg`; an empty status gives `{"contract":1,"lines":[]}` and exit 0.

## Phase 4: User Story 2 - failure as an exit code and an object (P1)

**Goal**: in runs mode, every failure is exit 75 and one error object.

**Independent test**: force each code in a subprocess and check exit, object and stdout.

- [x] T008 [US2] In `bin/cli.js` the Node check in runs mode prints the `node-version` object and exits 75 before any import (message from `MIN_NODE_MAJOR`); stdin that is empty, invalid or not an object prints `bad-payload` and exits 75; any other exception in the render path prints `internal` and exits 75 with no stack on stdout.
- [x] T009 [US2] Subprocess tests (SC-003) in `scripts/tests/runs-output.test.js`: `bad-payload` for empty, `not json`, `[]` and `null`; `internal` through `CLAUDE_STATUSLINE_TEST_THROW=1`; `node-version` through a hook that lowers the check (an environment variable read only in runs mode and only by the test); a valid object with unknown fields still draws.

## Phase 5: User Story 3 - nobody else sees a change (P1)

**Goal**: the default output and its failure lines are what they were.

**Independent test**: the ANSI hashes equal the ones made from main.

- [x] T010 [US3] `scripts/tests/runs-ansi-golden.test.js` (SC-004): compare the ANSI output of every fixture and width with `fixtures/ansi-golden.json`; and check that failures without the switch still exit 0 with the legacy lines.

## Phase 6: Polish

- [x] T011 [P] `scripts/bench.js` reports the runs overhead against the ANSI render (SC-005) and says whether it is within 10%.
- [x] T012 [P] README: the variable, the flag, the object, the error codes and an example the renderer generated (Principle VIII).
- [x] T013 Validate `contracts/runs-output.schema.json` with a small checker in the test (no dependency), then run `npm test`, bench, previews and composer; version 1.53.0; commit; push; PR; wait for CI; review the PR head; merge `--no-ff`; `update`.

## Dependencies

T001 first, before any source change. T002 before T004 to T010. T004 and T008 touch `bin/cli.js`
and go in that order. T005 to T007 need T004; T009 needs T008; T010 needs T001 only.

## Parallel examples

T003 with T002's review; T011 and T012 after T010.

## Implementation strategy

MVP is Phase 3 (US1). Phases 4 and 5 are independent of each other and follow it.
