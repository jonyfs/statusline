---
track: full
status: done
---

# Links that open on Linux as they do on macOS and Windows

**Feature Branch**: `fix/080-linux-link-opening`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description: "revise o motivo pelo qual o statusline não está abrindo os links no
linux, foi testado no ubuntu e falhou, corrija para que os links sejam abertos no macos, windows e
linux"

**Track**: `full`. The cause is not yet confirmed (see "What is known"), the fix may land in the
renderer, the doctor and the docs, or only in the last two, and a reviewer will ask why the bar
does or does not change on Linux. A `plan.md` and a `tasks.md` follow this spec.

## Context: what is known, and what is not

Measured on 2026-11-26 against `main` at `d8e0bcb` (v1.67.0), on the owner's machine (macOS,
Node 24). Linux was not available for this audit; every Linux claim below that was not measured
is marked **unverified**.

### What the bar prints is the same on every platform (measured)

The bar emits links unconditionally. Nothing in the path from a segment's `url` to the output
looks at the platform, `TERM`, `TMUX`, `VTE_VERSION` or `TERM_PROGRAM`:

- `src/theme.js:312` writes every link as `ESC ] 8 ; ; <url> BEL <text> ESC ] 8 ; ; BEL`.
- `src/theme.js:342` adds a dotted underline only where the terminal is known to draw one
  (`VTE_VERSION >= 5000` included); the link itself is written either way.
- `src/theme.js:216` reads `TMUX`, for colour depth only.
- `src/text.js` strips control characters from *values*, never from the bar's own escapes.

Running `bin/cli.js` with a Linux-like environment (`env -i`, `TERM=xterm-256color`,
`VTE_VERSION=7600`, no `TERM_PROGRAM`) prints well-formed OSC 8 sequences for:

| Link | Target printed |
|---|---|
| directory | `file:///Users/.../statusline` (no host name) |
| repository, branch | `https://github.com/<owner>/<repo>/tree/<branch>` |
| CI | `https://github.com/<owner>/<repo>/actions?query=branch%3A<branch>` |
| credits | `https://claude.ai/settings/usage` |
| help `?` | `https://jonyfs.github.io/statusline/` |

So the bytes are correct and platform-neutral. If the https links fail on Ubuntu too, the
failure is downstream of the bar: in Claude Code, a multiplexer, or the terminal.

### Directory link by platform (from the code)

`src/openTerminalTab.js:29` returns no script off macOS by design, so on Linux and Windows the
directory chip links to a bare `file:///path` URL that the OS hands to its file manager. macOS
with iTerm2 or Terminal.app gets a generated `.command` script that opens a tab.

### Candidate causes, ranked by how likely they are on a stock Ubuntu (unverified)

