# Quickstart: Multi-Agent Skills On The Skills Line

## Prerequisites

- Node.js >=18
- `task-rows` wired up (default install behavior; `--no-task-rows` disables it)

## Validate a running subagent appears on the skills line

```bash
echo '{"columns":100,"tasks":[{"id":"t1","name":"explore","description":"Finding the auth code","startTime":'$(date +%s000)'}]}' | node bin/cli.js task-rows
node bin/cli.js   # the main render, in the same terminal session
```

Expected: the skills line includes an entry identifying the running task (e.g. "explore" or its description), consistent with what the subagent's own row shows.

## Validate it disappears once the subagent finishes

```bash
echo '{"columns":100,"tasks":[]}' | node bin/cli.js task-rows
node bin/cli.js
```

Expected: the previously-shown subagent entry is gone.

## Validate no subagent means no change from today

```bash
node bin/cli.js   # with no task-rows tick having run recently, or an empty/stale snapshot
```

Expected: the skills line looks exactly as it does without this feature.

## Validate overflow still counts accurately with both sources combined

```bash
# Simulate several directly-invoked skills plus several running subagents
# exceeding the line's display cap, then:
node bin/cli.js
```

Expected: the shown subset plus "+N" reflects the true combined total (FR-002), not just one source.

## Run the test suite

```bash
node scripts/test-harness.js
```

Expected: `task-rows.test.js` (write side) and the new merge test (read side) both pass.
