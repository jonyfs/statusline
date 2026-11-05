---
track: quick
status: done
---

# Accounts that have no window

**Feature Branch**: `feat/068-no-window-account`

**Created**: 2026-11-04

**Input**: line 3 only fit the owner's account kind. A Console API key, Bedrock, Vertex,
Foundry or a seat with no individual allowance drew `5h — ?  7d — ?` for ever.

## Why this exists

Claude Code sends `rate_limits` only to Pro, Max and Ultra subscribers and behind a gateway
with a spend limit (code.claude.com/docs/en/statusline). Every other account gets none, so the
two chips waited for a figure that never comes. The dollar limit of a plain Enterprise
organisation is not in the payload either, so it cannot be shown.

## Requirements

- **FR-001**: A third account kind, `none`, is a payload with a response already received
  (`cost.total_api_duration_ms` above zero) and no `five_hour`, `seven_day` or `spend_limit`.
- **FR-002**: A remembered kind (`subscriber`, `budget`, `none`) outranks the `none` signal,
  because a subscriber or gateway account looks the same right after its window was dropped.
  `none` is written only when nothing is remembered. A payload with windows or a spend limit
  always wins and replaces it.
- **FR-003**: Under `none` the `5h` and `7d` chips are absent, not `?`. Before any response,
  with nothing remembered, they still read `?`.
- **FR-004**: Claude Code only; Codex, Copilot and OpenCode are untouched.
- **FR-005**: No dollar figure is added. `cost.total_cost_usd` is a client-side session
  estimate and stays out until the owner chooses it (it needs its own III amendment).

## Known limits

- A machine that remembered `budget` or `subscriber` and later runs an API key keeps that kind
  for up to 30 days. Hiding real windows would be the larger error.
- The Enterprise dollar limit of a claude.ai organisation reaches the payload nowhere.
