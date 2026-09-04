# Data Model: Subagent-Aware Activity Status

No new data entities. This feature combines two existing signals at render time.

## Working/idle status (existing, extended)

| Field | Source | Notes |
|---|---|---|
| `working` (before this feature) | `getSessionActivity()` | true if the top-level transcript wrote within `ACTIVE_WITHIN_MS` (10s) |
| `working` (after this feature) | `getSessionActivity()` OR `subagentActivity(now).length > 0` | true if either the top-level session is active or at least one subagent is (per specs/011's snapshot) |

No new fields, no new storage. The computation happens once, in `gather()`, before the value reaches the render.
