# Tasks: The statusline in GitHub Copilot CLI and OpenAI Codex

- [X] T001 Amend Principle III (and IV for `--harness`) in `.specify/memory/constitution.md`, 7.1.0 (FR-009)
- [X] T002 Save the captured Copilot payload as `scripts/tests/fixtures/copilot-payload.json` and an `events.jsonl` fixture with turn and skill events
- [X] T003 [US1] Failing tests in `scripts/tests/multi-harness.test.js`: detection (env, payload, neither); the Copilot payload renders with no 5h/7d/spend/burn/projection chip and keeps line 1, model, context, duration; premium and allow-all chips appear only when their fields say so; skills and working state come from `events.jsonl`; a Claude payload renders byte for byte as before
- [X] T004 [US1] `src/harness.js`, `src/copilotEvents.js`, and the probe swap, chips, glyph rows and registry rows in `src/render.js` and `src/segments.js`; glyphs into `scripts/extract-glyphs.py` and `src/preview/glyphs.json`
- [X] T005 [US1] Failing tests, then `install --harness copilot` / `uninstall --harness copilot` in `src/install.js` and `bin/cli.js`: backup, other keys kept, `//` comments read past, command in the specs/028 form
- [X] T006 [US2] Failing tests, then `src/codexConfig.js` and `install/uninstall --harness codex`: no `[tui]`, `[tui]` without the key, `[tui]` with a one-line and a multi-line `status_line`, uninstall of ours and of someone else's, missing `~/.codex`; round trip byte-identical
- [X] T007 [US3] Failing tests, then per-harness lines in `src/doctor.js`
- [X] T008 Composer and preview fixtures stay valid (registry rows need pool entries); regenerate what changes
- [X] T009 README: feature matrix and install per harness; humanizer
- [X] T010 Validate for real: the Copilot TUI in a pseudo-terminal with a throwaway `COPILOT_HOME` installed by `install --harness copilot`, and the Codex config written by `install --harness codex` into a throwaway `CODEX_HOME` checked with `codex -c`; record results
- [ ] T011 Suite, CI, merge, version, update the install
