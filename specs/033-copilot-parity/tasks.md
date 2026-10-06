# Tasks: Copilot parity

## Phase 1: Setup

- [X] T001 Amend Principles III and IV in `.specify/memory/constitution.md` (7.4.0) with a sync report entry
- [X] T002 [P] Fixtures from real Copilot 1.0.91 data: `scripts/tests/fixtures/copilot-payload-1091.json` and `copilot-parity-events.jsonl`

## Phase 2: User Story 1, the real terminal size (P1)

- [X] T003 [US1] Failing tests: `/dev/tty` size under Copilot, padding subtracted, never with `COLUMNS`, 120 on Windows or on error
- [X] T004 [US1] `copilotTerminal()` in `src/layout.js`, `src/copilotSettings.js`, wiring in `renderPayload`, the terminal source in `doctor`

## Phase 3: User Story 2, the same figures (P1)

- [X] T005 [US2] Failing tests: context fallbacks; effort from the log and settings; resolved model; `skill.invoked_ref`; todos from `session.db` through both drivers
- [X] T006 [US2] `src/tokens.js`, `src/copilotEvents.js` (sidecar schema 2), `src/copilotTodos.js`, `src/render.js`

## Phase 4: User Story 3, credits and the monthly quota (P2)

- [X] T007 [US3] Failing tests: credits chip with and without a limit; quota normaliser; quota chips; no lookup under Claude Code; the refresh probe
- [X] T008 [US3] `aiCredits`, `premiumQuota`, `chatQuota` in the registry, descriptions, doctor rows, composer presets; `src/copilotQuota.js`; `copilotQuota` in `refresh.js` and `freshness.js`

## Phase 5: User Story 4, install (P2)

- [X] T009 [US4] Failing tests: refresh interval 10, `--quiet-footer` writes and records, a second install keeps the record, uninstall restores, a changed key is left alone, doctor reports both
- [X] T010 [US4] `src/install.js`, `bin/cli.js`, `src/doctor.js`

## Phase 6: Polish

- [X] T011 README: the Copilot section and the feature matrix
- [X] T012 Regenerate previews and the composer; keep `scripts/tests/fixtures/composer-bar.txt` honest
- [X] T013 Validate against real Copilot data on this machine; record results in `plan.md`
- [X] T014 Suite green, spec `done`, commit on `feat/copilot-parity`
