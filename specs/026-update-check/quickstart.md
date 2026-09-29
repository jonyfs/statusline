# Quickstart: validating the update check

Prerequisites: Node 18+, git, run from the repository root. Every step below uses a throwaway
HOME and throwaway repositories; none touches your real install.

## 1. Tests

```sh
npm test
```

Expected: all pass, including `scripts/tests/update-check.test.js`, which builds an origin and a
clone in a temporary directory, adds `feat:`, `fix:` and `docs:` commits to the origin, and
checks each outcome.

## 2. The check by hand

```sh
S=$(mktemp -d); git clone -q https://github.com/jonyfs/statusline.git "$S/clone"
git -C "$S/clone" reset -q --hard HEAD~3
HOME="$S" node "$S/clone/bin/cli.js" check-updates
```

Expected: the three newest commits listed with their counts, and the clone unchanged.

## 3. The automatic path

```sh
HOME="$S" node "$S/clone/bin/cli.js" refresh update "$(HOME="$S" node -e 'import("'"$S"'/clone/src/cache.js").then(m=>console.log(m.repoKey("'"$S"'/clone")))')"
git -C "$S/clone" log --oneline -1
```

Expected: the clone is at `origin/main`. A redraw from that HOME shows
`statusline updated · …` once.

## 4. Behaviours

```sh
HOME="$S" node "$S/clone/bin/cli.js" updates notify
HOME="$S" node "$S/clone/bin/cli.js" updates
```

Expected: `Updates: notify (from ~/.claude/statusline/updates.json)`.
