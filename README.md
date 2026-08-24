# Claude Statusline (Catppuccin Powerline)

A four-line Catppuccin Powerline statusline for Claude Code: directory + git
branch + pull request, active skills, model + effort, and real token/rate-limit
usage (context window, 5-hour window, 7-day window) with reset countdowns.
Also shows `rtk` token-savings, when `rtk` is installed.

```
📁 statusline 🐙 main 🔃 ⬆2 🔀 PR #128 open
🧩 code-review 🧩 dataviz 🧩 artifact-design
🤖 Sonnet 5 ⚡ high
🧠 Context 21% ⏱️ 5h 11%  resets in 2h29m 📆 7d 76%  resets in 7h13m 🦀 rtk 81% saved
```

The reset-clock glyph () and the plain-git branch icon (non-GitHub
remotes) are Nerd Font icons copied from this machine's own
`starship.toml` — see "Where each icon comes from" below. Everything
else, including GitHub branch/PR, is color emoji, which needs no
special font and can't render as a blank box.

## How auto-update works

No daemon, no polling loop. Claude Code invokes the configured `statusLine`
command itself every time it re-renders the status bar, piping fresh session
JSON into the command's stdin — including exact context-window and rate-limit
percentages. This script reads that JSON, gathers a few more things (git, gh,
the session transcript, rtk) and prints the four lines — so it is always
current as of the last render tick without you doing anything.

## Install (local)

```bash
cd statusline
npm link
statusline-plugin install
```

This will:
- back up your current `~/.claude/settings.json` to
  `~/.claude/statusline/backups/settings.<timestamp>.json`
- add/replace the `statusLine` key so Claude Code calls this plugin
- leave every other setting untouched

Restart Claude Code (or start a new session) to see it.

## Uninstall

```bash
statusline-plugin uninstall
```

Removes the `statusLine` key only if it points at this plugin's `cli.js`.
Backups made on install are never deleted automatically.

## Configuration

Environment variables (set in your shell profile, or inline in the
`statusLine.command` string written to `settings.json`):

- `CLAUDE_STATUSLINE_FLAVOR` — `mocha` (default) | `frappe` | `macchiato` | `latte`
- `CLAUDE_STATUSLINE_ASCII=1` — disables the Powerline arrow separator for
  terminals without a Nerd Font installed
- `CLAUDE_STATUSLINE_DEBUG=1` — writes the raw stdin payload Claude Code
  sent to `~/.claude/statusline/debug-last-payload.json` on every render,
  for troubleshooting if a field's shape changes in a future Claude Code
  version

## Where each number comes from

- **Context %, 5-hour %, 7-day %, both reset countdowns** — read directly
  from Claude Code's own `context_window` and `rate_limits` stdin fields.
  Not estimated. There is no monthly figure: Anthropic's plan limits stop
  at a 7-day window, and this plugin doesn't invent a number to fill a
  slot Anthropic doesn't provide.
- **rtk savings %** — `rtk gain --format json`, only when `rtk` is
  installed; the segment is omitted otherwise.
- **Pull request info** — the `gh` CLI, authenticated, in a GitHub repo
  with an open PR for the current branch. Omitted if any of that is
  missing.
- **Active skills** — scanned from the current session's transcript for
  `Skill` tool calls. If Claude Code's transcript format changes, this
  degrades to showing no skills rather than crashing.

## Where each icon comes from

- **Branch (non-GitHub remote)** and **reset clock** — copied verbatim
  from this machine's own `~/.config/starship.toml` (`git_branch` and
  `time` module symbols), so they're proven to render in the Nerd Font
  that config already uses — not a guessed private-use codepoint.
- **Everything else** (directory, GitHub branch 🐙, ahead/behind 🔃,
  pull request 🔀, skills, model, effort, context, rate-limit windows,
  rtk) — color emoji. Starship has no built-in GitHub/PR module, so
  there was no proven codepoint to copy for those two; a guessed
  private-use codepoint risks rendering as a blank box, so emoji is used
  instead everywhere there's no verified Starship glyph to reuse.

## Clickable names

The directory, branch, and PR segments on line 1 are OSC 8 terminal
hyperlinks — the visible text stays exactly what you see (no URL is ever
printed), but it's clickable in terminals that support OSC 8:

- **Directory** → on iTerm2 and Terminal.app, opens a new tab in that
  same app, `cd`'d into the directory (via a generated `.command`
  script and AppleScript). Any other terminal (Warp, VS Code's
  integrated terminal, kitty, WezTerm, ...) has no automation target
  from here, so it falls back to a plain `file://` link, which most
  terminals resolve to revealing the folder in Finder.
- **Branch** → the branch's tree view on GitHub (built from `git remote
  get-url origin`), only when a remote is configured.
- **PR** → the pull request's page on GitHub, only when one is open.

Terminals without OSC 8 support just show the plain text, unaffected.

## Troubleshooting

- **Icons show as boxes/question marks**: your terminal font isn't a Nerd
  Font, or doesn't support color emoji. Install one (e.g. MesloLGS NF,
  FiraCode Nerd Font) or set `CLAUDE_STATUSLINE_ASCII=1`.
- **Nothing changed after install**: restart your Claude Code session —
  `settings.json` is read at startup.
- **A percentage shows `?%`**: Claude Code's payload didn't include that
  field this time (older client version, or a startup render before the
  session has any usage yet).
- **Clicking the directory doesn't open a new tab**: only iTerm2 and
  Terminal.app are supported; other terminals fall back to a Finder
  reveal. The first click may also trigger a one-time macOS Automation
  permission prompt for the terminal app.
- **Want the stock statusline back**: run `statusline-plugin uninstall`.
