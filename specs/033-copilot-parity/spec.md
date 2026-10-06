---
track: full
status: done
---

# Feature Specification: Copilot parity

**Feature Branch**: `feat/copilot-parity`

**Created**: 2026-10-06

**Status**: Completed (the declaration above is authoritative)

**Input**: Owner request, relayed by the workflow: "Sim, prossiga automaticamente até terminar
todas as specs." The computed task asks for every feasible Copilot option from the parity study
of GitHub Copilot CLI 1.0.91, so that the bar under Copilot looks and reads as close as possible
to the bar under Claude Code.

**Track**: `full`. It touches the layout, the Copilot session reader, a new cached network
source, the installer, the diagnostic and two constitution principles.

## What the study found (2026-10-06)

The parity study read the Copilot CLI 1.0.91 bundle (`app.js`), its event schema, ten real
sessions in `~/.copilot/session-state` and live captures of the payload Copilot sends. Its
conclusions, each checked by a second reviewer:

- Rendering is already at parity. Copilot passes truecolor, Nerd Font glyphs and OSC 8 links
  through unchanged. What differs is width and data, not drawing.
- Copilot sets no `COLUMNS` or `LINES`. It spawns the command with piped stdio and no extra
  environment, so the bar lays out for 120 columns. The command still shares Copilot's
  controlling terminal, so `/dev/tty` reports the real size (`stty size </dev/tty` gave `40 117`
  inside Copilot). Copilot adds `statusLine.padding` spaces to the left of every line.
- Copilot re-runs the command only on its own state changes or every
  `statusLine.refreshInterval` seconds. A resize, a todo change or a quota change does not
  trigger a redraw.
- **The payload sends `used_percentage: null` until the first model call**, but it also sends
  `current_context_used_percentage`, `current_context_tokens` and `displayed_context_limit`.
- No effort in the payload. The session log has it: the root `user.message` carries
  `data.responsesReasoning.effort`, and `session.model_change` carries `data.reasoningEffort`.
  The user's default is `effortLevel` in Copilot's settings.
- The model reads `Auto` with the default auto router. The session log names the model that
  answered: every root `assistant.message` has `data.model`, and `session.auto_mode_resolved`
  has `data.chosenModel`. Subagent messages carry an `agentId` and a `parentToolCallId`, and
  their model is the subagent's, not the session's.
- **Todos live in `<transcript_path>/session.db`**, a SQLite file with a `todos` table
  (`id, title, description, status`), status one of `pending`, `in_progress`, `done`,
  `blocked`. Its change signal is ephemeral and not given to commands.
- **Repeat skill invocations are written as `skill.invoked_ref`**, with the same `name`.
- AI credits are in the payload as `ai_used.formatted` (Copilot's own footer prints them as
  `0.64 AIC used`, or `4.20/20 AIC used` with a session limit). A session limit comes from
  `session.session_limits_changed` (`data.sessionLimits.maxAiCredits`, null clears it), and
  `session.resume` repeats it.
- The account's quota is a monthly one. `gh api /copilot_internal/user` returns
  `quota_snapshots.premium_interactions` and `quota_snapshots.chat` with `percent_remaining`,
  `entitlement`, `unlimited` and `has_quota`, and `quota_reset_date`. It is an internal,
  undocumented endpoint. There is no 5-hour or 7-day window.
- Copilot's own footer row repeats the bar. `footer.showDirectory`, `showBranch`,
  `showPullRequest` and `showAiUsed` default to on; `footer.showCustom` must stay on or the bar
  disappears.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The bar fits the real terminal under Copilot (Priority: P1)

A developer runs Copilot CLI in a 100-column terminal. The bar sheds segments by priority to
fit 100 columns, exactly as it does under Claude Code, instead of being laid out for 120 and
word-wrapped by Copilot.

**Why this priority**: a wrapped bar splits a segment across two rows and loses the background
of the space at the break. It is the most visible difference.

**Independent Test**: render with no `COLUMNS`, the Copilot harness and a stubbed terminal
reporting 100 columns; every line fits 100 columns.

