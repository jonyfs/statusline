---
track: quick
status: done
---

# Gate scripts run without a hook

**Feature Branch**: `feat/direct-gates`

**Created**: 2026-10-06

**Input**: The workflow's computed task for feature 036. Feature 031 shows a gate only when it
is a git hook (its parent is git) or a held `<gitdir>/gates.lock`. Agents often run gate scripts
directly from Claude's Bash tool, as `python3 .claude/scripts/gate-orcamento.py` or
`bash .claude/scripts/gates.sh`, and those runs were invisible.

**Track**: `quick`. One module owns the change (`src/gateRuns.js`), with `src/config.js`
reading one more key.

## Evidence

- `specs/031-git-gate-rows/research.md` reads hooks by their git parent and locks by
  `gates.lock/pid`. Nothing else was a run.
- The owner's barbershop repository (read only, names checked, nothing run) keeps
  `.claude/scripts/gates.sh`, `gates-lib.sh` and 40-odd `gate-*.py`, `gate-*.js`,
  `gate-*.mjs` and `gate-*.test.sh` scripts. `gates.sh` runs the others, and an agent runs
  either one by hand.
- On this machine `ps -A -o pid=,ppid=,etime=,command=` lists `python3 gate-demo.py` as
  `/Users/<user>/.pyenv/versions/3.14.8/bin/python3 gate-demo.py`. Framework builds of Python
  on macOS list as `.../Python.app/Contents/MacOS/Python`, so the interpreter is recognised by
  its name, case and version suffix aside.

## What counts as a direct run

A process is a direct run's root when all of these hold:

1. **Its script matches the repository's gate patterns.** The script is the interpreter's
   script argument (`bash`, `sh`, `zsh`, `python3`, `node`, `tsx`, `npx`, `env`, `deno`,
   `bun` and the rest, flags skipped) or, for any other program, the command itself. An inline
   command (`bash -c`, `python -m`, `node -e`) has no script; its children do.
2. **No git hook is above it.** The hook's row already shows it (no duplicate rows).
3. **No matching script is above it.** `gates.sh` running `gate-x.py` is one run.
4. **Its working directory is inside one of the repository's worktrees.** As for hooks, an
   absolute script path places it when the working directory cannot be read, and the
   previous probe's placement is kept for the same pid started at the same moment.

Default patterns: a basename that starts with `gate` or `gates` followed by `-`, `_` or `.`
(case aside), or a file whose own directory is named `gates`. Only the immediate directory
counts, so a repository cloned under `~/gates/` does not turn every script into a gate.

`.statusline.json` may replace the defaults:

```json
{ "gates": { "patterns": ["scripts/check-*.sh"] } }
```

Simple globs: `*` and `?` stay in one directory, `**` crosses them. A pattern with a `/`
matches the end of the script's path, one without its basename. `"patterns": []` turns direct
detection off. A `patterns` that is not a list, or holds no usable string, means the defaults.
`src/config.js` now reads six keys, and the README says so.

## The row

The same row as a hook's, with `gate` in the hook column and `kind: "direct"` on the run. The
step is the script's label, then ` › ` and the step under it as `stepOf` gives it, so
`gates.sh` running `gate-x.py` reads `gates.sh › gate-x.py`. A direct run whose `gates.sh`
stands at another run's held lock is `waiting`, like a hook.

**Lock dedupe.** When the held lock's pid is the run's root, inside it, or above it, the run is
not added. The lock's own row (named after the holder, aged by it) shows it exactly as before.

## Cost and failure

Still one probe in the detached refresh, never on the redraw path. The working directory
lookup (`/proc/<pid>/cwd` on Linux, `lsof -a -d cwd -p` on macOS) now asks about hook pids and
direct roots, and nothing else, so it costs nothing extra while no gate script runs. The
1.28 rules hold: lsof exit 1 with output is parsed, a missing `lsof` (ENOENT) degrades to
placing by absolute path, and a timeout or silent failure fails the probe so the last answer
stays. Windows still reads only the locks.

## Done when

- [x] Pure tests with fake ps and lsof output: direct script, nested gates, inside a hook,
  another repository, pattern override, patterns off, lock dedupe, waiting, lsof exit 1
  (`scripts/tests/direct-gates.test.js`).
- [x] A real `sh gate-demo.sh` sleeping in a temporary linked worktree is found by
  `probeGateRuns` on macOS and Linux (skipped on Windows).
- [x] README: the gates section and the feature matrix; the per-repository settings list six
  keys.
- [x] `docs/previews/gate-rows.svg` regenerated with a direct run's row.
- [x] Constitution II names gate scripts beside hooks (7.7.0).
