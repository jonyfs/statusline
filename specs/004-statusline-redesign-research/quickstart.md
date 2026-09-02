# Quickstart: Research It, Then Let the Owner Build the Bar

**Date**: 2026-09-02

How to check each story is really done. Every command runs from the
repository root and needs nothing installed beyond Node 18.

## Prerequisites

```bash
node --version   # 18 or newer
node scripts/smoke-test.js
```

The suite must be green before and after any story.

## Story 1: the page

Generate it and open it.

```bash
node scripts/generate-composer.js
open specs/004-statusline-redesign-research/composer.html      # macOS
xdg-open specs/004-statusline-redesign-research/composer.html  # Linux
start specs/004-statusline-redesign-research/composer.html     # Windows
```

Expected:

- The page opens on the bar as it ships today, labelled as the current
  design.
- Every segment the bar can draw is listed, including the ones that are off.
- Turning a segment off removes it and leaves the others where they were.
- Moving a segment within its line, or to another line, redraws the bar.
- The width switch shows what the arrangement sheds at 80 columns.
- The glyph switch shows the plain substitutes instead of missing boxes.
- Loading a preset replaces the canvas and leaves it editable.
- The single-line preset is labelled as requiring an amendment to Principle
  II.
- Reloading the page brings back what was being edited.
- The copy button yields JSON, and both file paths are named beside it.

Reproducibility, which the test also asserts:

```bash
node scripts/generate-composer.js
shasum specs/004-statusline-redesign-research/composer.html
node scripts/generate-composer.js
shasum specs/004-statusline-redesign-research/composer.html   # same hash
```

## Story 2: the bar obeys

Write the arrangement the page produced and redraw.

```bash
mkdir -p ~/.claude/statusline
cat > ~/.claude/statusline/layout.json <<'JSON'
{ "version": 1, "name": "trying it", "segments": { "rtk": { "on": false } } }
JSON

echo '{"cwd":"'"$PWD"'","session_id":"quickstart","model":{"display_name":"Opus 5"}}' \
  | node bin/cli.js
```

Expected: the token savings segment is gone and nothing else moved.

Then check the promises that matter:

```bash
# What is in force, where it came from, what it ignored
node bin/cli.js doctor | head -20

# Default output is untouched when nothing is configured
mv ~/.claude/statusline/layout.json /tmp/layout.json
echo '{"cwd":"'"$PWD"'","session_id":"quickstart","model":{"display_name":"Opus 5"}}' \
  | node bin/cli.js > /tmp/default.txt
mv /tmp/layout.json ~/.claude/statusline/layout.json
```

Expected: `/tmp/default.txt` matches the bar drawn before any arrangement
existed, byte for byte.

Bad input must not break anything:

```bash
echo 'not json at all' > ~/.claude/statusline/layout.json
echo '{"cwd":"'"$PWD"'","session_id":"quickstart"}' | node bin/cli.js
node bin/cli.js doctor | grep -i arrangement
```

Expected: the default bar draws, and the diagnostic names the file and the
reason.

Narrow terminals still fit:

```bash
COLUMNS=60 node bin/cli.js doctor | head -5
```

Expected: no line exceeds 60 columns, and nothing wraps.

Cost has not moved:

```bash
node scripts/bench.js --runs 50
```

Expected: p95 within the same range as the 18.6 ms baseline recorded in
[research.md](./research.md), and inside the 300 ms budget.

## Story 3: the new default

Closed on 2026-09-02 by the decision in [decisions.md](./decisions.md). The
arrangement chosen was the empty one, so the shipped default is already the
chosen design. What is left to check is that nothing moved:

```bash
node scripts/generate-previews.js
git status --short docs/previews
```

Expected: no diff. If a preview changed, something altered the default bar
after a decision that said it should not.

## Story 4: the record

```bash
node scripts/bench.js --runs 50        # the efficiency numbers
node bin/cli.js doctor                 # the absence explanations
```

Expected: every figure quoted in [research.md](./research.md) reproduces, and
every failure mode listed there can be forced and behaves as described.

## Cleanup

```bash
rm -f ~/.claude/statusline/layout.json
```