**Acceptance Scenarios**:

1. **Given** Copilot and no `COLUMNS`, **When** `/dev/tty` reports 117x40, **Then** the bar is
   fitted to 117 columns and 40 rows.
2. **Given** `statusLine.padding: 3` in Copilot's settings, **When** the terminal is 117
   columns, **Then** the bar is fitted to 114.
3. **Given** Claude Code with `COLUMNS=80`, **When** it renders, **Then** `/dev/tty` is never
   opened and the width is 80.
4. **Given** Windows, or no controlling terminal, **When** Copilot renders, **Then** the width
   falls back to 120.

---

### User Story 2 - The same figures Claude's bar shows (Priority: P1)

Under Copilot the bar shows the context percentage from the first frame, the effort beside the
model, the model that actually answered when the model is `Auto`, todo progress, and skills
including repeat invocations.

**Independent Test**: real Copilot 1.0.91 payloads and a session log built from real events.

**Acceptance Scenarios**:

1. **Given** `used_percentage: null` and `current_context_used_percentage: 0`, **Then** the chip
   reads `Context 0%`, not `?%`.
2. **Given** only `current_context_tokens` and `displayed_context_limit`, **Then** the
   percentage is their ratio. A limit of 0 gives `?%`.
3. **Given** a root `user.message` with `responsesReasoning.effort: "medium"`, **Then** the effort
   chip reads `medium`. A later root `session.model_change` with a non-null `reasoningEffort`
   replaces it. With neither, `effortLevel` from Copilot's settings is used; with nothing, the
   chip is absent.
4. **Given** `model.id: "auto"` and a root `assistant.message` with `model: "gpt-6-luna"`,
   **Then** the model chip reads `gpt-6-luna (auto)`. A subagent's message never answers for
   the session. Before any message, `session.auto_mode_resolved` answers; before that, `Auto`.
5. **Given** a `session.db` with three todos, one done and one in progress, **Then** line 2 shows
   the in-progress title and `(1/3)`, as it does for Claude Code. No file means no chip.
6. **Given** a `skill.invoked_ref` event, **Then** the skill counts as invoked at that moment.

---

### User Story 3 - What the session and the month have spent (Priority: P2)

Under Copilot the bar shows the AI credits this session used, as a share of the session limit
when one is set, and the account's monthly quotas in the slots the 5-hour and 7-day chips use
under Claude Code, each labelled as monthly with its reset date.

**Independent Test**: payloads with `ai_used`, a log with `session_limits_changed`, and a
cached quota entry.

**Acceptance Scenarios**:

1. **Given** `ai_used.formatted: "0.64"` and no limit, **Then** a chip reads `0.64 AIC`.
2. **Given** a limit of 20 credits and 4.2 used, **Then** the chip reads `4.20/20 AIC · 21%`
   in its ramp colour. A later `sessionLimits: null` removes the limit.
3. **Given** a cached quota with chat 97% remaining of 200 and premium unlimited or with an
   entitlement of 0, **Then** only a chat chip shows, reading `month chat 3% · Nov 1`.
4. **Given** `gh` missing or unauthenticated, **Then** nothing is cached and no quota chip shows.
5. **Given** Claude Code, **Then** no quota lookup is ever started.

---

### User Story 4 - Installing for Copilot (Priority: P2)

`install --harness copilot` writes a 10-second refresh interval. With `--quiet-footer` it also
turns off the parts of Copilot's own footer the bar already shows, keeping the bar on, and
uninstall puts back exactly what was there. `doctor` reports both.

**Acceptance Scenarios**:

1. **Given** a plain Copilot install, **Then** `statusLine.refreshInterval` is 10.
2. **Given** `--quiet-footer`, **Then** `footer.showDirectory`, `showBranch`, `showPullRequest`,
   `showAiUsed`, `showContextWindow`, `showQuota`, `showCodeChanges`, `showCiStatus` and
   `showModelEffort` are false, `showCustom` is not false, and the previous value of each key,
   including "absent", is recorded.
