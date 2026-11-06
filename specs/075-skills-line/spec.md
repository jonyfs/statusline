---
track: quick
status: done
---

# The skills line: how long, how it ended, in which mode, with what connected

**Feature Branch**: `feat/073-backlog-batch`

**Created**: 2026-11-05

**Input**: Backlog items 43, 44, 45, 46, 48, 49, 51 and 54 of the owner's selection: the running
skill's duration, the last skill's outcome, the session's skill count, the running skill in
emphasis, plan mode, the permission mode, the background tasks, and the MCP servers.

**Track**: `quick`: the transcript scan learns two more things, one small reader for MCP, two
segments, one chip rewritten.

## Why this exists

Line 2 lists the skills used lately and whether the session is working. It does not say which
skill is running now, for how long, how the last one ended, in which permission mode the session
runs, or what is connected. The transcript already holds all of it: a `Skill` tool call and its
result, `permission-mode` entries, and the background starts the activity chip already counts.

## Requirements

- **FR-001**: `scanTail` returns `skillRuns`, newest first: for each `Skill` tool call in the window,
  the skill's name, when it started, when its result arrived (null while it runs) and whether the
  result was an error. It also returns `permissionMode`, the newest `permission-mode` entry's word.
  `getSessionActivity` passes both on.
- **FR-002**: The skills chip draws the running skill in emphasis with how long it has run (`ship
  12m`), and marks the newest finished skill with `✓` or `✗`. With the hook's log, the chip ends
  with `· 7 used` when the session has used more distinct skills than the chip lists.
- **FR-003**: Segment `permissionMode` (line 2 after the activity): `plan`, `auto`, `accept edits`,
  `bypass` or `dontask`; `bypass` in the critical role, `plan` and `auto` in the attention role;
  nothing in the default mode.
- **FR-004**: The activity chip's `· N bg` (background shells and agents still running) is item 51,
  already drawn; README names it.
- **FR-005**: Segment `mcp` (line 2, before the vim mode): `mcp 4`, the MCP servers configured for
  this session: the user's in `~/.claude.json`, the project's in `.mcp.json` minus those disabled
  for the project, and the project-local ones. Absent at zero. Nothing says whether they
  connected; the doctor lists the names.
- **FR-006**: Doctor rows for the new segments; README's line-2 row and count follow.

## Out of scope

The outcome of a skill the hook recorded but the transcript window no longer holds; MCP health.
