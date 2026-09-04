# Data Model: Skill Auto-Removal

No new data entities. This feature verifies behavior over data structures that already exist.

## Skill activity record (existing)

| Field | Source | Notes |
|---|---|---|
| `skill` | hook event log (`src/skillEvents.js`) or transcript tool_use block (`src/transcriptTail.js`) | the invoked skill's name |
| `at` / `timestamp` | same | when it was last invoked; the sole signal for "in use" |

## Removal delay (existing, verified here)

| Field | Source | Notes |
|---|---|---|
| default | `DEFAULT_WINDOW_MS` in `src/skills.js` | 30 minutes |
| override | `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` env var | minutes; non-numeric or non-positive falls back to default |

A skill is "in use" (shown) exactly when `now - lastInvocationAt <= windowMs()`, evaluated independently per skill name, on every render.
