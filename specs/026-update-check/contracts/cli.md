# CLI contract: update check

## `statusline-plugin updates [auto|notify|off]`

With no argument, prints the current behaviour and where it comes from:

```
Updates: auto (default). Change with: node ".../bin/cli.js" updates notify
```

With an argument, writes `~/.claude/statusline/updates.json` and prints the new behaviour. An
unknown argument exits 1 and lists the three values. When `CLAUDE_STATUSLINE_UPDATES` is set,
the output says it overrides the file.

## `statusline-plugin check-updates`

Fetches, prints what is pending, changes nothing, exit 0:

```
2 fixes and 1 feature waiting (a1b2c3d to e4f5a6b):
  feat: the bar says when the prompt cache goes cold
  fix: the suite runs in a throwaway HOME
  fix: sample history wiring
Run: node ".../bin/cli.js" update
```

Or `Up to date (e4f5a6b).`, or `Nothing you run has changed: 2 docs/chore commits waiting.`
A fetch failure exits 1 with git's reason.

## `install` and `update`

Both print one more line:

```
  Updates:       auto (change with: node ".../bin/cli.js" updates notify)
```

## `doctor`

A line under the install line:

```
updates: auto, checked 3h ago: up to date
updates: notify, checked 20h ago: 1 feature, 2 fixes ready
updates: auto, checked 2h ago: blocked by local edits
updates: auto, never checked
```

## Bar

See [data-model.md](../data-model.md), "Outcome and chip".