1. **Claude Code does not pass OSC 8 through to that terminal.** Public reports describe the
   status line keeping colours but dropping links: on Konsole while VS Code's terminal works,
   and as regressions in specific releases (2.1.181, 2.1.186). Not something this repository
   can fix; something it can detect and explain.
   Sources: [Konsole](https://claudeissues.com/issue/26356-osc-8-hyperlinks-in-custom-statusline-work-in-ide-terminals-but-not-in-real-term),
   [regression 2.1.181](https://claudeissues.com/issue/70161-bug-statusline-osc-8-hyperlinks-no-longer-clickable-regression-in-2-1-181),
   [ESC stripped](https://claudeissues.com/issue/70421-bug-osc-8-hyperlink-escape-sequences-stripped-in-statusline-output),
   [stripped in statusline](https://claudeissues.com/issue/45173-osc-8-hyperlinks-stripped-in-statusline-output).
2. **tmux between Claude Code and the terminal.** tmux drops OSC 8 unless the outer terminal
   is declared with the `hyperlinks` feature (tmux 3.4+), and even then Claude Code's own
   rendering inside tmux has been reported broken.
   Sources: [tmux render](https://claudeissues.com/issue/23438-bug-custom-statusline-osc-8-hyperlinks-dont-render-inside-tmux),
   [tmux analysis](https://claudeissues.com/issue/37216-bug-osc-8-hyperlinks-in-custom-statusline-broken-inside-tmux-rendering-layer-ana).
3. **The gesture.** GNOME Terminal (VTE), Ubuntu's default, opens a link on Ctrl+click, not on
   a plain click. The README never says how to click on any platform.
4. **SSH into the Ubuntu box.** The link is opened by the machine running the terminal, not the
   one running the bar: https links still work, but a `file:///home/...` directory link names a
   path on another computer and opens nothing, or the wrong thing.
5. **The `file://` form.** Some terminals may expect `file://<hostname>/path` per the OSC 8
   convention, or the desktop may have no handler for a folder URL. Lowest-ranked until a real
   Ubuntu run shows it.

### The reported test (clarified 2026-11-26)

The owner's Ubuntu test failed for **every** link, https included, in **GNOME Terminal**, with
Claude Code running **inside tmux**, on a machine reached **over SSH**, using a **plain click**.
That setup hits candidates 2, 3 and 4 at once, and any of 2 or 3 alone is enough to make every
link look dead:

- a plain click in VTE does nothing (the link opens on Ctrl+click);
- tmux without the `hyperlinks` feature drops the sequence before the terminal sees it;
- over SSH, the folder link names a path on the remote machine.

Candidate 1 (Claude Code) is not ruled out and candidate 5 is not shown. The fix for this report
is therefore mostly outside the renderer: the doctor must name these conditions, the README
must say what to change, and the folder link must be left out over SSH. FR-001 still requires
the reproduction, one condition removed at a time, to confirm which layer drops the link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A web link on the bar opens the browser on Ubuntu (Priority: P1)

A person on Ubuntu, in the default terminal, clicks the branch, the pull request, the CI chip,
the credits chip or the `?` and the page opens in their browser, exactly as it does on macOS.

**Why this priority**: These are most of the bar's links and they are the ones reported broken.
They need nothing from the local disk, so they must work wherever the terminal supports links.

**Independent Test**: On Ubuntu 24.04 in GNOME Terminal, outside tmux and not over SSH, open a
Claude Code session in a repository with a pull request and use the terminal's link gesture on
each web chip.

**Acceptance Scenarios**:

1. **Given** Ubuntu with GNOME Terminal and a Claude Code version that passes links through,
   **When** the person Ctrl+clicks the branch chip, **Then** the tree view opens in the default
   browser.
2. **Given** the same setup, **When** the person Ctrl+clicks the `?`, **Then** the help page
   opens in the browser.
3. **Given** a terminal or Claude Code version that drops links, **When** the person runs the
   doctor, **Then** it says links cannot be clicked in this setup, why, and what to change.

---

### User Story 2 - The folder link opens the folder on Linux and Windows (Priority: P2)

A person on Ubuntu or Windows clicks the directory chip and their file manager opens on that
folder. On macOS with iTerm2 or Terminal.app it still opens a terminal tab there.

**Why this priority**: One link, local only, and with a documented fallback; it matters, but
less than the web links.

**Independent Test**: Click the directory chip on Ubuntu (GNOME Terminal, Files), Windows
(Windows Terminal, Explorer) and macOS (iTerm2, Terminal.app, Ghostty).

**Acceptance Scenarios**:

1. **Given** Ubuntu with a desktop session, **When** the person Ctrl+clicks the directory chip,
   **Then** the file manager opens on the working directory.
2. **Given** Windows Terminal and a path with a space or a drive letter, **When** the person
   Ctrl+clicks the directory chip, **Then** Explorer opens on that folder.
3. **Given** the bar is running on a machine reached over SSH, **When** the bar is drawn,
   **Then** the directory chip carries no link (a path on another machine cannot be opened
   here), and the web links stay.

---

### User Story 3 - The person can tell why a link does not open (Priority: P3)

A person whose links do nothing runs the doctor and reads, in one place, what stands between the
bar and a working click: the gesture for their terminal, tmux without the `hyperlinks` feature,
an SSH session, or a Claude Code version known to drop links.

**Why this priority**: Most causes are outside this repository. Saying which one applies is the
fix the plugin can actually deliver for them.

**Independent Test**: Run the doctor with fixture environments for each condition and check the
lines it prints.

**Acceptance Scenarios**:

1. **Given** `TMUX` is set and tmux does not declare `hyperlinks` for the outer terminal,
   **When** the doctor runs, **Then** it names the tmux setting that enables links
   (`set -as terminal-features ',*:hyperlinks'`) and the tmux version it needs.
2. **Given** the owner's reported setup (GNOME Terminal, tmux, SSH), **When** the doctor runs,
   **Then** it prints all three lines, in the order a person should fix them: gesture, tmux, SSH.
3. **Given** `SSH_CONNECTION` is set, **When** the doctor runs, **Then** it says the folder link
   is left out over SSH and web links open on the local machine.
4. **Given** VTE is the terminal, **When** the doctor runs, **Then** it says links open on
   Ctrl+click.

### Edge Cases

- A working directory with spaces, `#`, `?`, `%` or non-ASCII characters: the folder link still
  opens the right folder on all three platforms.
- A WSL session in Windows Terminal: the path is a Linux path on a Windows desktop; the folder
  link must open the folder or be left out, never open a wrong one.
- A headless Ubuntu (server, no desktop): web links may still open on the client terminal; the
  folder link has nowhere to go.
- A container or devcontainer: same as SSH for the folder link.
- `TERM_PROGRAM=iTerm.app` on Linux (forwarded over SSH): no `.command` script is written; this
  is already guarded and must stay so.
- A terminal that draws no underline: the link still works, it just is not marked.
- A passive render (composer, previews): no file is written, links are as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Before a fix is chosen, the reported setup (GNOME Terminal, tmux, SSH) MUST be
  reproduced on a real Ubuntu machine, removing one condition at a time: Ctrl+click instead of a
  plain click; tmux with `hyperlinks` declared, then no tmux; local session instead of SSH. At
  each step a raw `printf` OSC 8 link, the bar outside Claude Code and the bar inside Claude Code
  are tried, so the layer that drops the link is named. The result is recorded in this spec.
- **FR-002**: Every web link on the bar (repository, branch, CI, pull request, alerts, credits,
  help) MUST open in the default browser on macOS, Windows and Linux in any terminal that
  supports OSC 8, when the host passes the sequence through.
- **FR-003**: The directory link MUST open the folder in the file manager on Linux and Windows,
  and MUST keep opening a terminal tab on macOS with iTerm2 or Terminal.app. A new terminal tab
  on Linux or Windows is out of scope.
- **FR-004**: When the bar runs in an SSH session, the directory and project-directory links
  MUST be left out; the chips' text and width MUST not change.
- **FR-005**: If FR-001 shows the bare `file:///path` form is not accepted by a supported Linux
  terminal, the folder link MUST use the form that terminal accepts (for example, with the local
  host name), and the change MUST keep macOS and Windows working.
- **FR-006**: If FR-001 shows a supported terminal ignores the BEL terminator, links MUST use
  the ST terminator instead, on every platform, and the width counter MUST still treat the
  sequence as zero-width.
- **FR-007** *(amended in plan.md: the Claude Code check is a `printf` test, not a version
  table)*: The doctor MUST report, when the environment shows them: tmux without the
  `hyperlinks` feature (read from tmux's own server options, inside the doctor only, never
  from a redraw), a tmux older than the first version with that feature, an SSH session, a VTE terminal (Ctrl+click), and a Claude Code version
  known to drop status-line links. Each line MUST say what to do.
- **FR-008**: The README's "Clickable names" section MUST state the gesture per platform
  (Cmd+click on macOS terminals that need it, Ctrl+click on GNOME Terminal and Windows
  Terminal), the tmux setting, the SSH behaviour, and the dependency on Claude Code passing
  links through. Its stale paragraph saying the `?` opens a page from the local disk MUST be
  corrected: it opens the published https page (`src/helpLink.js`).
- **FR-009**: The bar MUST NOT open anything itself (no `xdg-open`, `start` or `open` from a
  redraw). Opening a link stays the terminal's job.
- **FR-010**: Tests MUST pin the exact link bytes for a Linux, a Windows and a macOS
  environment, including a Windows drive path and a path with spaces and `#`, and the SSH case.
- **FR-011**: No new runtime dependency.

### Key Entities

- **Link kind**: web (opens in the browser, works anywhere the link reaches the terminal) or
  local folder (opens on the machine running the terminal, so only valid when that is the
  machine running the bar).
- **Link environment**: platform, terminal, multiplexer, remote session, Claude Code version;
  what the doctor reads to say whether a click can work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On Ubuntu 24.04 in GNOME Terminal, outside tmux and SSH, with a Claude Code version
  that passes links through, 7 of 7 web link kinds open the right page in the browser.
- **SC-002**: The directory chip opens the right folder on Ubuntu (Files), Windows (Explorer,
  Windows Terminal) and macOS (iTerm2 and Terminal.app open a tab; Ghostty opens the folder),
  including a path with a space and a `#`: 3 of 3 platforms.
- **SC-003**: For each of the four conditions in FR-007, the doctor prints its line in 100% of
  fixture cases and in none of the cases where the condition is absent.
- **SC-004**: Over SSH, no folder link is printed; outside SSH on macOS, the bar's output is
  byte-identical to v1.67.0 unless FR-005 or FR-006 applied.
- **SC-005**: In the owner's reported setup, after following the doctor's lines (Ctrl+click,
  tmux `hyperlinks`), 7 of 7 web link kinds open in the local browser.
- **SC-006**: A person whose links do not open can find the reason from the doctor or the README
  in under 2 minutes, without reading the code.

## Assumptions

- Claude Code renders the status line and decides whether OSC 8 reaches the terminal. When it
  drops links, this feature detects and explains; it does not work around the host.
- "Opens" means: web links in the default browser; the folder link in the file manager (Linux,
  Windows, Ghostty and other macOS terminals) or a terminal tab (macOS iTerm2, Terminal.app).
- The supported Linux terminals are GNOME Terminal and other VTE terminals, Konsole, kitty,
  WezTerm, Ghostty and VS Code's terminal; the supported Windows terminal is Windows Terminal.
  The legacy Windows console host has no OSC 8 and is out of scope.
- Ubuntu 24.04 LTS with a desktop session is the reference Linux. Over SSH, "the browser" is the
  one on the machine running the terminal.
- Wrapping links in tmux's DCS passthrough from the bar is not assumed: it needs
  `allow-passthrough`, goes through Claude Code's renderer first, and the plan decides whether
  it is worth it.
- The owner or a contributor can run the FR-001 reproduction on Ubuntu; it cannot be done from
  the owner's macOS machine.

## Outcome

Shipped in the release after v1.67.0. The bar's link bytes were not changed (FR-005 and FR-006
did not apply); folder links are left out over SSH; `doctor` prints `links:` lines for the
gesture, tmux and SSH, and a `printf` test that tells the terminal from Claude Code; README and
the help page (four languages) say how to click on each platform. SC-001, SC-002 and SC-005
need a run on Ubuntu and Windows by the owner; SC-003, SC-004 and SC-006 are covered by
`scripts/tests/linux-links.test.js` and the docs.
