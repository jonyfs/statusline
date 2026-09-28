# Research: The bar keeps counting after the limit is lifted

## R1. Does the payload carry the granted allowance?

**Decision**: Read `rate_limits.spend_limit` and nothing else.

**Rationale**: Claude Code 2.1.283 builds the payload's `rate_limits` from three sources. The
bundled code reads:

```js
...ze.five_hour&&{five_hour:{used_percentage:rmt(ze.five_hour.utilization),resets_at:ze.five_hour.resets_at}},
...ze.seven_day&&{seven_day:{used_percentage:rmt(ze.seven_day.utilization),resets_at:ze.seven_day.resets_at}},
...Ie()==="gateway"&&ze.overage&&{spend_limit:{used_percentage:rmt(ze.overage.utilization),resets_at:ze.overage.resets_at}}
```

The bundled schema text describes `spend_limit` as "Optional: behind a Claude gateway, your
fullest spend limit (present only while the gateway reports it and its resets_at has not
passed)", with `used_percentage` "0-100, above 100 once exceeded". The public page at
https://code.claude.com/docs/en/statusline says the same.

The binary also holds internal state for usage credits, per-model weekly windows
(`seven_day_opus`, `seven_day_sonnet`) and overage status, but none of it reaches the
statusline payload. Principle III restricts the bar to the payload, so those are out of reach.

**Alternatives considered**: Calling the usage API from the statusline to get a credit balance.
Rejected: it needs credentials the statusline does not have, it is undocumented, and it would
be a network call on a 300 ms redraw path.

## R2. What "frozen" is

**Decision**: Treat it as a display problem, not a redraw problem.

**Rationale**: Claude Code redraws on each assistant message, on the 60-second
`refreshInterval` the installer sets, and when a reported `resets_at` passes. At the limit the
payload keeps sending `five_hour.used_percentage: 100`, so every redraw prints the same chip.
The bar is running and has nothing new to say. The fix is to say "full" plainly and to show the
spend limit when there is one.

**Alternatives considered**: A heuristic that notices messages still arriving at 100% and
labels them "extra usage". Rejected: it infers an account state the payload does not report,
and Principle III forbids presenting inference as account data.

## R3. Spend-limit reset formatting

**Decision**: Reuse the 7-day chip's rule: `shortCountdown` inside a day, `resetMomentLabel`
beyond it (which already names the weekday within six days and the date after that).
`formatResetCountdown` gains an optional bound so the spend limit can accept 32 days while the
windows keep 30.

**Rationale**: A spend period can be monthly, and a 31-day month would trip the 30-day
plausibility guard and render `?`. The guard exists to catch millisecond timestamps, which
land about 20 million days out, so 32 days catches them just as well.

**Alternatives considered**: Raising the shared bound to 32 days. Rejected: the 5-hour and
7-day windows have no reason to accept a reset a month out, and a tighter bound catches more
bad data for them.

## R4. Icon

**Decision**: `U+F0584` nf-md-wallet for the Nerd set, `$` for the plain set.

**Rationale**: Rendered from the installed FiraCode Nerd Font Mono. The evidence sheet is
`specs/023-extra-usage-limit/glyph-evidence.png`. F0584 draws a wallet. F0114 (nf-md-cash) draws
a banknote, which reads as currency rather than as a budget being spent. The same sheet adds
one more entry to the list of wrong names: F00F6, which a candidate list called "md-cart",
draws a calendar. `$` is ASCII, East Asian Narrow, present in every font, and not used
elsewhere on the bar.

**Alternatives considered**: Reusing the timer or calendar glyph. Rejected: Principle X
requires one glyph to mean one thing.

## R5. The at-limit word

**Decision**: `full`, placed after the band mark and before the reset:
`5h 100%▴ full · 2h09m`.

**Rationale**: Four ASCII columns, no new glyph, and it cannot be confused with the
projection chip, which says `5h limit ~14:20`. Keeping the percentage satisfies Principle III.
The word stays when the reset text is shed for width, since it is the part that explains why
the figure is not moving.

**Alternatives considered**: Replacing `100%` with `full` (drops the figure Principle III
requires). A dedicated glyph (needs evidence and a table row for a state a word already says).

## R6. Priority

**Decision**: Fixed priority 95 for the `spendLimit` segment, order 52 (right after the 7-day
chip).

**Rationale**: The 5-hour window is 94 and context is 100. The chip only exists in gateway
setups, where it decides whether work can continue. Order 52 keeps the three allowances
together and puts the new one last, so the existing chips do not move (SC-005).

## R7. Constitution

**Decision**: Amend Principle III as a MINOR bump (6.1.0 to 6.2.0), adding `spend_limit` to
the list of displayed fields and allowing that one figure above 100%.

**Rationale**: It adds a field to a list and does not redefine any existing requirement.