3. **Given** a second `--quiet-footer` install, **Then** the record still holds the values from
   before the first one.
4. **Given** uninstall, **Then** each recorded key whose value is still the one the install
   wrote goes back to its old value or is removed; a key the user changed since is left alone.
5. **Given** `doctor`, **Then** the Copilot line names the refresh interval and whether the
   footer is quiet.

### Edge Cases

- `/dev/tty` exists but has no controlling terminal: `ENXIO`, so the width is 120.
- `node:sqlite` missing (Node before 22.13, or 23.0 to 23.3): the `sqlite3` CLI is used on macOS and Linux when it
  is installed; otherwise the todo chip is absent. Node's experimental warning is not printed.
- A `session.db` with no `todos` table: no chip.
- A quota snapshot with `unlimited: true`: no chip for it. `has_quota: false` with an
  entitlement: the chip says `full`.
- `ai_used.formatted` with letters in it is drawn as sent.
- A Copilot settings file with comments: read past them, as install already does.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Under Copilot with no `COLUMNS`, the width MUST come from `/dev/tty` minus
  `statusLine.padding`, and the height from the same read; on Windows or on any failure, 120
  columns and no height limit. With `COLUMNS` set, `/dev/tty` MUST NOT be opened.
- **FR-002**: The context percentage MUST fall back to `current_context_used_percentage`, then
  to `current_context_tokens / displayed_context_limit`, only when `used_percentage` is null.
- **FR-003**: Under Copilot the effort MUST come from the latest root `user.message`
  `responsesReasoning.effort` or root `session.model_change` `reasoningEffort`, whichever is
  newer and non-null, then from `effortLevel` in Copilot's settings.
- **FR-004**: Under Copilot, when `model.id` is `auto`, the model chip MUST name the latest root
  `assistant.message` model, else `session.auto_mode_resolved` `chosenModel`, with `(auto)`
  after it. A root `session.model_change` clears both.
- **FR-005**: Under Copilot the todo chip MUST read `<transcript_path>/session.db` read-only,
  through `node:sqlite` when present, else the `sqlite3` CLI outside Windows, else not at all.
- **FR-006**: `skill.invoked_ref` MUST count as `skill.invoked`.
- **FR-007**: Under Copilot an AI credits chip MUST show `ai_used.formatted` when credits were
  used, with the share of `maxAiCredits` when a session limit is in force.
- **FR-008**: Under Copilot the monthly premium and chat quotas MUST come from
  `gh api /copilot_internal/user` through the detached refresh, cached for about 5 minutes,
  labelled monthly with the reset date, and absent when `gh` fails. No lookup under Claude Code.
- **FR-009**: `install --harness copilot` MUST write `refreshInterval: 10`; `--quiet-footer` MUST
  turn the covered footer items off and record their previous values; uninstall MUST restore
  them; `doctor` MUST report both.

### Key Entities

- **Copilot session state**: what the events log folds into (adds the root effort, the resolved
  model and the session limit to the sidecar, schema 2).
- **Copilot quota entry**: `{ resetDate, quotas: { premium, chat } }`, each quota
  `{ usedPct, entitlement, unlimited, full }`, cached under one global key.
- **Footer record**: `~/.claude/statusline/copilot-footer.json`, per Copilot settings file, each
  key's previous value or absence.

## Success Criteria *(mandatory)*

- **SC-001**: In a 100-column Copilot terminal no bar line is wider than 100 columns.
- **SC-002**: A fresh Copilot session's first frame shows a context figure, not `?%`.
- **SC-003**: With the default auto model, the chip names the model that answered.
- **SC-004**: Claude Code's bar is byte-identical for every existing preview scenario.
- **SC-005**: `npm test` passes.

## Out of scope, and why

- A redraw at the moment of a resize: Copilot gives the command no resize trigger.
- Copilot's hint row and model label above the bar: no setting moves them.
- A prompt-cache chip: the only persisted cache state is written at shutdown, so any chip would
  be a guess (Principle III).
- 5-hour and 7-day windows: Copilot meters a month.
