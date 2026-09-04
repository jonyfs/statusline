# Data Model: Statusline English-Only Output

No persistent data entities are introduced. This feature operates on two conceptual categories already implicit in the codebase, formalized here to support FR-001 through FR-006.

## Tool-authored string

| Field | Description |
|---|---|
| `file` | Source file the literal lives in (e.g. `src/render.js`) |
| `line` | Line number of the literal |
| `text` | The literal string as written |
| `context` | Segment/CLI path it renders into (e.g. "pr segment review-state word") |

Not persisted. Computed at scan time by the regression check (`scripts/check-english-strings.js`) and printed as a report (FR-005).

## Pass-through data (reference only, not modified)

| Field | Description |
|---|---|
| `source` | Where it comes from (git branch, commit message, task title, file path) |
| `value` | The raw value, displayed unchanged |

Included here only to make explicit what the scan MUST exclude (FR-004): pass-through values are read from `git`/`gh`/task payloads, not from string literals in `src/`, so a literal-based scan naturally leaves them untouched.
