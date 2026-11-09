---
track: full
status: active
---

# Bar resilience: icons that mean one thing, a width that is the window's, a redraw that costs little

**Feature Branch**: `feat/079-bar-resilience`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "revise a interface do statusline em busca de falhas, na exibição dos
ícones, redimensionamento, performance etc e crie uma spec para corrigir isso, deixe os detalhes na
spec de forma minuciosa e detalhada."

**Track**: `full`. The work crosses `layout.js`, `render.js`, `freshness.js`, `changeTracker.js`,
`install.js`, the glyph tiers, the doctor and the docs, and several decisions below need a reason
recorded (which width wins, what a redraw may skip, which glyphs change). A `plan.md` and a
`tasks.md` follow this spec.

## Context: what this audit found, with the measurements

Every figure here was measured on 2026-11-09 against `main` at `6ee6bfd` (v1.66.4), on the
owner's machine (macOS, Node 24.22.1, Ghostty 1.4.0, `Hack Nerd Font Mono`). Where a claim could
not be measured it is marked **unverified** and the spec says how to measure it.

### Performance

| Measurement | Value | How |
|---|---|---|
| One `render` process, wall time | 160 to 230 ms | `/usr/bin/time -p` over 8 runs, `COLUMNS=160`, this repository as `cwd` |
| Same, CPU (user+sys) | 160 to 190 ms | same runs |
| Of which: Node start | ≈ 26 ms | `node -e 'process.uptime()'` |
| Of which: importing `src/render.js` and its graph | ≈ 50 ms | `performance.now()` around `import()` |
| Of which: `spawnSync` (git) | ≈ 18 ms | `--cpu-prof`, self time |
| Of which: `taskRows.js` module evaluation | ≈ 13 ms | `--cpu-prof`, self time of the module's top-level |
| Of which: the bar's own logic ("redraw" in `doctor`) | 40 to 80 ms | `doctor` at 80 to 300 columns |
| Detached refresh | adds nothing to the redraw's wall time | `CLAUDE_STATUSLINE_NO_REFRESH=1` vs unset: 0.16 to 0.18 s both |
| Installed cadence | every 2 s (`refreshInterval: 2`, since v1.66.3) | `~/.claude/settings.json` |

So a session that sits idle now spends roughly **170 ms of CPU every 2 s, 7 to 9 % of one core,
per open Claude Code session**, where before v1.66.3 it was the same cost every 60 s. The
`subagentStatusLine` command is a second process on its own tick. Two things make this worse than
it needs to be:

- The bar does the whole job on every redraw even when nothing it reads has changed: it imports
  ~60 modules, runs `git` directly when the last run was cheap (`gitCost` under the budget, which
  it is here at 18 ms), reads the transcript tail, the `/usage` cache, the samples, and writes
  the per-session state file unconditionally (`changeTracker.js:118-125`, `saveState` has no
  "changed?" guard).
- `freshness.js` still declares `REDRAW_INTERVAL_MS = 6_000` and `MAX_AGE_MS.git: 5_000`, and the
  README still says "with the installed 60-second refresh" (`README.md:1249`). These were tuned
  for a cadence that no longer exists. With a 2 s cadence and a 5 s git age, the direct `git`
  runs on every redraw in a cheap repository and the detached refresh is started every ~2.5 s in
  an expensive one (a refresh is due at half the age).

### Width and resize

| Finding | Evidence |
|---|---|
| The width now comes from `/dev/tty` on each redraw, `COLUMNS` second (v1.66.3, specs/079 note in `layout.js`) | `terminalFor` |
| In a pty with `COLUMNS=200` fixed, line 3 is 90, 130 and 220 columns at pty widths 90, 130, 220 | `script` + `stty cols` |
| The pinned help chip is present and no line overflows from 30 to 120 columns, full and empty payloads | `renderPayload` with `maxWidth`, `displayWidth` per line |
| **Unverified**: what `COLUMNS` Claude Code sets, and whether it is the terminal's width or the width of the area the status line is drawn in (the old comment in `terminalFor` said "with its own layout already taken into account") | needs a dump from inside a real session; see FR-010 |
| **Unverified**: whether Claude Code's `COLUMNS` is updated on resize before the next redraw, or stays at the value from spawn | same dump, before and after a resize |
| `rows` now also comes from `/dev/tty` first (v1.66.3). Before, under Claude Code, `LINES` was unset and `rows` was `Infinity`, so `linesToRender` never shed a line and the gate/agent rows always fit. Now the **terminal's** height gates them, which is the wrong quantity: the status line never gets the whole terminal | `terminalFor`, `render.js:2607`, `render.js:2647` |
| `fitToWidth` with a pinned chip returns an overflowing row when the budget for the other chips reaches zero (`budget <= 0` exit) | `layout.js`, pinned block; only below ≈ 12 columns |
| Agent rows (`task-rows`) size themselves from `payload.columns`, default 80, not from the terminal, so at 160 columns the rows are 80 wide under the bar | `taskRows.js:564` |
| `doctor` says "the window's size, read from /dev/tty on this redraw" for columns and prints the tty's rows, which under Claude Code is not the height the bar has | `doctor.js:604-613` |

