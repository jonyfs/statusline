# Quickstart: validating the spend-limit chip and the at-limit form

Prerequisites: Node 18 or newer, run from the repository root.

## 1. Tests

```sh
npm test
```

Expected: every test passes, including the new `spend-limit.test.js`.

## 2. An exhausted window with no spend limit (Story 2)

```sh
echo '{"rate_limits":{"five_hour":{"used_percentage":100,"resets_at":'$(( $(date +%s) + 7200 ))'}}}' \
  | COLUMNS=160 NO_COLOR=1 CLAUDE_STATUSLINE_ASCII=1 node bin/cli.js render | tail -1
```

Expected: the 5-hour chip reads `5h 100%▴ full · 2h00m` (or `1h59m`), and there is no spend chip.

## 3. A spend limit in the payload (Story 1)

```sh
echo '{"rate_limits":{"five_hour":{"used_percentage":100,"resets_at":'$(( $(date +%s) + 7200 ))'},"spend_limit":{"used_percentage":115,"resets_at":'$(( $(date +%s) + 20*86400 ))'}}}' \
  | COLUMNS=160 NO_COLOR=1 CLAUDE_STATUSLINE_ASCII=1 node bin/cli.js render | tail -1
```

Expected: a `$ spend 115%▴ · DD/MM HH:MM` chip after the 7-day chip.

## 4. The diagnostic (Story 3)

Run `node bin/cli.js doctor` in a live session. Expected: a `spendLimit` row that is either
`on` with its figure, or `off` with the gateway explanation. See
[contracts/output.md](contracts/output.md).

## 5. On a real account

When the admin raises the limit, copy `~/.claude/statusline/debug-last-payload.json` and check
for `rate_limits.spend_limit`. If it is there, the chip appears on the next redraw. If it is
not, the setup is not a gateway setup, and Story 2 is what the bar can offer.
