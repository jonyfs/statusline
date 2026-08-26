# Feature Specification: Statusline Redesign Review, Chosen by the Owner

**Feature Branch**: `002-statusline-design-review`

**Created**: 2026-08-26

**Status**: Selected. 55 of 68 options chosen on 2026-08-26; constitution amendment and plan pending.

**Review page**: https://claude.ai/code/artifact/d4d6c710-7db0-45b4-a72a-7ba8e9d27bc6 (source kept at `review-board.html` beside this spec)

**Input**: User description: "considere rever o que pode ser melhorado na diagramaçao das informacoes com o que há de mais moderno, pesquise na internet no minimo 30 fontes sobre como ter improvements no statusline do claude code e abra uma página para rever o que pode ser mudado aqui, sobre design, sobre informaçoes que serão exibidas para que eu possa escolher o que, onde e como algo será mudado, não decida nenhuma mudança por mim, apenas siga as minhas selecoes sejam por chekboxs ou bullets clicáveis para poder decidiar mudar algo e finalmente vc implementar"

## Problem Context

The statusline shows four lines that were designed a version at a time. Nobody has
compared them against what the payload now offers or against what the rest of the
ecosystem has learned since.

Two gaps came out of the research behind this spec.

**The payload carries far more than the bar shows.** Claude Code sends the open pull
request (`pr.number`, `pr.url`, `pr.review_state`, `pr.kind`), the repository identity
parsed from the origin remote (`workspace.repo.host/owner/name`), session cost and
duration, lines added and removed, token counts and the real context window size,
cache reads and writes, worktree identity, vim mode, agent name, session name,
thinking state, fast mode, and the Claude Code version. This project shells out to
`gh` and to `git remote get-url` for two of those, and ignores the rest.

**The terminal width is knowable.** Claude Code sets `COLUMNS` and `LINES` before
running the command. The width guard added in the previous feature assumes 120
columns for everyone.

There are also things worth deciding about rather than inheriting: whether a
percentage should be a bar, how many lines the bar should occupy, which colour ramp
means what, what happens on a narrow terminal, and whether a segment that costs a
subprocess still earns its place now that the same value arrives for free.

None of that is decided here. The owner decides, item by item.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every option, decide each one (Priority: P1)

The owner opens one page that lists every candidate change, grounded in what the
payload actually offers and in what other statuslines do. Each item says what it is,
what it would cost, and what it would look like. The owner ticks the ones they want,
says where each should go, and picks between variants where variants exist. Nothing
is pre-ticked.

**Why this priority**: This is the request. Without the page there is nothing to
decide from, and without explicit selection nothing may be built.

**Independent Test**: Open the page, make a set of selections, and produce a summary
that names exactly those selections and nothing else.

**Acceptance Scenarios**:

1. **Given** the page has never been opened, **When** it loads, **Then** every option
   is unselected and the summary is empty.
2. **Given** an option with placement choices, **When** it is selected, **Then** the
   owner can say which line it belongs on before the selection counts as complete.
3. **Given** an option with variants, **When** it is selected, **Then** exactly one
   variant is chosen and the summary names it.
4. **Given** a set of selections, **When** the owner asks for the summary, **Then**
   they get text they can hand back, listing each chosen item with its placement and
   variant.
5. **Given** the page is closed and reopened, **When** it loads, **Then** the previous
   selections are still there.

---

### User Story 2 - Judge each option on evidence (Priority: P2)

Every option on the page carries what it is grounded in: which payload field feeds
it, what it costs to gather, which other statuslines do it, and what a design source
says about it. The owner can tell an option backed by a measurement from one backed
by taste.

**Why this priority**: A list of suggestions with no evidence is a list of opinions,
and the owner asked for research, not preferences.

**Independent Test**: Pick any option on the page and follow it to a named source or
a measurement from this repository.

**Acceptance Scenarios**:

1. **Given** an option that adds a new value, **When** it is read, **Then** it names
   the payload field or the command that produces it.
