---
track: quick
status: done
---

# Render-only build for a host

**Feature Branch**: `feat/061-render-only`

**Created**: 2026-10-13

**Status**: Done

**Input**: The fourth of the separate specs named in spec 056. A host that vendors the renderer
copies `bin/` and `src/` whole (Astrolabe's sync script keeps 47 modules and removes only
`src/preview`), including the install, doctor and Codex launcher and pane modules it never
calls. This builds the smaller copy from the import graph.

**Track**: `quick`: one build script and its test.

## Requirements

- **FR-001**: `node scripts/build-render-only.js [outDir]` (default `dist/render-only`) writes
  `bin/cli.js`, the `src/` modules reachable from `render.js`, `config.js`, `runs.js`,
  `printConfig.js`, `refresh.js` and `paths.js` by static and literal dynamic imports,
  `package.json`, `LICENSE` and a `VERSION` file with the version, the commit, the contract
  number, `"build": "render-only"` and the module count.
- **FR-002**: The closure is read from the import graph, so a module the renderer starts to need
  is in the build without anyone listing it.
- **FR-003**: The build draws every shared fixture (spec 060) as the full copy does, answers
  `--version` and `--print-config`, and runs the detached refresh the same way.
- **FR-004**: A command that was left out (`install`, `doctor`, `codex`) fails with the missing
  module and a non-zero exit; the render path is unaffected.
- **FR-005**: `dist/` is not committed.

## Measured

On 1.57.0 the build is 39 of 52 modules and 446 KB of 605 KB of source (74%): the Copilot and
Codex readers, the gate and task rows and the transcript tail are part of the render path, so
they stay. What goes is the installer, the doctor, the Codex launcher and pane, the OpenCode glue
and the preview converter (13 modules, 26%). A host that wants less has to drop a harness, which
is a separate decision.

## Success criteria

- **SC-001**: The suite renders all shared fixtures from the build and compares them with the
  expected rows.
- **SC-002**: The suite finds no `install`, `doctor` or Codex launcher module in the build.
