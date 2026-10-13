# Quickstart: validating runs output

Run from the repository root with Node 18 or newer.

## A footer as data

```sh
echo '{"model":{"display_name":"Opus 5"},"cwd":"'"$PWD"'"}' \
  | COLUMNS=120 CLAUDE_STATUSLINE_OUTPUT=runs CLAUDE_STATUSLINE_NO_REFRESH=1 node bin/cli.js
```

Expect one JSON object: `"contract":1` and a `lines` array of arrays of runs. The same with
`--format runs` instead of the variable gives the same object.

## The plain text matches

```sh
echo '{}' | COLUMNS=100 node bin/cli.js | sed 's/\x1b\[[0-9;]*m//g' > /tmp/ansi.txt
echo '{}' | COLUMNS=100 CLAUDE_STATUSLINE_OUTPUT=runs node bin/cli.js \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).lines.map(l=>l.map(r=>r.text).join("")).join("\n")))' > /tmp/runs.txt
diff /tmp/ansi.txt /tmp/runs.txt && echo same
```

## An error

```sh
echo 'not json' | CLAUDE_STATUSLINE_OUTPUT=runs node bin/cli.js; echo "exit $?"
```

Expect `{"contract":1,"error":{"code":"bad-payload",...}}` and `exit 75`. The same input
without the variable prints a bar and exits 0.

## The suite

```sh
node scripts/tests/runs-output.test.js
node scripts/tests/runs-ansi-golden.test.js
npm test
```
