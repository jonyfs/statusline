# Claude Statusline Plugin Constitution

<!-- 
Sync Impact Report:
- Version: 3.1.0 (two principles materially expanded)
- Modified: II. Four-Line Display Structure — line 1 now also carries working-tree state
  (tracked changes, untracked files). The count was already being computed and silently
  discarded, so the statusline could not answer "do I have uncommitted work?"
- Modified: X. Icons Carry Live State — adds three rules: git and GitHub state must use GitHub's
  own Octicons so the line reads in symbols its audience knows; every icon must be rendered and
  inspected before adoption, because Nerd Font codepoint names proved unreliable (F433
  "repo_push" draws a DOWN arrow, F45D "arrow_up" draws a signpost); and working-tree counts must
  not animate, since they change on every file save
- MINOR bump: both principles gain requirements without any existing rule being reversed
- Templates: no `.specify/templates/*` changes required
- Known limitation, documented rather than worked around: `behind` reflects the locally cached
  remote ref, so it means "commits already fetched but not merged". The statusline deliberately
  never fetches — it re-renders every few seconds, and hitting the network that often would be
  hostile to the user's connection and the remote
- Follow-up: none deferred
- Prior versions: 3.0.0 redefined IV and XI (clone distribution, no registry); 2.4.1 clarified
  VIII (pinned timezone); 2.4.0 added XI; 2.3.0 added X; 2.2.0 added IX; 2.1.0 added VIII;
  2.0.0 redefined II (three-line → four-line)
- Project Type: clone-installable CLI plugin for Claude Code statusline customization
- Scope: Local development → distribution as a git repository, released by tag
- Key Constraints: Starship compatibility, four-line display format, token tracking grounded in
  real payload data, icons carrying live state in the platform's own vocabulary, generated
  documentation previews, cross-platform support, zero runtime dependencies, tag-driven verified
  releases, English-only output
-->

## Core Principles

### I. Starship-Compatible Output

Visual design MUST mirror the user's existing local Starship Powerline setup
(`~/.config/starship.toml`, Catppuccin Mocha palette, Nerd Font glyphs). This is the concrete
reference — not a vague "Starship-like" aspiration:

- **Palette**: Catppuccin Mocha hex values MUST be used as color tokens (not raw hex inline):
  `red #f38ba8`, `peach #fab387`, `yellow #f9e2af`, `green #a6e3a1`, `sapphire #74c7ec`,
  `lavender #b4befe`, `crust #11111b` (text-on-color), `mantle #181825` (background accents).
  Segment order in this project reuses the same color progression the local config uses
  for its module chain (red → peach → yellow → green → sapphire → lavender), assigning one
  color band per statusline line/segment group so the three lines read as one continuous
  Powerline chain, not three unrelated bars.
- **Segment format**: each block MUST follow the local config's pattern —
  `[ $content ](fg:crust bg:<segment_color>)` — light text on solid color background,
  padded with a leading and trailing space inside the block.
- **Powerline separators**: segments MUST be joined with the arrow/triangle glyph `` (U+E0B0,
  Nerd Font "powerline" glyph), transitioning `fg:<previous_bg> bg:<next_bg>` between segments,
  exactly as `[](bg:peach fg:red)` chains directory→git in the reference config. No plain
  text separators (`|`, `>`, `-`) are permitted between segments.
- **Glyphs**: module icons MUST come from Nerd Font icon set (matching the reference config's
  ``  ``  ``  ``-style glyphs for git/branch/language/tool markers), never plain ASCII
  labels, so the line visually matches p10k/Powerline conventions.
- **Font dependency**: README MUST document that a Nerd Font (or Nerd Font patched font) is
  required in the user's terminal for glyphs to render; MUST include a fallback ASCII mode
  (`--no-nerd-font` flag or config toggle) for terminals without one.
- **Theme variants**: palette MUST be swappable between the four standard Catppuccin flavors
  (mocha/frappe/macchiato/latte) the same way the reference `starship.toml` defines all four
  under `[palettes.*]`, defaulting to mocha (dark) and latte (light) by terminal background
  detection where feasible.

Modules MUST NOT break when the palette variant changes. All prompt strings, separators, and
color references MUST validate against Starship v1.26+ module/schema conventions, since that
is the version installed and studied on the reference machine.

### II. Four-Line Display Structure

Statusline MUST display exactly four information lines, in this order:
- **Line 1**: Working directory + git branch + working-tree state (tracked changes, untracked files) + divergence from upstream (ahead, behind) + PR status (existence + number if open)
- **Line 2**: Active skills for the current session, one chip per skill, each in a distinct palette color, no bullet/prefix glyph
- **Line 3**: Model name + effort level (current session context)
- **Line 4**: Context percentage + token usage windows (weekly / monthly) + rate-limit reset countdown

