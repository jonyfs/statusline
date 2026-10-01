# Implementation Plan: The statusline in GitHub Copilot CLI and OpenAI Codex

**Branch**: `feat/multi-harness` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

## Summary

Copilot runs our renderer as is, so the work there is adaptation: detect it, hide the limits it
does not have, read its event log for skills and activity, add its two figures, and install
into its settings. Codex cannot run our renderer, so the work there is configuration: write the
built-in items that match our features into `[tui] status_line`.

## Technical Context

JavaScript ES modules, Node 18+, no runtime dependencies. No TOML library is added (Principle
IV): the Codex writer edits one key in one table with line-level rules and is tested against
fixtures. Tests run in the suite's throwaway HOME, with `COPILOT_HOME` and `CODEX_HOME` pointed
at temporary directories.

## Research

**R1. Detection.** Copilot's loader exports `COPILOT_CLI_BINARY_VERSION` to the command (seen in
the captured environment), and its payload alone carries `ai_used` and `allow_all_enabled`.
Either marks Copilot. A test run of Copilot without the variable still matches on the payload.

**R2. Probes, not a second renderer.** `renderPayload` swaps the transcript probes for Copilot:
`getSessionActivity` reads `events.jsonl` and returns the same shape (`skills`,
`skillsTrueCount`, `todos: null`, `working`); `getActiveSkills` and the true count return what
that pass found; `subagentActivity` returns none. `gather()` and the line builders do not
change.

**R3. Activity from events.** Working when the last `assistant.turn_start` has no later
`assistant.turn_end`, or the last event is within the 10-second window the Claude reader uses.
Skills are `skill.invoked` events inside `windowMs()`, newest first, by `data.name`. The tail
read is capped at 2 MB like the transcript reader.

**R4. Codex items.** In bar order: `model-with-reasoning`, `current-dir`, `git-branch`,
`context-used`, `five-hour-limit`, `weekly-limit`, `fast-mode`, `run-state`, `task-progress`.
Verified to render with Codex 0.158.0 (spec, "What the investigation found").

**R5. Codex writer.** Find `[tui]` (a line that is exactly the table header). If present, replace
a `status_line = ...` entry inside it, including a multi-line array, or insert after the header.
If absent, append `\n[tui]\nstatus_line = [...]\n`. Uninstall removes the entry only when its
value equals ours. A trailing comment on the header line is allowed.

**R6. Glyphs.** `U+F4B8` nf-oct-copilot for premium requests (`✦` plain), `U+F099E`
nf-md-shield_off for allow-all (`⊘` plain), from the evidence sheet.

## Constitution Check

III is amended to read "the payload the harness sends" and to list Copilot's fields; MINOR,
7.1.0, since Claude Code's rules are unchanged and a second source is added. IV gains the
`--harness` installs. IX applies to the Copilot command (specs/028 form). X: two glyphs with
evidence. No violation.

## Source changes

```text
src/harness.js         detectHarness()
src/copilotEvents.js   copilotSessionActivity()
src/render.js          probe swap, harness reading, limit chips hidden, two chips, glyphs
src/segments.js        premiumRequests, allowAll rows and descriptions
src/install.js         installHarness()/uninstallHarness() for copilot and codex, harnessStatus()
src/codexConfig.js     setCodexStatusLine()/removeCodexStatusLine() on TOML text
src/doctor.js          per-harness lines
bin/cli.js             --harness flag on install and uninstall
scripts/tests/multi-harness.test.js, fixtures/copilot-payload.json
README.md, .specify/memory/constitution.md
```

## Results (2026-10-01)

- Suite: 596 passed locally.
- Copilot CLI, for real: `install --harness copilot` into a throwaway `COPILOT_HOME`, then
  Copilot's TUI in a pseudo-terminal (140 columns). Its footer drew this project's bar:
  `statusline  feat/multi-harness  16  6  +0 −0  CI` and `Auto  Context ?%  0m  rtk 70% saved`,
  with no 5-hour or 7-day chip. A promotion to install GitHub's desktop app and the folder-trust
  prompt appeared; the first was declined with `N` inside the throwaway home, the second left
  unanswered.
- Codex CLI, for real: `codex mcp list` with a throwaway `CODEX_HOME` refuses a broken TOML and
  a `status_line` of the wrong type ("failed to load bootstrap configuration") and loads the
  file `install --harness codex` wrote, with the existing `[tui] theme` kept. Codex's TUI drew
  the same items during the investigation.
- Incident during the investigation: an Enter sent to Codex's TUI accepted its own update
  prompt and started `npm install -g @openai/codex`, which the test harness then killed midway.
  The global package was restored to the version that was there before, 0.158.0, and checked.
