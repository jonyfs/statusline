# Quickstart: validating passive mode

```sh
H=$(mktemp -d)
echo '{"session_id":"q","cwd":"'"$PWD"'","model":{"display_name":"Opus 5"}}' \
  | HOME=$H CLAUDE_STATUSLINE_PASSIVE=1 CLAUDE_STATUSLINE_UPDATES=off node bin/cli.js >/dev/null
find $H -type f | wc -l        # expect 0
```

With a cache directory:

```sh
D=$(mktemp -d)
echo '{"session_id":"q","cwd":"'"$PWD"'"}' \
  | HOME=$H CLAUDE_STATUSLINE_PASSIVE=1 CLAUDE_STATUSLINE_CACHE_DIR=$D node bin/cli.js >/dev/null
find $D -type f | head          # the cache and the session state
find $H -type f | wc -l        # still 0
```

The suite: `node scripts/tests/passive-mode.test.js` and `npm test`.
