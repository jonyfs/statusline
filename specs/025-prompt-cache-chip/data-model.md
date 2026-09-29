# Data Model: The bar says when the prompt cache goes cold, and why it did

## Input: `payload.prompt_cache`

| Field | Used on | Rule |
|---|---|---|
| `warm` | bar | Boolean, or the whole block is ignored |
| `caching_observed` | bar | Must be `true` for any chip |
| `ttl` | bar | `"5m"` or `"1h"`, anything else is unknown |
| `expires_at` | bar | Finite number of Unix seconds, at most 3,600 s ahead, or null |
| `recache_tokens_if_cold` | bar | Finite, not negative, or absent |
| `last_miss_cause.causes` | bar | Array of strings, or absent |
| `hit_ratio` | doctor | Finite, 0 to 1, or absent |
| `misses`, `requests` | doctor | Finite, not negative integers, or absent |

## Reading: `getPromptCache(payload, now)` in `src/tokens.js`

Returns null when there is no usable block. Otherwise:

```js
{
  state: "warm" | "cold",       // "cold" also when warm is true and expires_at has passed
  ttl: "5m" | "1h" | null,
  secondsLeft: number | null,   // warm only
  closing: boolean,             // warm and inside its window (120 s / 600 s)
  observed: boolean,            // caching_observed
  recacheTokens: number | null,
  cause: string | null,         // the phrase, or the code as sent; null when skipped
  hitRatio: number | null,
  misses: number | null,
  requests: number | null,
}
```

## Chip visibility

| observed | state | closing | chip |
|---|---|---|---|
| false | any | any | none |
| true | warm | false | none |
| true | warm | true | warm |
| true | cold | n/a | cold |

## Registry row

```js
{ key: "promptCache", line: 3, order: 54, priority: 80, colour: "ramp", source: "payload" }
```

## Glyph rows

| Key | Nerd | Plain |
|---|---|---|
| `cacheWarm` | `U+F050F` nf-md-thermometer | `↻` |
| `cacheCold` | `U+F0717` nf-md-snowflake | `❄` |