Each line independently loadable; failures in one line MUST NOT break others (e.g. no git repo omits
line 1's branch/PR segments but the line still renders; no active skills omits line 2 entirely).
Lines MUST fit within 120 characters when rendered.

### III. Token Tracking Grounded in Real Data

System MUST display token/rate-limit usage using only the exact fields Claude Code provides on
the `statusLine` command's stdin payload (`context_window.used_percentage`,
`rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`, and each
window's `resets_at`) — never a locally estimated or invented figure standing in for real
account data. Anthropic's plan limits are a 5-hour window and a 7-day window; there is no
monthly quota, so the statusline MUST NOT display a "monthly" figure — inventing one to fill a
slot would be a fabricated number presented as real. Three percentages are shown: context
window usage, 5-hour window usage, 7-day window usage, plus a reset countdown computed from the
7-day window's `resets_at`. If a field is absent from the payload (older Claude Code version,
or a render before the session has usage), the segment MUST show `?%` rather than a guessed
value, and MUST NOT break the rest of the line.

### IV. Installable by Clone, With Install/Uninstall Commands

The plugin MUST be installable by cloning the repository and running one command, with no
package registry and no package manager involved:

```
git clone https://github.com/jonyfs/statusline.git ~/.claude/statusline-plugin
node ~/.claude/statusline-plugin/bin/cli.js install
```

This is only possible because the project has zero runtime dependencies, and it MUST stay that
way. Adding a dependency would reintroduce a package manager into the install path and break
this principle.

Install MUST:
- Back up the user's existing `~/.claude/settings.json` to a timestamped file before touching it
- Set only the `statusLine` key, leaving every other setting untouched
- Report the settings file it wrote, the backup it made, and the command it installed
- Refuse to run from a package-manager scratch directory (`~/.npm/_npx/<hash>/...`). Such a path
  is evicted later, and recording it produces a statusline that works now and silently
  disappears afterwards with no clue why. Failing at install time, naming the command that does
  work, is the kinder failure.

Uninstall MUST:
- Remove the `statusLine` key only when it points at this plugin's own CLI path — matching a
  generic `cli.js` would delete an unrelated tool's statusline
- Preserve the backups taken at install time

Both commands MUST be idempotent, and neither may require the user to hand-edit JSON. Updating
MUST be a `git pull` with no reinstall, which holds as long as install records the clone's own
path rather than a copy.

### V. Integration Documentation & Configuration Guide

Documentation MUST include step-by-step "How to Integrate" section explaining Claude's hook system and where statusline module injects itself. Configuration guide MUST show:
- Default settings (what you get immediately after installing)
- Customization options (colors, time window display, module order)
- Troubleshooting (common integration errors)
- Reverting to standard Claude statusline

Documentation MUST be in `README.md` and reviewed for accuracy before GitHub release.

### VI. English-Only Codebase

All code, comments, documentation strings, CLI output, and error messages MUST be written in English. User-facing error messages MUST be clear and actionable. No abbreviations or acronyms unless standard in tech (e.g., PR, CLI, JSON). This ensures maintainability and reduces localization debt.

### VII. MVP-First, Local-Then-GitHub

Development MUST start from a local clone, run directly with `node`. Feature completeness verified locally before a release is tagged. A release ONLY after:
- All features verified working (manual testing in Claude Code)
- README complete with integration guide and troubleshooting
- Install/uninstall commands tested end-to-end
- Package.json correctly configured (name, version, bin, entry point)

No features added beyond MVP scope before first release. Scope for v1.0.0: display model + effort, token usage %, active skills, GitHub branch/PR info.

### VIII. Documentation Shows Generated, Not Hand-Drawn, Output

`README.md` MUST illustrate the statusline with images generated from the real renderer, never
with hand-written mockups or prose approximations of what the output "looks like". Hand-drawn
examples drift silently from the code the moment a segment, icon, or colour changes, and a
reader has no way to tell a stale illustration from a current one.

- **Generation**: previews MUST be produced by `node scripts/generate-previews.js`, which calls the same
  `renderPayload()` the installed statusline runs, and converts its actual ANSI output to SVG.
  Any change in the renderer therefore shows up in the images on the next regeneration.
- **Reproducibility**: preview inputs MUST be fixed (`scripts/preview-fixtures.js`), the clock
  frozen, and the timezone pinned to UTC during generation, so regenerating without a code
  change produces no diff on any machine. Clock and calendar output derive from *local* time, so
  without a pinned timezone the same fixture renders differently in UTC-3 and on a UTC CI
  runner, and the staleness check fails on a diff that reflects geography rather than a code
  change. Previews MUST NOT probe the live machine's git state, usage, or clock — an image
  showing whichever branch happened to be checked out is a screenshot, not documentation.
