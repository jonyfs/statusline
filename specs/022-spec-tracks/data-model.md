# Data Model: Two spec tracks, and a scaffold that cannot lie

**Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

There is no database and no runtime state. The entities below are files on disk and the
fields they carry.

## Spec declaration

Lives at the top of every `specs/*/spec.md`, in YAML front matter delimited by a `---` line
as the first line of the file and the next `---` line after it.

```yaml
---
track: quick
status: active
---
```

| Field | Values | Required | Meaning |
|---|---|---|---|
| `track` | `quick`, `full` | yes | Which artifacts complete this feature |
| `status` | `active`, `done`, `abandoned` | yes | Where the feature is in its life |

Rules:

- Values are lowercase and matched exactly. `Quick`, `QUICK` and `quick ` (trailing space
  after trimming is impossible, but leading whitespace is trimmed) are handled as follows:
  surrounding whitespace is trimmed, then the value must equal one of the listed strings.
  Anything else is invalid.
- Both keys are required. A declaration with one key is invalid, and the error names the
  missing key.
- There is no inferred value. A spec with no front matter block is invalid.
- Keys other than `track` and `status` inside the block are ignored, so the block can carry
  other metadata later without breaking this reader.

### Artifact set by track

| Track | Required files in the feature directory |
|---|---|
| `quick` | `spec.md` |
| `full` | `spec.md`, `plan.md`, `tasks.md` |

Files beyond the required set are permitted. `research.md`, `data-model.md`,
`quickstart.md`, `contracts/` and `checklists/` are optional under both tracks.

### Enforcement by status

| Status | Artifact requirement | May be pointed at |
|---|---|---|
| `active` | not enforced, the work is in progress | yes, and only one directory may hold this status |
| `done` | enforced | yes |
| `abandoned` | not enforced | yes |

## Feature pointer

Two files name the current feature, and they must agree.

| Location | Form | Written by |
|---|---|---|
| `.specify/feature.json` | `{"feature_directory": "specs/NNN-name"}` | `create-new-feature.sh`, `_persist_feature_json` in `common.sh` |
| `CLAUDE.md`, between `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` | a path under `specs/NNN-name/` | `update-agent-context.sh` |

The two are compared on their feature directory segment, not on the full path. The agent
context block may name the directory, its plan, or its spec.

`.specify/feature.json` always names an existing directory. There is no value meaning "no
feature"; a finished directory is a valid pointer target.

## State transitions

```
        created by /speckit-specify
                  |
                  v
             status: active
             (pointer names it)
                  |
        +---------+---------+
        |                   |
        v                   v
   status: done      status: abandoned
   (artifacts          (reason recorded
    enforced)           in the spec body)
```

A feature moves out of `active` in the commit that closes it. Nothing automates the
transition; FR-019 makes a forgotten one visible, because only the pointed feature may be
`active` and the pointer moves on when the next feature is specified.

## Validation rules, mapped to requirements

| Rule | Requirement | Checked by |
|---|---|---|
| Declaration present and valid | FR-001, FR-006, FR-007 | `read_spec_declaration` in `common.sh` |
| Required artifacts present for a `done` feature | FR-004, FR-018 | `check-prerequisites.sh`, `spec-scaffold.test.js` |
| No artifact requirement while `active` or `abandoned` | FR-004, FR-005 | same |
| Exactly one `active` directory, and it is the pointed one | FR-019 | `spec-scaffold.test.js` |
| Pointer names an existing directory | FR-011, FR-020 | `spec-scaffold.test.js` |
| The two pointers agree | FR-013 | `spec-scaffold.test.js` |
| Every directory declares validly | FR-012 | `spec-scaffold.test.js` |
