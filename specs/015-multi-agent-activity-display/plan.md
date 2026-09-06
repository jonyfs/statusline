# Plan: Multi-Agent Activity Display Fix

**Status**: Completed & Deployed

**Versions**: v1.2.3 through v1.2.8

## Implementation Summary

Three bugs fixed with three targeted changes:

### Fix 1: Activity Detection (v1.2.4)

**File**: `src/render.js:333`

**Change**: Add check for `payload.activeAgents` to activity.working flag

```
activity.value.working = activity.value.working || subagent.length > 0 || hasActiveAgents
```

**Why**: When agents run in parallel (spec 013), they appear in payload.activeAgents, not in subagent list. Checking only subagent.length missed this case.

### Fix 2: Agent Status Filter (v1.2.5)

**File**: `src/skillAggregation.js:34-48`

**Change**: Relaxed status filter to include agents with missing status field

**Old**: Skip agents where `status !== "running"`  
**New**: Skip agents with terminal statuses only (finished/completed/failed/error)

**Why**: Payload may not include status field. Being strict filtered out valid agents silently.

### Fix 3: Skills Display Truncation (v1.2.5)

**File**: `src/skills.js:263-270`

**Change**: Truncate display text to displayLimit skills

**Why**: formatForDisplay returned full string. With many agents, line 2 would overflow. Now respects display constraints while hiddenCount tracks what's off-screen.

## Testing

- All 440 existing tests pass
- Test suite includes: agent integration (test-agent-integration.js), skill aggregation (test-skill-aggregation.js)
- Multi-agent scenarios verified: 2, 3, 5+ agents, overlapping skills, status filtering

## Verification

User reported screenshot showing correct behavior after v1.2.5 installation:
- Multiple agents display with activity "working" (not idle)
- Skills showing with proper overflow handling