- **Coverage**: the committed previews MUST include the degraded states, not only the ideal
  one — at minimum: no git repository, no open pull request, no active skills, and a payload
  missing rate-limit fields. These are the cases where a reader most needs to know what to
  expect, and they're the cases a hand-drawn example never bothers to show.
- **Portability**: preview SVGs MUST render correctly for a viewer with no Nerd Font and no
  terminal (GitHub's README renderer being the primary target). Nerd Font glyphs MUST be
  embedded as extracted outlines rather than font references or a redistributed font binary;
  emoji MAY remain as text, since every platform's system emoji font covers them.
- **Freshness**: any change to segment content, ordering, icons, or palette MUST be accompanied
  by regenerated previews in the same commit. A README image that disagrees with the code is a
  defect, not a cosmetic issue.

### IX. Runs on Linux, macOS and Windows

Every script in this project — the renderer, the install/uninstall commands, and the
developer tooling — MUST run on Linux, macOS and Windows. The statusline is distributed via
cloned by whoever runs Claude Code, and Claude Code runs on all three.

- **No shelling out to platform-specific tools on a shared path**: `osascript`, `open`,
  `xdg-open`, `cmd /c` and friends MUST be reached only behind an explicit
  `process.platform` check, never assumed. Guards MUST test the platform itself, not a proxy
  for it — `TERM_PROGRAM` is an ordinary environment variable and can carry a macOS value on
  a Linux machine.
- **Paths**: every filesystem path MUST be built with `node:path` and every home/temp
  location with `node:os` (`homedir()`, `tmpdir()`). Hard-coded `/tmp`, `$HOME`, `~`, or `/`
  separators are prohibited outside strings that are already platform-guarded.
- **File URLs**: `file://` URLs MUST be produced by the shared helper, which handles the
  Windows drive-letter form (`file:///C:/...`), converts backslashes, and percent-encodes
  spaces — a naive `` `file://${path}` `` yields an unopenable URL on Windows and on any
  path containing a space.
- **Spawned commands**: anything written into `settings.json` or passed to a shell MUST quote
  both the interpreter and the script path, since either may contain spaces on any platform.
  The interpreter MUST be `process.execPath` rather than a bare `node`, which may not be on
  the PATH of the shell Claude Code spawns.
- **Shell command strings**: values derived from the payload or the environment MUST NOT be
  interpolated into a shell command string. Working directory travels as the `cwd` option;
  command strings stay constant. A directory named with shell metacharacters would otherwise
  be command injection, and quoting rules differ per platform.
- **Graceful degradation over silent breakage**: a capability that genuinely does not exist on
  a platform (opening a terminal tab from a link has no Linux/Windows equivalent that works
  without installing a URL-scheme handler) MUST fall back to the nearest portable behaviour
  and be documented as platform-limited. It MUST NOT emit a broken artifact or throw.
- **Verification**: `node scripts/smoke-test.js` MUST pass on all three platforms. It MUST cover path/URL
  construction, platform guards, and the degraded rendering paths, so a platform regression
  fails a test rather than surfacing as a broken statusline on someone else's machine.

### X. Icons Carry Live State

An icon MUST earn its place by conveying information that changes. A glyph that looks the same
whatever the underlying state is decoration, and decoration in a four-line status display costs
width that real signal could use.

**What "animated" can and cannot mean here.** A statusline is printed once per render and is
then static text: this process exits, and nothing can redraw it. There is no timer and no frame
loop. Claude Code re-invokes the command roughly every 5–6 seconds during activity (measured on
the reference machine, not assumed). Animation therefore MUST be implemented as one frame per
render, producing a slow pulse that draws the eye — never described or documented as smooth
motion, and never implemented with ANSI blink, which many terminals ignore and which is an
accessibility hazard where it works.

- **Change highlighting**: when a tracked value differs from the previous render, that segment's
  icon MUST switch to an animation frame sequence, advancing one frame per render, and MUST
  revert to its static icon once the change is no longer recent (30 seconds).
- **Only discrete state is tracked**: branch, ahead/behind, pull request, active skills, model,
  and effort. Usage percentages MUST NOT trigger highlighting — they move on nearly every
  render, so animating them would leave the line permanently in motion and the highlight would
  stop meaning anything.
- **No false positives on first render**: a session with no previous state MUST render every
  icon static. Treating an absent baseline as "everything just changed" would light up the whole
  line at startup.
- **Time-derived icons**: where an icon represents a moment, it MUST be derived from the real
  timestamp — the reset segments use the clock-face emoji matching the actual reset hour, not a
  fixed clock glyph.
- **Speak the platform's vocabulary**: git and GitHub state MUST use GitHub's own Octicons, so
  the line reads in symbols its audience already knows: the diff-modified and diff-added markers
  for working-tree counts, and cloud-up/cloud-down for commits waiting to be pushed or pulled.
- **A codepoint's name is not evidence of its glyph**: every icon MUST be rendered and inspected
  before adoption. Nerd Font tables proved unreliable in practice — `F433` is listed as
  "repo_push" but draws a downward arrow, and `F45D` is listed as "arrow_up" but draws a
  signpost. Shipping either on its name would have put a wrong-direction arrow on the line.
- **Working-tree counts MUST NOT animate**: they change on every file save, which is exactly the
  churn this principle excludes. Only the discrete state (branch, ahead, behind, PR, skills,
  model, effort) animates.
- **No invented symbols**: Unicode has no per-weekday or per-date emoji. The expiry day MUST be
  rendered as text (`Thu 15:00`, `tomorrow 09:00`, or a bare time when it is still today)
  beside a generic calendar icon. Repurposing an unrelated glyph to stand for a date would be a
  symbol that does not mean what it appears to.
- **Durations stay legible**: a countdown MUST switch to days past 24 hours (`resets in 3d 6h`),
  since the 7-day window routinely lands days out and an hours-only figure becomes noise.
- **State persistence is disposable**: change-tracking state MUST live outside the repository,
  be keyed per session, be pruned once stale, and MUST never break rendering when it cannot be
  read or written. It MUST be disableable, so generated previews stay reproducible.

### XI. Releases Are Tag-Driven and Verified

Releases MUST be cut by pushing a `v*.*.*` tag, never from a branch push, so a green `main` can
never ship by accident and the tag is the single source of truth for what was released.

- **Re-verify at the tag**: the release workflow MUST re-run the full test suite on Linux, macOS
  and Windows against the tagged commit. A tag can point at a commit that never went through a
  pull request, so trusting an earlier CI run would leave a hole.
- **Refuse inconsistent releases**: the workflow MUST fail if the tag's version disagrees with
  the version recorded in `package.json`.
- **Distribution is the git repository itself**: users install by cloning, so a release is a tag
  plus a GitHub release entry, not an upload to any registry. No publishing credential of any
  kind belongs in this repository.
- **Least privilege**: workflow `permissions` MUST be the minimum each job needs, declared per
  job rather than granted repository-wide.
- **CI guards the invariants other principles declare**: continuous integration MUST run the
  test matrix across all three platforms (Principle IX) and MUST fail when regenerating previews
  produces a diff (Principle VIII).

## Development & Distribution Workflow

**Local Installation Procedure** (v1.0.0 MVP):
1. Clone repo locally
2. Clone the repository to a permanent location
3. Run `statusline-plugin install` to integrate with Claude
4. Test statusline display in Claude Code
5. Make edits; auto-reload when settings.json changes

**GitHub Publication Checklist**:
- [ ] README.md complete (what it does, how to use, troubleshooting)
- [ ] package.json version bumped (semver)
- [ ] Install/uninstall tested end-to-end
- [ ] No uncommitted changes
- [ ] Tag release as `v1.0.0` (or next version)
- [ ] Tag the release and let the workflow create the GitHub release entry

## Integration with Claude's Configuration

Plugin integrates via Claude Code's `settings.json` hooks system. Installation adds a hook entry under `hooks.on_prompt_ready` (or equivalent CLI hook) that injects statusline module. Uninstallation removes only the statusline-specific hook; other hooks untouched.

Claude settings location: `~/.claude/settings.json` or `~/.claude/settings.local.json` (per user/project).

## Governance

**Amendment Process**: Constitution changes require documented rationale (breaking changes, new principle, or clarification). Version bumped according to semver: MAJOR for principle removals/redefinitions, MINOR for new principles/sections, PATCH for wording/clarification only.

**Compliance Review**: Each feature merged MUST verify adherence to Principles I–XI (Starship compatibility, four-line format, token tracking, clone distribution, documentation, English-only code, MVP-first scope, generated previews, cross-platform support, live-state icons, tag-driven releases). Reviews checked via PR review checklist.

**Repository State**: This constitution supersedes all other project guidelines. When in doubt, refer to Core Principles I–XI. Runtime integration guidance lives in `README.md` (user-facing) and `.claude/CLAUDE.md` (developer-facing).

**Version**: 3.1.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-24
