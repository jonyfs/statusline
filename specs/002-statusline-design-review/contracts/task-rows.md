# Contract: subagent task rows

**Feature**: `specs/002-statusline-design-review`

Item F2. A second command, declared beside `statusLine`, that overrides how Claude Code
draws the rows for running subagents. Nothing about it touches the statusline's own
redraw path; it runs on its own tick with its own input.

## Input

One JSON object on stdin per tick, carrying the base hook fields, a `columns` field with
the usable row width, and a `tasks` array. Each task has `id`, `name`, `type`, `status`,
`description`, `label`, `startTime`, `model`, `effort`, `contextWindowSize`, `tokenCount`,
`tokenSamples` and `cwd`.

`model` and `contextWindowSize` require Claude Code v2.1.205 or later and are absent for
a task whose model has not resolved yet. A row missing either renders without the context
bar rather than with an empty one.

## Output

One JSON line per row to override: `{"id": "<task id>", "content": "<row body>"}`.

- A task whose `id` is omitted keeps Claude Code's default row.
- An empty `content` hides that row.
- `content` renders as-is, ANSI colours and OSC 8 links included.

## Promises

- Uses the same palette, separators and glyph set as the statusline, so the rows read as
  part of the same bar rather than a second design (this is what F2's chosen form asks
  for).
- Renders a per-task context bar from `tokenCount` against `contextWindowSize`, using the
  same ramp and the same shape rule as the main bar.
- Spells out the tier a task is running at, from `model` and `effort`, and colours the task's
  name with it: red for opus at xhigh or max, peach for opus otherwise, yellow for sonnet at
  high or above, green for sonnet otherwise, teal for haiku. With several subagents in
  flight these rows are the only view of what is RUNNING, as against what a roster on disk
  says was declared. A task whose `model` has not resolved, or whose family is unknown, gets
  no tier rather than a guessed one.
- Respects `columns`. A row never exceeds it, and drops content by the same priority
  discipline the statusline uses.
- Exits 0 whatever happens. A row it cannot render is a row it stays silent about, which
  leaves Claude Code's default in place.
- Writes nothing to stderr, and never blocks: it has the same 300 ms character as a
  redraw, and the same rule against network calls.
