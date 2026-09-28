# Output contract: allowance chips and diagnostic rows

The shapes below use plain mode with `NO_COLOR=1`, so each glyph shows as its plain
substitute. In Nerd mode, `◷` is the timer glyph, `▤` the calendar and `$` the wallet.

## Line 3 chips

| Payload `rate_limits` | 5-hour chip | 7-day chip | Spend chip |
|---|---|---|---|
| 5h 43, 7d 79, no spend | `◷ 5h 43% · 4h23m` | `▤ 7d 79%▵ · Thu 21:13` | absent |
| 5h 100, 7d 79, no spend | `◷ 5h 100%▴ full · 4h23m` | `▤ 7d 79%▵ · Thu 21:13` | absent |
| 5h 100, 7d 100, no spend | `◷ 5h 100%▴ full · 4h23m` | `▤ 7d 100%▴ full · Thu 21:13` | absent |
| 5h 100, spend 12 (resets in 3 days) | `◷ 5h 100%▴ full · 4h23m` | as reported | `$ spend 12% · Thu 21:13` |
| spend 115 | as reported | as reported | `$ spend 115%▴ · 12/10 09:00` |
| spend 30, reset in 5 hours | as reported | as reported | `$ spend 30% · 5h00m` |
| spend 30, no reset | as reported | as reported | `$ spend 30% · ?` |
| spend -3, NaN, or a string | as reported | as reported | absent |

Under width pressure the reset text comes off first (`moment: false` sheds both the 7-day and
spend resets), then the 5-hour countdown. The word `full` is never shed while its chip is on
the line. The spend chip sits after the 7-day chip, at priority 95.

A payload with no spend entry and no window at 100% produces the same bytes on line 3 as
before this feature (SC-005).

## `doctor` rows

```
fiveHour     on   100% · resets in 4h23m
sevenDay     on   79% · resets in 3d 2h
spendLimit   on   12% · resets in 3d 5h
```

With no spend entry:

```
spendLimit   off  not in the payload: Claude Code reports a spend limit only behind a Claude gateway with spend limits
```

`doctor --json` carries the same row under `segments` with the same `key`. `doctor --explain`
gains one sentence for `spendLimit`.
