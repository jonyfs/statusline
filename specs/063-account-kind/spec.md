---
track: quick
status: done
---

# Remember the kind of account

**Feature Branch**: `feat/063-account-kind`

**Created**: 2026-11-03

**Input**: the 062 follow-up: a dollar-budget account drew `5h — ?  7d — ?` after its spend
limit left the payload, and drew no money chip at all.

## Why this exists

The gateway sends `rate_limits.spend_limit` only while it reports one and its `resets_at` has
not passed, and `rate_limits` is absent before the first API response. A payload with neither
a window nor a spend limit therefore cannot say which kind of account it came from, and the
062 rule (hide the windows when `spend_limit` is the only limit) did not apply to it.
Reproduced with `rate_limits: {}` and with no `rate_limits`: both drew `5h — ?  7d — ?`.

## Requirements

- **FR-001**: `accountKindOf(payload)` is `subscriber` when `five_hour` or `seven_day` is a
  block, `budget` when `spend_limit` is the only one, `null` otherwise.
- **FR-002**: Under Claude Code only, the last kind seen is kept in one cache entry for the
  machine (`accountKind`, 30 days). A payload that says nothing never erases it; one that says
  a kind replaces it. It is rewritten at most once a day for the same kind.
- **FR-003**: A budget account (from the payload or remembered) whose payload has no window
  draws no `5h` or `7d` chip. A payload with a window always draws it, whatever was remembered.
- **FR-004**: A remembered budget account whose payload has no `spend_limit` draws
  `spend —`, not nothing and not an invented figure (Principle III). The pace chip stays
  absent: it needs the dollars.
- **FR-005**: With nothing remembered, or under Codex, Copilot or OpenCode, nothing changes:
  `5h — ?  7d — ?` stays what it was.

## Known edge

Someone who uses a budget account and a subscription on one machine sees `spend —` in place of
`5h — ?` for the first redraw of a session on the other account, until its first response
carries the windows and the remembered kind flips.
