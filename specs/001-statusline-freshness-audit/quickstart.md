# Quickstart: validating the freshness work

**Feature**: `specs/001-statusline-freshness-audit`

How to prove the feature works, end to end, on a real machine. Every check maps to a
success criterion in `spec.md`.

## Prerequisites

- Node 18 or newer, git, and this repository cloned.
- Optional for the full picture: `gh` authenticated, and `rtk` installed.
- A large session transcript to test against. Find the biggest one you have:

  ```bash
  ls -S ~/.claude/projects/*/*.jsonl | head -1
  ```

  On this machine that is a 78 MB file, which is what the baseline numbers in
  `research.md` were measured against.

## 1. The redraw stays inside its budget (SC-001, SC-002)

```bash
node scripts/bench.js --runs 100
```

Reports per-run elapsed time, the 95th percentile, and a breakdown per source.

Expected: p95 under 300 ms. Run it in this repository and again in a large one with
thousands of changed files; the two should be close.

To confirm session age no longer matters, point a render at a real transcript:

```bash
BIG=$(ls -S ~/.claude/projects/*/*.jsonl | head -1)
printf '{"transcript_path":"%s","session_id":"bench"}' "$BIG" | node bin/cli.js doctor
```

Expected: the transcript row reports single-digit or low double-digit milliseconds
and a bounded `bytesRead`, not the whole file.

## 2. A skill shows up immediately (SC-003)

With the hook registered, invoke any skill in a live session and watch the second
line on the next redraw. The name should be there.

Without the hook, the same test through the fallback path:

```bash
printf '{"transcript_path":"%s","session_id":"t"}' "$BIG" | node bin/cli.js render
```

Expected: the same names either way. The hook changes when they appear, not which
ones.

## 3. Offline still renders on time (SC-004)

Disconnect the network, or point `gh` at nothing, then:

```bash
node scripts/bench.js --runs 20
```

Expected: p95 still under 300 ms, and the PR segment absent rather than the line
hanging. The cache holds a fresh value for 60 seconds after the last successful
lookup, so run this at least a minute after the last online render to see the
absence.

## 4. Every segment behaves in all three states (SC-005)

```bash
npm test
```

Expected: green, with each of the fifteen segments covered present, absent, and
degraded. The suite runs on Linux, macOS and Windows in CI, as Principle IX requires.

Two behaviours worth checking by eye as well: an empty payload still shows
`Context ?%` rather than dropping the segment, and a render that throws still exits 0
with lines on stdout and nothing on stderr.

```bash
echo '{}' | node bin/cli.js render; echo "exit=$?"
```

## 5. No line exceeds the width limit (SC-006)

```bash
npm run previews
git diff --exit-code docs/previews
```

Expected: no diff when nothing changed, and the width check in the suite passing for
the widest fixture in both glyph modes.

Regenerate and commit previews in the same commit as any segment change, per
Principle VIII.

## 6. The diagnostic explains the line (SC-007)

```bash
node bin/cli.js doctor
```

Expected: one row per segment, in render order, with value, source, age, freshness,
and cost, plus a reason for every absent segment. Cached segments show two columns:
the reading `render` would use, and a live probe run for the diagnostic. Nothing on
the rendered line should be missing from the report.

## 7. Install and uninstall are clean (SC-008)

Run this against a throwaway `HOME`, not your real one, so a mistake cannot cost you
your settings:

```bash
export TESTHOME=$(mktemp -d)
mkdir -p "$TESTHOME/.claude"
cp ~/.claude/settings.json "$TESTHOME/.claude/settings.json"
cp "$TESTHOME/.claude/settings.json" "$TESTHOME/before.json"

HOME="$TESTHOME" node bin/cli.js install
HOME="$TESTHOME" node bin/cli.js uninstall
diff <(jq -S . "$TESTHOME/before.json") <(jq -S . "$TESTHOME/.claude/settings.json")
```

Expected: no differences. Both the `statusLine` key and the `PostToolUse` hook the
install registered are gone, and everything else is untouched. Backups from the
install remain.

Check the opt-out and the interpreter too:

```bash
HOME="$TESTHOME" node bin/cli.js install --no-hook
jq '.hooks.PostToolUse' "$TESTHOME/.claude/settings.json"
```

Expected: no hook registered, and when it is registered, its command starts with the
absolute Node path rather than a bare `node`, per Principle IX.

## Cleaning up between runs

```bash
rm -rf ~/.claude/statusline/cache ~/.claude/statusline/skills
```

Both directories are disposable. Removing them costs one cache miss.

## Reference

- Segment shapes and maximum ages: [data-model.md](./data-model.md)
- Command promises: [contracts/cli.md](./contracts/cli.md)
- File formats: [contracts/state-files.md](./contracts/state-files.md)
- The optional hook: [contracts/hooks.md](./contracts/hooks.md)
