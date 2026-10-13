---
track: full
status: done
---

# Feature Specification: Runs output and failure contract for a host

**Feature Branch**: `feat/056-runs-output-contract`

**Created**: 2026-10-13

**Status**: Done

**Input**: A host (Astrolabe) runs this renderer as a child process and draws its output in its
own pane. Today it reads the ANSI text and rebuilds the styled runs, and it tells a failure
from a render by comparing the output with two fixed lines. This feature adds a data output
mode and a failure contract, and nothing else.

**Track**: `full`. It adds a second output format, a documented error contract and an exit
code, and it has to keep the default output byte for byte.

**Scope**: two requirements only (FR-001 and FR-003). Passive mode, an omit list, a
resolved-configuration command and a render-only build are separate specs.

## What already works (no change needed)

- Reads the Claude Code status payload as JSON on stdin and prints lines on stdout.
- Takes the width from `COLUMNS` and the row budget from `LINES`.
- Honors `CLAUDE_STATUSLINE_UPDATES`, `CLAUDE_STATUSLINE_NO_REFRESH`,
  `CLAUDE_STATUSLINE_DEBUG`, `CLAUDE_STATUSLINE_FLAVOR`, `CLAUDE_STATUSLINE_ASCII` and
  `CLAUDE_STATUSLINE_RAMP`.
- In the default mode, exits 0 and prints `statusline unavailable` or `statusline needs Node`
  when it cannot render.

## Problems for a host

1. The host reverse-parses SGR and OSC 8 escapes to get the styles back. A change in how the
   renderer paints can break the host without any test failing on this side.
2. A failure is a line of text with exit 0. The host compares strings to detect it, so a new
   fallback line is read as a footer.

## User scenarios & testing

### User Story 1 - The footer as data (Priority: P1)

A host asks for the footer as data and receives, per line, a list of runs with text and style.
It needs no escape parser.

**Independent Test**: Render a fixture payload with `CLAUDE_STATUSLINE_OUTPUT=runs` and parse
the single JSON object.

**Acceptance Scenarios**:

1. **Given** a payload, **When** the renderer runs with `CLAUDE_STATUSLINE_OUTPUT=runs`,
   **Then** stdout is one JSON object with `contract` 1 and `lines`, and nothing else.
2. **Given** the same payload at 80, 100, 144 and 200 columns, **When** the runs of each line
   are joined, **Then** they equal the plain text of the ANSI output.

### User Story 2 - Failure as an exit code and an object (Priority: P1)

A host starts the renderer and knows from the exit code and one JSON object whether it got a
footer or an error, and which error.

**Independent Test**: Force each documented error and check the exit code and the object.

**Acceptance Scenarios**:

1. **Given** runs mode and input that is not a JSON object, **When** the renderer runs,
   **Then** it exits 75 and prints `{"contract":1,"error":{"code":"bad-payload",...}}`.
2. **Given** runs mode and an unexpected exception, **When** the renderer runs, **Then** it
   exits 75 with code `internal` and prints no stack trace on stdout.

### User Story 3 - Nobody else sees a change (Priority: P1)

A person who runs the renderer in the status line of Claude Code sees no change.

**Independent Test**: Compare the ANSI output of every fixture with the previous release.

**Acceptance Scenarios**:

1. **Given** neither the variable nor the flag, **When** the renderer runs, **Then** the
   output is the ANSI text, byte for byte as before, and failures still exit 0 with the legacy
   fallback lines.

## Requirements

### FR-001 Runs output

`CLAUDE_STATUSLINE_OUTPUT=runs` (or the flag `--format runs`) MUST make the renderer print one
JSON object and nothing else on stdout:

```json
{
  "contract": 1,
  "lines": [
    [
      { "text": " ~/src/app ", "fg": "#cdd6f4", "bg": "#313244", "bold": true },
      { "text": "main", "fg": "#a6e3a1", "href": "https://github.com/o/r/tree/main" }
    ]
  ]
}
```

- Each line is an array of runs in drawing order.
- A run has `text` (a non-empty string, no control characters, no newline) and these optional
  fields: `fg` and `bg` as `#rrggbb`; `bold`, `dim` and `underline` as `true` (absent means
  off); `href`.
- `href` MUST be an `http`, `https` or `file` URL. Any other target is left out and the text
  stays.
- The runs MUST join to the same plain text as the ANSI output for the same input, column for
  column.
- The color of a run is its resolved truecolor value for the active flavor and ramp. With
  `CLAUDE_STATUSLINE_ASCII=1` the glyph set is ASCII, as in the ANSI mode.
- `contract` is an integer. It is `1` for this shape and rises only when a host could notice a
  change in the shape.
- Without the variable or the flag the output is the ANSI text, byte for byte as before.

### FR-003 Failure contract

When the renderer cannot produce lines, in runs mode it MUST exit with code `75` and print one
JSON object on stdout:

```json
{ "contract": 1, "error": { "code": "node-version", "message": "statusline needs Node 20 or newer" } }
```

- `code` is one of a documented, stable set: `node-version`, `bad-payload`, `internal`.
  `message` is one line meant for people.
- An unexpected exception MUST end in `internal` and exit `75`; the renderer MUST NOT print a
  stack trace on stdout.
- Input that is not valid JSON, or has no object at the top level, is `bad-payload`. A valid
  object with missing or unknown fields is not an error: the renderer draws what it can.
- In the default (ANSI) mode nothing changes: exit 0 and the legacy fallback lines. They are
  removed only in a major version, with a note in `CHANGELOG.md`.
- The renderer MUST print an error object even when it cannot load most of its modules: the
  check for the Node version and the runs-mode switch run first.

## Edge cases

- Empty status: `{ "contract": 1, "lines": [] }` and exit 0, never an error.
- A run whose text is only spaces keeps its `bg`; a run with no style has only `text`.
- A wide character (East Asian wide or emoji) is never split inside a code point.
- Two adjacent runs with the same style MAY be merged; a host MUST NOT rely on either.
- OSC 8 links that carry an `id` in ANSI mode carry only `href` in runs mode.

## Success criteria

- **SC-001**: For each fixture payload, at 80, 100, 144 and 200 columns, the runs joined line
  by line equal the plain text of the ANSI output.
- **SC-002**: Replaying the runs as SGR and OSC 8 escapes gives the same picture as the ANSI
  output on the fixtures (colors, bold, dim, underline, links).
- **SC-003**: Forcing each documented error gives exit `75`, a valid object and no stack
  trace.
- **SC-004**: The ANSI output of every fixture is identical to the output of the previous
  release.
- **SC-005**: Rendering in runs mode takes no more than 10% longer than ANSI mode on the same
  payload.

## Assumptions

- The host sets `COLUMNS`, `LINES` and the other existing variables itself, as it does today.
- Truecolor is the only color model in runs mode; the host maps it to its own palette if it
  must.
- `75` is free in this renderer; any other free code works if the host is told.
- The repository has no `CHANGELOG.md` today. This feature removes no legacy line, so it adds
  none; the file is created in the release that removes them.
- The check for the Node version lives in `bin/cli.js`, which already runs before the
  renderer's modules load. The runs-mode switch is read there too.

## Out of scope

- Passive mode, the omit list, a resolved-configuration command, the render-only build and
  shared fixtures.
- Changes to what is drawn or to layout.
- Any host-side code; the host changes in its own spec once this ships.

## Host side (for the host's own spec)

When this ships, the host reads `contract` and the runs, drops its ANSI parser for the
vendored copy that supports it, and replaces the fallback-line comparison with the exit code
and `error.code`. Until a copy with `contract >= 1` is vendored, it keeps the ANSI path.