2. **Given** an option that costs time, **When** it is read, **Then** it states the
   cost against the redraw budget.
3. **Given** the page as a whole, **When** the sources are counted, **Then** there are
   at least 30, each linked and reachable.

---

### User Story 3 - Only the selected changes get built (Priority: P3)

Implementation follows the selection exactly. Nothing else is touched, no matter how
good an idea it looked on the page. Anything the owner did not tick stays on the page
for a later round.

**Why this priority**: It is the constraint the request is most explicit about. It
matters at implementation time, which is after the first two stories.

**Independent Test**: Compare the shipped change against the selection summary; every
change traces to a ticked item and every ticked item is shipped.

**Acceptance Scenarios**:

1. **Given** a selection summary, **When** implementation finishes, **Then** every
   rendered change maps to a selected item.
2. **Given** an item that was not selected, **When** implementation finishes, **Then**
   the statusline behaves exactly as it did before.
3. **Given** a selected item that turns out to conflict with a constitutional rule,
   **When** that is discovered, **Then** it is raised with the owner rather than
   silently dropped or silently built.

---

### Edge Cases

- An option the owner selects that contradicts another option they also selected, for
  example two different segments claiming the same slot.
- A selection that would push a line past the width limit on a narrow terminal.
- A payload field that is absent on the owner's Claude Code version, so a selected
  segment would render nothing on their machine.
- A selected option whose data source is unavailable, such as a repository with no
  remote for the repository-identity option.
- The owner selects nothing, which is a valid outcome and must leave the statusline
  untouched.
- The owner selects everything, which would exceed the width limit and must be
  reported as a conflict rather than quietly trimmed.
- The page is opened on a phone, where the layout still has to be usable.

## Requirements *(mandatory)*

### Functional Requirements

**The review page**

- **FR-001**: The page MUST list every candidate change, grouped by kind, and MUST at
  minimum separate what is shown (information) from how it is shown (design and
  layout). As built it uses six groups: payload values not yet used, values that would
  have to be computed, things to remove or merge, layout and structure, how a number
  is drawn, and behaviour.
- **FR-002**: Every option MUST start unselected. The page MUST NOT express a
  recommendation, a default, or a ranking that amounts to one.
- **FR-003**: Each option MUST be selectable independently, with a control that shows
  its state at a glance.
- **FR-004**: An option whose placement is not obvious MUST let the owner choose where
  it goes: which line, and where in that line's order.
- **FR-005**: An option with more than one reasonable form MUST present the forms as
  named variants with a rendered example of each, and MUST require exactly one to be
  chosen when the option is selected.
- **FR-006**: Each option MUST state what feeds it (payload field, command, or
  derivation), what it costs, and what it would displace.
- **FR-007**: The page MUST produce a summary of the current selection as text the
  owner can hand back, naming each selected item with its placement and variant.
- **FR-008**: Selections MUST survive closing and reopening the page.
- **FR-009**: The page MUST cite at least 30 sources, each linked, and each option
  that came from a source MUST point at it.
- **FR-010**: The page MUST work on a phone and on a desktop, and in both light and
  dark appearance.

**What the catalogue must cover**

- **FR-011**: The catalogue MUST include every payload field the statusline does not
  currently use, each as its own option, with the fields that are already used marked
  as such.
- **FR-012**: The catalogue MUST include the two segments that currently cost a
  subprocess and are available in the payload, stating what dropping the subprocess
  would save.
- **FR-013**: The catalogue MUST include layout options: number of lines, segment
  order, alignment, behaviour on a narrow terminal, and what gets dropped first.
- **FR-014**: The catalogue MUST include presentation options for a percentage: bar,
  number, colour ramp, and the thresholds a ramp changes at.
- **FR-015**: The catalogue MUST include accessibility options, including whether any
  meaning is carried by colour alone.
- **FR-016**: The catalogue MUST include options that would remove or merge something
  currently shown, not only options that add.

**Implementation**

