# Contract: the arrangement file

**Date**: 2026-09-02

What a person writes, where they write it, and what the bar promises to do
with it. This is a public interface: once released, a file that was valid
stays valid.

## Locations and precedence

Highest first. The first one found wins whole; arrangements do not merge.

| Rank | Location | Notes |
|---|---|---|
| 1 | `CLAUDE_STATUSLINE_LAYOUT=<path>` | An explicit file. Anything, anywhere, including under the home directory |
| 2 | `layout` key in the repository's `.statusline.json` | Found by the walk `config.js` already does, stopping at the filesystem root or the home directory |
| 3 | `~/.claude/statusline/layout.json` | The whole file is the arrangement |
| 4 | The registry in `src/segments.js` | The default. What ships |

`node bin/cli.js doctor` reports which rank was used and the path it came
from.

## Shape

```json
{
  "version": 1,
  "name": "optional label",
  "segments": {
    "<segment key>": { "on": true, "line": 2, "order": 30 }
  }
}
```

Every field is optional except `version`. `{ "version": 1 }` is a valid
arrangement that changes nothing.

## Promises

1. An absent, unreadable or unparseable file means the default. It is never
   an error and never stops the bar from drawing.
2. With no arrangement in force, output is byte-identical to the default.
3. `on: false` removes a segment from the bar entirely, whatever its
   priority.
4. `line` and `order` decide placement. A segment does not move because a
   neighbour disappeared.
5. Width fitting still applies. Content wider than the terminal is dropped by
   priority, and no line wraps.
6. Line shedding still applies, in the order Principle II declares.
7. Nothing else can be set. Priority, colour and a segment's content stay in
   source; an arrangement that names one of them is accepted for its valid
   parts and the diagnostic names what was ignored.
8. An unknown segment key is ignored and named by the diagnostic.
9. An unknown `version` means the file is ignored whole, and the diagnostic
   says which version it found.
10. An arrangement that turns every segment off draws nothing rather than
    falling back to the default, because that is a choice a person can mean.

## Errors, and what the reader sees

| Situation | Bar | Diagnostic |
|---|---|---|
| File missing | Default | `arrangement: default` |
| File unreadable or invalid JSON | Default | Names the path and the reason |
| Unknown `version` | Default | Names the version found |
| Unknown segment key | Every other entry applies | Names the key |
| `line` outside 1..4 | That entry's line ignored, rest applies | Names the key and the value |
| Non-numeric `order` | That entry's order ignored, rest applies | Names the key and the value |

## Stability

`version: 1` is the contract above. A future version may add fields; it may
not change what an existing field means. A file written by the composer page
is always valid against the version it names.
