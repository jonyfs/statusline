# Implementation Plan: Two spec tracks, and a scaffold that cannot lie

**Branch**: `main` (no feature branch; this repository works on `main`) | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-spec-tracks/spec.md`

## Summary

A spec declares its own shape in YAML front matter, and the scaffold requires only what
that declaration promises. Two shell scripts stop assuming every feature produces a plan,
all 21 existing specs get a declaration matching what is already on disk, and a new test in
the existing suite fails whenever the scaffold stops describing reality. No runtime code
changes.

The approach comes out of reading the code rather than designing against it: path
resolution in `common.sh` is already track-agnostic, so the whole change is one new reader
function, two narrowed conditions, 21 front matter blocks, and one test file.

## Technical Context

**Language/Version**: bash (the `.specify/scripts/bash/` scripts) and Node.js 18+ (the test)

**Primary Dependencies**: none added. The declaration reader uses the `jq` / `python3` /
`grep` ladder already present in `common.sh`. The test uses `node:fs`, `node:assert/strict`
and the repository's own `scripts/test-harness.js`.

**Storage**: files on disk. `specs/*/spec.md` front matter and `.specify/feature.json`.

**Testing**: `node scripts/smoke-test.js`, which imports every `scripts/tests/*.test.js`.

**Target Platform**: Linux, macOS and Windows, Node 18, 20 and 22, per the CI matrix.

**Project Type**: developer tooling inside an existing CLI project. The scaffold, not the
renderer.

**Performance Goals**: the new test reads at most 21 small files plus two pointers. It must
not measurably lengthen the suite, and it must not read git history or the network.

**Constraints**: no new dependency; no change to any file under `src/`; the enforcement
must not land before the declarations it enforces.

**Scale/Scope**: 21 spec directories today, growing by a handful a year. Four files
modified, one file created, 21 files given a four-line header.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Relevance | Verdict |
|---|---|---|
| I. Starship-Compatible Output | no renderer change | not engaged |
| II. Three-Line Display Structure | no renderer change | not engaged |
| III. Token Tracking Grounded in Real Data | no renderer change | not engaged |
| IV. Installable by Clone | nothing installed or published changes; `package.json` `files` does not include `specs/` or `.specify/` | pass |
| V. Integration Documentation & Configuration Guide | the workflow description file is updated by FR-021, so the documented process matches the real one | pass |
| VI. English-Only Codebase | spec, plan, research, data model, contract, quickstart, the new test and every front matter block are in English | pass |
| VII. MVP-First, Local-Then-GitHub | runs locally with `node scripts/smoke-test.js` and `bash check-prerequisites.sh`, no service required | pass |
| VIII. Documentation Shows Generated, Not Hand-Drawn, Output | this feature applies the same rule to the scaffold: a pointer that disagrees with reality fails the build. No preview is regenerated because no renderer file changes | pass |
| IX. Runs on Linux, macOS and Windows | the test reads files with `node:fs` and no shell; the scripts changed are bash, which CI runs on all three platforms already | pass |
| X. Icons Carry Live State | no renderer change | not engaged |
| XI. Releases Are Tag-Driven and Verified | deliberately untouched. The principle describes a flow that has not run since v1.2.7 while the version reads 1.18.0; repairing that contradiction needs its own decision and its own amendment | deferred, recorded in the spec |

Post-Phase-1 re-check: unchanged. The design added no dependency, no platform-specific
code, and no renderer contact. The one open item is XI, which this feature declines to
touch rather than violating.

**Violations requiring justification**: none.

## Project Structure

### Documentation (this feature)

```text
specs/022-spec-tracks/
├── plan.md              # This file
├── spec.md              # Clarified, 22 functional requirements
├── research.md          # Phase 0: where the failure lives, what parses what
├── data-model.md        # Phase 1: the declaration, the pointer, the transitions
├── quickstart.md        # Phase 1: eight runnable validations
├── contracts/
│   └── scaffold-cli.md  # Phase 1: exit codes and exact failure messages
├── checklists/
│   └── requirements.md  # Quality checklist, 16/16
└── tasks.md             # Phase 2 output, created by /speckit-tasks
```

### Source (repository root)

```text
.specify/
├── feature.json                      # pointer, must name an existing directory
├── scripts/bash/
│   ├── common.sh                     # + read_spec_declaration
│   ├── check-prerequisites.sh        # plan/tasks requirement narrows to the declaration
│   └── setup-tasks.sh                # same narrowing
├── templates/spec-template.md        # + front matter, seeded quick/active
├── workflows/speckit/workflow.yml    # + both tracks described
└── memory/constitution.md            # + one principle, own version bump

scripts/
└── tests/spec-scaffold.test.js       # new, five cases, picked up by smoke-test.js

specs/*/spec.md                       # 21 files gain a four-line front matter block
```

**Structure Decision**: no new directory. The feature lives entirely in
`.specify/scripts/bash/`, `.specify/templates/`, `scripts/tests/`, and the front matter of
existing specs. `src/` is not touched, which is what keeps SC-006 true by construction
rather than by testing.

## Implementation Order

The order is a correctness requirement, not a preference. FR-016 says enforcement must not
precede the declarations it enforces.

1. **`read_spec_declaration` in `common.sh`.** New function, no caller yet. Safe to land
   alone: nothing changes behavior.
2. **Backfill 21 declarations, and narrow the two scripts, in one commit.** Splitting them
   breaks `main`: narrowed scripts without declarations reject every existing spec, and
   declarations without narrowed scripts leave the original failure in place.
3. **Template and workflow description.** Independent of the above; seeds new specs with
   `track: quick` and `status: active`, and makes `workflow.yml` describe both tracks.
4. **Resolve `specs/003-status-change-animations`.** A maintainer decision, not an
   implementation step. Until it is `done` or `abandoned`, two directories are `active` and
   the FR-019 case cannot pass. This blocks step 5 and nothing else.
5. **`scripts/tests/spec-scaffold.test.js`.** Five cases. Lands last because every
   condition it asserts has to already hold.
6. **Constitution amendment.** One new principle defining the tracks, with its own version
   bump. Principle XI is not touched.

## Risks

- **Step 4 is not ours to decide.** The plan can go no further than pointing out that spec
  003 has 16 unchecked tasks and that FR-019 needs an answer. If the maintainer wants the
  test sooner, `abandoned` with a recorded reason is the cheapest honest answer; inventing
  one here would be worse than waiting.
- **Front matter in 21 files is a large diff for a small idea.** It is four lines per file
  and mechanical, but it touches every spec in the repository. It lands in its own commit
  alongside the script change so the diff reads as one intent.
- **The `---` used as a separator inside existing specs.** The reader only treats a `---`
  as front matter when it is the first line of the file, which the existing specs' internal
  separators never are. The test in step 5 covers a spec whose body contains `---`.
