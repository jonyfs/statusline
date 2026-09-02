# Data Model: Research It, Then Let the Owner Build the Bar

**Date**: 2026-09-02

Nothing here is stored in a database. These are the shapes that move between
the registry, the arrangement file, the page and the renderer.

## Registry row

Unchanged, in `src/segments.js`. One row per thing the bar can draw.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Unique. What an arrangement names |
| `line` | 1..4 | Default line |
| `order` | number | Default position within the line |
| `align` | `left` \| `right` | Default edge. Arrangeable |
| `priority` | number | Not arrangeable. Decides what survives a narrow terminal |
| `colour` | `identity` \| `ramp` \| `change` | Not arrangeable. One meaning per channel |
| `source` | string | Where the value comes from |

## Arrangement

The file. Every field optional; an absent file and an empty arrangement are
the same thing.

```json
{
  "version": 1,
  "name": "lean",
  "segments": {
    "rtk": { "on": false },
    "burnRate": { "line": 4, "order": 15 },
    "skills": { "line": 1, "order": 70 },
    "resetMerged": { "align": "right" }
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `version` | integer | `1`. An unknown version is ignored whole, and the diagnostic says so |
| `name` | string | Free text, shown by the diagnostic. Not used for resolution |
| `segments` | object | Keys are registry keys. An unknown key is ignored, and the diagnostic names it |

### Entry

| Field | Type | Rules |
|---|---|---|
| `on` | boolean | Default `true`. `false` removes the segment from every line |
| `line` | 1..4 | Default: the registry's line. Out of range means the entry's line is ignored |
| `order` | number | Default: the registry's order. Ties break on the registry order, then on the key, so resolution is deterministic |
| `align` | `left` \| `right` | Default: the registry's alignment. Anything else is ignored and reported |

Anything else in an entry is ignored rather than rejected, matching how
`repoConfig` already treats unknown keys.

## Resolved placement

What the renderer works with. Produced by `resolveArrangement(registry,
arrangement)`, a pure function.

| Field | Source |
|---|---|
| `key`, `priority`, `colour`, `source` | Registry, always |
| `line`, `order`, `align` | Arrangement entry when valid, registry otherwise |
| `on` | Arrangement entry when present, `true` otherwise |
| `origin` | `default`, `repo`, `user` or `env`. For the diagnostic |

Rules the resolver holds:

- An arrangement never invents a segment. Keys not in the registry are
  dropped and reported.
- An arrangement never changes priority or colour.
- Every off segment is absent from every line, including a segment the
  registry marks essential.
- With no arrangement, resolution returns the registry rows unchanged, which
  is what makes byte-identical default output testable.

## Built segment

What `renderReadings` produces per key before rows are assembled, and what
the page is handed at generation time.

| Field | Type | Notes |
|---|---|---|
| `key` | string | Matches a registry key, or `key:n` for the skill chips |
| `text` | string | Already padded with its leading and trailing space |
| `color` | palette token | Resolved by `theme.js`, never a raw hex |
| `url` | string or absent | For the segments that hyperlink |

The pool is the list of these for one session. It is the only thing about a
session the page contains, and it is fixed at generation time so the page
never probes anything.

## Preset

A named arrangement shipped with the page.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `today`, `peripheral`, `rightMargin`, `operational`, `lean`, `oneLine` |
| `label` | string | Shown on the page |
| `optimisesFor` | string | One sentence |
| `givesUp` | string | One sentence |
| `forWhom` | string | One sentence |
| `conflicts` | array | Principles it breaks, empty for most. `oneLine` names Principle II |
| `arrangement` | Arrangement | The same shape the file uses, so a preset is loadable and editable |

## Composer state

Held in the browser only.

| Field | Type | Notes |
|---|---|---|
| `arrangement` | Arrangement | What is on the canvas |
| `basePreset` | preset id | What it started from, for the record |
| `width` | integer | The width switch, one of the offered values |
| `glyphs` | `nerd` \| `plain` | The glyph switch |

Persisted to local storage on every change, restored on load. Nothing else
about the page is state.

## Decision record

`decisions.md` in this feature directory, written when the owner settles.
Mirrors what feature 003 wrote.

| Field | Notes |
|---|---|
| Chosen arrangement | The JSON, verbatim |
| Base preset | Which one it started from |
| Rejected presets | One row each, with the reason |
| Outcome | Adopted as default, kept personal, or nothing changed |

## Finding

`research.md` sections and, for anything discovered later, appended rows.

| Field | Notes |
|---|---|
| Area | efficiency, reliability or informativeness |
| Claim | What was found |
| Evidence | The command or the failure that shows it |
| Disposition | Adopted, with the change, or declined, with the reason |
