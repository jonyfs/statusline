---
track: quick
status: done
---

# Line 3 for a seat billed by usage: what moves the credits, and whose they are

**Feature Branch**: `feat/069-usage-credits` (same pull request as specs/069 and 070)

**Created**: 2026-11-05

**Input**: "use /design para ver as melhorias que podem ser integradas a este modelo de conta do
claude, criando informações úteis para a linha 3 do statusline" (which improvements line 3 could
carry for this account model). Six were proposed and all six chosen; a seventh was added by the
owner: show which account is signed in, and of what kind, since one computer may carry two.

**Track**: `quick`: one history file, two new segments, four chip rules, three opt-in switches.

## Why this exists

A seat billed by usage pays for what it burns. The bar already shows how much of the month's
credits is gone (specs/069). It does not yet show what is burning them: a context past 200k
tokens (long-context pricing), a cold prompt cache (full input price), a heavy model, or this
very session. Nor does it say whose credits they are. The cache Claude Code keeps for `/usage`
has nothing more to offer on this account (`pace` is null, `limits` is empty, the per-model weeks
are null), so what follows comes from the payload and from history the bar keeps itself.

## Requirements

- **FR-001** (`200k+`): When the payload's `exceeds_200k_tokens` is true, the context chip reads
  `72% · 200k+` in the critical band, and the mark survives every width step of the chip.
- **FR-002** (credits rate): A per-machine history of the cached credits figure, one point per
  distinct `fetchedAtMs`, kept 24 hours; a drop of more than one point ends it (the month rolled).
  With two or more points spanning at least thirty minutes and a positive change, the credits chip
  carries `+0.4%/h`. The figure is the exact `utilization`, not the rounded percentage. Measured
  from Claude Code's own fetches, never projected to the cap: the cache names no reset.
- **FR-003** (session delta): The same history remembers the figure at the first redraw of each
  session (`session_id`); the chip carries `+1.2% session` once the difference rounds above zero.
  Sessions older than 48 hours are forgotten.
- **FR-004** (cache hit): A new segment `cacheHit`, drawn wherever the credits chip draws (a seat
  billed by usage, or a plan with extra usage on) when the payload's `prompt_cache.hit_ratio` exists: `cache 82%`, bands inverted (70 and above ok,
  40 to 69 warn, below 40 critical). Line 3, gauges, after the prompt cache state chip.
- **FR-005** (session share, opt-in): `CLAUDE_STATUSLINE_SESSION_SHARE=1` adds `session 0.4%` to
  the credits chip: `cost.total_cost_usd` over the cap the cache reports, as a percentage. The cost
  is Claude Code's client-side estimate at list price, so this is the one estimated figure on the
  bar, off by default and named as such. The cap in money never leaves the reader: it answers
  `shareOfCap(usd)` and nothing else.
- **FR-006** (model tier, opt-in): `CLAUDE_STATUSLINE_MODEL_TIER=1` appends `+++`, `++` or `+` to
  the model chip from the model's name (Opus and Fable, Sonnet, Haiku). A table in the plugin, not
  a payload fact; its first width variant is the bare name.
- **FR-007** (account): A new segment `account`, line 3 before the model: the signed-in Claude
  account in one word, `personal` (a Pro or Max seat, or the address's own organisation) or
  `business`, and the account kind, `business · credits` (changed in PR #85; the organisation's
  name was too long for line 3). `CLAUDE_STATUSLINE_ACCOUNT` is `org` (default, the word),
  `email` (the address instead) or `off`. Read from
  `oauthAccount` in `~/.claude.json`, never the token. Under Codex it names the plan the rollout
  reports, `codex pro`; Copilot and OpenCode draw nothing, as nothing is read there.
- **FR-009** (when the cap comes back): The credits chip ends with the reset, as a day and a time in
  the computer's own zone (`nov 20 14:30`; `tmrw 00:00` and `14:30` when near). The cache's own
  `resets_at` is used when an active entry of `limits` whose kind or group names the extra usage,
  credits, spend or overage carries one. Otherwise the first day of the next calendar month at local
  midnight is drawn with a tilde, `~dec 1 00:00`: an estimate, on by default at the owner's
  decision of 2026-11-05, off with `CLAUDE_STATUSLINE_CREDITS_RESET=off`. Width sheds the motion
  before the reset and the reset before the track. Neither Claude Code's schema nor Anthropic's
  public documentation names the cap's period; the tilde says so.
- **FR-008**: Doctor rows for `account` and `cacheHit`; README and the constitution (III, 8.11.0:
  the measured rate and delta of Claude Code's figure, the opt-in estimated share, the identity
  fields) follow.

## Out of scope

A reset or a projection for the credits (the cache names none); any amount in money; reading
Codex's or Copilot's identity files.
