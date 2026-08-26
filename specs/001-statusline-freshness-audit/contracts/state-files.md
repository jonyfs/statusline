# Contract: files on disk

**Feature**: `specs/001-statusline-freshness-audit`

Everything the statusline persists lives under `~/.claude/statusline/`, outside the
repository, and is disposable. Deleting any of it costs at most one redraw's worth of
animation and one cache miss.

## Layout

```text
~/.claude/statusline/
├── backups/                      # settings.json backups, taken at install (existing)
├── debug-last-payload.json       # only when CLAUDE_STATUSLINE_DEBUG=1 (existing)
├── state/
│   └── <session-id>.json         # animation state (existing)
├── cache/
│   └── <repo-key>.json           # PR, savings and remote URL readings (new)
└── skills/
    └── <session-id>.jsonl        # skill events from the optional hook (new)
```

`<session-id>` is the payload's session identifier with every character outside
`[A-Za-z0-9_-]` replaced by `_`, as the existing state files already do. Without a
session identifier, the literal `default` is used, and the animation and skill files
are shared. That is the current behaviour and is left alone.

`<repo-key>` is a stable hash of the absolute repository root path. A hash rather
than the path itself, because a path is not a safe filename on any platform and
because two checkouts of the same repository are legitimately different caches.

## Cache file

```json
{
  "schema": 1,
  "entries": {
    "pr": { "value": { "number": 12, "state": "OPEN", "isDraft": false, "url": "..." },
            "at": 1756000000000 },
    "rtk": { "value": 63, "at": 1756000000000 },
    "remote": { "value": "https://github.com/owner/repo", "at": 1756000000000 },
    "_locks": { "pr": 1756000000000 }
  }
}
```

Rules:

- Written to `<repo-key>.json.tmp` in the same directory, then renamed over the
  target.
- Missing file, parse failure, or `schema !== 1` is a miss, never a migration.
- `_locks[key]` is when a detached refresh for that key started. A new refresh starts
  only when the recorded time is absent or older than that key's maximum age.
- A refresh that fails leaves the existing entry untouched and clears its lock.
- Readers ignore an entry whose `at` is in the future, which is what a clock jump
  looks like.

## Skill event file

JSON Lines, appended to, one record per line:

```text
{"skill":"humanizer","at":1756000000000}
{"skill":"speckit-plan","at":1756000100000}
```

Rules:

- Append only, with a trailing newline per record, so a reader never sees half a
  record.
- The reader takes the tail of the file, not the whole thing. Records outside the
  activity window are dropped; the rest are deduplicated by name keeping the most
  recent.
- Absent, unreadable, or malformed means fall back to the transcript tail read. The
  rendered line is the same either way, only slower to react.
- A malformed line is skipped, not treated as end of file.

## Sweeping

The existing sweep deletes animation state files untouched for a week, on the first
render of a session. It extends to cover `cache/` and `skills/` under the same rule
and on the same trigger, so the number of files stays bounded without a scheduled
job.

## Failure behaviour

None of these files may break a render. Every read is wrapped so a failure is a miss,
and every write is best effort. This is already Principle X's rule for animation
state and it now applies to all three directories.

## Reproducibility

`CLAUDE_STATUSLINE_NO_REFRESH=1` stops any background refresh from being spawned, and
the preview generator already disables change tracking. Together these keep generated
previews free of anything read from a live machine, which Principle VIII requires.
