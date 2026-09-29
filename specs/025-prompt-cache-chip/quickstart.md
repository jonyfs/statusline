# Quickstart: validating the prompt-cache chip

Prerequisites: Node 18 or newer, run from the repository root.

## 1. Tests

```sh
npm test
```

Expected: every test passes, including `scripts/tests/prompt-cache.test.js`.

## 2. A warm cache about to expire

```sh
echo '{"prompt_cache":{"warm":true,"caching_observed":true,"ttl":"5m","expires_at":'$(( $(date +%s) + 100 ))'}}' \
  | COLUMNS=160 NO_COLOR=1 CLAUDE_STATUSLINE_ASCII=1 node bin/cli.js render | tail -1
```

Expected: `↻ cache warm · 1m`. With `+ 250` instead of `+ 100`, no cache chip.

## 3. A cold cache

```sh
echo '{"prompt_cache":{"warm":false,"caching_observed":true,"ttl":"5m","expires_at":null,"recache_tokens_if_cold":184000,"last_miss_cause":{"causes":["tools_changed"]}}}' \
  | COLUMNS=160 NO_COLOR=1 CLAUDE_STATUSLINE_ASCII=1 node bin/cli.js render | tail -1
```

Expected: `❄ cache cold · 184k · tools changed`.

## 4. The diagnostic

Pipe either payload into `node bin/cli.js doctor` and check the `promptCache` row against
[contracts/output.md](contracts/output.md).

## 5. On a real session

Start Claude Code with `CLAUDE_STATUSLINE_DEBUG=1` in its environment. Each redraw then writes
the payload to `~/.claude/statusline/debug-last-payload.json`, and the `prompt_cache` block
appears after the first response.
