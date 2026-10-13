# Tasks: Passive mode for a host

**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Phase 1: Foundational

- [x] T001 Write `src/paths.js` (`isPassive`, `stateRoot`, `canWrite`) and its unit tests.

## Phase 2: User Story 1 - a render that touches nothing

- [x] T002 [US1] `spawnRefresh` and `maybeStartUpdateCheck` refuse in passive mode (`src/cache.js`, `src/updateCheck.js`).
- [x] T003 [US1] Gate every render-path write on `canWrite()` and root it at `stateRoot()`: `src/cache.js`, `src/changeTracker.js`, `src/taskRows.js`, `src/skills.js`, `src/skillEvents.js`, `src/copilotEvents.js`, `src/render.js` (debug dump).
- [x] T004 [US1] No open-tab script in passive mode (`src/openTerminalTab.js`).
- [x] T005 [US1] Recorder preload and `scripts/tests/passive-mode.test.js`: children and file writes, with and without a cache directory (SC-001, SC-002).

## Phase 3: User Story 2 - the same footer

- [x] T006 [US2] Cache directory round trip and the default write set unchanged (SC-003), against `fixtures/ansi-golden.json`.

## Phase 4: Polish

- [x] T007 README and `contracts/environment.md`; version 1.54.0; previews and composer; commit; PR; review of the head; merge; `update`.
