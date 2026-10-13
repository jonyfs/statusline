---
track: quick
status: done
---

# The guide items that are on request

**Feature Branch**: `feat/053-opt-in-guide-items`

**Created**: 2026-10-12

**Status**: Done

**Input**: Three things the review's guide states literally and the bar left out for a
measured reason (features 044, 045 and 051). The reasons stand as defaults. Each is now
available to a person who wants the guide's form.

## Requirements

- **FR-001**: `CLAUDE_STATUSLINE_DIM=sgr` draws units, resets and the repository with SGR 2.
  The default stays a quieter text colour, which keeps 4.5:1.
- **FR-002**: `CLAUDE_STATUSLINE_PADDING=wide` puts two columns before the icon of every chip
  after an arrow (section 5.5). The width guard counts the column, and the pill ignores it.
- **FR-003**: `scripts/bench.js` reports the guide's 25 ms p95 target as met or not met, and
  never fails the run on it. The 300 ms budget stays the enforced one.

## Not changed

- The defaults. A bar with none of these set draws what feature 052 drew.
