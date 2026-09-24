# Research: Two spec tracks, and a scaffold that cannot lie

**Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

The Technical Context for this feature had no NEEDS CLARIFICATION markers: the languages,
the test harness, and the target platforms are all fixed by the repository. What needed
research was the shape of the code being changed. Everything below was read from the
files it names.

## Where the failure lives

**Decision**: the hard error is a single block in `check-prerequisites.sh`, and the same
block is duplicated in `setup-tasks.sh`.

```bash
if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "ERROR: plan.md not found in $FEATURE_DIR" >&2
    echo "Run /speckit-plan first to create the implementation plan." >&2
    exit 1
fi
```

**Rationale**: both scripts source `common.sh` and both call `get_feature_paths`, which
returns `IMPL_PLAN` unconditionally as `$feature_dir/plan.md` whether or not the file
exists. The path resolution is already track-agnostic. Only the requirement is wrong.

**Alternatives considered**: teaching `get_feature_paths` to omit `IMPL_PLAN` for a quick
feature. Rejected: callers read `IMPL_PLAN` to decide what to write, and `setup-plan.sh`
needs the path precisely when the file is absent.

## Where the declaration is parsed

**Decision**: one function in `common.sh`, `read_spec_declaration`, returning the track and
status of a given spec file. Both scripts call it. Nothing else parses front matter.

**Rationale**: `common.sh` already holds `read_feature_json_feature_directory` with the
same shape: a safe reader that never aborts its caller under `set -e`, with a parser
ladder of `jq`, then `python3`, then `grep`/`sed`. The declaration reader follows that
existing pattern rather than inventing a second one.

**Alternatives considered**: a YAML library. Rejected: the repository ships no YAML parser,
the scripts must run on a bare macOS, Linux and Windows-bash checkout, and the declaration
is two keys with fixed value sets. `grep` and `sed` over the block between the first two
`---` lines is enough and adds no dependency.

## How the front matter is delimited

**Decision**: the declaration is the block between the first `---` line and the next `---`
line, and only when the first `---` is the first line of the file.

**Rationale**: it is the convention every static site generator uses, so an author who has
seen front matter anywhere will recognize it. Restricting it to the top of the file means
a `---` used as a horizontal rule later in a spec is never mistaken for a declaration. The
existing specs use `---` as a separator between user stories, which is exactly the case
this rule has to survive.

## Where the automated check runs

**Decision**: a new `scripts/tests/spec-scaffold.test.js`, picked up automatically by
`scripts/smoke-test.js`.

**Rationale**: `smoke-test.js` reads `scripts/tests/` and imports every `*.test.js` in name
order. Adding a file is the whole registration step, and CI already runs `node
scripts/smoke-test.js` on three platforms across three Node versions. The test reads files
only, so it costs the same everywhere.

**Alternatives considered**: a separate CI job. Rejected: it would run the check once
rather than on every platform, and it would need its own workflow entry to stay alive.

## Why no check reads git history

**Decision**: nothing in this feature reads git history.

**Rationale**: the design's original fourth assertion compared commit scopes to spec
directories. CI checkouts are shallow by default, so that assertion would have skipped in
every CI run and only ever executed on a developer's full clone, which is a guard rail that
does not guard. Rather than configure fetch depth for a check of secondary value, the
assertion is dropped and the convention documented instead.

**Alternatives considered**: `fetch-depth: 0` on the checkout step. Rejected: it makes every
CI run clone the full history of the repository to enforce a naming convention, and the
cost lands on all nine matrix cells.

## What the existing 21 specs already declare

**Decision**: the backfill values are determined by what is on disk, not by judgment.

| Track | Directories |
|---|---|
| full (has `plan.md` and `tasks.md`) | 001 through 016, and 019 |
| quick (`spec.md` only) | 017, 018, 020, 021 |

**Rationale**: read directly by testing for `plan.md` in each of the 21 directories. Every
directory falls cleanly into one of the two sets; none has a plan without tasks or the
reverse.

**Status values**: all `done` except `003-status-change-animations`, which has 22 checked
tasks and 16 unchecked. It is backfilled `active`, which makes it the one directory that
must be resolved before FR-019 can be enforced.

## The pointer in CLAUDE.md

**Decision**: the check compares the path inside the `<!-- SPECKIT START -->` block against
`.specify/feature.json`, matching on the feature directory rather than on the full string.

**Rationale**: the block holds a plan path (`specs/019-explaining-a-segment/plan.md`) while
`feature.json` holds a directory (`specs/022-spec-tracks`). Comparing directories means the
check passes whether the block names the directory, the plan, or the spec, and fails only
when the two genuinely name different features. A quick-track feature has no plan path to
name, which is another reason not to compare full strings.
