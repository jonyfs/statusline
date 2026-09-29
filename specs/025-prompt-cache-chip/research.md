# Research: The bar says when the prompt cache goes cold, and why it did

## R1. What the payload carries

**Decision**: Read `payload.prompt_cache` as Claude Code 2.1.284 builds it, and use `warm`,
`caching_observed`, `ttl`, `expires_at`, `recache_tokens_if_cold` and `last_miss_cause.causes`
on the bar. `hit_ratio`, `misses`, `requests` and `miss_causes` go to `doctor` only.

**Rationale**: The spec deferred confirming the block to a live capture. The builder in the
installed binary settles it without one:

```js
function mqn(e=Date.now()){let n=ZFe(void 0,e);if(n.requests===0||n.lastRequest===null)return{};
return{prompt_cache:{warm:n.warm,caching_observed:n.cachingObserved,ttl:n.lastRequest.ttl,
expires_at:n.expiresAt===null?null:Math.ceil(n.expiresAt/1000), ... hit_ratio:n.hitRatio, ...
last_miss_cause:n.lastMissAttribution===null?null:{causes:n.lastMissAttribution.causes, ...},
miss_causes:n.missCauses,recache_tokens_if_cold:i3n()}}}
```

So the block is absent until the first request completes, `expires_at` is whole seconds
rounded up, and `ttl` is taken from the last request. Elsewhere in the same binary the TTL is
only ever `"5m"` or `"1h"` (`L.cache_ttl==="1h"?3600:300`), and the bundled schema says the
same. A live capture is still worth taking once, and the quickstart says how, but nothing in
the design waits on it.

**Alternatives considered**: Changing the user's `statusLine` command to capture a payload.
Rejected: it edits their settings for a check the binary already answers.

## R2. The closing window

**Decision**: A warm chip appears when `expires_at - now` is at most 120 s on a `5m` TTL or
600 s on a `1h` TTL (clarification of 2026-09-29). An unknown TTL or a null `expires_at` draws
no warm chip.

**Rationale**: Both windows are the last fifth or sixth of the TTL, which is the stretch
where waiting another minute changes the outcome. The redraws that make it visible already
exist: the installer sets a 60-second `refreshInterval`, and Claude Code redraws at
`expires_at` itself.

## R3. How minutes are shown

**Decision**: Whole minutes rounded down, `<1m` under 60 s. A warm cache whose `expires_at`
has passed reads cold.

**Rationale**: Rounding down never promises time that is not there. `1m` at 1 min 59 s is
cautious in the direction that costs nothing.

## R4. Icons

**Decision**: `U+F050F` nf-md-thermometer for warm and `U+F0717` nf-md-snowflake for cold, so
the icon carries the state (Principle X). Plain substitutes `↻` (U+21BB) and `❄` (U+2744),
both East Asian Narrow.

**Rationale**: Rendered from the installed font, evidence at
`specs/025-prompt-cache-chip/glyph-evidence.png`. Two more wrong names turned up: F09A2, listed
as a database-refresh icon, draws a speaker with a Bluetooth mark, and F06B0 draws a clock
with a circular arrow. `❄` has an emoji form, but its default presentation is text, so it
stays one column unless a variation selector asks otherwise, and the bar never sends one.

**Alternatives considered**: One icon for both states (nf-md-cached F00E8). Rejected: a glyph
that looks the same whatever the state is decoration, which Principle X forbids.

## R5. Colour channel and bands

**Decision**: Registry channel `ramp`. Warm renders in the warning colour, cold in the critical
colour. The words `warm` and `cold` and the two icons carry the state without colour.

**Rationale**: The chip is a level of urgency, which is what the ramp channel means on this
bar. It has no percentage, so it does not use the percentage band marks; the word does that
job.

## R6. Width

**Decision**: Registry row `{ key: "promptCache", line: 3, order: 54, priority: 80 }`. A cold
chip carries `variants`, its shorter texts in the order it gives them up (without the cause,
then without the token count), and `fitToWidth` in `src/layout.js` tries them before dropping
the segment.

**Rationale**: Order 54 sits between the spend limit (52) and the duration (55), so nothing
existing moves. Priority 80 is in the actionable band, under the three allowances and the
model, above the burn rate.

The first design added two steps to the renderer's `TRIM_STEPS` ladder. Implementation showed
the ladder almost never runs: `fitToWidth` always makes a row fit by dropping segments, so the
ladder's "does every row fit" check passes before any step is taken, and the chip was dropped
whole at 100 columns. Variants work inside `fitToWidth` instead. They keep the bar's rule that
a lower-priority neighbour goes before anything shortens, and when the guard reaches the chip
it loses the cause, then the token count, then itself. No other segment declares variants, so
every other bar lays out exactly as before. Measured on a fixture: the full chip at 110
columns, no cause at 100, no tokens at 80, no chip at 70.

## R7. Cause phrases

**Decision**: The table fixed in the clarification: `tools changed`, `prompt changed`,
`model changed`, `history rewritten`, `server side`; nothing for `unknown`, `ttl_expired_5m`
and `ttl_expired_1h`; any other code as sent, through `payloadText`.

## R8. Constitution

**Decision**: Amend Principle III to 6.3.0, MINOR, adding `prompt_cache` to the displayed
fields. No other principle changes.
