---
track: quick
status: done
---

# Codex windows of any length, and Codex credits

**Feature Branch**: `feat/codex-windows`

**Created**: 2026-10-06

**Input**: The owner asked for the bar's windows and percentages to follow what `/usage` shows
in Claude Code: the 5-hour session, the week, and their equivalents in Copilot CLI and Codex CLI.

**Track**: `quick`. One module reads the new fields (`src/codexRollout.js`), the renderer draws
two more chips, and the registry, doctor and README follow.

## Evidence

- **Claude Code.** The payload Claude Code 2.1.292 sends on this machine carries
  `rate_limits.five_hour` and `rate_limits.seven_day` (checked in `debug-last-payload.json`),
  and the bar already draws both. `/usage` shows more: a Sonnet-only week, an Opus-only week and
  extra usage. Those come from `api.anthropic.com/api/oauth/usage`, which needs Claude Code's
  OAuth token from the Keychain or `~/.claude/.credentials.json`. The owner chose not to read
  the token (decision logged on 2026-10-06). Claude stays payload-only, and those three figures
  stay off the bar.
- **Copilot CLI.** Copilot 1.0.92 meters a month. The bar already shows the monthly premium and
  chat quota (specs/033-copilot-parity). The session logs record no 5-hour or weekly limit.
  Nothing changes.
- **Codex CLI.** Codex 0.160.1 writes `rate_limits` on every `token_count` in its rollout:
  `primary` and `secondary`, each with `used_percent`, `window_minutes` and `resets_at`, plus
  `credits` (`has_credits`, `unlimited`, `balance`) and `plan_type`. On this machine's free plan
  the latest rollout reads `primary: { used_percent: 8, window_minutes: 43200 }`,
  `secondary: null`. The bar maps only 300 and 10080 minutes (Principle III as of 7.6.0), so a
  free-plan session under the Codex pane shows no usage figure at all, while Codex's own
  `/status` shows the 30-day figure.

## User scenarios

### US1: A free-plan Codex session shows its 30-day window (P1)

Under the Codex pane, on the free plan, line 3 shows `30d 8% · 05/11 13:46`, the share of the
30-day window used and when it resets, coloured by the same levels as the 5-hour and 7-day chips.

**Acceptance**

1. A rollout whose only window is 43200 minutes draws a `30d` chip with its percentage. The
   `5h` and `7d` chips stay absent, not `?%`.
2. A window at 100% says `full`, like the others.
3. A reset more than a day out names the date, `dd/mm hh:mm`. One inside a day counts down.
   A reset further out than the window's own length is shown as `?`, because it is a timestamp
   in the wrong unit.
4. A narrow terminal drops the reset before the chip.

### US2: Any other window length gets its own label (P2)

A window Codex reports at a length other than 300 or 10080 minutes is labelled by that length:
whole days as `Nd`, whole hours as `Nh`, otherwise `Nm`. 1440 minutes reads `1d`, 120 reads `2h`.
300 and 10080 keep the `5h` and `7d` chips and their slots. When both `primary` and `secondary`
are such windows, the chip shows `primary`, and `doctor` names both.

### US3: Codex credits (P3)

When the rollout's `credits.has_credits` is `true`, `unlimited` is not `true` and `balance` is
a number written as text, line 3 shows `credits 12.5`, the balance as Codex reports it.
Unlimited credits, `has_credits: false`, or a missing or non-numeric balance draw nothing.

## Requirements

- **FR-001** The rollout reader MUST keep each window that has a numeric `used_percent` and a
  positive whole `window_minutes` other than 300 and 10080, with its label, length, percentage
  and `resets_at`, in the payload's `codex` block. It MUST NOT write those windows into
  `rate_limits`, which keeps Claude Code's shape.
- **FR-002** The label MUST come from `window_minutes` alone. Nothing is inferred from the plan
  name.
- **FR-003** The chip MUST appear only under Codex, only when such a window exists, and MUST NOT
  replace or move the `5h` and `7d` chips.
- **FR-004** The reset MUST be bounded by the window's own length plus one day. A reset past
  that bound shows `?`.
- **FR-005** The credits chip MUST show the balance text unchanged (trimmed) and MUST be absent
  in every other case in US3.
- **FR-006** `doctor` MUST have a row for each new segment: its value, or why it is absent
  ("Codex CLI only" outside Codex).
- **FR-007** Claude Code and Copilot output MUST NOT change. Neither payload carries a `codex`
  block.
- **FR-008** Principle III MUST be amended to allow FR-001 to FR-005. Its rule against drawing
  a window under a label it does not have stays.

## Edge cases

- `window_minutes` of 0, negative, fractional, or not a number: the window is dropped.
- `used_percent` missing or `NaN`: the window is dropped.
- The rollout changes shape: the reader degrades to an absent field, as before.
- A rollout written before credits existed: no credits chip.

## Success criteria

- **SC-001** A free-plan Codex session shows a usage figure on its first redraw after a turn,
  where it showed none before.
- **SC-002** Every existing Claude Code and Copilot render test passes unchanged.
- **SC-003** The suite covers US1 to US3 and every edge case above.

## Assumptions

- The free plan's 30-day window is Codex's own figure, the one `/status` shows, so drawing it
  is not a fabricated monthly figure. Principle III's ban on a monthly figure is about
  Anthropic's plans, which have none.
- One extra-window chip is enough. Codex reports at most two windows, and a plan with two
  windows of unusual length has not been seen.
