# Output contract: the prompt-cache chip and its doctor row

Shapes are shown in plain mode (`↻` warm, `❄` cold). In Nerd mode the icons are the
thermometer and the snowflake.

## Line 3 chip

| `prompt_cache` | Chip |
|---|---|
| absent | none |
| `caching_observed: false` | none |
| warm, `5m`, 250 s left | none |
| warm, `5m`, 110 s left | `↻ cache warm · 1m` (warning colour) |
| warm, `5m`, 40 s left | `↻ cache warm · <1m` (warning colour) |
| warm, `1h`, 2,820 s left | none |
| warm, `1h`, 540 s left | `↻ cache warm · 9m` (warning colour) |
| warm, `expires_at` 5 s ago | `❄ cache cold` (critical colour) |
| warm, `ttl` missing or `expires_at` null | none |
| cold, 184,000 to re-cache, cause `tools_changed` | `❄ cache cold · 184k · tools changed` |
| cold, 184,000, cause `ttl_expired_5m` | `❄ cache cold · 184k` |
| cold, re-cache null, cause `model_changed` | `❄ cache cold · model changed` |
| cold, cause `unknown` | `❄ cache cold · 184k` |
| cold, causes `["unknown", "tools_changed"]` | `❄ cache cold · 184k · tools changed` |
| cold, cause `some_new_cause` | `❄ cache cold · 184k · some_new_cause` |

Width shedding removes the cause, then the token count, before any other segment's text. A
payload with no block, or with `caching_observed: false`, renders line 3 as before.

## `doctor` row

```
promptCache   3   80   yes   cold, 5m, 184k to re-cache, tools changed, 91% hits, 2 misses
promptCache   3   80   no    warm, 5m, 4m left: outside the 2m closing window
promptCache   3   80   no    caching is not reported by this provider
promptCache   3   80   no    not in the payload: Claude Code 2.1.283+ sends it after the first response
```
