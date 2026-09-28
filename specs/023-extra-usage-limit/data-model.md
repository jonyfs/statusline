# Data Model: The bar keeps counting after the limit is lifted

## Allowance (payload input)

Read from `payload.rate_limits.<name>`, where `<name>` is `five_hour`, `seven_day` or
`spend_limit`.

| Field | Type | Rule |
|---|---|---|
| `used_percentage` | number | Finite and not negative, or the entry is absent. Rounded for display. `spend_limit` may exceed 100. The windows are shown as reported, as today. |
| `resets_at` | number, Unix seconds | Optional. Finite, and at most 30 days out for the windows, 32 days for `spend_limit`. Otherwise the reset reads `?`. |

The spend-limit entry exists only in gateway setups, and only while its `resets_at` has not
passed. The 5-hour and 7-day entries are expected on every account; when absent they render
`?%`.

## Readings added to `gather()`

| Reading | Value | Source |
|---|---|---|
| `spendLimit` | rounded percentage, or null | payload |
| `spendLimitReset` | Unix seconds, or null | payload |

`getRateLimits(payload)` returns two new keys, `spendLimitPct` and `spendLimitResetsAt`, next to
the four it already returns.

## At-limit state (derived, not stored)

`atLimit(pct) = typeof pct === "number" && pct >= 100`, evaluated on the rounded figure the
chip displays. It applies to the 5-hour and 7-day chips only. A spend limit at or above 100
is shown in the critical band with its real figure.

| State | 5h / 7d chip |
|---|---|
| figure < 100 | unchanged |
| figure ≥ 100 | `… 100%▴ full · <reset>` |
| next payload after the reset, figure < 100 | unchanged again (nothing is persisted) |

## Segment registry row

```js
{ key: "spendLimit", line: 3, order: 52, priority: 95, colour: "ramp", source: "payload" }
```

## Glyph table rows

| Key | Nerd | Plain |
|---|---|---|
| `spend` | `U+F0584` nf-md-wallet | `$` |
