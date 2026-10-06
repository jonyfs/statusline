# Claude Statusline Plugin Constitution

<!--
Sync Impact Report:
- Version: 7.6.1 (IX clarified on 2026-10-06: PATCH. The bare `node` exception the status line
  command has now also covers Codex's SessionStart hook, so IV's rule that the hook keep the same
  command text across updates holds through a Node upgrade. A version-pinned `process.execPath`
  would make the hook fail after the upgrade and change the text Codex trusted. Templates: no
  change needed. See specs/035-codex-pane/.)
- Previously, version 7.6.0 (II, III and IV extended on 2026-10-06: MINOR, the bar in a pane under Codex.
  III names Codex's session rollout as a data source: the pane reads only what the rollout
  records, and a usage window maps to the 5-hour or 7-day chip only by its length, so the free
  plan's 30-day window has no chip. IV adds the opt-in `--pane`, which appends one SessionStart
  hook to Codex's `hooks.json` after every existing group, backs the file up first, and is
  removed alone by `--no-pane` or uninstall. II notes that the pane is the bar itself, three
  lines drawn by the same renderer, not rows added to it. Templates: no change needed. See
  specs/035-codex-pane/.)
- Previously, version 7.5.0 (IV extended on 2026-10-06: MINOR, Codex items. Under `--harness codex`,
  install may also write `[tui] status_line_use_colors` when it is absent, records that, and
  uninstall removes only that recorded `true`. A `status_line` is replaced only when it matches a
  list this plugin has written, so a reinstall upgrades an older list and keeps one the person
  chose. `theme` changes only through the opt-in `--theme`, with the previous value recorded and
  restored by `--no-theme` or uninstall. Templates: no change needed. See specs/034-codex-items/.)
- Previously, version 7.4.0 (III and IV extended on 2026-10-06: MINOR, Copilot CLI parity. III names what
  the bar may show under Copilot beyond its payload: the AI credits Copilot reports and the
  session limit its log records, the effort and the routed model its log records, the todos in
  the session's own database, and the account's monthly premium and chat quota as GitHub
  reports it to `gh`, labelled as a month with its reset date. The month is Copilot's only
  window, so it is not a fabricated monthly figure, and the 5-hour and 7-day chips stay absent
  there. IV adds the opt-in `--quiet-footer` for Copilot, which may write the `footer.show*`
  keys the bar repeats, records what each held, and is undone by uninstall. Templates: no
  change needed. See specs/033-copilot-parity/.)
- Previously, version 7.3.0 (II extended on 2026-10-06: MINOR, a second kind of row after the bar. The git
  gates running in the repository's worktrees get a row each, in Claude Code and Copilot, and a
  count on line 1. The rows are the first thing a short window drops. See
  specs/031-git-gate-rows/.)
- Previously, version 7.2.0 (II extended on 2026-10-05: MINOR, a harness without its own subagent rows may
  print them after the bar. Copilot CLI has no `subagentStatusLine`, only `statusLine.command`,
  and its session log names every subagent; the rule for Claude Code is unchanged. See
  specs/030-copilot-agent-rows/.)
- Previously, version 7.1.0 (III and IV extended on 2026-10-01: MINOR, a second and third harness added
  without changing what Claude Code's rules require. Copilot CLI runs this renderer and sends
  its own payload; Codex CLI runs no command, so the plugin only configures Codex's built-in
  items. See specs/029-multi-harness/.)
- Previously, version 7.0.0 (IX redefined on 2026-09-30: MAJOR, a MUST changed rather than added. IX
  required both the interpreter and the script path quoted, and the command install wrote in
  that form was a PowerShell `ParserError`, so on Windows without Git Bash the bar never ran.
  The rule now asks for a command every shell Claude Code uses can parse. See
  specs/028-cross-platform/.)
- Previously, version 6.3.1 (IV corrected on 2026-09-29: PATCH, the text brought in line with what install
  has written for a long time. It said install sets "only the `statusLine` key"; it also writes
  the refresh interval, the subagent rows and the skill hook, each behind a flag. No rule
  changed. See specs/027-bar-polish/.)
- Previously, version 6.3.0 (III amended on 2026-09-29: MINOR, a payload block added to the list of
  displayed fields. Claude Code 2.1.283+ sends `prompt_cache` on every redraw and redraws
  when a warm cache expires; the bar now says when the cache is about to go cold, or has, and
  what the next request will write again. Minutes come from the payload's own `expires_at`,
  so nothing is estimated. See specs/025-prompt-cache-chip/.)
