# Quickstart: Subagent-Aware Activity Status

## Prerequisites

- Node.js >=18
- Feature 011's task snapshot bridge in place (`task-rows` writes `~/.claude/statusline/tasks/latest.json`)

## Validate "working" shows while a subagent runs, even with a quiet top-level session

```bash
echo '{"columns":100,"tasks":[{"id":"t1","name":"explore"}]}' | node bin/cli.js task-rows
# with a transcript that has not been touched in the last 10+ seconds:
node bin/cli.js
```

Expected: line 2 shows "working," not "idle."

## Validate "working" still shows when both sources are active

```bash
echo '{"columns":100,"tasks":[{"id":"t1","name":"explore"}]}' | node bin/cli.js task-rows
# with a transcript touched just now:
node bin/cli.js
```

Expected: "working," unchanged from today for this case.

## Validate "idle" once both sources are quiet

```bash
echo '{"columns":100,"tasks":[]}' | node bin/cli.js task-rows
# wait past the freshness window, with the top-level transcript also quiet:
node bin/cli.js
```

Expected: "idle."

## Validate no snapshot means no behavior change

```bash
# with no task-rows tick having ever run:
node bin/cli.js
```

Expected: working/idle exactly as it behaves without this feature.

## Run the test suite

```bash
node scripts/test-harness.js
```

Expected: `scripts/tests/activity.test.js` covers the scenarios above.