### Icons

| Finding | Evidence |
|---|---|
| Every Nerd Font codepoint the renderer emits (54) has an outline in `src/preview/glyphs.json`; the help page and previews are complete | script over `render.js` and the table |
| 30 of the 54 are in the supplementary private-use plane (`U+F0000+`, the `nf-md` set). Some terminals and fonts draw plane-15 glyphs two cells wide or clip them (**unverified** here; known for non-"Mono" Nerd Font variants, where icons are proportional and overlap the next cell). The bar counts every Nerd glyph as one column (`theme.js`, `displayWidth`) and has no way to learn otherwise | `theme.js` width rules; the owner uses a Mono variant, so this machine cannot show it |
| **Glyphs shared across different meanings.** Nerd: `U+F4A4` for `reviewApproved`, `ciPass` and `clean`; `U+F004D` for `from` and `mcp`; `U+F051F` for `timer` and `cacheWarmHalf`. Emoji: `⏳` for `timer`, `cacheWarm` and `cacheWarmHalf`. Plain: `?` for `help` and `untracked` (and `?` is also the unknown-figure text beside a reset glyph: `󰓦 ?`), `!` for `bandCritical`, `yourTurn` and `unavailable`, `✓` for `reviewApproved`, `ciPass` and `clean`, `⇄` for `prDraft`, `prMerged` and `prClosed`, `⧗` for all three cache-warm states | script over the three tiers |
| In the plain tier, the help chip is a bare `?` at the right end of a line that can also end in `󰓦 ?`; the two are indistinguishable without colour | render at 80 columns, empty payload |
| Emoji tier uses `🪙` (U+1FA99, Unicode 13) and `🧊` (U+1F9CA, Unicode 12); on a system emoji font older than those they are tofu | tier table |
| OSC 8 links get `ESC[4:4m` (dotted underline) only on terminals in `STYLED_UNDERLINE`; the test suite deletes `TERM_PROGRAM` so the golden never carries it. Correctly gated; noted because an unlisted terminal that supports it gets no underline and a listed one that does not would print the sequence | `theme.js:322-345` |

### Install and docs

