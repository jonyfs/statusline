# Tasks: Subagent rows in GitHub Copilot CLI

- [X] T001 Amend Principle II in `.specify/memory/constitution.md`, 7.2.0 (FR-007); point `.specify/feature.json` and the `CLAUDE.md` block at 030
- [X] T002 Save the real session's `events.jsonl` as `scripts/tests/fixtures/copilot-subagent-events.jsonl`, paths trimmed
- [X] T003 [US1][US2] Failing tests in `scripts/tests/copilot-agent-rows.test.js`: running versus completed, failed and shut down; fields per FR-002; per-agent skills off line 2; root-only turns; the cap; a non-Claude model label; a Claude payload unchanged; the real log replayed (SC-003)
- [X] T004 [US1][US2] `src/copilotEvents.js`: root/subagent split and running subagents
- [X] T005 [US1] `src/taskRows.js` `modelLabel` fallback; `src/render.js` agents reading and appended rows
- [X] T006 README: feature matrix row and a paragraph on the rows; humanizer
- [X] T007 Validate for real: a live Copilot session dispatching subagents, rendered by `bin/cli.js render` against its session directory; record results
- [X] T008 Suite, CI, merge, version, update the installs
