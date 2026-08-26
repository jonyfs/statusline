# Contract: command line interface

**Feature**: `specs/001-statusline-freshness-audit`

The CLI is what Claude Code and the user both call. Changing it changes an installed
user's `settings.json` behaviour, so each command's promise is written down here.

## `render`

The command written into `settings.json`. Also the default when no subcommand is
given.

**Input**: the session payload as JSON on stdin. An empty stdin, malformed JSON, or a
TTY stdin all mean "render with what is knowable without a payload".

**Output**: the four lines of ANSI text on stdout, followed by a newline, minus the
skills line when no skills are active. Principle II states the four-line structure
and the same escape: a line with nothing to say is dropped rather than shown empty.

**Exit code**: always 0, including when the render throws. An unexpected failure
prints whatever lines could be built, or a single minimal line if none could, and
still exits 0. A statusline that exits non-zero is a statusline the harness may stop
calling, and an error message printed where the bar should be is worse than a short
bar.

**Promises**:

- Completes within 300 ms at the 95th percentile regardless of session age (FR-001).
- Never blocks on a network call. The PR and savings segments read from cache only.
- Never writes to stdout except the lines, and never writes to stderr during a normal
  render.
- Any single failing source removes its own segment and nothing else (FR-015).

**Environment**:

| Variable | Effect |
|---|---|
| `CLAUDE_STATUSLINE_FLAVOR` | `mocha` (default), `frappe`, `macchiato`, `latte` |
| `CLAUDE_STATUSLINE_ASCII=1` | Substitute glyphs for terminals without a Nerd Font |
| `CLAUDE_STATUSLINE_SKILL_WINDOW_MIN` | Minutes a skill stays listed, default 30 |
| `CLAUDE_STATUSLINE_DEBUG=1` | Write the raw payload to `~/.claude/statusline/debug-last-payload.json` |
| `CLAUDE_STATUSLINE_NO_REFRESH=1` | Never spawn a background refresh. For tests and preview generation. |

The first four exist today and keep their current meaning. The fifth is new.

## `doctor`

**Input**: the same payload on stdin when available. Without one, it reports the
payload-derived segments as unavailable and everything else normally.

**Output**: a human-readable table on stdout, one row per segment, plus a total row.
Columns follow the diagnostic report in `data-model.md`. With `--json`, the same data
as a single JSON object instead.

**Exit code**: 0 when the report was produced, whatever it says. 1 only when the
report itself could not be produced.

**Promises**:

- Uses the same gathering path as `render`, so the reading it reports for a segment is
  the reading the renderer would use (FR-016).
- Names every segment on the line, and gives a reason for each absent one (FR-017).
- Reports two things per cached segment, in separate columns: the cached reading
  `render` would use, and the result of a live probe run for the diagnostic's own
  benefit. Collapsing them into one row would describe a path the renderer never
  takes. `doctor` is therefore slower than `render`, and is the one place a network
  call is waited on.
- Re-measuring the redraw budget of FR-001 is `scripts/bench.js`, not this command
  (FR-018).

## `refresh`

Internal. Spawned detached by `render` to update an expensive cache entry.

**Input**: the cache key to refresh as an argument, and the working directory as the
process `cwd`.

**Output**: nothing on stdout or stderr.

**Exit code**: ignored by the caller, which has already exited.

**Promises**:

- Writes at most one cache file, atomically.
- Clears its own lock on exit, including on failure.
- Leaves a previous good value in place when the lookup fails.
- Never spawns anything further.

## `install`

Unchanged in what it writes, with additions.

**Promises kept from today**:

- Backs up `~/.claude/settings.json` before touching it.
- Sets only the `statusLine` key.
- Refuses to run from a package-manager scratch directory.
- Idempotent.

**Added**:

- Registers the optional `PostToolUse` hook described in `hooks.md` by default, and
  reports it on the same summary as the settings path and the backup. `--no-hook`
  skips it. The install stays non-interactive and idempotent either way, as Principle
  IV requires, and the statusline meets its budget with the hook absent (FR-019).
- Any hook it registers is recorded so `uninstall` can remove exactly that entry and
  nothing else (FR-020).

## `uninstall`

**Promises**:

- Removes the `statusLine` key only when it points at this plugin's own CLI path.
- Removes only the hook entry this plugin registered, leaving other hooks untouched.
- Leaves backups in place.
- Reports what it removed, or why it removed nothing.
- Idempotent.

## Compatibility

`render`, `install` and `uninstall` keep their current names and behaviour. An
existing installation keeps working after a `git pull` with no reinstall, which is
what Principle IV promises. `doctor` and `refresh` are additive.
