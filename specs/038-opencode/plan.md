# Plan: the bar inside OpenCode

**Spec**: [spec.md](./spec.md)

## Shape

```
OpenCode TUI (Bun)                         this clone (Node)
┌──────────────────────────────┐
│ src/opencode/tui.tsx         │  payload on stdin   ┌─────────────────────┐
│  api.state ─► snapshot ──────┼────────────────────►│ bin/cli.js render   │
│  opencodePayload(snapshot)   │                     │  (the normal bar)   │
│  slot app_bottom ◄── spans ◄─┼─────────────────────┤  ANSI on stdout     │
│  parseAnsi(stdout)           │                     └─────────────────────┘
└──────────────────────────────┘
```

## Decisions

1. **A TUI plugin, not a pane.** Codex needed a tmux pane because it loads nothing from outside.
   OpenCode loads plugins and gives them a slot under the prompt, which is where the bar sits in
   Claude Code. The person needs no tmux and sees the bar in the same window.
2. **The renderer runs in a child process.** The renderer calls git and gh with blocking calls
   bounded to about 300 ms. Inside OpenCode's process that would freeze its screen on every
   redraw. A child keeps OpenCode responsive, and the bar under OpenCode is the same program
   Claude Code runs, so a fix to one is a fix to both. The cost is one `node` start per redraw.
   Redraws are debounced, so that is a few per turn, not a few per second.
3. **The payload is built by a plain module.** `src/opencodePayload.js` turns a snapshot of
   `api.state` into Claude Code's payload shape. It has no OpenCode imports, so the suite tests
   it under Node with fixtures. The `.tsx` file only gathers the snapshot, runs the child and
   draws.
4. **ANSI becomes spans.** OpenCode's text elements take colours, not escape codes.
   `src/opencode/ansi.js` turns the renderer's output (24-bit `38;2`/`48;2`, reset, OSC 8 links)
   into lines of `{ text, fg, bg }` runs. Any other escape is dropped.
5. **Activity travels in the payload.** Claude Code's working state and todo come from its
   transcript. OpenCode has none, so the payload's `opencode.activity` carries `working` and
   `todos`, and `harnessProbes` answers `getSessionActivity` from it, the way Codex's pane
   passes its own.
6. **Install edits `tui.json` as data.** JSONC is read with comments stripped, the file is
   backed up before any write, and the entry is the plugin file's absolute path. A file plugin
   needs an `id`; it is `statusline-plugin`.

## Files

| File | Change |
|---|---|
| `src/opencodePayload.js` | new: snapshot to payload, activity |
| `src/opencode/ansi.js` | new: ANSI to runs |
| `src/opencode/tui.tsx` | new: the OpenCode plugin |
| `src/harness.js` | detect `opencode` |
| `src/render.js` | probes and absent windows under OpenCode |
| `src/doctor.js` | pass the payload to the probes |
| `src/install.js` | `installHarness`/`uninstallHarness`/`harnessStatus` for OpenCode |
| `bin/cli.js` | `--harness opencode` |
| `README.md` | the OpenCode section and the comparison table |
| `.specify/memory/constitution.md` | III and IV: the new source and the new install target |

## Risks

- OpenCode's plugin API is young (v1). The plugin touches only `api.state`, `api.slots`,
  `api.event`, `api.renderer` and `api.lifecycle`, and treats every field as optional.
- The renderer's width is OpenCode's terminal width, passed as `COLUMNS`.
