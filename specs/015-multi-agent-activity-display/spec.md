# Feature Specification: Multi-Agent Activity Display

**Feature Branch**: `015-multi-agent-activity-display`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User report: With many agents in parallel, statusline shows "idle" instead of "working", and doesn't display all agent skills.

## Problem

When multiple agents (2+) run concurrently:
1. Activity status shows "idle" — should show "working" (relates spec 012)
2. Skills line incomplete — doesn't display all agent skills (relates spec 013)
3. Line 2 appears to truncate or not aggregate skills correctly

## Root Cause Analysis

- **Spec 012** (subagent-aware activity): May not be detecting multiple concurrent agents correctly
- **Spec 013** (multi-agent skills): May be hitting line-width limits and truncating without overflow indicator
- **Aggregation**: Skills may not be merging properly when >2 agents run

## Requirements

- **FR-001**: Activity shows "working" when ANY agent is running (not just single-threaded)
- **FR-002**: All agent skills displayed on line 2, using overflow handling (+N) if needed
- **FR-003**: Line 2 doesn't truncate—shows what fits, then "+X more" for rest
- **FR-004**: Works correctly with 2, 3, 5+ concurrent agents

## Success Criteria

- Activity shows "working" with 2+ agents running
- All agent skills visible (direct view or via overflow count)
- No silent truncation of agent skill display
