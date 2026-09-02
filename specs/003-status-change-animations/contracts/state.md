# Contract: the change state file

`~/.claude/statusline/state/<session>.json`, written by `src/changeTracker.js`
on every render. Disposable: pruned after a week, and a render that cannot read
or write it proceeds without change tracking.

## Shape

```json
{
  "snapshot": { "branch": "main", "pr": "7 open", "skills": "a,b", "model": "Opus 5" },
  "changedAt": { "branch": 1756700000000 },
  "frames":    { "branch": 2 },
  "samples":   [ { "at": 1756700000000, "fiveHourPct": 20 } ]
}
```

## What changes

- `frames` is added: renders elapsed since each highlighted segment changed.
  An entry exists exactly when the matching `changedAt` entry exists.
- `frame` is removed. It was a single counter for the whole bar, advancing per
  render and wrapping at 4, and nothing read it.

## Compatibility

A state file written by an older version has no `frames` and may have `frame`.
Both cases are handled by the same rule the loader already uses: an absent
field is an absent field, so every segment starts at frame 0 on the first
render after an upgrade. A stray `frame` key is ignored and disappears the next
time the file is written.