| Finding | Evidence |
|---|---|
| `statusLine.command` is `node "…/cli.js" render` (PATH lookup) while `subagentStatusLine.command` is `/Users/…/.nvm/versions/node/v24.22.1/bin/node "…/cli.js" task-rows` (absolute, version-pinned). A change of the default Node, or removing that version, breaks the rows and not the bar, or the other way round | `~/.claude/settings.json` |
| spec 071 still describes the account chip as "the account's organisation name and the account kind, `Acme · credits`" (`specs/071-line-3-credits-seat/spec.md:52`); the chip now says `personal`/`business` (PR #85) | grep |
| `samples.js` and README were tuned for the 60 s cadence; `pushSample` got a one-minute floor in v1.66.4 but the README's explanation (`README.md:1245-1255`) still reasons from 60 s | grep |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A redraw every two seconds that the machine does not notice (Priority: P1)

The owner keeps two or three Claude Code sessions open all day on a laptop. Each one redraws the
bar every two seconds so the `?` follows a resize and the countdowns move. The fan must not know.

**Why this priority**: the 2 s cadence is what makes resize work (specs/079 note, PR #91), and it
multiplied the bar's idle cost by thirty. Everything else in this spec is cosmetic next to a
status line that is a measurable share of a core.

**Independent Test**: run `render` 20 times with the same payload, `cwd` and width, two seconds
apart, in a repository where nothing changes. Measure CPU per run. Compare the printed bar of run
N with run N-1.

**Acceptance Scenarios**:

1. **Given** a redraw whose inputs (payload fields that reach the bar, width, height, minute of the
   clock, the cached entries' versions, the transcript tail's size and mtime, the samples ring)
   are identical to the previous redraw's, **When** `render` runs, **Then** it prints the previous
   output and exits having spent at most 60 ms of CPU, with no `git`, no transcript read and no
   state write. (`doctor` reports the redraw as "replayed" with the reason the inputs matched.)
2. **Given** the same, **When** any input differs (a field, the width, the minute), **Then** the
   bar is computed in full and the result replaces the stored one.
3. **Given** a full redraw, **When** it runs, **Then** no module that the printed segments do not
   need is imported (Codex, Copilot and OpenCode paths are not loaded under Claude Code), and
   Node's compile cache is enabled so the second process in a session compiles nothing.
4. **Given** an hour of idle session at 2 s, **When** CPU is summed, **Then** it is under 3 % of
   one core on the reference machine (down from 7 to 9 %).
5. **Given** `MAX_AGE_MS.git`, **When** the installed `refreshInterval` is 2 s, **Then** `git` is
   not run by the redraw or the refresh more than once every 10 s in a quiet repository.

---

### User Story 2 - The bar is exactly as wide as the place it is drawn in (Priority: P1)

A person moves a Claude Code window between a laptop screen, a monitor and an ultrawide, and drags
its edge. The `?` is always the last thing on line 3, touching the right edge, and no line ever
wraps.

**Why this priority**: a wrapped line costs a terminal row and scrolls the conversation; a chip
past the edge is invisible. Both are the complaint that started this work. v1.66.3 fixed the
common case; the remaining risks are unmeasured.

**Independent Test**: in a real Claude Code session, with `CLAUDE_STATUSLINE_DEBUG=1`, read the
dump of `COLUMNS`, `LINES` and the tty size before and after a resize; render at each and check
`displayWidth` of every line against the smaller of the two widths.

**Acceptance Scenarios**:

1. **Given** both `COLUMNS` and a tty width are known, **When** they differ, **Then** the bar fits
   the smaller one (never the larger: a narrow bar costs nothing, a wrap costs a row), less the
   margin of FR-011 when it is set.
2. **Given** only one is known, **When** rendering, **Then** that one is used; with neither, 120.
3. **Given** a window narrower than the pinned chip plus the highest-priority chip, **When**
   rendering, **Then** the help chip yields (it is the one unpinned in that case) and the row does
   not overflow.
4. **Given** the terminal is 40 rows tall, **When** rendering under Claude Code, **Then** no line
   is shed and gate/agent rows are gated by `LINES` when Claude Code sets it, else never; the
   tty's row count is used only under Copilot, where it was already.
5. **Given** agent rows are drawn under a 160-column bar, **When** the payload carries no
   `columns`, **Then** the rows take the bar's width, not 80.

---

### User Story 3 - Every icon means one thing (Priority: P2)

A reader learns the bar once. A glyph seen on line 1 for "approved" is not the same glyph that
means "clean tree" on the same line; the hourglass that means "5-hour window" is not the one that
means "warm cache"; the `?` that opens the help is not the `?` that says "untracked" or "unknown".

**Why this priority**: the help page explains every chip by its glyph. Two cards with the same
picture undo the page's job, and in the plain tier the help chip is indistinguishable from an
unknown figure.

**Independent Test**: the test that already maps each tier (`chip-copy`, `emoji-tier`) gains an
assertion: within a tier, a glyph is shared only by the meanings this spec lists as deliberately
shared.

**Acceptance Scenarios**:

1. **Given** the plain tier, **When** the help chip is drawn, **Then** it is not a bare `?`;
   it is a glyph used nowhere else on the bar (candidate: `ⓘ` U+24D8 is Ambiguous; `¿` U+00BF is
   Narrow and unused; decision in the plan), and `untracked` keeps `?`.
2. **Given** the nerd tier, **When** `timer` and `cacheWarmHalf` are drawn, **Then** they differ;
   `from` and `mcp` differ; `reviewApproved`, `ciPass` and `clean` may share a check mark (three
   "good" states on line 1, deliberately alike) and that sharing is listed.
3. **Given** the emoji tier, **When** the cache states are drawn, **Then** `timer` keeps `⏳` and
   the cache states use a glyph of their own; the three warm states may share one.
4. **Given** the glyph table changes, **When** `scripts/extract-glyphs.py` runs, **Then** every
   new codepoint has an outline and the help page regenerates with the new cards.

---

### User Story 4 - A terminal that draws Nerd glyphs two cells wide still gets a straight bar (Priority: P3)

A person uses a non-Mono Nerd Font, or a terminal that draws plane-15 glyphs double width. Their
chips overlap or the line is longer than the bar thinks.

**Why this priority**: the owner's machine cannot show it, so it is **unverified**, and it has no
report yet. It is here because the bar has no lever for it at all and the fix is small.

**Independent Test**: set the new switch and check every Nerd glyph is counted as two columns by
`displayWidth` and the fitted rows still match the width.

**Acceptance Scenarios**:

1. **Given** `CLAUDE_STATUSLINE_NERD_WIDTH=2`, **When** rendering, **Then** every private-use glyph
   counts two columns and the layout fits accordingly.
2. **Given** `doctor`, **When** it prints the icons line, **Then** it names the font family it can
   see (Ghostty's config, iTerm's profile, or "unknown") and says "a Nerd Font **Mono** variant
   draws one cell per icon; set `CLAUDE_STATUSLINE_NERD_WIDTH=2` if icons overlap". The README and
   the help page carry the same sentence.

---

### User Story 5 - The install writes one truth (Priority: P3)

`install` and `update` leave the two commands in `settings.json` resolving Node the same way, and
the docs describe the bar that is installed.

**Acceptance Scenarios**:

1. **Given** `install` runs, **When** it writes `statusLine.command` and
   `subagentStatusLine.command`, **Then** both use the same Node reference (the resolved absolute
   path of the Node running the install, or both bare `node`; decision in the plan), and `doctor`
   warns when they differ.
2. **Given** the docs, **When** read, **Then** spec 071's account wording, README's refresh and
   sample explanations and `freshness.js`'s `REDRAW_INTERVAL_MS` match the shipped behaviour.

---

### Edge Cases

- `COLUMNS` set but not a positive integer; tty open fails with `ENXIO` (no controlling terminal,
  as under some CI and some IDE terminals): fall through in order, never throw.
- A resize that happens between the tty read and the print: the bar may be one redraw late, never
  wrapped on the next one.
- Width below the pinned chip plus the top-priority chip (≈ 12 columns): see US2 scenario 3.
- `LINES=1`: line 3 only; the help chip still present.
- The memoised output is from a previous version of the plugin (the install updated between two
  redraws): the stored record carries the plugin's commit; a mismatch forces a full redraw.
- The memoised record is unreadable or half-written: treat as absent, redraw in full, overwrite
  atomically (tmp + rename, as `cache.js` does).
- A clock that jumped: the minute key differs, full redraw; the samples ring already drops
  out-of-order samples.
- `CLAUDE_STATUSLINE_NERD_WIDTH` set to anything but `1` or `2`: ignored, `doctor` says so.
- A glyph change lands while a help page is cached in a browser: the page is regenerated with the
  tiers, so the cards and the bar change together in one release.

## Requirements *(mandatory)*

### Functional Requirements

**Performance**

- **FR-001**: A redraw MUST be able to replay its previous output when its inputs are unchanged.
  The record (per session, beside the change-tracker state) holds: the plugin commit, the width
  and height used, the minute of the clock, a hash of the payload fields the bar reads, the
  versions (`at`) of every cache entry it read, the transcript tail's `size` and `mtime`, the
  samples ring's last `at`, and the printed output. A replay reads that record and the current
  payload only, prints, and exits. `doctor` reports "replayed" or "computed" and why.
- **FR-002**: A replay MUST NOT run `git`, read the transcript, read `~/.claude.json`, write the
  change-tracker state or the samples, or start the detached refresh. The refresh's own schedule
  (`shouldRefresh`) is honoured by the next computed redraw; a replay MAY start it when an entry
  is past its age, since that is a `spawn` and not work in this process.
- **FR-003**: `saveState` in `changeTracker.js` MUST write only when the serialised state differs
  from what it last wrote (compare the string, not the object).
- **FR-004**: Node's compile cache MUST be enabled for `render` and `task-rows`
  (`module.enableCompileCache()` where available, Node ≥ 22.1; a no-op elsewhere), with the cache
  directory under the plugin's state root so a clone update invalidates it.
- **FR-005**: Modules that only a harness other than the current one needs (Codex, Copilot,
  OpenCode paths) MUST be imported lazily, after `detectHarness`. The import graph of a Claude
  Code redraw is measured in the suite and may not grow past the figure recorded in the plan.
- **FR-006**: `freshness.js` MUST derive `REDRAW_INTERVAL_MS` from the installed `refreshInterval`
  when known (the install writes it to the state root), else from the constant in `install.js`,
  so the two never disagree. `MAX_AGE_MS.git`, `branch`, `conflicts` and `worktreeState` MUST be at
  least `max(10 s, 5 × interval)`, so a 2 s cadence does not run `git` every redraw.
- **FR-007**: The measured per-redraw CPU of a replay MUST be under 60 ms and of a full redraw
  under 150 ms on the reference machine (`scripts/bench.js` gains both cases and the suite
  asserts the replay path does not call `spawnSync`).

**Width, height and resize**

- **FR-008**: `terminalFor` MUST take the **smaller** of `COLUMNS` and the tty width when both are
  known, then the one that is known, then 120. `source` names which won (`tty`, `COLUMNS`,
  `min(tty,COLUMNS)`, `default`).
- **FR-009**: Rows MUST come from `LINES` when set, else `Infinity`, under every harness except
  Copilot, which keeps `/dev/tty` rows as specs/033 designed. The tty's row count MUST NOT gate
  line shedding or the rows after the bar under Claude Code.
- **FR-010**: `CLAUDE_STATUSLINE_DEBUG=1` MUST also write `debug-last-env.json` with `COLUMNS`,
  `LINES`, `TERM_PROGRAM`, the tty size as read, the width chosen and its `source`. The plan's
  first task is to run this inside a real session before and after a resize and record the
  values here, so FR-008's tie-break is confirmed or changed before it ships.
- **FR-011**: `CLAUDE_STATUSLINE_WIDTH_MARGIN=<n>` (default 0, integer 0 to 8) MUST reserve `n`
  columns at the right of every line. It exists for a host that draws the bar in less than the
  width it reports; `doctor` shows it when set.
- **FR-012**: `fitToWidth` with pinned segments MUST never return a row wider than `width`: when
  the pinned set alone does not fit with the top-priority free segment, the pinned flag is
  dropped for that row and the ordinary priority fit runs.
- **FR-013**: `task-rows` MUST size its rows from, in order, `payload.columns`, the bar's stored
  width from FR-001's record for the same session, the tty width, 80.
- **FR-014**: `doctor`'s `terminal:` line MUST say which width source won and, for rows, "LINES
  not set, every line drawn" under Claude Code rather than the tty's row count.

**Icons**

- **FR-015**: Within a tier, a glyph MAY be shared only by the meanings in this list; a test
  asserts the list. Nerd: `reviewApproved`/`ciPass`/`clean` (check), the track and effort families
  (three positions of one picture). Emoji: `working` frames; `idle`/`sleeping`; the three
  `cacheWarm*` states. Plain: `dir`/`home`; the track and effort families; the three `cacheWarm*`
  states; `idle`/`sleeping`.
- **FR-016**: These MUST change: nerd `timer` vs `cacheWarmHalf` (one of them moves; the cache
  keeps the hourglass family so its three states stay a sequence, `timer` takes another timer
  glyph, candidate `nf-md-timer_sand` `U+F051E` is already the cache's; pick `nf-md-progress_clock`
  `U+F0995` or `nf-fa-clock_o` `U+F017`, decision in the plan); nerd `from` vs `mcp`; emoji
  `cacheWarm*` leave `⏳` to `timer` (candidate `♨` or `🔁`, must be two columns like the rest of
  the tier); plain `help` leaves `?` to `untracked`; plain `!` is split (`bandCritical` keeps `!`,
  `yourTurn` and `unavailable` take their own); plain `⇄` is split for `prDraft`/`prMerged`/
  `prClosed`; plain `⧗` for the warm cache may stay a family.
- **FR-017**: Any new codepoint MUST be: one column (Narrow or Nerd) in the nerd and plain tiers,
  two in emoji; absent from the `AMBIGUOUS` set unless added there; extracted into
  `src/preview/glyphs.json` (nerd); and present in the help page's cards. The emoji tier MUST NOT
  add a codepoint newer than Unicode 12 without a note in the README's compatibility table, and
  `🪙` (Unicode 13) gets that note now.
- **FR-018**: `CLAUDE_STATUSLINE_NERD_WIDTH=2` MUST make `displayWidth` count every private-use
  glyph (BMP `U+E000-F8FF` and plane 15 `U+F0000-FFFFD`) as two columns. `doctor`, the README and
  the help page explain when to set it (non-Mono Nerd Font, a terminal that draws plane-15 glyphs
  double). `doctor` MUST print the font family when it can read it from the terminal's config
  (Ghostty: `~/.config/ghostty/config` `font-family`; others: "unknown").

**Install and docs**

- **FR-019**: `install` MUST write `statusLine.command` and `subagentStatusLine.command` with the
  same Node reference. Decision for the plan: the absolute path of `process.execPath` for both
  (stable across PATH changes; `update` rewrites it, so a Node upgrade is picked up on the next
  `update`), with `doctor` warning when the file no longer exists.
- **FR-020**: Docs MUST match: spec 071 line 52 (account chip wording), README `refreshInterval`
  and samples paragraphs, `freshness.js` and `samples.js` comments that cite 60 s or 6 s, the
  constitution's Sync Impact Report (MINOR: the bar MAY replay an unchanged redraw; MAY read the
  terminal's font family from the terminal's own config, never anything else from it).

### Key Entities

- **Redraw record**: `{ commit, width, height, minuteKey, payloadHash, cacheVersions, transcript:
  { size, mtime }, samplesAt, output }`, one per session, in the change-tracker's state directory,
  written atomically, swept with it.
- **Width decision**: `{ columns, rows, source }` where `source ∈ { tty, COLUMNS, min(tty,COLUMNS),
  default }` plus `margin`.
- **Glyph sharing list**: the explicit allow-list of FR-015, kept beside the tiers and asserted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Idle CPU per Claude Code session at the 2 s cadence falls from 7 to 9 % to under 3 %
  of one core on the reference machine, measured over 60 redraws with `/usr/bin/time`.
- **SC-002**: A replayed redraw spends under 60 ms CPU and performs zero `spawnSync` calls (the
  suite asserts via a stubbed `child_process`).
- **SC-003**: With `COLUMNS` and the tty disagreeing in either direction, no printed line is wider
  than the smaller of the two, at every width from 20 to 400 (host-fixture test extended).
- **SC-004**: Under Claude Code with the terminal at 10 rows and `LINES` unset, all three lines
  and the agent rows are drawn (today line 2 is shed).
- **SC-005**: Within each tier, no glyph is shared outside FR-015's list (new test, fails on
  `main` today for the seven collisions found).
