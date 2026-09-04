# Data Model: PR Label Display

## PR/MR (extended)

The existing normalized shape returned by `normalizePr()` (`src/git.js:259`), with one added field.

| Field | Type | Notes |
|---|---|---|
| `number` | number | existing |
| `url` | string \| null | existing |
| `review` | string \| null | existing (`draft`, `changes_requested`, etc.) |
| `kind` | `"pr"` \| `"mr"` | existing |
| `source` | string | existing (`"payload"` or `"gh"`) |
| `labels` | string[] | **new**. Label names only, in the order returned by `gh pr view --json labels` (GitHub) or the payload (GitLab). Empty array when the PR has no labels or the source didn't include the field. |

## PR label (display-time, not a stored entity)

| Field | Description |
|---|---|
| `name` | The label's text, shown verbatim (no color, no ID) |

Colors and IDs from `gh`'s label objects are dropped during normalization; only `name` is kept, consistent with the Assumptions in spec.md ("labels are shown as plain text").

## Truncation rule

- Show up to 3 label names, space/comma-joined, in the order they arrive.
- If more than 3 exist, append `+N` where `N` is the count of the remainder (e.g. 5 labels → `bug, priority-high, needs-review +2`).
- 0 labels → no label text at all; segment renders exactly as before this feature.

This mirrors the existing skills-line truncation (`hiddenCount`, `src/render.js:708-713`), reused here rather than reinvented (FR-004).
