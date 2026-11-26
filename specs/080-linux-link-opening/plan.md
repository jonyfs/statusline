# Plan: 080 links that open on Linux

Spec: [spec.md](spec.md). Tasks: [tasks.md](tasks.md).

## What the clarification settled

The Ubuntu test was GNOME Terminal, inside tmux, over SSH, plain click, and every link failed.
The bar's bytes are already correct and platform-neutral (spec, Context), so the work is: say
what stands in the way, and stop drawing the one link that cannot mean anything over SSH.

## Decisions

### One module, `src/linkEnv.js`

Everything about "can a click work here" lives in one place, read by two callers:

- `isRemoteSession(env)`: `SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY`. The renderer reads it
  on each redraw (an environment lookup, no I/O).
- `linkGesture(env, platform)`: only terminals whose default is documented are named; anything
  else gets the generic sentence. Guessing a gesture would be worse than not naming one.
- `tmuxLinks(env, { run })`: `tmux -V` and `tmux show-options -sv terminal-features`, one second
  timeout each, constant argument lists. Doctor only: a redraw never spawns tmux.
- `linkStatus(env, ...)`: the doctor's `links:` lines, ordered gesture, tmux, SSH, host test.

### SSH: leave the folder links out (FR-004)

The chip keeps its text and its width; only the OSC 8 wrapper goes, and the probe skips the
open-tab script too, so no `.command` file is written for a link that is not drawn. A
`file://<host>/path` form was considered and rejected: the terminal's machine still has no
such folder.

### The Claude Code check (FR-007, amended)

The spec asked the doctor to name "a Claude Code version known to drop status-line links".
The public reports name versions but do not say which later release fixed each one, so a
version table would be a guess that goes stale. The doctor prints instead a one-line
`printf` test that tells the terminal and the host apart, which works for every version.

### FR-005 and FR-006 are not applied

Both were conditional on a reproduction (FR-001) that showed the bare `file:///` form or the
BEL terminator failing. The reported failure is fully explained by the gesture, tmux and SSH,
and the owner's own setup works with the current bytes, so neither changes. The bytes are now
pinned by a test, so a later change is deliberate.

### Docs

README "Clickable names" gains "When a link does not open" (gesture table, tmux line, SSH,
the `printf` test) and loses the stale paragraph that said `?` opens a page from disk. The help
page's `p5` and footer change in all four locales and `help/index.html` is regenerated; the
Pages workflow publishes it on merge. Constitution IX clarified (8.15.1).

## Not in scope

A terminal tab on Linux or Windows; wrapping links in tmux's DCS passthrough (needs
`allow-passthrough` and still goes through Claude Code's renderer first); the bar opening
anything itself.

## Review (PR #97, /code-review medium): eight findings, all addressed

- tmux state comes from the attached client (`#{client_termfeatures}`), which includes what
  tmux detects for itself (iTerm2); the option list is a fallback and counts only `*:hyperlinks`.
- `tmux -V` is compared as integers (3.10 is newer than 3.4); `openbsd-7.4`, `next-3.6` are
  unknown.
- Over SSH or inside tmux the terminal is not named: those variables describe the far side.
  The doctor lists the gestures per terminal instead. The test uses a real SSH+tmux env.
- VS Code Remote-SSH keeps folder links (VS Code opens them in the remote workspace).
- `remote` is a render option defaulting to the environment; the composer, previews and images
  generators pass `false`, so committed output does not depend on where it was built.
- The doctor's probe skips the open-tab script over SSH, as the bar does.
- A tmux pane's stale SSH variables cannot be detected without asking tmux on every redraw,
  which the bar does not do: documented in README and as a doctor line.
- README and help p5 no longer say tmux always needs the config line.
