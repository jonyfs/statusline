# Contract: scaffold command-line behavior

**Date**: 2026-09-23 | **Spec**: [spec.md](../spec.md)

This feature's external interface is the behavior of two shell scripts and one test. What
follows is what a caller may rely on.

## `check-prerequisites.sh`

Existing options are unchanged: `--json`, `--require-tasks`, `--include-tasks`,
`--paths-only`, `--help`. `--paths-only` still performs no validation.

### Exit codes

| Code | Condition |
|---|---|
| 0 | Every requirement the declaration implies is satisfied |
| 1 | Any failure below |

### Failure messages

Each goes to stderr, one situation per message. The wording is part of the contract because
the person reading it is fixing a file by hand.

```
ERROR: Feature directory not found: <dir>
Run /speckit-specify first to create the feature structure.
```

```
ERROR: spec.md not found in <dir>
Run /speckit-specify first to create the feature structure.
```

```
ERROR: <dir>/spec.md declares no valid track (expected quick|full)
Add a front matter block at the top of spec.md with track: and status: keys.
```

```
ERROR: <dir>/spec.md declares no valid status (expected active|done|abandoned)
Add a front matter block at the top of spec.md with track: and status: keys.
```

```
ERROR: plan.md not found in <dir>
This feature declares the full track. Run /speckit-plan first to create the implementation plan.
```

```
ERROR: tasks.md not found in <dir>
This feature declares the full track. Run /speckit-tasks first to create the task list.
```

The track message and the status message are distinct, so a reader can tell which key is
wrong without opening the script. This is FR-007.

### When artifacts are required

`plan.md` and `tasks.md` are required only when `track` is `full` **and** `status` is
`done`. Under `active` or `abandoned` their absence is not an error, so a full-track
feature can be specified, planned and broken into tasks in that order without the check
failing in between.

`--require-tasks` continues to require `tasks.md` regardless of declaration, because a
caller passing it is about to implement and genuinely needs the file.

## `setup-tasks.sh`

Same declaration rules and the same two messages for an invalid declaration. Its existing
`plan.md` requirement narrows in the same way: required for a `full` feature at `done`,
not otherwise. Its output shape (`FEATURE_DIR`, `AVAILABLE_DOCS`, `TASKS_TEMPLATE`) does
not change.

## `read_spec_declaration` in `common.sh`

```
read_spec_declaration <spec-file-path>
```

Prints two lines to stdout and returns 0 whenever it can read the file:

```
SPEC_TRACK=quick
SPEC_STATUS=active
```

An absent block, an absent key, or an unrecognized value prints an empty value for that
key rather than failing, leaving the caller to produce the message its own context calls
for. The function never aborts its caller under `set -e`, matching
`read_feature_json_feature_directory` alongside it.

## `scripts/tests/spec-scaffold.test.js`

Runs under `node scripts/smoke-test.js` like every other case. Reads files only: no
network, no subprocess, no git history. One assertion per named case, so a failure names
what broke:

| Case | Fails when |
|---|---|
| the pointer names a directory that exists | `feature.json` names a missing directory |
| every spec declares a track and a status | any directory under `specs/` has an invalid or absent declaration |
| a finished feature has what its track promises | a `done` full-track directory lacks `plan.md` or `tasks.md` |
| only the pointed feature is in progress | a second directory declares `active` |
| both pointers name the same feature | the `CLAUDE.md` block and `feature.json` disagree |

Extra files beyond a track's required set never fail a case (FR-018).
