---
track: quick
status: done
---

# Every kind of account: the cache, the amounts, the age, the diagnosis

**Feature Branch**: `feat/069-usage-credits` (same pull request as specs/069)

**Created**: 2026-11-05

**Input**: "quais melhorias poderiam ser aplicadas no statusline para funcionar em todos os tipos de
conta claude, assim como codex e copilot" (which improvements would make the bar work with every
kind of Claude account, and with Codex and Copilot). Six were proposed; all six were chosen, with
`amounts` defaulting to `show`.

**Track**: `quick`: one reader widened, one switch, one doctor line, three chip rules.

## Why this exists

specs/063, 068 and 069 taught the bar four kinds of Claude account: a subscriber with the 5-hour
and 7-day windows, a gateway budget with a spend limit, a seat billed by usage with a monthly
credit cap, and an account with no window at all. Each is right on its own. Four gaps remain
between them:

1. A subscriber's bar is silent until the session's first API response, because `rate_limits`
   arrives only then. Claude Code's own `/usage` cache (`~/.claude.json`,
   `cachedUsageUtilization.utilization.five_hour` and `.seven_day`) already holds each window as
   `{ utilization, resets_at }`, the very pair Claude Code turns into `used_percentage` and
   `resets_at` for the payload (read from the 2.1.318 bundle on 2026-11-05).
2. A bar is shared on screens and in screenshots. The `spend` chip carries dollars, the Codex
   chip a credit balance, the Copilot chip a credit count. specs/069 kept money off the credits
   chip; nothing lets a person keep it off the others.
3. A chip drawn from a cache looks the same at five minutes and at twenty hours. Principle III
   wants the age told.
4. When a chip is absent, the doctor says why per segment, but never says which kind of account
   it decided on, or from what evidence. "Why is my chip missing" needs the code.

## Requirements

- **FR-001** (windows from the cache): `readUsageCredits` also returns `windows`:
  `{ fiveHour: { pct, resetsAt } | null, sevenDay: { pct, resetsAt } | null }`, read from
  `utilization.five_hour` and `utilization.seven_day` when each is a block with a finite
  `utilization`; `resetsAt` is `resets_at` when it is a finite number, else null. The same
  account and 24-hour freshness rules as the credits apply. The reader no longer needs
  `extra_usage` to return: a cache with windows and no credits returns `pct: null, enabled: false`
  with its `windows`.
- **FR-002**: Under the Claude harness, when the payload carries no `rate_limits.five_hour` or
  `.seven_day` and the cache does, the `5h` and `7d` readings take the cache's figures with
  `source: "cache"`. The payload's own figure, once it arrives, wins. The sample history (burn
  rate) takes payload figures only. A cache with windows marks the account `subscriber`, noted
  the way a payload sighting is.
- **FR-003** (amounts): `CLAUDE_STATUSLINE_AMOUNTS=hide`, or `"amounts": "hide"` in
  `.statusline.json` (the command line copies the file's value into the variable, as it does for
  `separator`), removes money and balances from the bar in every harness: the `spend` chip draws
  its percentage form only, the `spendPace` chip is not drawn, the Codex `credits` balance is not
  drawn, Copilot's AI credits draw as `AIC 28%` when a percentage exists and not at all otherwise.
  Any other value, or none, is `show`: the bar as it is today.
- **FR-004** (age): A chip whose figure comes from the cache (the credits, and the windows under
  FR-002) is drawn in the neutral colour with no band once the fetch is more than six hours old,
  and carries a quiet ` ·14h` age after twelve hours. At twenty-four hours the reader already
  answers absent.
- **FR-005** (`credits off`): When the account kind is `credits` and the cache says extra usage is
  off (`is_enabled` false or `user_disabled` true), the chip reads `credits off` in the neutral
  colour instead of being absent. The reader returns `disabledReason` (`extra_usage.disabled_reason`
  when a string) and the doctor row names it. A cache with no windows whose `extra_usage` has
  `credits_ever_enabled` true also counts as a usage-based seat for the kind.
- **FR-006** (severity): The reader returns `severity` from `utilization.spend.severity` when it
  is a string. On the credits chip, `"critical"` forces the critical band and `"warning"` at least
  the warn band, whatever the rounded percentage says. `"normal"`, anything else, or none changes
  nothing.
- **FR-007** (doctor): The report gains `account: <kind> · <evidence>` above the segment table,
  for every harness. Claude: `subscriber · 5h/7d in the payload`, `subscriber · 5h/7d from Claude
  Code's /usage cache, 3h old`, `budget · spend_limit in the payload, period monthly`,
  `credits · Claude Code's /usage cache, 3h old, no 5h/7d window`, `none · a response and no
  rate_limits`, `<kind> · remembered from an earlier session`, or `unknown · no response yet`.
  Codex: `codex · plan <plan_type>` when the rollout names one. Copilot: `copilot · quotas via gh`.
  OpenCode: `opencode · no usage windows`.
- **FR-009** (a click on the figure): The `credits` chip in every form (the figure, `credits —`,
  `credits off`) is an OSC 8 link to `https://claude.ai/settings/usage`; Codex's balance links to
  `https://chatgpt.com/codex/settings/usage`; Copilot's AI credits link to
  `https://github.com/settings/billing`. No URL opens Claude Code's `/usage` screen from a
  terminal, so the account's own page is the destination. The gateway's `spend` chip stays
  unlinked, as the payload names no page. specs/020's rule stands: a link never points at
  another project; the account's own page is the reader's, not a repository's.
- **FR-008**: README documents the switch, the cache-fed windows, the age mark and the doctor
  line. The constitution's Principle III amendment (8.10.0) already covers reading the cache as
  written; the windows are percentages and reset instants, nothing estimated.

## Out of scope

Fetching anything from the network; any figure the cache does not carry; money on the doctor
report (a local diagnostic nobody screenshots).
