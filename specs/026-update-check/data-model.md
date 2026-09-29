# Data Model: The statusline tells you it has an update, and can take it

## Update behaviour

`~/.claude/statusline/updates.json`:

```json
{ "mode": "auto" }
```

`mode` is `auto`, `notify` or `off`. `CLAUDE_STATUSLINE_UPDATES` overrides it. A missing file,
an unreadable one or an unknown value means `auto`.

## Check result: cache entry `update`

Stored with `writeEntry(repoKey(<clone root>), "update", value)`.

```js
{
  checkedAt: number,          // ms
  ok: boolean,                // false when fetch or log failed
  error: string | null,       // short reason when !ok
  mode: "auto" | "notify" | "off",
  head: string,               // clone HEAD after the check (and after an update)
  upstreamHead: string | null,
  pending: [{ type: "feature" | "fix" | "other", subject: string }],  // HEAD..@{u}
  outcome: "current" | "ready" | "updated" | "blocked" | "failed",
  blockedBy: "local edits" | "history diverged" | "not a clone" | null,
  arrived: { features: number, fixes: number } | null,   // for "updated"
  shownTo: string | null,     // session_id the one-time chip was first drawn for
}
```

Subjects are stored after `plainText` and cut to 72 characters.

## Outcome and chip

| outcome | chip | lifetime |
|---|---|---|
| `current` | none | |
| `ready` (notify, pending feat/fix) | `update ready · N features, N fixes` | while pending |
| `updated` (auto) | `statusline updated · N features, N fixes` | first session drawn after it |
| `blocked` | `update blocked · <reason>` | while blocked |
| `failed` | `update failed` | first session drawn after it |
| any, mode `off` | none | |

Pending commits that are all `other` give `current`.

## Registry row and glyphs

```js
{ key: "update", line: 1, order: 70, priority: 60, colour: "identity", source: "cache" }
```

| Key | Nerd | Plain |
|---|---|---|
| `updateReady` | `U+F01DA` nf-md-download | `⤓` |
| `updateDone` | `U+F0737` nf-md-arrow_up_bold | `⤒` |