- Previously, version 6.2.0 (III amended on 2026-09-28: MINOR, a field added to a list rather than a
  requirement redefined. Claude Code sends `rate_limits.spend_limit` behind a Claude gateway
  with spend limits, and the bar ignored it, so a user whose administrator raised their limit
  kept reading an exhausted `5h 100%` with no sign of the allowance they were now spending.
  The spend limit is the one figure allowed above 100%, because the payload reports it that
  way once the limit is exceeded. See specs/023-extra-usage-limit/.)
- Previously, version 6.1.0 (XII added on 2026-09-23: MINOR, a new principle rather than a redefinition.
  A spec declares in its own front matter which artifacts complete it, and the scaffold requires
  only what that declaration promises. Four of the last five features had shipped with spec.md
  alone while the tooling demanded a plan for every one, so check-prerequisites.sh failed on its
  first call. Nothing in I through XI changed; XI in particular was left alone, and the gap
  between the tag-driven flow it describes and the untagged versions since v1.2.7 remains an
  open question with its own decision to make.)
- Previously, version 6.0.0 (II redefined on 2026-09-07: MAJOR, the bar draws three lines rather than four.
  "How the model is configured" and "what is running out" become one subject: the first never
  filled a line, and what is being spent is read in the same glance as what is spending it.
  Nothing was dropped in the merge — the terminal decides what survives by the priorities in
  src/segments.js. The savings figure was raised out of last place at the owner's request so it
  survives the narrower line, and the shed order changes with the numbering: line 3 is now the
  last one standing, carrying both the limits and the model spending them.)
- Previously, version 5.1.0 (X gains NO_COLOR on 2026-09-07: MINOR, a new requirement rather than a
  redefinition of an existing one. The bar emitted truecolor unconditionally, so a person who
  had asked every program on the machine not to colourise could not turn this one off without
  uninstalling it. The powerline separator goes with the colour, being a shape cut out of two
  backgrounds that do not exist without it.)
- Previously, version 5.0.0 (II and X redefined on 2026-09-06: line 2 gains the running subagents as a
  named subject, and line 4's merged reset countdown is removed in favour of each window
  carrying its own reset. MAJOR because both are redefinitions of what a line MUST show, not
  clarifications.)
- Redefined: II. Four-Line Display Structure — line 2 is the session's own skills, its todo and
  its activity, and names no subagent: the roster went there on 2026-09-06 and came off the same
  day, because four agents with their tiers and ages crowded both the skills and the working
  state off a 120-column window. A skill a subagent invoked belongs to that subagent's row and
  is not counted as the session's; it is forbidden
  from giving them per-agent skill lists, because Claude Code attributes a skill invocation to a
  session and not to a subagent, so any such list would be invented. Line 4 loses the merged
  right-aligned countdown: `2h09m / 3d` asked a reader to know which half belonged to which of
  two figures several chips away, and read as a fraction beside the session duration. A window
  now carries its own reset, counts down inside a day, names the day beyond one, and says `?`
  when the payload carried no reset at all.
- Redefined: X. Icons Carry Live State — the per-hour clock-face emoji exception is retired
  with the segment that justified it, leaving no emoji on the bar. Two clauses added: an
  animated indicator advances on a persisted counter rather than the clock, because a
  clock-derived index aliases against the redraw cadence and freezes outright at the 60-second
  refresh; and an icon must be legible before it is learned, which is what took the working
  indicator from a filled disc against a hollow one to a hammer against a coffee cup.
- Previously, version 4.2.0 (I and X expanded on 2026-09-01: the glyph set becomes Nerd-Font-first, with
  emoji kept only as a recorded exception rather than an unexamined default)
- Expanded: I. Starship-Compatible Output — the Glyphs bullet now states a default and an escape
  hatch instead of a preference. A Nerd Font glyph is what a segment icon is; an emoji is
  permitted only where no glyph in the installed Nerd Font set carries the meaning, and every
  such case MUST be recorded with the search that failed. The reason is width, not taste: a
  private-use Nerd Font glyph occupies one column and an emoji two, on a bar whose segments
  already compete for the columns `COLUMNS` reports, and emoji resolve to the system emoji font,
  whose colour and metrics sit outside the palette the rest of the chain is drawn in
- Expanded: X. Icons Carry Live State — three rules added. The glyph set MUST be declared in one
  table with a plain-mode substitute per entry, so no render function emits a glyph literal and
  `CLAUDE_STATUSLINE_ASCII=1` degrades completely rather than partly. The codepoints listed in
  the renderer and in `scripts/extract-glyphs.py` MUST be the same set. And the evidence for
  adopting an icon MUST be an image of the glyph rendered from the installed font, kept with the
  change that adopts it
- Recorded exception: per-hour clock faces stay emoji. The Material Design `clock_time_one` ..
  `clock_time_twelve` series is absent from the installed FiraCode Nerd Font build — F1861-F186C
  draw clock-plus, clock-minus, clock-x and a plug — so no Nerd Font glyph varies by hour, and
  Principle X requires that icon to carry the real reset hour