- **FR-017**: Implementation MUST cover exactly the selected items. An unselected item
  MUST leave current behaviour byte-identical.
- **FR-018**: A selected item that conflicts with the project constitution, with
  another selected item, or with the redraw budget MUST be reported back before it is
  built or dropped.
- **FR-019**: Every implemented item MUST be covered by a test and, where it changes
  what renders, by a regenerated preview.
- **FR-020**: The redraw budget of 300 ms and the width limit MUST continue to hold
  after the selected items ship.

### Key Entities

- **Option**: One candidate change. Has a name, a group, what feeds it, its cost, its
  evidence, its variants, its placement choices, and whether the owner selected it.
- **Variant**: One form an option can take, with a rendered example.
- **Placement**: Which line an option belongs on and where in that line's order.
- **Selection**: The owner's answer for one option: chosen or not, with a placement
  and a variant when the option has them.
- **Source**: A linked reference behind an option, either external research or a
  measurement from this repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The page presents at least 40 distinct options across the two groups. As built it presents 68, in six groups.
- **SC-002**: At least 30 sources are cited and every link resolves. As built there are 41.
- **SC-003**: Every option names its data source and its cost.
- **SC-004**: A first-time reader can go from opening the page to a complete selection
  summary without asking a question.
- **SC-005**: The page opens with nothing selected, every time, on a machine that has
  never seen it.
- **SC-006**: After implementation, every rendered difference traces to a selected
  item, and every selected item is present.
- **SC-007**: After implementation, the redraw still finishes inside 300 ms at the
  95th percentile and no line exceeds the width limit.
- **SC-008**: The test suite covers each implemented item in its present and absent
  states.

## The Selection

Handed back on 2026-08-26 from the review page: **55 of the 68 options**. This is the
scope. Nothing outside this list changes.

### Values taken from the payload (12)

| Item | Form |
|---|---|
| A1 Pull request from the payload | number, state, review |
| A2 Repository identity from the payload | owner and repo as text |
| A4 Session duration | hours and minutes |
| A5 Time waiting on the API | absolute |
| A6 Lines added and removed | both |
| A7 Token counts | used of total |
| A8 Context window size | always |
| A10 The 200k warning flag | marker when true |
| A14 Agent name | marker plus name |
| A15 Session name | full name |
| A17 Working directory versus project directory | both when they differ |
| A19 Worktree identity | name and origin branch |

A21 (effort) and A22 (output style) were also selected. Both already render; they are in
scope only as far as C3 changes how they are grouped.

### Values that have to be computed (7)

| Item | Form | Note |
|---|---|---|
| B1 Burn rate on the 5-hour window | percent per hour | needs stored samples |
| B2 Projected exhaustion time | time | derives from B1 |
| B3 Distance to auto-compaction | warning past a threshold | |
| B4 Context trend | sparkline | needs stored samples |
| B8 Merge conflicts | count | already parsed, currently discarded |
| B10 CI status | symbol and workflow | network, background refresh only |
| B12 A clock | 24-hour | needs F1 |

### Removals and merges (7)

| Item | Form |
|---|---|
| C1 Drop the gh subprocess | keep as a fallback when `pr` is absent |
| C2 Drop the git remote lookup | keep as a fallback |
| C3 Merge model, effort and output style | two segments: model, then the rest |
| C4 The weekday on the 7-day segment | keep only past 24 hours |
| C5 The rtk segment | show only when it moves by five points |
| C6 The two reset countdowns | one segment carrying both |
| C7 Directory that repeats the repository name | always keep it |

### Layout (10)

| Item | Form |
|---|---|
| D1 Line count | adaptive by terminal height |
| D2 Terminal width | use `COLUMNS`, fall back to 120 |
| D3 Right-aligned group | reset countdowns right |
| D4 Narrow-terminal behaviour | priority per segment, iTerm2 style |
| D5 Order of lines | unchanged: place, skills, model, usage |
| D6 Order inside line 1 | unchanged: directory, branch, state, PR |
| D7 Skills line | one chip, comma separated |
| D8 Column alignment | align all lines |
| D9 Separators | Powerline, thin as a fallback |
| D10 Colour bands | per segment, as today |

