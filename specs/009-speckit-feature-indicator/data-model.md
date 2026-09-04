# Data Model: Speckit Feature Indicator

## In-progress feature record (read-only, external)

Not owned by this feature; read from `.specify/feature.json`, which Spec Kit's own commands write.

| Field | Type | Notes |
|---|---|---|
| `feature_directory` | string | e.g. `"specs/009-speckit-feature-indicator"`. This feature reads only this field. |

## Feature identifier (derived, display-time)

| Field | Description |
|---|---|
| `id` | The basename of `feature_directory` (e.g. `"009-speckit-feature-indicator"`), or `null` when the file is missing, unparseable, or the field is absent/not a string. |

## Relationship to the skills chip

No change to `getActiveSkills()`'s shape. The feature identifier is computed independently at render time and substituted into the same parenthetical slot `sddStepFor()` already populates (specs/007), per research.md's decision: feature identifier takes the slot when available, the step label is the fallback, and the parenthetical is omitted entirely when neither is available.
