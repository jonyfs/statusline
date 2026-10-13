# Failure contract

In runs mode (`CLAUDE_STATUSLINE_OUTPUT=runs` or `--format runs`) a failure is exit code `75`
and one JSON object on stdout. In the default mode nothing changes: exit `0` and the legacy
fallback lines.

| `error.code` | When | Message |
|---|---|---|
| `node-version` | Node is older than `MIN_NODE_MAJOR` (18). | `statusline needs Node 18 or newer` |
| `bad-payload` | stdin is empty, is not valid JSON, or is JSON whose top level is not an object. | `the status payload is not a JSON object` |
| `internal` | Any other exception while rendering. No stack trace is printed on stdout. | `statusline could not render` |

The set is stable. A code is added only with a `contract` bump. A host that meets an unknown
code treats it as `internal`.

A valid object with missing or unknown fields is not an error: the renderer draws what it can.
An empty status is `{"contract":1,"lines":[]}` with exit `0`.