### Encoding (10)

| Item | Form |
|---|---|
| E1 Context | bar and number, revised on 2026-08-26 to number only |
| E2 Bar style | blocks |
| E3 Bar width | scaled to terminal width |
| E4 Context ramp | green, yellow, red at 60/85 |
| E5 Rate-limit ramp | same thresholds as context |
| E6 Meaning never in colour alone | the bar's shape changes too |
| E7 Icon set | unchanged: Nerd Font plus emoji |
| E8 Dim secondary segments | dim the reset countdowns |
| E9 Number formatting | abbreviated |
| E10 Change highlighting | colour instead of frames |

### Behaviour (7)

| Item | Form |
|---|---|
| F1 Refresh interval | every 60 seconds |
| F2 Subagent task rows | match the statusline's style |
| F3 Themes | add Nord and Gruvbox |
| F4 Configuration | unchanged: environment variables |
| F5 Per-repository configuration | selected, form left to the implementer |
| F6 Working or idle | working or idle marker |
| F7 Todo progress | count and current item |

### Revised after seeing it

**Four segments were taken off the line on 2026-08-26**, after the same
look: A7 (token counts as used-of-total), B4 (the context sparkline), A5
(the API-wait figure) and B12 (the clock). Each was built as selected and
each cost width on line 4, which is the line that runs out of room first.
A7 in particular repeated the window size that A8 renders beside it. The
payload readers behind them stay, since the segments that remain use the
same ones.


**E1, the context bar, was removed on 2026-08-26.** It rendered as chosen,
was looked at, and cost ten to sixteen columns on the widest line to say what
the number said in three. The band it carried without relying on colour is
now a one-character mark, which keeps E6 and Section 508 satisfied at a
fraction of the width. The bar itself stays in the subagent task rows, where
a row has a whole line and no other number competing for it.

### Decisions taken on the selection

Four questions came out of reading the selection as a whole, and were answered on
2026-08-26:

1. **The four items that contradict the constitution** (D1, D9, F3, E10) are to be built,
   and the constitution amended to allow them. That amendment is a prerequisite of this
   feature, not a side effect of it.
2. **Colour carries two meanings and had to be split.** The ramp (E4, E5) applies only to
   the context and rate-limit segments. Change highlighting (E10) applies only to branch,
   pull request, skills and model. No segment carries both, so a colour on screen has one
   meaning wherever you find it.
3. **The six items left undecided** (A17, B1, B2, B4 and B12 without a placement, F5
   without a form) are treated as "you decide", the same as the thirty items where that
   was chosen explicitly. Every such decision is reported back.
4. **Order of work**: plan and tasks before implementation.

### What the selection does not fit into

Nineteen new segments, a bar, and alignment padding come to roughly 400 columns against a
120-column limit across four lines. Three selected items are what make that survivable:
D2 gives the real width, D4 gives each segment a priority, and D1 lets the line count
follow the terminal. The priority table D4 needs is a design decision in its own right and
is produced in the plan, for review, before anything is built.

## Assumptions

- The owner reviews the page in a browser and hands the selection back in this
  conversation. The page does not need to reach this repository by itself.
- Presenting an option is not proposing it. The page describes trade-offs, including
  the case against an option, and stops there.
- Options are drawn from the payload documented for the current Claude Code version,
  from what other statuslines do, and from design sources on glanceability and
  accessibility. Where a field requires a minimum Claude Code version, the option says
  so.
- The four-line structure, the Catppuccin palette and the Powerline separators are
  fixed by the project constitution. Options that would change them are still listed,
  marked as requiring a constitutional amendment, so the owner sees the whole space.
- The measurements quoted for cost come from this repository's own benchmark on the
  reference machine, and from the previous feature's research.
- Implementation happens in a later step, after the selection is handed back.
