---
track: quick
status: done
---

# Line 3's windows: the weekly rate, the per-model weeks, extra usage, a clock, the seat, the links

**Feature Branch**: `feat/073-backlog-batch`

**Created**: 2026-11-05

**Input**: Backlog items 59, 60, 61, 62, 68 and 74 of the owner's selection.

**Track**: `quick`: one more sampled field, one more cached block, two small segments, three switches.

## Requirements

- **FR-001** (59): The sample history keeps `sevenDayPct`. Segment `sevenDayRate` (line 3 after the
  7-day chip) draws `+3%/d`, the 7-day figure's rate over the sample ring scaled to a day, with the
  same five-samples-over-a-minute rule as the 5-hour burn rate. Absent when flat or falling.
- **FR-002** (60): `readUsageCredits` returns `windows.perModel`, one `{ model, pct, resetsAt }` per
  `seven_day_<model>` block the cache carries (`opus`, `sonnet`, any other name after the prefix).
  Segment `weeklyModels` draws them as `opus 40% · sonnet 12%` in the band of the highest.
- **FR-003** (61): A subscriber's 5-hour chip ends with `+extra` while the cache says extra usage is
  on for the signed-in account (a plan that keeps working past its windows).
- **FR-004** (62): `CLAUDE_STATUSLINE_RESET=clock` draws every window's reset as a moment in the
  computer's zone (`13:45`, `tmrw 09:00`, `thu 18:00`, `nov 20`) instead of a countdown, on the
  5-hour, 7-day, spend and Codex window chips.
- **FR-005** (68): `CLAUDE_STATUSLINE_ACCOUNT=tier` draws the organisation and the seat tier,
  `Acme · usage-based`, the tier's underscores read as spaces and `enterprise_` dropped.
- **FR-006** (74): The 5-hour and 7-day chips link to `claude.ai/settings/usage`; the Codex window
  chip to Codex's usage page, as the credit chips already do. The gateway's spend chip stays
  unlinked, as specs/070 decided: the payload names no page for it.
- **FR-007**: Doctor rows and README follow.