- Evidence gathered 2026-09-01 for X's "a codepoint's name is not evidence of its glyph", by
  rendering candidates out of the installed font: F09DA "brain" draws a boxed chevron, F44E
  "stopwatch" draws three horizontal bars, F0BE "checklist" draws the App Store logo, and F0C71
  "format_list_checks" draws a smiling face. Four names were checked and all four were wrong
  about their glyph
- MINOR bump: rules are added and an exception process is written down; no existing rule is
  reversed. Principle I already required Nerd Font module icons, so naming the emoji escape
  hatch narrows current practice rather than loosening the rule
- Templates: no `.specify/templates/*` changes required
- Carried out in the same change: the renderer's glyph table now holds every glyph the bar emits
  with a plain-mode substitute for each, eight emoji were swapped for Nerd Font glyphs, the
  extractor lists the same set, and README's "Where the icons come from" section was rewritten
  around the table. The proof sheet is committed as `docs/glyph-evidence.png`
- Follow-up: none deferred
- Prior version 4.1.0: II and X expanded, and two sections corrected against the shipped code, after
  the layout reductions of 2026-08-26 and 2026-08-27; see specs/002-statusline-design-review/
- Expanded: II. Four-Line Display Structure — the per-line content lists now match what the
  segment registry actually renders: line 1 carries the repository and its state, line 2 carries
  skills, todo and activity, line 3 is the model and the effort level and nothing else, and line 4
  is what is running out. Three rules are added: every segment's placement MUST be declared as a
  row in `src/segments.js`; the shedding order MUST be declared (line 2, then 3, then 1, with
  line 4 last); and a wide element MUST justify its width against the number beside it. Subagent
  rows are stated not to count toward the four
- Corrected in II: line 4 was described as carrying "weekly / monthly" windows, which Principle
  III explicitly forbids — the windows are the 5-hour and the 7-day one
