# Claude Statusline Plugin Constitution

<!-- 
Sync Impact Report:
- Version: 2.0.0 (Principle II redefined: three-line format → four-line format)
- Modified: II. Three-Line Display Structure → II. Four-Line Display Structure — directory/git/PR,
  skills, model/effort, and context/usage are now separate lines (skills split out of the old
  line 2 into their own line; directory and PR detail added to the git line), matching the
  accepted Model 1 mockup built and iterated in this session
- MAJOR bump: redefines a ratified principle's core structure (line count and per-line content),
  a backward-incompatible change per this constitution's own versioning rule
- Project Type: npm-installable CLI plugin for Claude Code statusline customization
- Scope: Local development → GitHub distribution pipeline
- Key Constraints: Starship compatibility, four-line display format, token tracking, English-only output
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
- **Line 1**: Working directory + git branch + ahead/behind upstream + PR status (existence + number if open)
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

### IV. npm Installable with Install/Uninstall Workflow

Plugin MUST be distributable via `npx statusline-plugin` command (when on GitHub). Local development uses `npm link` or direct path injection. Install command (`npx statusline-plugin install`) MUST:
- Create `.claude/statusline/` config directory
- Write template configuration to user's Claude settings
- Add statusline import to active `settings.json` hooks
- Document changes made (for audit trail)

Uninstall command (`statusline-plugin uninstall` or `npm uninstall statusline-plugin`) MUST:
- Remove statusline module references from Claude settings
- Preserve user configuration backups (timestamped)
- Restore original settings.json state

Both commands MUST be idempotent (safe to run multiple times).

### V. Integration Documentation & Configuration Guide

Documentation MUST include step-by-step "How to Integrate" section explaining Claude's hook system and where statusline module injects itself. Configuration guide MUST show:
- Default settings (what you get after `npm install`)
- Customization options (colors, time window display, module order)
- Troubleshooting (common integration errors)
- Reverting to standard Claude statusline

Documentation MUST be in `README.md` and reviewed for accuracy before GitHub release.

### VI. English-Only Codebase

All code, comments, documentation strings, CLI output, and error messages MUST be written in English. User-facing error messages MUST be clear and actionable. No abbreviations or acronyms unless standard in tech (e.g., PR, CLI, npm). This ensures maintainability and reduces localization debt.

### VII. MVP-First, Local-Then-GitHub

Development MUST start with local installation path (npm link or direct import). Feature completeness verified locally before GitHub publication. GitHub release ONLY after:
- All features verified working (manual testing in Claude Code)
- README complete with integration guide and troubleshooting
- Install/uninstall commands tested end-to-end
- Package.json correctly configured (name, version, bin, entry point)

No features added beyond MVP scope before first release. Scope for v1.0.0: display model + effort, token usage %, active skills, GitHub branch/PR info.

## Development & Distribution Workflow

**Local Installation Procedure** (v1.0.0 MVP):
1. Clone repo locally
2. Run `npm link` in statusline plugin directory
3. Run `statusline-plugin install` to integrate with Claude
4. Test statusline display in Claude Code
5. Make edits; auto-reload when settings.json changes

**GitHub Publication Checklist**:
- [ ] README.md complete (what it does, how to use, troubleshooting)
- [ ] package.json version bumped (semver)
- [ ] Install/uninstall tested end-to-end
- [ ] No uncommitted changes
- [ ] Tag release as `v1.0.0` (or next version)
- [ ] Publish to npm registry
- [ ] Update repo homepage link to npm package

## Integration with Claude's Configuration

Plugin integrates via Claude Code's `settings.json` hooks system. Installation adds a hook entry under `hooks.on_prompt_ready` (or equivalent CLI hook) that injects statusline module. Uninstallation removes only the statusline-specific hook; other hooks untouched.

Claude settings location: `~/.claude/settings.json` or `~/.claude/settings.local.json` (per user/project).

## Governance

**Amendment Process**: Constitution changes require documented rationale (breaking changes, new principle, or clarification). Version bumped according to semver: MAJOR for principle removals/redefinitions, MINOR for new principles/sections, PATCH for wording/clarification only.

**Compliance Review**: Each feature merged MUST verify adherence to Principles I–VII (Starship compatibility, four-line format, token tracking, npm distribution, documentation, English-only code, MVP-first scope). Reviews checked via PR review checklist.

**Repository State**: This constitution supersedes all other project guidelines. When in doubt, refer to Core Principles I–VII. Runtime integration guidance lives in `README.md` (user-facing) and `.claude/CLAUDE.md` (developer-facing).

**Version**: 2.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
