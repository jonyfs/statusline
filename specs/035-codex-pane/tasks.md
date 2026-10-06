# Tasks: The full bar in a pane under Codex

## Phase 1: Setup

- [X] T001 Amend Principles II, III and IV in `.specify/memory/constitution.md` (7.6.0) with a sync report entry
- [X] T002 [P] Fixtures derived from real rollouts, read-only, content stripped: `scripts/tests/fixtures/codex-rollout-{plus,free,0160,preview}.jsonl`
- [X] T003 Point `.specify/feature.json` and the `CLAUDE.md` SPECKIT block at `specs/035-codex-pane`

## Phase 2: User Story 2, Codex's own figures (P1)

- [X] T004 [US2] Failing tests in `scripts/tests/codex-rollout.test.js`: Plus, free and 0.160 mapping; window lengths; working and idle; bounded head and tail; incremental read; shrunk file; broken input; rendering through `renderPayload`
- [X] T005 [US2] `src/codexRollout.js`; `codex` in `src/harness.js`; codex probes, the `Codex` model name and absent windows in `src/render.js`

## Phase 3: User Story 3, the right session (P2)

- [X] T006 [US3] Failing tests: `codex-hook` writes atomically and prints nothing; bad input; id cleaning; sweep; resolution order; rollout by id
- [X] T007 [US3] `src/codexSession.js`; `codex-hook` in `bin/cli.js`

## Phase 4: User Story 1, the bar under Codex (P1)

- [X] T008 [US1] Failing tests: the frame; the flags; `--once`; exit when the watched process is gone; Ctrl-C; the wrapper's plans inside tmux, outside, without tmux and on Windows; `-e` for the environment; PATH lookup; a stand-in codex gets its arguments intact
- [X] T009 [US1] `src/codexPane.js`, `src/codexLaunch.js`; `codex-pane` and `codex` in `bin/cli.js`
- [X] T010 [US1] Check the split, the repaint, a resize and the close in a throwaway tmux server with a stand-in codex; record in `plan.md`

## Phase 5: User Story 4, install and doctor (P2)

- [X] T011 [US4] Failing tests: the hook is appended after other groups and removed byte for byte; a broken `hooks.json` is refused before any write; `--pane`, plain reinstall, `--no-pane`, uninstall; a created file is removed; doctor's line; the CLI
- [X] T012 [US4] `src/codexHooks.js`; `--pane` in `src/install.js` and `bin/cli.js`; pane readiness in `harnessStatus` and `src/doctor.js`

## Phase 6: Polish

- [X] T013 The `codex-pane.svg` scenario in `scripts/preview-fixtures.js`, from the preview fixture through the adapter; `npm run previews`
- [X] T014 README: "Codex with the full bar" and the feature matrix
- [X] T015 Suite green, spec `done`, commit on `feat/codex-pane`
