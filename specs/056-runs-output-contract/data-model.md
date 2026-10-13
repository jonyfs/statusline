# Data model: runs output

## Document

| Field | Type | Notes |
|---|---|---|
| `contract` | integer | `1` for this shape. Rises only when a host could notice a change. |
| `lines` | array of Line | Present in a footer document. |
| `error` | Error | Present in an error document, and then `lines` is absent. |

A document has exactly one of `lines` and `error`.

## Line

An array of Run, in drawing order. A line may be empty. `lines` may be empty (an empty status).

## Run

| Field | Type | Rule |
|---|---|---|
| `text` | string | Non-empty. No control characters and no newline. Never splits a code point. |
| `fg` | string | Optional. `#rrggbb`, lower case. |
| `bg` | string | Optional. `#rrggbb`, lower case. |
| `bold` | boolean | Optional. Present as `true` or absent. |
| `dim` | boolean | Optional. Present as `true` or absent. |
| `underline` | boolean | Optional. Present as `true` or absent. |
| `href` | string | Optional. Scheme `http`, `https` or `file`. |

A run with no style has only `text`. Absent means off, never `false`.

## Error

| Field | Type | Rule |
|---|---|---|
| `code` | string | `node-version`, `bad-payload` or `internal`. |
| `message` | string | One line, no newline, for people. |

## Converter state (inside `ansiToRuns`)

`fg`, `bg`, `bold`, `dim`, `underline`, `href` start unset for every line. A line is
independent: the renderer resets at the end of each, so state does not carry over.

| Sequence | Effect |
|---|---|
| `0` | clear all |
| `1` / `22` | bold on / bold and dim off |
| `2` | dim on |
| `4` / `24` | underline on / off |
| `38;2;r;g;b` / `39` | set / clear fg |
| `48;2;r;g;b` / `49` | set / clear bg |
| `53`, `55` | ignored (overline is not in the contract) |
| `38;5;n`, `48;5;n`, `3x`, `4x`, `9x`, `10x` | not emitted in runs mode, ignored if met |
| OSC 8 with a target | set href, if the scheme is allowed |
| OSC 8 with no target | clear href |
