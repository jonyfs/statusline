# Research: Passive mode

## Decision 1: one module owns the root and the permission

`src/paths.js` is the only place that reads `CLAUDE_STATUSLINE_PASSIVE` and
`CLAUDE_STATUSLINE_CACHE_DIR`. A write site calls `canWrite()` and builds its path from
`stateRoot()`. Rejected: a check at each site against the environment, which is how the existing
`NO_REFRESH` check ended up in two files with two spellings.

## Decision 2: no cache directory means no writes in passive mode

The host asked to be certain; "writes only where it was told" with nowhere told is no write. A
render keeps its snapshots in module memory for its own process, which is what every render
already needs. Rejected: falling back to the temporary directory, which is still a write the host
did not choose.

## Decision 3: `CLAUDE_STATUSLINE_CACHE_DIR` works without passive mode

A person with a read-only home, or a host that wants the full behaviour in a directory of its
own, needs the root without the silence. The cost is one `stateRoot()` call per site.

## Decision 4: user configuration is read from where it is

The layout file, `updates.json` and `terminal-background.json` are the person's choices, written
only by `install`, `updates` and `doctor`. A render reads them from the home directory in every
mode and never writes them.

## Decision 5: read-only `git` stays

`getGitInfo` runs `git --no-optional-locks status`, and `getRemoteUrl` runs `git remote get-url
origin` when no remote is cached. A recorder run of a real render saw those two and no other
process. Both are read-only. The other `git` calls (`worktree list`, `rev-parse`) are in the
refresh process, which passive mode never starts.

## Decision 6: the open-tab script is a write

On macOS in iTerm and Apple Terminal `getOpenTabUrl` writes a `.command` file to the temporary
directory on every render. Passive mode returns `null` there and the caller falls back to the
`file://` link, which is what it already does on every other platform.
