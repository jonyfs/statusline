# Data model: git gate rows

## Worktree

| Field | Source | Notes |
|---|---|---|
| `path` | `worktree` line of `git worktree list --porcelain` | absolute |
| `gitDir` | `.git` directory, or the `gitdir:` line of the `.git` file | per worktree |
| `branch` | `branch refs/heads/<name>` | null when detached |
| `head` | `HEAD <sha>` | first 7 characters shown when detached |
| `prunable` | `prunable` line | skipped when present |

## GateRun (the cached value, one per running gate)

| Field | Meaning |
|---|---|
| `pid` | the hook process, or the lock holder for a lock-only run |
| `hook` | `pre-commit`, `pre-push`, …, or `gates.sh` for a lock-only run |
| `worktree` | the worktree's directory name |
| `path` | the worktree's path, to mark the session's own |
| `branch` | branch name, or the short commit |
| `step` | R7's label, or null |
| `startedAt` | milliseconds since the epoch, from `etime` or the lock's mtime |
| `state` | `running` or `waiting` |

Validation: every text field passes `plainText` (control characters removed) before it is
stored, and again before it is drawn.

State transitions: a run is `waiting` while another live pid holds its worktree's lock and is not
in its process tree, and `running` otherwise. A run disappears when its pid is no longer alive
(checked on every redraw) or when the next refresh does not find it.

## Cache entry

`~/.claude/statusline/cache/<repoKey(cwd)>.json`, entry `gates`:
`{ value: { runs: GateRun[] }, at }`. Written by the detached refresh only.
