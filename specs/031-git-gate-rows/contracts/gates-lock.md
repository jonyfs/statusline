# Contract: what the bar reads, and never writes

The bar is a reader of two things other tools own.

## The process list (Linux, macOS)

Read with `ps -A -o pid=,ppid=,etime=,command=` in the detached refresh only. A gate is a
process whose parent's command starts with `git` (or ends in `/git`) and whose command names a
file called after a hook in githooks(5). Nothing is sent to any process.

## `<git dir>/gates.lock/pid`

A convention of barbershop's `.claude/scripts/gates-lib.sh`, readable by any tool that wants the
same behaviour:

- `<git dir>` is the worktree's own git dir (`.git/worktrees/<name>` for a linked worktree).
- The directory exists while a run holds the lock; `pid` holds that run's process id.
- A `pid` that is not alive means a dead holder: the bar shows nothing for it.

The bar MUST NOT create, modify or remove the directory or the file.
