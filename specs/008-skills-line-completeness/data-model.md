# Data Model: Skills Line Completeness

## Active skill scan result (extended)

Existing shape returned by `getActiveSkillsDetailed()` (`src/skills.js`), clarified for this feature:

| Field | Type | Notes |
|---|---|---|
| `skills` | string[] | existing, newest first, deduplicated |
| `truncated` | boolean | existing: true when the scan stopped before exhausting the activity window |
| `bytesRead` | number | existing |
| `source` | `"hook"` \| `"transcript"` | existing |
| `trueCount` | number | **new**. The actual number of distinct active skills, computed without the `SKILLS_PROBED` display cap, used only to compute an accurate overflow count |

## Skills line overflow (render-time, not persisted)

| Field | Description |
|---|---|
| `shown` | Up to `SKILLS_SHOWN` (5) skill names, newest first |
| `hiddenCount` | `trueCount - shown.length`, no longer `list.length - SKILLS_SHOWN` where `list.length` was itself capped at `SKILLS_PROBED` |

## Doctor diagnostic entry (new)

| Field | Description |
|---|---|
| `skillName` | The skill being explained |
| `status` | One of: `active`, `expired` (was seen, now outside the window), `never-detected` |
| `lastSeenAt` | Timestamp, when `status` is `expired` |
| `trackingSource` | `hook` or `transcript-fallback`, so a missing-hook-installation cause is visible |
