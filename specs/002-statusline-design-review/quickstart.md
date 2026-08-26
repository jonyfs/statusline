# Quickstart: validating the redesign

**Feature**: `specs/002-statusline-design-review`

Every check maps to something the selection asked for. Run them in order; the first two
are the ones that catch a structural mistake early.

## 1. The bar fits whatever terminal it is given

```bash
for w in 200 120 100 80 60; do
  echo "--- $w columns ---"
  COLUMNS=$w LINES=40 CLAUDE_STATUSLINE_NO_REFRESH=1 \
    node bin/cli.js render < scripts/tests/fixtures/payload-full.json
done
```

Expected: no line exceeds the width it was given, at any of them. As the width falls,
segments leave in the priority order from `data-model.md`, and the six in the top band
are the last to go. Nothing moves sideways when a neighbour disappears.

## 2. The line count follows the window

```bash
for h in 40 8 6 4; do
  echo "--- $h rows ---"
  COLUMNS=120 LINES=$h CLAUDE_STATUSLINE_NO_REFRESH=1 \
    node bin/cli.js render < scripts/tests/fixtures/payload-full.json | wc -l
done
```

Expected: four lines while there is room, then skills go, then the model line, and line 4
is the last one standing. Give the rows back and all four return.

## 3. Colour means one thing

```bash
node bin/cli.js doctor --json | jq '.segments[] | {key, colour, priority}'
```

Expected: every segment reports `identity`, `ramp` or `change`, never two. The four
ramped segments are context, 5-hour, 7-day and burn rate. The four change-highlighted are
branch, PR, skills and model. No overlap.

## 4. A ramp is readable without colour

```bash
node bin/cli.js render < scripts/tests/fixtures/payload-near-limit.json | sed 's/\x1b\[[0-9;]*m//g'
```

Expected: the bar's own characters differ by band, so a screenshot in greyscale still
says which band a value is in.

## 5. The subprocesses are gone from the redraw path

```bash
node bin/cli.js doctor | grep -E "^(pr|remote)"
```

Expected: both report `payload` as their source, with a cost of 0 ms, in a session whose
Claude Code sends the fields. In a repository where the payload has no `pr`, the row
reports the `gh` fallback instead, which is what C1 asked for.

## 6. The budget still holds

```bash
node scripts/bench.js --runs 100
```

Expected: p95 under 300 ms. It was 47 ms before this feature; the alignment pass and the
priority fill are the only additions on the path.

## 7. Rates say nothing until they know something

Start a fresh session and watch the burn rate, the projection and the sparkline. Expected:
absent for the first minute, then present. A rate computed from two samples is not shown.

## 8. Install and uninstall stay reversible

```bash
export TESTHOME=$(mktemp -d); mkdir -p "$TESTHOME/.claude"
cp ~/.claude/settings.json "$TESTHOME/.claude/settings.json"
cp "$TESTHOME/.claude/settings.json" "$TESTHOME/before.json"
HOME="$TESTHOME" node bin/cli.js install
HOME="$TESTHOME" node bin/cli.js uninstall
diff <(jq -S . "$TESTHOME/before.json") <(jq -S . "$TESTHOME/.claude/settings.json")
```

Expected: no differences. `refreshInterval` and the task-row command go in with install
and come out with uninstall, and nothing else in the file is touched.

## 9. Everything renders in every theme

```bash
for f in mocha frappe macchiato latte nord gruvbox; do
  CLAUDE_STATUSLINE_FLAVOR=$f node bin/cli.js render < scripts/tests/fixtures/payload-full.json > /dev/null || echo "$f failed"
done
npm run previews && git diff --exit-code docs/previews
```

Expected: six themes render, and regenerating previews produces no diff.

## 10. The whole suite

```bash
npm test
```

Expected: green, with every new segment covered present, absent and degraded, and the
priority table asserted at 200, 120, 100 and 80 columns.
