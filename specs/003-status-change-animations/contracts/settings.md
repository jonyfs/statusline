# Contract: the `animate` setting

Resolved by `resolveSettings()` in `src/config.js`, alongside the settings that
already exist. Environment variable wins, then the repository file, then the
default.

| Source | Form | Notes |
|---|---|---|
| Environment | `CLAUDE_STATUSLINE_ANIMATE=0` | Any value other than `0` leaves animation on |
| Repository file | `{ "animate": false }` in `.statusline.json` | Added to the resolver's known-keys list |
| Default | on | Catching the eye is the point of the feature |

`resolveSettings` gains one field:

```js
animate: env.CLAUDE_STATUSLINE_ANIMATE !== "0" && file.animate !== false
```

Generated previews need no setting. `scripts/generate-previews.js` already
renders with `trackChanges: false`, and that path returns a tracker whose
`isChanged` is always false and whose `iconFor` always returns the static icon.
Animation cannot reach a generated preview, which is why regenerating them
stays byte-reproducible.
