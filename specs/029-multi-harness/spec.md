---
track: full
status: active
---

# Feature Specification: The statusline in GitHub Copilot CLI and OpenAI Codex

**Feature Branch**: `029-multi-harness`

**Created**: 2026-10-01

**Status**: Draft (the declaration above is authoritative)

**Input**: User description: "revise este projeto para que tb seja possível configurar o status
line para codex e copilot, fazendo as adaptações necessárias para ter o maior número possível de
features atuais rodando no statusline destes harness tb, faça um teste minucioso para entender o
que precisa ser feito, compatibilidade do statusline atual do claude para ver o que vai ser
possível fazer tb por lá, crie uma spec completa sobre o assunto e implemente".

**Track**: `full`. It adds two harnesses to a tool written for one, changes what Principle III
says the bar may read, and writes into two more configuration files.

## What the investigation found (2026-10-01)

Both tools were tested on this machine, not assumed.

**GitHub Copilot CLI 1.0.80 runs a status line command, like Claude Code.** Its `app.js` builds
the status line from `statusLine.command` in `$COPILOT_HOME/settings.json` (default
`~/.copilot`), with `statusLine.padding` and `statusLine.refreshInterval`. It spawns the command
with `shell` on Windows, or when the command is not an existing file path, writes a JSON payload
to stdin, waits up to 10 seconds, and draws every line of stdout. A real payload was captured by
running Copilot's TUI in a pseudo-terminal with a capture script as the command:

```json
{ "cwd", "session_id", "session_name", "transcript_path", "model": {"id","display_name"},
  "workspace": {"current_dir"}, "username", "remote": {"connected", ...}, "version",
  "cost": {"total_api_duration_ms","total_lines_added","total_lines_removed",
           "total_duration_ms","total_premium_requests"},
  "context_window": {"total_input_tokens","total_output_tokens","total_cache_read_tokens",
           "total_cache_write_tokens","context_window_size","used_percentage", ...},
  "ai_used": {"total_nano_aiu","formatted"}, "allow_all_enabled" }
```

There is no `rate_limits`, `effort`, `prompt_cache`, `vim`, `fast_mode`, `pr` or `exceeds_200k_tokens`.
Copilot passes no `COLUMNS` or `LINES`. `transcript_path` is a directory, `session-state/<id>`,
and a real session wrote `events.jsonl` there, one `{type, data, id, timestamp, parentId}` per
line, with `assistant.turn_start`, `assistant.turn_end`, `session.usage_checkpoint` and, from
the code, `skill.invoked` carrying the skill's `name`. Copilot's loader exports
`COPILOT_CLI_BINARY_VERSION` to the command.

Run against that captured payload today, the bar renders without error, but draws
`5h ?% · ?` and `7d ?% · ?` for windows Copilot does not have, and its skills and activity read
nothing, because it looks for a Claude transcript file.

**OpenAI Codex CLI 0.158.0 has no status line command.** Its status line is a list of built-in
items in `[tui] status_line` of `~/.codex/config.toml`, chosen with `/statusline`. The binary
names twenty items: `project-name`, `current-dir`, `run-state`, `thread-title`, `git-branch`,
`context-remaining`, `context-used`, `five-hour-limit`, `weekly-limit`, `thread-credits`,
`estimated-thread-cost`, `codex-version`, `used-tokens`, `total-input-tokens`,
`total-output-tokens`, `thread-id`, `fast-mode`, `model-with-reasoning`, `reasoning`,
`task-progress`. A run of Codex's TUI with `-c tui.status_line=[...]` drew
`GPT-5.5 default · ~/repositorios/ai/RockAI · Context 0% used · Ready` and the account's limit,
and left `config.toml` unchanged. No setting or string for an external command was found, so
this project's renderer cannot run inside Codex; the most it can do is choose Codex's own items
to match its features.

## Feature matrix

| Feature | Claude Code | Copilot CLI | Codex CLI |
|---|---|---|---|
| Directory, repository, branch, tree state, PR, CI | yes | yes, from git and gh | `current-dir`, `git-branch` |
| Lines changed | yes | yes (`cost`) | no |
| Model | yes | yes | `model-with-reasoning` |
| Effort | yes | no field | in `model-with-reasoning` |
| Context % | yes | yes (null before the first call) | `context-used` |
| 5-hour, 7-day, spend limit | yes | none exist: hidden | `five-hour-limit`, `weekly-limit` |
| Burn rate, projection | yes | none | no |
| Prompt cache | yes | none | no |
| Session duration | yes | yes (`cost`) | no |
| rtk savings | yes | yes (local) | no |
| Skills | yes | yes, from `events.jsonl` | no |
| Working / idle | yes | yes, from `events.jsonl` | `run-state` |
| Todo | yes | no source found | `task-progress` |
| Vim, fast mode | yes | none | `fast-mode` |
| Update chip | yes | yes | no |
| Premium requests, allow-all | n/a | yes, new chips | n/a |
| Subagent rows, skill hook | yes | no equivalent | no |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The bar runs in Copilot CLI (Priority: P1)

