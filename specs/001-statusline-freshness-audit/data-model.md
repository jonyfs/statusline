# Phase 1 Data Model: Statusline Line-by-Line Audit and Freshness Guarantees

**Feature**: `specs/001-statusline-freshness-audit`
**Date**: 2026-08-25

Nothing here is a database. These are the shapes that pass between the gathering
step, the cache files on disk, and the renderer.

## Reading

A single value the statusline might show, together with everything needed to decide
whether it may be shown.

| Field | Type | Meaning |
|---|---|---|
| `value` | any, or `null` | What was read. `null` means the source had no answer. |
| `at` | number | Unix milliseconds when the value was gathered. |
| `source` | string | `payload`, `git`, `gh`, `transcript`, `hook`, `rtk`. |
| `fresh` | boolean | Gathered during this redraw, rather than read from cache. |
| `tookMs` | number | How long the source took. Zero for a cache read. |
| `error` | string, or `null` | Why the source had no answer, for the diagnostic. |

Rules:

- A reading with `value === null` renders nothing. It is not zero and not a
  placeholder.
- A reading whose age (`now - at`) exceeds its segment's maximum age renders nothing,
  whatever `value` holds.
- The payload-derived segments are the one exception. `context`, `fiveHour` and
  `sevenDay` keep their slot and render `?%` when the payload carried no figure, and
  the two reset segments keep theirs and render their unknown text. This is Principle
  III and FR-010, and it is why a missing context figure looks different from a
  missing pull request.
- `error` is for the diagnostic only. It never reaches the rendered line.

## Segment

The rendering rule for one coloured block. Static configuration, not data read at
runtime.

| Field | Type | Meaning |
|---|---|---|
| `key` | string | `dir`, `branch`, `worktree`, `upstream`, `pr`, `skills`, `model`, `effort`, `outputStyle`, `context`, `fiveHour`, `fiveHourReset`, `sevenDay`, `sevenDayReset`, `rtk`. Fifteen keys. |
| `line` | 1..4 | Which line it belongs to. |
| `maxAgeMs` | number | From FR-004. |
| `animated` | boolean | Whether change tracking may animate its icon. Principle X fixes this list. |

Maximum ages, per FR-004:

| Segment keys | Maximum age | Why |
|---|---|---|
| `context`, `fiveHour`, `fiveHourReset`, `sevenDay`, `sevenDayReset` | this redraw only | They come from the payload the harness just sent. Anything older is a different session state. |
| `skills`, `model`, `effort`, `outputStyle`, `dir` | 1 redraw (6 s) | Cheap enough to gather every time. |
| `branch`, `worktree`, `upstream` | 5 s | Normally gathered fresh in about 30 ms. A repository large enough to exceed the git budget falls back to the cached snapshot instead of stalling the redraw (research.md, Decision 8). |
| `pr`, `rtk` | 60 s | Expensive, and they change rarely. |
| `remote` (feeds the branch and directory links, never rendered on its own) | 24 h | A repository's origin effectively never changes, and a wrong link is visible the moment it is clicked. |

`effort` and `outputStyle` are separate keys on purpose (FR-021). `effort` renders
only when the payload carries a real effort level, behind the lightning icon.
`outputStyle` renders only when a non-default output style is set, behind its own
icon. Neither ever stands in for the other, which is what the current single slot
does.

## Source budgets

FR-003 requires every source to declare a time budget, and the sources a redraw waits
on to fit inside the 300 ms of FR-001. These are the declared budgets. The measured
costs behind them are in [research.md](./research.md).

| Source | On the redraw path | Budget | Measured today |
|---|---|---|---|
| `payload` | yes | none, it arrives on stdin | negligible |
| `git` (one `status --porcelain=v2 --branch -z`) | yes | 150 ms, then the cached snapshot; skipped entirely while the last measured cost exceeds the budget | 31.7 ms in an ordinary repository, 812 ms in one with 5,000 modified files |
| `git` refresh (detached, after a budget miss) | no | 10 s | as above |
| `transcript` (bounded tail read) | yes | 100 ms, and a 4 MB byte cap, whichever binds first | 17 ms for 2 MB |
| `hook` (skill event file) | yes | 20 ms | single-digit |
| `cache` (read of a local JSON file) | yes | 20 ms | negligible |
| `gh` (pull request) | no, refresh only | 5 s | 540 ms warm |
| `rtk` (savings) | no, refresh only | 5 s | 20 ms |

The four budgets on the redraw path sum to 290 ms, which is the worst case where
every one of them times out at once. The expected case is an order of magnitude
below that. The two off-path budgets are deliberately generous: a detached refresh
has nobody waiting on it, and a lookup killed at 500 ms would simply never populate
the cache on a slow network.

A source that exceeds its budget is a cache miss, not an error. Its segment falls
back to the last known value if one is inside its maximum age, and disappears
otherwise.

