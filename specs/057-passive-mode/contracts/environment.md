# Environment contract

| Variable | Value | Effect |
|---|---|---|
| `CLAUDE_STATUSLINE_PASSIVE` | `1` | A render starts no child process but read-only `git` (`status --no-optional-locks`, `remote get-url`), never starts the update check, and writes no file outside `CLAUDE_STATUSLINE_CACHE_DIR` (none at all when that is unset). Implies `CLAUDE_STATUSLINE_NO_REFRESH=1`. |
| `CLAUDE_STATUSLINE_CACHE_DIR` | absolute path | The root of the cache, the session state, the task snapshots, the skill events and the Copilot event cache. A relative path is ignored. |

User configuration (`layout.json`, `updates.json`, `terminal-background.json`) is read from
`~/.claude/statusline` in every mode and is never written by a render.

Not affected: `CLAUDE_STATUSLINE_OUTPUT`, `COLUMNS`, `LINES` and the flavor, ramp and ASCII
variables.