- Expanded: X. Icons Carry Live State — a ramped segment MUST carry its level in something other
  than colour where the consequence is irreversible, with the context figure recorded as the one
  declared exception (owner's decision, 2026-08-26)
- Corrected: "Integration with Claude's Configuration" described a `hooks.on_prompt_ready` entry.
  Installation writes the `settings.json` `statusLine` object, as Principle IV already stated
- MINOR bump: rules are added and stale descriptions corrected; no existing rule is reversed
- Templates: no `.specify/templates/*` changes required
- Prior versions: 4.0.0 redefined I, II and X after the redesign review of 2026-08-26
- Redefined in 4.0.0: I. Starship-Compatible Output — a plain separator is now permitted as a declared
  fallback for terminals that cannot render the Powerline glyph, and palettes from outside
  Catppuccin may ship alongside the four flavors. Neither may become the default; Catppuccin
  Mocha with Powerline arrows is still what the project is when nobody has chosen otherwise
- Redefined: II. Four-Line Display Structure — four lines is the shape rather than a fixed
  count. On a terminal too short or too narrow, lines are shed by declared priority instead of
  wrapping, and the width limit is the real terminal width from COLUMNS rather than a constant
  120. A terminal with room still shows four
- Redefined: X. Icons Carry Live State — change highlighting may use a colour shift instead of
  an icon frame sequence, and a new rule requires each colour channel to carry exactly one
  meaning: ramp and change-highlight must apply to disjoint sets of segments
- 4.0.0 was a MAJOR bump: II's "exactly four" and X's "MUST switch to an animation frame
  sequence" were both binding rules that no longer held as written
- Prior versions: 3.1.0 expanded II and X; 3.0.0 redefined IV and XI (clone distribution, no
  registry); 2.4.1 clarified VIII (pinned timezone); 2.4.0 added XI; 2.3.0 added X; 2.2.0
  added IX; 2.1.0 added VIII; 2.0.0 redefined II (three-line → four-line)
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
  exactly as `[](bg:peach fg:red)` chains directory→git in the reference config. A plain
  separator is permitted only as a declared fallback for a terminal that cannot render the
  glyph, never as the default: the Powerline arrow is what the design is, and a bar that
  silently chose a pipe would be a different design wearing the same name. The existing ASCII
  mode already establishes this shape, where the fallback is asked for rather than assumed.
- **Glyphs**: a segment icon MUST be a Nerd Font glyph — the Octicon, Material Design and
  Devicon sets the reference config already draws from — so the line matches p10k/Powerline
  conventions and reads in a single typeface. A plain ASCII label is never an icon. An emoji is
  permitted only where no glyph in the installed Nerd Font set carries the meaning, and each
  such case MUST be recorded under Principle X together with the codepoints that were rendered
  and rejected; per-hour clock faces are the first recorded case. The reason for the default is
  width: a private-use Nerd Font glyph occupies one column where an emoji occupies two, and on a
  bar whose segments already compete for the columns `COLUMNS` reports, every emoji spends a
  column a segment could have used. Emoji also resolve to the system emoji font
  instead of the terminal's, so their colour and baseline fall outside the palette the rest of
  the chain is drawn in.
- **Font dependency**: README MUST document that a Nerd Font (or Nerd Font patched font) is
  required in the user's terminal for glyphs to render; MUST include a fallback ASCII mode
  (`--no-nerd-font` flag or config toggle) for terminals without one.
- **Theme variants**: palette MUST be swappable between the four standard Catppuccin flavors
  (mocha/frappe/macchiato/latte) the same way the reference `starship.toml` defines all four
  under `[palettes.*]`, defaulting to mocha (dark) and latte (light) by terminal background
  detection where feasible. Palettes from outside Catppuccin MAY ship alongside them, since a
  bar that clashes with the rest of a terminal is a bar people turn off. Any added palette MUST
  define every colour token the Catppuccin flavors define, MUST be selected the same way, and
  MUST NOT become the default: Catppuccin Mocha remains what this project looks like when
  nobody has chosen anything.

Modules MUST NOT break when the palette variant changes. All prompt strings, separators, and
color references MUST validate against Starship v1.26+ module/schema conventions, since that
is the version installed and studied on the reference machine.

### II. Three-Line Display Structure

Statusline MUST display three information lines, each with a subject a reader can name, in this
order:
- **Line 1 — the repository and its state**: working directory, the project directory when it
  differs, owner and repository, branch, worktree and its state, merge conflicts, lines changed
  this session, divergence from upstream (ahead, behind), pull request (number, state, review
  state) and the CI conclusion
- **Line 2 — what is shaping the work**: the active skills for the current session, the current
  todo and the current activity. **The skills are this session's own**: a skill invoked inside a
  subagent belongs to that subagent's row and MUST NOT be counted here, since with four agents
  running the chip otherwise becomes a list of things the reader is not doing. **Running
  subagents MUST NOT be named on this line.** They were, briefly, with their tiers and ages, and
  four of them crowded both the skills and the working state off a 120-column window; the roster
  belongs on the subagent rows, which have a line each. What a running subagent still does here
  is answer the working question, per Principle II's own subagent rule and specs/012
- **Line 3 — what is running, and what it is running out of**: model name and effort level, the
  context percentage, the 5-hour and 7-day window usage each with its own reset, the burn rate
  and projection, the session duration, and the token saving figure. These were two lines until
  2026-09-07: "how the model is configured" never filled one, and what is being spent is read in
  the same glance as what is spending it. **Nothing was dropped in the merge** — the terminal
  decides what survives, by the priorities in `src/segments.js`, and at 120 columns that is the
  model, the effort, the three levels with their resets and the savings figure. There is no
  monthly window to show, per Principle III

**A usage window MUST carry its own reset**, beside its own level and in one chip: a level and
the moment it comes back are read together, and separating them cost this line its legibility. A
reset the payload did not carry MUST say so rather than going quiet, in the same vocabulary as
the unknown percentage beside it, since a reader cannot otherwise tell an absent figure from one
a narrow terminal shed. **Near and far are told differently, and that is the rule**: a window
resetting within a day counts down, because it is something to wait out; one resetting beyond a
day names the day, because it is something to plan around.

**The savings figure MUST outlive what is derived from the line.** It was the lowest priority on
the bar and the first thing any narrow line gave up; at the owner's decision of 2026-09-07 it now
outranks the session duration, the projection and the burn rate, all three of which are derived
from figures that stay on the line.

Each line independently loadable; failures in one line MUST NOT break others (e.g. no git repo omits
line 1's branch/PR segments but the line still renders; no active skills omits line 2 entirely).

**Placement is declared, not implied.** Every segment MUST be a row in `src/segments.js` carrying
its line, its order within that line, its alignment, its priority and its colour channel. Order
MUST stay independent of priority, so a segment never moves sideways because a neighbour
disappeared, and the eye can learn where to look. A segment defined only inside a render function
is a segment whose narrow-terminal behaviour nobody chose.

**Subagent rows are not statusline lines.** The rows drawn for running subagents come from a
separate command with its own contract and its own tick. They MUST NOT count toward the three, and
a row that cannot be rendered MUST leave Claude Code's own rendering in place instead of failing.
GitHub Copilot CLI has no such command, only the status line, so there the rows follow the bar's
lines in the same output, one per running subagent read from Copilot's session log, capped with a
count of the rest. They still MUST NOT count toward the three, and the bar MUST NOT print them in
Claude Code, which draws its own (specs/030-copilot-agent-rows).

**Git gate rows follow the bar too.** The git hooks running in the repository's worktrees get one
row each after the bar (after the subagent rows, in Copilot), with a count as a registered line 1
segment. Like subagent rows, they MUST NOT count toward the three. They MUST be the first thing a
short window gives up, before any of the bar's own lines, and MUST return as soon as there is
room; the count on line 1 stays (specs/031-git-gate-rows).

**The pane under Codex is the bar itself.** Codex CLI cannot run the bar in its footer, so
`codex-pane` draws it in a tmux pane next to Codex (specs/035-codex-pane). That pane MUST be
drawn by the same renderer with the same three lines, order, shedding and gate rows, at the
pane's own size. It is not extra rows added to Codex's footer or to the bar, and it MUST NOT
grow a layout of its own.

**Three is the shape, not a floor.** A line with nothing to say is already dropped rather than
rendered empty, and the same reasoning extends to the terminal: on a window too short or too
narrow to hold three lines, the statusline MUST shed lines rather than wrap, because a wrapped
bar costs more rows than the one it was trying to save and Claude Code truncates rather than
wraps a line that overflows. Shedding MUST follow a declared order — line 2, then any line an
arrangement has created beyond the three, then line 1, with line 3 last, since it carries the
limits whose consequences cannot be undone and, since the merge, the model that is spending
them — MUST be driven by the terminal dimensions Claude Code reports rather than guessed, and
MUST restore every line as soon as the room exists. A terminal with room for three lines MUST
show three.

Lines MUST fit within the terminal's real width, read from the `COLUMNS` environment variable
Claude Code sets before running the command, falling back to 120 characters when it is absent.
Where content exceeds that width, the segments dropped MUST follow a declared per-segment
priority rather than source order, so what survives on a narrow terminal is what matters most
rather than what happened to be first.

**A wide element MUST justify its width against the number beside it.** The context progress bar
spent ten to sixteen columns on the widest line saying what the figure said in three, and was
removed on 2026-08-26; the same bar still earns its place on a subagent row, which has a whole
line and no other number competing for it. Width on a shared line goes to something the reader
cannot already read beside it.

### III. Token Tracking Grounded in Real Data

System MUST display token/rate-limit usage using only the exact fields Claude Code provides on
the `statusLine` command's stdin payload (`context_window.used_percentage`,
`rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`,
`rate_limits.spend_limit.used_percentage`, each entry's `resets_at`, and the `prompt_cache`
block) — never a locally estimated or invented figure standing in for real
account data. Anthropic's plan limits are a 5-hour window and a 7-day window; there is no
monthly quota, so the statusline MUST NOT display a "monthly" figure — inventing one to fill a
slot would be a fabricated number presented as real. Three percentages are shown: context
window usage, 5-hour window usage, 7-day window usage, plus a reset countdown computed from the
7-day window's `resets_at`. A fourth, the spend limit, is shown only where the payload carries
it. Its period may be a month, and that is the one exception to the rule above: it is a
figure Claude Code reports, not one the statusline invented. If a field is absent from the payload (older Claude Code version,
or a render before the session has usage), the segment MUST show `?%` rather than a guessed
value, and MUST NOT break the rest of the line.

The spend limit is different in two ways. Claude Code sends it only behind a Claude gateway
with spend limits, so its absence is the normal state for most accounts: the segment MUST be
omitted when the entry is absent rather than shown as `?%`. And its `used_percentage` goes
above 100 once the limit is exceeded, so the statusline MUST show it as reported rather than
capping it. A granted allowance the payload does not carry MUST NOT be displayed at all: no
figure may be derived from spend, message count or elapsed time to stand in for it.

The same rule holds in every harness that runs this renderer: the bar reads the payload that
harness sends, and nothing invented to stand in for a field it lacks. GitHub Copilot CLI sends
no rate limits, so under Copilot the 5-hour, 7-day and spend chips are absent rather than `?%`,
which would claim an unknown value for a limit that does not exist there. Its own fields,
`cost.total_premium_requests` and `allow_all_enabled`, are read as reported. OpenAI Codex CLI
runs no external command; in its own footer the plugin only chooses Codex's built-in status line
items, and no figure comes from this code (specs/029-multi-harness).

Next to Codex, in the pane `codex-pane` draws (specs/035-codex-pane), the payload is built from
Codex's session rollout (`$CODEX_HOME/sessions/**/rollout-*.jsonl`), which is a data source in
its own right: the model and effort from `turn_context`, the window size from `task_started` or
`token_count`, the context share as the last turn's `total_tokens` over that window, the usage
windows from `token_count.rate_limits`, and working while a `task_started` has no later
`task_complete` or `turn_aborted`. A window MUST map to the 5-hour chip only when Codex says it
is 300 minutes long and to the 7-day chip only at 10080 minutes; any other window, such as the
free plan's 30 days, MUST be left out rather than drawn under a label it does not have, and a
chip whose window the plan lacks is absent rather than `?%`. A field the rollout does not carry
is absent from the payload and renders as the bar renders any absent field. The rollout is
Codex's internal format, so a reader MUST degrade to the absent field, never guess, when a
record changes shape.

Under Copilot the bar MAY also show figures Copilot or GitHub report outside the payload, each
read as reported and never estimated (specs/033-copilot-parity): the AI credits in the payload's
`ai_used`, drawn as Copilot formats them, with their share of the session limit only while the
session log's latest `session.session_limits_changed` sets one; the effort and the model the
auto router chose, from the root agent's events in the session log; the todos in the session's
own `session.db`; and the account's monthly premium and chat quota from GitHub's
`/copilot_internal/user`, fetched by `gh` in the detached refresh only. The quota is the one
window Copilot meters, so showing it does not break the rule against a monthly figure above:
it is GitHub's figure, not one invented to fill a slot. It MUST be labelled as a month and
carry its reset date, MUST NOT be drawn as a 5-hour or 7-day window, and MUST be absent when
`gh` cannot answer or the plan has no such allowance. A quota or credits lookup MUST NOT run
under Claude Code. When the payload's `used_percentage` is null, Copilot's own
`current_context_used_percentage`, or `current_context_tokens` over `displayed_context_limit`,
stands in for it; both are Copilot's figures for the same thing.

The prompt cache is shown only while the payload's `prompt_cache` block says caching is
observed. Its countdown is the payload's `expires_at` minus now, and its token figure is the
payload's `recache_tokens_if_cold`; the statusline MUST NOT compute either from anything else,
and MUST NOT turn them into a cost.

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
- Set only the keys this plugin owns: `statusLine` (with its `refreshInterval`),
  `subagentStatusLine`, and one `PostToolUse` hook matching `Skill`, each skippable with a flag,
  leaving every other setting untouched
- Report the settings file it wrote, the backup it made, and the command it installed
- Refuse to run from a package-manager scratch directory (`~/.npm/_npx/<hash>/...`). Such a path
  is evicted later, and recording it produces a statusline that works now and silently
  disappears afterwards with no clue why. Failing at install time, naming the command that does
  work, is the kinder failure.

Install MAY also be pointed at another harness with `--harness copilot` or `--harness codex`.
It then manages only that harness's status line setting (`statusLine` in Copilot's
`settings.json`, `[tui] status_line` in Codex's `config.toml`), backs the file up first, and
leaves every other key or line untouched. With no `--harness`, install is Claude Code's, as it
always was.

For Codex, install also writes `[tui] status_line_use_colors = true` when that key is absent, and
records that it did. It MUST keep a value the person set, and uninstall MUST remove the key only
when it was recorded and still reads `true`. Install MUST replace a `status_line` only when it
matches a list this plugin has written (current or older) and MUST keep any other list. Codex's
`theme` MAY change only through the opt-in `--theme`, limited to Codex's bundled Catppuccin themes,
which records the value it replaces; `--no-theme` and uninstall MUST restore it unless the theme
was changed since. Install does not write `terminal_title`.

For Codex, install MAY also take `--pane`, which registers one SessionStart hook running this
plugin's `codex-hook` in Codex's `hooks.json` (specs/035-codex-pane). The file is shared with
other tools and Codex trusts each hook by its position and its command, so the hook MUST be
appended after every existing SessionStart group, MUST keep the same command text across
updates, and the file MUST be backed up before it changes. Install MUST refuse `--pane`, before
writing anything, when `hooks.json` does not parse. It MUST tell the person that Codex asks once
to trust the hook. `--no-pane` and uninstall MUST remove only hooks whose command is this
plugin's `codex-hook`, and MAY delete `hooks.json` only when install created it and nothing else
is left in it. With neither flag, a reinstall or update leaves the hook as it is.

For Copilot, install MAY also take `--quiet-footer`, which turns off the items of Copilot's own
footer the bar already shows (`footer.showDirectory`, `showBranch`, `showPullRequest`,
`showAiUsed`, `showContextWindow`, `showQuota`, `showCodeChanges`, `showCiStatus`,
`showModelEffort`) and keeps `footer.showCustom` on, since that is the bar. It MUST be opt-in,
MUST record each key's previous value or absence before changing it, and MUST NOT overwrite that
record on a repeat install. `--no-quiet-footer` and uninstall MUST restore every recorded key
whose value is still the one install wrote, and leave one the person changed since. With
neither flag, a reinstall or update leaves the footer as it is.

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
- **Spawned commands**: anything written into `settings.json` MUST parse in every shell Claude
  Code runs it through: POSIX `sh`, Git Bash, and PowerShell, which Claude Code uses on Windows
  when Git Bash is absent. The script path MUST be quoted. The interpreter MUST NOT be quoted
  unless it contains whitespace on a POSIX system: PowerShell reads a line that opens with a
  quoted string as an expression and never runs it, and the `&` that would fix that is a
  syntax error in bash (measured 2026-09-30, specs/028-cross-platform). On Windows, paths MUST
  use forward slashes, as Claude Code's own documentation instructs. The interpreter MUST be
  `process.execPath` rather than a bare `node`, which may not be on the PATH of the shell
  Claude Code spawns, except on Windows when that path contains whitespace, where a bare
  `node` that the installing shell can run is used instead. The status line's bare `node`
  remains the documented exception it was, and Codex's SessionStart hook (`codex-hook`, IV)
  shares it: Codex trusts that hook by its command text, which IV requires to stay the same
  across updates, and a version-pinned `process.execPath` would break the hook and change that
  text on the next Node upgrade. Both fall back to `process.execPath` when no bare `node` runs.
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

- **Change highlighting**: when a tracked value differs from the previous render, that segment
  MUST mark itself as recently changed, and MUST revert once the change is no longer recent
  (30 seconds). The mark MAY be an icon frame sequence advancing one frame per render, or a
  colour shift on the segment. Colour is the stronger signal of the two: it is preattentive,
  where a swapped glyph has to be recognised, and it does not require the reader to have seen
  the previous frame.
- **Colour is not the only carrier where the consequence is irreversible**: a segment whose
  colour ramps by level MUST also mark its band in something other than colour (`▴` past 60%,
  `▲` past 85%), since roughly one man in twelve cannot separate red from green. The context
  figure is the one declared exception, carrying its level in colour alone at the owner's decision
  of 2026-08-26. The 5-hour and 7-day figures MUST keep their marks: those are the limits whose
  consequence a reader cannot undo. Any further exception MUST be recorded here rather than
  decided in a render function.
- **Colour is a preference the reader may withdraw**: `NO_COLOR`, set to anything non-empty,
  MUST turn colour off. It is a cross-tool convention rather than this project's invention, and
  a bar that ignores it is one a person cannot turn off without uninstalling it. Nothing may be
  carried by colour alone for this to be safe, which the band marks below already require. The
  powerline separator MUST go with the colour: it is a shape cut out of two backgrounds, and
  without them it is a filled triangle between chips that no longer have edges.
- **One meaning per channel**: a colour on the bar MUST mean exactly one thing wherever it
  appears. Where colour marks change, it MUST NOT also encode a level on the same segment, and
  where a ramp encodes a level, that segment MUST NOT also use colour to mark change. The two
  uses MUST be assigned to disjoint sets of segments, and the assignment MUST be written down
  rather than left to whoever edits next.
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
- **A codepoint's name is not evidence of its glyph**: every icon MUST be rendered from the
  installed font and inspected before adoption, and that rendering MUST be kept with the change
  that adopts it, so the next reader sees the evidence rather than the claim. Nerd Font tables
  proved unreliable in practice — `F433` is listed as "repo_push" but draws a downward arrow,
  and `F45D` is listed as "arrow_up" but draws a signpost. A sweep on 2026-09-01 turned up four
  more in the installed FiraCode build: `F09DA` "brain" draws a boxed chevron, `F44E`
  "stopwatch" draws three horizontal bars, `F0BE` "checklist" draws the App Store logo, and
  `F0C71` "format_list_checks" draws a smiling face. Shipping any of them on its name would put
  a symbol on the line that means something else.
- **One glyph table, one fallback per entry**: every glyph the bar can emit MUST be a row in a
  single glyph table carrying its Nerd Font codepoint and its plain-mode substitute. A glyph
  written inline in a render function is a glyph `CLAUDE_STATUSLINE_ASCII=1` cannot replace, and
  a fallback that swaps some icons and not others leaves boxes on the line while claiming to
  have removed them. The renderer and `scripts/extract-glyphs.py` MUST list the same set, since
  a glyph missing from the extractor renders in the terminal and vanishes from the generated
  previews.
- **An emoji on the bar is an exception with a reason**: where Principle I's Nerd Font default is
  not met, the search that failed MUST be recorded here — which codepoints were rendered, and
  what each one drew. Retired case: per-hour clock faces. They were the one recorded exception,
  kept because the hour was the information they carried, and they went out on 2026-09-06 with
  the merged reset segment. Each window now draws its own reset beside its own level, and a face
  showing the absolute hour next to a relative countdown stated the same thing twice in two
  units — which is decoration by this principle's own test, whatever the glyph knows. There is
  currently no emoji on the bar and no exception outstanding.
- **An animated indicator MUST advance on a counter, never on the clock**: a clock-derived frame
  index aliases against whatever the redraw cadence happens to be, and at the installed
  60-second refresh a per-second clock modulo four frames lands on the same frame every time —
  an indicator that has silently stopped while still claiming to move. The frame count MUST be
  small enough to read at this cadence: four frames is one turn over roughly twenty seconds of
  activity, where the ten-frame spinner a terminal library ships is built for a repaint every
  eighty milliseconds and would show an arbitrary cell. Nothing on the bar animates today; this
  is written down because the rule cost a bug to learn, and whoever tries next should find it.
- **An icon MUST be legible before it is learned**: a reader who has never seen the bar should
  be able to say what a segment claims. A filled disc against a hollow one distinguishes two
  states without naming either, which is a legend the reader has to be given; a hammer against a
  coffee cup names them. Where a candidate set exists, the choice MUST be made from the glyphs
  rendered at the one column they get, not from their names.
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

### XII. A Spec Declares What Completes It

Every feature specification MUST open with YAML front matter naming its track and its status,
and the scaffold MUST require only what that declaration promises. A spec that does not declare
is an error, never a guess.

```yaml
---
track: quick
status: active
---
```

- **Two tracks, no third**: `quick` means `spec.md` alone is the complete artifact set. `full`
  means `spec.md`, `plan.md` and `tasks.md` together are. Most features here are quick ones, and
  the tooling MUST stop treating the short path as a failure of the long one.
- **Enforced at `done` only**: `status` is `active`, `done` or `abandoned`. Artifacts are checked
  when a feature says it is finished. A full feature is written spec first, then plan, then
  tasks, so demanding all three from the start would fail the normal path.
- **One feature in progress**: at most one directory may be `active`, and it MUST be the one
  `.specify/feature.json` names. Otherwise a feature left `active` forever never has to show its
  artifacts, and the requirement becomes opt-in.
- **The two pointers agree**: the `<!-- SPECKIT START -->` block in `CLAUDE.md` and
  `.specify/feature.json` MUST name the same feature. They disagreed for several features before
  this principle existed, and every agent reading project instructions was told the wrong one.
- **Declaration beats inference, and nothing infers**: a missing block, a missing key or an
  unrecognized value MUST fail with a message naming the offending key and its allowed values.
  There is no default in the tooling. The template seeds `track: quick` into a new spec, which is
  a value the author is already editing, not a value the parser supplies.
- **Checked by the suite, not by history**: `scripts/tests/spec-scaffold.test.js` enforces the
  above and MUST read files only. A check that reads git history would skip on the shallow
  checkouts CI makes by default, which is a guard rail that does not guard.

This is Principle VIII pointed at the scaffold: documentation that disagrees with reality is a
defect, whether it is a README image or the file that says which feature is current.


## Development & Distribution Workflow

**Local Installation Procedure** (v1.0.0 MVP):
1. Clone the repository to a permanent location
2. Run `statusline-plugin install` to integrate with Claude
3. Test statusline display in Claude Code
4. Make edits; auto-reload when settings.json changes

**GitHub Publication Checklist**:
- [ ] README.md complete (what it does, how to use, troubleshooting)
- [ ] package.json version bumped (semver)
- [ ] Install/uninstall tested end-to-end
- [ ] No uncommitted changes
- [ ] Tag release as `v1.0.0` (or next version)
- [ ] Tag the release and let the workflow create the GitHub release entry

## Integration with Claude's Configuration

Plugin integrates through Claude Code's `settings.json`. Installation writes the `statusLine`
object and nothing else: its `command`, plus `refreshInterval` and the `taskCommand` for subagent
rows when those are asked for. Every other setting is left untouched. Uninstallation removes that
object only when its command points at this plugin's own CLI path, per Principle IV.

Claude settings location: `~/.claude/settings.json` or `~/.claude/settings.local.json` (per user/project).

## Governance

**Amendment Process**: Constitution changes require documented rationale (breaking changes, new principle, or clarification). Version bumped according to semver: MAJOR for principle removals/redefinitions, MINOR for new principles/sections, PATCH for wording/clarification only.

**Compliance Review**: Each feature merged MUST verify adherence to Principles I–XII (Starship compatibility, three-line format, token tracking, clone distribution, documentation, English-only code, MVP-first scope, generated previews, cross-platform support, live-state icons, tag-driven releases, declared spec tracks). Reviews checked via PR review checklist.

**Repository State**: This constitution supersedes all other project guidelines. When in doubt, refer to Core Principles I–XII. Runtime integration guidance lives in `README.md` (user-facing) and `.claude/CLAUDE.md` (developer-facing).

**Version**: 7.6.1 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-10-06