- **SC-006**: `CLAUDE_STATUSLINE_NERD_WIDTH=2` renders every width from 60 to 300 without a line
  wider than the width (host-fixture run twice).
- **SC-007**: `install` on a clean HOME writes identical Node references into both commands; the
  install test asserts it.
- **SC-008**: `README.md`, `specs/071`, `freshness.js` and `samples.js` contain no sentence that
  reasons from a 60-second or 6-second cadence (grep in the docs test).

## Assumptions

- Claude Code re-runs the status line command on its own events and every `refreshInterval`
  seconds (documented minimum 1 s); it does not notify on resize. A resize is therefore seen at
  the next tick, and 2 s stays the installed default.
- `/dev/tty` reports the terminal's full size. Whether Claude Code's `COLUMNS` is that size, a
  smaller area, or stale after a resize is **unknown until FR-010's dump is taken**; FR-008's
  "smaller wins" is safe under every answer (a narrow bar never wraps), and the dump may let a
  later spec choose the exact value instead.
- The owner's terminal uses a Mono Nerd Font; FR-018 is for other people's and is unverifiable
  here, which is why it is a switch and a doctor hint, not detection.
- `module.enableCompileCache` exists in Node ≥ 22.1; the package declares `node >= 18`, so it is
  called behind a feature check.
- Replaying output is safe because the bar is a pure function of the inputs the record lists;
  anything the bar reads that is not in the record (a new source) must be added to the record in
  the same change, and the test that stubs `spawnSync` catches a source that spawns.

## Out of scope

- Detecting glyph width from the terminal (no portable query exists; `CPR` after printing a glyph
  would cost a round-trip the status line cannot afford).
- Making Claude Code emit a resize event or a `terminal_width` field (upstream).
- The Ghostty `link-previews` hover behaviour over the help chip (terminal setting, documented in
  the help page's "switches" section instead).
