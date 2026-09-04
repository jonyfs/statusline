# Research: Subagent-Aware Activity Status

## Decision: OR subagent activity into `working` at the point `activity` is computed in `gather()`

**Decision**: In `src/render.js`'s `gather()`, right after `const activity = timed("transcript", () => probe.getSessionActivity(...))` (~line 308), patch `activity.value.working` to `activity.value.working || probe.subagentActivity(now).length > 0` when `activity.value` is non-null.

**Rationale**: This is the single place `working` is computed before it reaches the render (`pushLine2Extras`, `src/render.js:729-730`); patching it here means the render-time badge logic (`activity.working ? "working" : "idle"`) needs no change at all, and every existing test of that badge logic keeps its meaning.

**Alternatives considered**: Patching inside `getSessionActivity()` itself (`src/skills.js`) was considered and rejected: that function already has a narrow, well-documented contract ("the transcript grew recently") and mixing in a completely different data source (a task-rows snapshot) would make its own doc comment describe two different things. Keeping the OR at the call site in `render.js`, where `subagentActivity()` is already imported and called for the skills chip (specs/011), is the smaller, more legible change.

## Decision: Reuse `subagentActivity()` verbatim, no new function

**Decision**: `probe.subagentActivity(now).length > 0` is the entire signal; no new reader, no new freshness window, no new state file.

**Rationale**: The spec's own Assumptions require this ("whatever mechanism already knows 'is a subagent currently running' is the source this indicator also draws from, rather than a second, independent detection method"). `subagentActivity()` already has the right freshness semantics for "is a subagent running right now" (specs/011's 30-second window, tuned for exactly this "is a tick still happening" question), which is a better fit here than inventing a new one.

**Alternatives considered**: A separate "is any subagent running" boolean reader was considered and rejected as needless duplication: the labels array's emptiness already answers the same question `subagentActivity()` was built to answer.

## Decision: No behavior change when the snapshot is absent

**Decision**: When `subagentActivity(now)` returns `[]` (no snapshot, stale snapshot, or genuinely no subagents), `working` is exactly what `getSessionActivity()` already computed, unchanged.

**Rationale**: Directly satisfies FR-005 and Acceptance Scenario 3; the OR operation is a no-op in this case by construction, so no separate fallback code path is needed.

**Alternatives considered**: None; this falls out of the OR design for free.