**Independent Test**: Install for Copilot into a throwaway `COPILOT_HOME`, feed the captured
payload to the written command, and confirm the bar draws without 5-hour or 7-day chips.

**Acceptance Scenarios**:

1. **Given** `install --harness copilot`, **When** it runs, **Then** `$COPILOT_HOME/settings.json`
   gets `statusLine.command` and `statusLine.refreshInterval: 60`, the previous file is backed
   up, and every other key is kept.
2. **Given** a Copilot payload, **When** the bar renders, **Then** line 1, the model, the
   context figure, the session duration and the lines changed draw as they do in Claude Code,
   and no 5-hour, 7-day, spend, burn-rate or projection chip appears.
3. **Given** `cost.total_premium_requests` above zero, **When** the bar renders, **Then** a
   premium-requests chip shows the count.
4. **Given** `allow_all_enabled: true`, **When** the bar renders, **Then** an allow-all chip
   shows, since every tool now runs without asking.
5. **Given** a Copilot `events.jsonl` with a `skill.invoked` event inside the activity window,
   **When** the bar renders, **Then** line 2 names the skill; **given** an open
   `assistant.turn_start`, **Then** it reads working.

### User Story 2 - Codex shows the closest equivalents (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `install --harness codex`, **When** it runs, **Then** `~/.codex/config.toml` gets a
   `status_line` list under `[tui]` with the items matching this project's features, the
   previous file is backed up, and every other line is kept byte for byte.
2. **Given** a `[tui]` table that already exists, or a `status_line` already set, **When**
   install runs, **Then** it replaces only that key, inside that table.
3. **Given** `uninstall --harness codex`, **When** the `status_line` is the one install wrote,
   **Then** it is removed; a different list is left alone.

### User Story 3 - One tool, three harnesses, one answer (Priority: P2)

**Acceptance Scenarios**:

1. **Given** any install, **When** the user runs `doctor`, **Then** it reports, per harness that
   is present, whether this plugin is configured there.
2. **Given** `uninstall --harness copilot`, **When** the `statusLine` is this plugin's, **Then**
   it is removed and nothing else changes.

### Edge Cases

- `settings.json` for Copilot holds `//` comments: they are read past, the file is backed up,
  and the rewritten file is plain JSON; install says so.
- Copilot passes no width: the bar uses its 120-column default, and Copilot's own footer wraps.
- A payload that is neither Claude's nor Copilot's renders as Claude's, as today.
- `config.toml` missing: install creates it with only the `[tui]` table.
- A Codex user without `~/.codex`: `install --harness codex` says Codex is not set up and
  changes nothing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The renderer MUST detect the harness: Copilot when `COPILOT_CLI_BINARY_VERSION` is
  set or the payload carries `ai_used`; Claude Code otherwise. The premium-requests and
  allow-all chips depend on their own fields, not on the detection.
- **FR-002**: Under Copilot, the bar MUST NOT draw chips for limits Copilot does not report
  (5-hour, 7-day, spend, burn rate, projection), and MUST read skills and working state from
  `<transcript_path>/events.jsonl`.
- **FR-003**: Under Copilot, the bar MUST show `cost.total_premium_requests` when above zero
  and an allow-all chip when `allow_all_enabled` is true, each with an icon adopted from
  rendered evidence (`specs/029-multi-harness/glyph-evidence.png`).
- **FR-004**: `install --harness copilot` and `uninstall --harness copilot` MUST manage only
  `statusLine` in `$COPILOT_HOME/settings.json`, with a backup, in the cross-platform command
  form of specs/028.
- **FR-005**: `install --harness codex` and `uninstall --harness codex` MUST manage only
  `[tui] status_line` in `$CODEX_HOME/config.toml` (default `~/.codex`), with a backup, leaving
  every other line unchanged.
- **FR-006**: `install` with no `--harness` MUST behave exactly as today (Claude Code).
- **FR-007**: `doctor` MUST report the plugin's state in each harness found on the machine.
- **FR-008**: The README MUST document the feature matrix and the install for each harness.
- **FR-009**: Principle III MUST be amended to read each harness's own payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The captured Copilot payload renders with no `?%` limit chips.
- **SC-002**: A Claude Code payload renders byte for byte as before.
- **SC-003**: Installing and uninstalling for Codex leaves a `config.toml` identical to the one
  before, in tests with and without an existing `[tui]` table.
- **SC-004**: The full suite passes on all CI platforms.

## Assumptions

- The Copilot payload and event format are those of Copilot CLI 1.0.80, the version tested.
- Codex's item list is that of Codex CLI 0.158.0; an item a later Codex drops is ignored by it.
- Copilot's todo list has no source this project could find, so todo stays Claude-only.
- Codex's TUI could not be scripted past its trust and hook-review prompts without recording a
  decision in the user's config; the render test used a folder already trusted and pressed Esc
  at the hook prompt, and `config.toml` was compared before and after.
