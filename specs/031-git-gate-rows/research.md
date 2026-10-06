# Research: Rows for git gates running in this repository's worktrees

All measurements on the reference machine (macOS, 2026-10-06), unless a line says otherwise.

## R1. How a running hook shows up

**Decision**: a running gate is a process whose parent is a `git` process and whose command line
names a script with a hook's name (`pre-commit`, `pre-push`, and the rest of githooks(5)).

**Rationale**: an experiment in a throwaway repository with a linked worktree:

| Setup | What `ps` showed for the hook |
|---|---|
| `core.hooksPath = .githooks` (relative), commit in the linked worktree | `bash .githooks/pre-commit`, parent `git commit -q --allow-empty -m a` |
| default hooks directory, commit in the linked worktree | `bash <main checkout>/.git/hooks/pre-commit` |
| barbershop, main checkout | `bash /Users/…/barbershop/.githooks/pre-commit` |

The path alone cannot name the worktree: it is relative in the first case and points at the main
checkout's git dir in the second, while the commit ran in the linked worktree. The parent being
`git` is what tells a hook apart from someone running the same script by hand.

**Alternatives considered**: matching on the path only (wrong worktree in two of three cases);
reading `index.lock` (exists during `pre-commit` but not `pre-push`).

## R2. Which worktree a hook runs in

**Decision**: the hook's working directory, matched against `git worktree list --porcelain` by
longest path prefix. Linux reads `/proc/<pid>/cwd`; macOS asks `lsof -a -d cwd -p <pids> -Fn`
once for all candidate pids; when neither answers, an absolute hook path under a worktree is
used; otherwise the hook is not shown.

**Rationale**: git runs hooks from the worktree's top level. `lsof` for one pid took 126 ms; it
runs only when a candidate hook exists, and only in the detached refresh (R4).

## R3. Waiting for the lock

**Decision**: per worktree, `<git dir>/gates.lock/pid` names the holder when that pid is alive
(`process.kill(pid, 0)`). A gate in that worktree whose process tree does not contain the holder
is waiting. A worktree's git dir is `.git` for the main checkout, and for a linked one the path
in its `.git` file (`gitdir: …`).

**Rationale**: this is barbershop's `acquire_gates_lock` (`.claude/scripts/gates-lib.sh`): a
`mkdir` lock per worktree git dir, holder pid written inside, a dead pid taken over by the next
run. The bar reads it and never writes it.

## R4. Cost, and where the lookup runs

**Decision**: the lookup runs in the existing detached refresh (`src/refresh.js`), cached per
session directory, never on the redraw path. A redraw reads the cached runs, drops any whose pid
is no longer alive, and starts a refresh when the entry is more than 5 seconds old.

**Rationale**: `ps -A -o pid=,ppid=,etime=,command=` from Node took 348 to 675 ms over five runs
with about 930 processes, while a gate was running. The redraw is allowed 300 ms in total
(`src/cache.js`). The pid check costs a system call per row and makes a finished gate disappear
on the next redraw rather than when the cache expires.

**Alternatives considered**: a synchronous lookup (over budget on its own); a cache shown only
while younger than a few seconds (at the installed 60-second refresh, a quiet session would never
show a row, since every redraw would find the entry expired).

## R5. Platforms

**Decision**: Linux and macOS run R1 to R3. Windows reads only R3's locks, with the age from the
lock directory's modification time, and spawns no process lookup.

**Rationale**: Windows has no `ps`; `Get-CimInstance Win32_Process` is slow and gives no working
directory. Principle IX allows a documented degradation.

## R6. Icons

**Decision**: running, `U+F0996` md-progress_clock; waiting for the lock, `U+F097F`
md-lock_clock. Plain mode: `⟳` and `⧖`.

**Rationale**: rendered from the installed FiraCode Nerd Font Mono with eleven other candidates
(`glyph-evidence.png`). The gate glyphs (`F0299` md-gate, `F0E86` md-boom_gate) read as a fence
and a crane at one cell. A clock reads as "still going", and a lock with a clock as "waiting on a
lock", before either is learned. The same sheet shows that `U+F0997`, which the CI chip uses as
"progress_clock", draws md-progress_download; that is recorded here and left to its own change.

## R7. Steps

**Decision**: the step is the chain of named processes under the hook, following the most
recently started child at each level, as at most two labels joined by `›`; when the hook has
several named children, their labels joined by ` · `. A label is the script's file name for an
interpreter (`bash`, `sh`, `node`, `python3`, `tsx`), else the program and its first two
arguments (`npm run lint`). A subshell repeating its parent's command is skipped.

**Rationale**: the live tree had `pre-commit` → `gates.sh` → `review-cycle.test.sh` →
`review-cycle.test.sh` (a subshell), and barbershop's hook starts `npm run -s lint`,
`npm run -s typecheck` and `npm test` side by side.
