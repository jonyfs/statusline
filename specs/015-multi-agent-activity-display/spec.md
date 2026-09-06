# Feature Specification: Multi-Agent Activity Display

**Feature Branch**: `015-multi-agent-activity-display`

**Created**: 2026-09-05

**Status**: Completed & Deployed (v1.2.3 → v1.2.8)

**Input**: User report: With many agents in parallel, statusline shows "idle" instead of "working", and doesn't display all agent skills.

## Problem

When multiple agents (2+) run concurrently:
1. Activity status shows "idle" — should show "working" (relates spec 012)
2. Skills line incomplete — doesn't display all agent skills (relates spec 013)
3. Line 2 appears to truncate or not aggregate skills correctly

## Root Causes Identified & Fixed

**Issue 1: Activity detection ignores activeAgents** (v1.2.4)
- Activity check only looked at `subagent.length > 0`
- When agents run in parallel via payload.activeAgents, `subagent` list was empty
- Fix: Added check for `payload.activeAgents.length > 0` to activity.value.working

**Issue 2: Agent status filter too strict** (v1.2.5)
- aggregateSkills filtered agents with `status !== "running"` 
- Payload may not include status field, so agents were silently skipped
- Fix: Changed to skip only terminal statuses (finished/completed/failed/error)
  Include agents with missing status field

**Issue 3: Skills display not truncated** (v1.2.5)
- formatForDisplay returned full string (could be very long with many agents)
- No truncation to displayLimit, causing line overflow
- Fix: Added truncation logic in getAggregatedSkills to limit display text

## Requirements

- **FR-001**: Activity shows "working" when ANY agent is running ✓
- **FR-002**: All agent skills displayed on line 2, with overflow handling ✓
- **FR-003**: Line 2 truncates gracefully to displayLimit, uses "+N more" ✓
- **FR-004**: Works with 2, 3, 5+ concurrent agents ✓

## Success Criteria

- ✓ Activity shows "working" with 2+ agents running (v1.2.4)
- ✓ All agent skills visible or counted in overflow (v1.2.5)
- ✓ No silent truncation — hiddenCount accurate (v1.2.5)