## Width trim order

FR-014 caps a rendered line at 120 characters. When a line would exceed it, content
is dropped in this order, and the first step that brings the line inside the cap
stops the process:

1. The 7-day segment's named moment (`· Thu 15:00`), which the countdown beside it
   already conveys.
2. The reset countdown text on the 5-hour segment, keeping its clock face.
3. The reset countdown text on the 7-day segment, keeping its clock face.
4. The savings segment, which is the only segment on line 4 that is not about this
   session.
5. The directory label, truncated from the left with a leading ellipsis, since the
   end of a path identifies it better than the start.

Line 1's git counters and line 2's skill chips are not on this list. Counters are
already omitted when zero, and skills already truncate by count under FR-013, so
both shrink on their own before the guard is reached.

## Cache entry

What a cache file holds, one file per repository for git-derived values and one per
session for skills.

| Field | Type | Meaning |
|---|---|---|
| `value` | any | The last successful reading's value. |
| `at` | number | When it was gathered. |
| `refreshStartedAt` | number, or absent | When a detached refresh began. Acts as the lock. |

The `gitCost` entry holds one number: what the last git call cost in this
repository. It is what decides whether the next redraw asks git directly or reads the
snapshot, and it is refreshed by the detached process, so the decision corrects itself
as a repository grows or shrinks.
| `schema` | number | Cache format version. A mismatch is a miss, never a migration. |

Rules:

- Written to a temporary file in the same directory, then renamed over the target.
- A parse failure, a missing file, or an unexpected `schema` is a cache miss.
- A refresh starts only when `now - at` is past half the maximum age and no refresh
  started within the maximum age.
- A failed refresh leaves the previous entry alone. It does not write `null` over a
  good value.

## Skill event log

Per-session, appended to by the optional hook, read by the skills segment.

One record per line, newest last:

| Field | Type | Meaning |
|---|---|---|
| `skill` | string | Skill name as invoked. |
| `at` | number | Unix milliseconds. |

Rules:

- Append only, one line per record, so a concurrent read never sees a partial record.
- The reader takes the last N lines, drops anything outside the activity window,
  deduplicates by name keeping the most recent, and orders by recency.
- The file is advisory. Absent or unreadable means fall back to the transcript tail
  read, and the line is identical either way.
- Swept on the same schedule as animation state, and keyed by the same session
  identifier.

## Transcript scan result

What the bounded tail read returns.

| Field | Type | Meaning |
|---|---|---|
| `skills` | string[] | Names, most recent first, already deduplicated and windowed. |
| `truncated` | boolean | Whether the byte cap was hit before the window was exhausted. |
| `bytesRead` | number | For the diagnostic and for the budget test. |

`truncated` matters because it separates "no skills were used recently" from "the
scan gave up", which the diagnostic must be able to tell apart (FR-017).

## Git snapshot

Parsed from one `git --no-optional-locks status --porcelain=v2 --branch -z`.

| Field | Type | Meaning |
|---|---|---|
| `head` | string | Branch name, or the literal `(detached)`. |
| `oid` | string | Commit the head points at. |
| `upstream` | string, or `null` | Upstream ref name. `null` when there is none. |
| `ahead` | number, or `null` | `null` when there is no upstream, which is not the same as 0. |
| `behind` | number, or `null` | Same rule. |
| `changed` | number | Tracked files with modifications. |
| `untracked` | number | Files git is not tracking. |

Rules:

- `upstream === null` means the ahead and behind segments render nothing at all. This
  is FR-012, and the current code cannot express it.
- `head === "(detached)"` renders the short `oid` with a marker that says it is a
  detached head, not a branch icon and a bare SHA.
- The remote URL is a separate reading with its own cache, since it is a separate git
  call and effectively never changes.

## Session state

The existing per-session animation record, unchanged in shape. Listed here because
the sweep that prunes it also prunes the new per-session files, and because the
diagnostic reports which frame the current render is on.

| Field | Type | Meaning |
|---|---|---|
| `snapshot` | object | Tracked values from the previous render. |
| `changedAt` | object | Key to the time it last changed. |
| `frame` | number | Animation frame counter. |

## Diagnostic report

What `doctor` prints, per FR-016 and FR-017. One row per segment key, in the order
the segments render.

| Field | Type | Meaning |
|---|---|---|
| `key` | string | Segment key. |
| `rendered` | boolean | Whether it would appear on the line right now. |
| `value` | string | Rendered text, or a dash. |
| `source` | string | From the reading. |
| `ageMs` | number | `now - at`. |
| `fresh` | boolean | This redraw, or cache. |
| `tookMs` | number | Source cost. |
| `reason` | string, or absent | Why it is not rendered: no repository, source failed, value too old, nothing to show. |

A total row carries the whole redraw's elapsed time, which is the number FR-001 and
SC-001 are measured against.
