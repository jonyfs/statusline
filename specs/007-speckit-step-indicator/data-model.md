# Data Model: Spec-Driven Development Step Indicator

## SDD step label (static table, not persisted)

| Field | Type | Notes |
|---|---|---|
| `skillName` | string | key, e.g. `speckit-plan` |
| `label` | string | English step label, e.g. "Planning" |

Illustrative starting set (final wording decided during implementation, per the checklist's note that exact phrasing is a planning/implementation detail, not a spec requirement):

| Skill | Label |
|---|---|
| `speckit-specify` | Specifying |
| `speckit-clarify` | Clarifying |
| `speckit-plan` | Planning |
| `speckit-tasks` | Writing tasks |
| `speckit-analyze` | Analyzing |
| `speckit-implement` | Implementing |
| `speckit-checklist` | Checklisting |
| `speckit-constitution` | Setting constitution |
| `speckit-converge` | Converging |
| `speckit-taskstoissues` | Filing issues |
| `speckit-agent-context-update` | Updating agent context |

Any `speckit-*` skill not listed uses the fallback rule from research.md (prefix stripped, hyphens to spaces, capitalized).

## Relationship to existing `Active skill` data

No change to the shape `getActiveSkills()` returns (an ordered array of skill name strings). The step label is computed at render time from that array's first `speckit-*` entry; it is not stored alongside skill activity data.
