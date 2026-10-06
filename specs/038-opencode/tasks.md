# Tasks: the bar inside OpenCode

**Plan**: [plan.md](./plan.md)

## Phase 1: data (US1)

- [x] T001 `src/opencodePayload.js`: snapshot to payload (model, effort, context, cost,
  duration, lines changed, cwd, session id) and activity (working, todos)
- [x] T002 [P] `src/opencode/ansi.js`: ANSI to lines of runs
- [x] T003 `src/harness.js`: `opencode` when the payload has an `opencode` block
- [x] T004 `src/render.js`, `src/doctor.js`: probes answer activity from the payload; the
  window chips are absent under OpenCode
- [x] T005 Tests: `scripts/tests/opencode.test.js` for T001 to T004 and the edge cases

## Phase 2: the plugin (US1, US3)

- [x] T006 `src/opencode/tui.tsx`: snapshot from `api.state`, one child render at a time with a
  deadline, debounce on events, slow clock, resize, spans in `app_bottom`
- [x] T007 Verify in a real OpenCode under tmux

## Phase 3: install (US2)

- [x] T008 `src/install.js`: install, uninstall and status for OpenCode
- [x] T009 `bin/cli.js`: `--harness opencode`
- [x] T010 Tests: install and uninstall round trip, comments, invalid JSON, older clone,
  missing config directory

## Phase 4: documents

- [x] T011 README: OpenCode section and table column
- [x] T012 Constitution 7.9.0: III and IV
- [x] T013 Install on this machine and check it in OpenCode
