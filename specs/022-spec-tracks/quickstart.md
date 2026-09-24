# Quickstart: validating the two spec tracks

**Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/scaffold-cli.md](./contracts/scaffold-cli.md)

Run these from the repository root after implementation. Each one proves a requirement and
says what you should see.

## Prerequisites

Node 18 or newer and bash. Nothing else; no network access is needed.

**One trap to know about.** `get_feature_paths` in `common.sh` persists
`SPECIFY_FEATURE_DIRECTORY` into `.specify/feature.json` as a side effect, so any step
below that sets that variable rewrites the repository's pointer. Back the file up first
and restore it afterwards:

```bash
cp .specify/feature.json /tmp/feature.json.bak
# ... run the steps that set SPECIFY_FEATURE_DIRECTORY ...
cp /tmp/feature.json.bak .specify/feature.json
```

This was found by running step 2 without the backup. It is existing behavior, not
something this feature introduces.

## 1. The prerequisite check passes on main (SC-001)

```bash
bash .specify/scripts/bash/check-prerequisites.sh --json
```

Expected: exit 0 and a JSON line naming the feature directory and available docs. Before
this feature, the same command exited 1 with `ERROR: plan.md not found`.

## 2. A quick feature needs nothing but its spec (US1)

```bash
mkdir -p /tmp/qs-quick/specs/900-quick-demo
printf -- '---\ntrack: quick\nstatus: done\n---\n\n# Demo\n' \
  > /tmp/qs-quick/specs/900-quick-demo/spec.md
SPECIFY_FEATURE_DIRECTORY=/tmp/qs-quick/specs/900-quick-demo \
  bash .specify/scripts/bash/check-prerequisites.sh --json
```

Expected: exit 0. No plan is demanded.

## 3. A finished full feature without its plan fails (US1, scenario 3)

Change `track: quick` to `track: full` in the file from step 2 and re-run the same command.

Expected: exit 1 and the message
`ERROR: plan.md not found in ...` followed by the line explaining that the feature declares
the full track.

## 4. An undeclared spec fails, and the message names the key (US2, FR-007)

Remove the front matter block from the file in step 2 and re-run.

Expected: exit 1 and `ERROR: .../spec.md declares no valid track (expected quick|full)`.

Then restore the block with `status: maybe` instead of `status: done`.

Expected: exit 1 and `ERROR: .../spec.md declares no valid status (expected
active|done|abandoned)`. The track message must not appear: a wrong status is reported as a
status problem.

## 5. Every existing spec declares what it already is (US3, SC-003)

```bash
for d in specs/*/; do
  printf '%s ' "$(basename "$d")"
  sed -n '2,4p' "$d/spec.md" | tr '\n' ' '
  echo
done
```

Expected: all 21 directories print a track and a status. Directories 017, 018, 020 and 021
print `track: quick`. No directory gained a `plan.md`:

```bash
ls specs/017-line-legibility specs/018-readme-current \
   specs/020-links-that-belong-here specs/021-agent-rows
```

Expected: no `plan.md` and no `tasks.md` in any of them.

## 6. The scaffold check runs with the suite (US4, SC-004)

```bash
node scripts/smoke-test.js
```

Expected: the tally includes the `spec-scaffold.test.js` cases and reports `0 failed`.

Break one condition at a time and confirm each fails on its own:

```bash
# pointer names a directory that does not exist
cp .specify/feature.json /tmp/feature.json.bak
printf '{"feature_directory":"specs/999-nope"}\n' > .specify/feature.json
node scripts/smoke-test.js   # expect a failure naming specs/999-nope
cp /tmp/feature.json.bak .specify/feature.json
```

```bash
# the two pointers disagree
cp CLAUDE.md /tmp/CLAUDE.md.bak
sed -i'' -e 's|specs/022-spec-tracks|specs/019-explaining-a-segment|' CLAUDE.md
node scripts/smoke-test.js   # expect a failure reporting both values
cp /tmp/CLAUDE.md.bak CLAUDE.md
```

Restore both files and re-run the suite; expect `0 failed` again.

## 6b. A quick feature does not borrow another feature's plan (FR-009, FR-013)

The agent-context script used to write the newest `specs/*/plan.md` into the `CLAUDE.md`
block. A quick feature has none, so the block would have named a different feature.

```bash
cp .specify/feature.json /tmp/fj.bak; cp CLAUDE.md /tmp/cm.bak
mkdir -p specs/900-quick-probe
printf -- '---\ntrack: quick\nstatus: active\n---\n\n# Probe\n' > specs/900-quick-probe/spec.md
printf '{"feature_directory":"specs/900-quick-probe"}\n' > .specify/feature.json
bash .specify/extensions/agent-context/scripts/bash/update-agent-context.sh
sed -n '1,5p' CLAUDE.md
node scripts/smoke-test.js
rm -rf specs/900-quick-probe
cp /tmp/fj.bak .specify/feature.json; cp /tmp/cm.bak CLAUDE.md
bash .specify/extensions/agent-context/scripts/bash/update-agent-context.sh
```

Expected: the block names `specs/900-quick-probe/spec.md`, the sentence reads "spec at"
rather than "plan at", and the suite stays green. Before the fix the block named
`specs/022-spec-tracks/plan.md` and the "both pointers name the same feature" case failed.

## 7. Nothing about the bar changed (SC-006)

The same `node scripts/smoke-test.js` run covers this: the 489 pre-existing cases must
still pass, and no renderer file is touched by this feature.

## 8. A shallow checkout behaves identically (SC-008)

A `--depth 1` clone only carries the last commit, so it cannot see uncommitted work. Copy
the working tree without its `.git` instead, which is stricter: there is no repository at
all.

```bash
rm -rf /tmp/nogit && mkdir -p /tmp/nogit
tar --exclude=.git --exclude=node_modules -cf - . | (cd /tmp/nogit && tar -xf -)
cd /tmp/nogit && git rev-parse --git-dir   # expect: fatal: not a git repository
node scripts/smoke-test.js
```

Expected: the same tally as in the repository, with no case reporting that it was skipped.
No check in this feature reads history.
