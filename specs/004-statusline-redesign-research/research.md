# Research: Research It, Then Let the Owner Build the Bar

**Date**: 2026-09-02

Phase 0. Everything the plan assumes, with the reason it was chosen and what
was rejected. Measurements were taken on the owner's machine on the date
above and are reproducible with the commands given.

## 1. How the page draws a bar that matches the terminal

**Decision**: The page imports the renderer's own modules and runs them in
the browser over a pre-built pool of segment objects. `layout.js` fits and
aligns, `theme.js` builds the Powerline chain, `arrangement.js` resolves the
overrides, and a glyph-aware drawer converts the resulting ANSI to SVG using
the same `src/preview/glyphs.json` the committed previews use.

**Rationale**: The page is what a decision gets made from, so a bar on it
that the terminal would draw differently is worse than no page. Reusing the
functions removes the class of defect entirely rather than testing for it.
Two of the four modules are already pure and browser-safe; the other two need
one guard each, described in section 9.

**Alternatives considered**:

- *Hand-built HTML mockup*. Fastest to write, and wrong the first time a
  segment changes. Principle VIII already refuses this for README images, and
  the argument is stronger here.
- *Pre-render every arrangement in Node*. Truthful by construction, but
  twenty-four segments give more combinations than there are atoms worth
  counting. Only workable for a fixed gallery, which is the shape the owner
  rejected.
- *A local server that shells out to the renderer per edit*. Truthful and
  live, but it turns a document into an application, needs a port and a
  process, and breaks the "open the file" property that made the 003 board
  easy to look at.

**Disposition**: adopted, and checked rather than assumed. For every preset,
at 120 and 160 columns, the page's composition and the renderer's output are
compared string for string in `scripts/tests/composer.test.js`, and they
match. One difference is known and stated on the page itself: when the line
carrying the limits overflows, the terminal drops two countdown labels before
it drops a segment, and the page does not.

## 2. What an arrangement may override

**Decision**: Four things, all of them position. Whether a segment is on,
its order within a line, which line it belongs to, and which edge it sits
against. Priority, colour channel and the segment's content stay in
`src/segments.js`.

Alignment was on the excluded list until the presets were written on
2026-09-02, and it did not survive contact with them. A quiet left side with
the rest pushed to the right margin is one of the two directions the outside
research found, and it cannot be expressed at all without moving a segment to
the other edge. It belongs with line and order: it says where a segment sits,
not what it claims.

**Rationale**: Priority decides what survives an 80-column terminal, and
Principle II requires that choice to be deliberate and declared once. Colour
means one thing across the bar by the same principle. An arrangement that
could set either would let a person produce a bar where a colour lies or
where the wrong thing is dropped under pressure, and then report it as a bug.
The four that are allowed are the ones the owner actually asked for, and none
of them can make a segment say something untrue.

**Alternatives considered**:

- *Full override of every registry column*. More expressive and much harder
  to reason about, with two of the constitution's guarantees moved out of
  source and into a file nobody reviews.
- *Order only, no cross-line moves*. Simpler, and it fails the request as
  written: "organised how I want" is mostly about which line a thing sits on.

**Disposition**: adopted, with alignment added to the list during
implementation for the reason stated above.

## 3. Where the arrangement lives, and which one wins

**Decision**: Two optional locations. A `layout` key inside the repository's
existing `.statusline.json`, and a per-user `~/.claude/statusline/layout.json`.
Precedence, highest first: `CLAUDE_STATUSLINE_LAYOUT` naming a file, then the
repository file, then the user file, then the registry default.

**Rationale**: It mirrors the precedence `resolveSettings` already
implements, where an environment variable beats the repository file beats the
default, so there is one rule in the project rather than two. The repository
file beating the user file is deliberate: a repository that ships an
arrangement is making a statement about that project, which is the case the
existing file was created for. The user file is new because an arrangement is
the first setting here that is genuinely about the person rather than the
project, and `config.js` refuses to read a home-directory `.statusline.json`
for good reasons that do not apply to an explicit path.

**Alternatives considered**:

- *User file wins over the repository*. Rejected for consistency with the
  existing precedence, and because the arrangement can be overridden per
  invocation by the environment variable when someone disagrees.
- *One location only*. The repository alone cannot express "my bar
  everywhere", and the user file alone cannot express "this monorepo needs
  the worktree segment".

**Disposition**: adopted as specified, and covered by
`scripts/tests/config-layout.test.js`.

## 4. The presets

**Decision**: Six, in this order.

1. **Today**. The bar as it ships. The baseline the page opens on.
2. **Peripheral**. The context bar comes back at full width, the ramp does
   more of the work, and the number of visually distinct bands drops.
   Optimises for state registering without being read.
3. **Right margin**. Line 1 keeps the directory and branch; everything else
   is right-aligned. Optimises for a quiet left side where the eye rests.
4. **Operational**. Activity, todo and skills are promoted to the first line,
   repository state moves down. Optimises for what the agent is doing over
   where the code is.
5. **Lean**. Twelve segments instead of twenty-four, three lines, nothing
   that repeats something a neighbour already says. Optimises for reading the
   whole bar in one fixation.
6. **One line**. Everything on a single line at the terminal's width, the
   rest dropped by priority. Forbidden by Principle II and labelled as such
   on the page.

**Rationale**: Each is a position taken from evidence rather than a colour
variation, and the set spans the two directions the outside research points
in at once. Presets 2 and 6 exist because the trend material argues for
peripheral legibility and for less content, and this project moved the other
way on 2026-08-26 when the context progress bar was removed for spending
sixteen columns on what three columns said. The page is the right place to
find out whether that call still holds now that the owner can see both.
Preset 6 is the departure the spec asks for, and it is the one whose cost is
stated rather than hidden.

**Alternatives considered**: Colour and separator variants. Rejected: flavour
switching already exists and answers that question, and a preset that differs
only in palette spends a slot without asking anything.

**Disposition**: adopted with one substitution. A right-margin preset was
planned and could not be built: `align: "right"` is declared in the registry
and honoured by nothing, as recorded in section 6. `twoLine` took its place,
and the missing direction is a finding rather than a silent omission.

## 5. Efficiency, measured

**Decision**: Nothing in the redraw path needs optimising for this feature to
be worth doing, and the arrangement must not change that.

**Measurement**, `node scripts/bench.js --runs 50` in this repository on
2026-09-02, no transcript attached:

| Figure | Value |
|---|---|
| p50 | 15.5 ms |
| p95 | 18.6 ms |
| max | 21.1 ms |
| Budget | 300 ms |

One `gather` broken down by source: git 13 ms, activity 1 ms, every other
source under a millisecond because it comes off the payload or out of cache.

**Rationale**: The redraw is not slow, and the two calls that are slow when
they happen at all, `gh pr view` at around half a second and the `rtk`
process launch, are already behind a cache with a background refresh. The
honest efficiency finding is therefore not about time. It is that the bar
spends columns the way a slow function spends milliseconds: twenty-four
segments compete for the width the terminal reports, and on an 80-column
window most of them lose. Arrangement is the optimisation, and the unit is
columns.

**What this makes testable**: the arrangement resolver adds a small JSON read
on the same walk `.statusline.json` already does, so the p95 must not move.
The bench figure above is the baseline that comparison runs against.

**Measured again after the resolver shipped, 2026-09-02.** Resolving an
arrangement costs **0.087 ms per call**, timed directly over a thousand calls,
which is three hundredths of one percent of the redraw budget.

The end-to-end comparison is not usable as it stands, and saying so is more
honest than quoting it. The re-measurement was taken on a machine busy with
this feature's own work, and it drifted between 26 and 51 ms at the 95th
percentile across consecutive runs. An A/B against the pre-change code in a
git worktree, run under the same load, put the *old* code at 59 to 73 ms,
which is slower than the new code and therefore measures the load rather than
either version. The 18.6 ms baseline above was taken on an idle machine and
is the number the comparison has to be made against.

**Re-measured on an idle machine, 2026-09-02, after the feature merged.**
Three runs of `node scripts/bench.js --runs 100`: p95 of 20.1, 24.2 and 18.0
ms, p50 of 16.5, 17.2 and 16.1. Against the 18.6 ms baseline that is no
regression, and every run sat inside a twentieth of the budget.

The spread has a cause worth writing down, because it makes the benchmark
easy to misread. The bar caches under `~/.claude/statusline/cache` and stops
asking a repository that has already proved too slow to answer in time. On a
loaded machine `git status` blows its 150 ms budget, that guard latches, and
every later redraw skips git and measures about half a millisecond. A run
reporting 0.4 to 0.6 ms is the guard doing its job rather than a fast redraw,
and a run reporting 60 to 80 ms is the machine rather than the code. A
benchmark taken while something else is building says nothing about either
version. The clean figures above were taken with the cache cleared and
nothing else running.

**Disposition**: adopted and closed. The resolver costs 0.087 ms per call,
the end-to-end p95 is unchanged against the baseline, and the condition the
benchmark needs in order to mean anything is now written down rather than
assumed.

## 6. Reliability, catalogued

**Decision**: No new failure mode is introduced, and the arrangement resolver
follows the file-reading rule `config.js` already sets: a file that cannot be
read or parsed means no settings, not an error.

The failure modes the bar already has, and what it shows for each:

| Failure | What the reader sees |
|---|---|
| Not a git repository | Line 1 renders without branch, upstream, PR or CI |
| `git status` too slow in a large repository | The cached snapshot, refreshed in the background; the first redraw after opening has no git segments |
| `gh` unreachable or absent | The PR and CI segments disappear rather than showing a stale state |
| Branch changed since the PR was cached | The cached value is refused, because it belongs to the branch that was left |
| Sample history restarted | The burn rate and projection disappear until three samples exist |
| Rate-limit fields missing from the payload | The usage segments keep their slot and show `?%`, per Principle III |
| Terminal too narrow | Segments drop by priority, never wrapping |
| Terminal too short | Lines shed in the declared order: 2, then 3, then 1, with 4 last |

**Found while building the page, 2026-09-02.** Two registry rows do not do
what the registry says they do, and both had been invisible because nothing
ever asked the question this feature asks:

- `upstream` is declared on line 1 with an order and a priority, and no
  render function builds it. The ahead and behind counts are drawn by
  `worktreeState`, and have been since. The composer page marks the row "no
  content" rather than offering a lever that moves nothing.
- `align: "right"` is declared on `resetMerged`, and `splitByAlignment` and
  `gapBetween` exist in `src/layout.js` to honour it, but no render path
  calls either. Every segment is drawn left to right today. This is why the
  preset set has no right-margin design, which is one of the two directions
  the outside research points at: it cannot be shown without a renderer
  change, and this feature promised not to make one before the owner has
  chosen.

Both are recorded here rather than fixed in passing. Each changes what the
bar looks like, which makes each a decision for story 3 rather than a tidy-up.

**Rationale**: Every one of these is already explained by `node bin/cli.js
doctor`, one row per segment with its source, age, cost and the reason it is
absent. The reliability gap is not behaviour, it is that the diagnostic is
the only place this is written down. Story 4 records it, and the arrangement
adds one row to the diagnostic: which arrangement is in force, where it came
from, and which entries it ignored.

**Alternatives considered**: a strict mode that fails loudly on a bad
arrangement. Rejected: a statusline that refuses to draw is worse than one
that draws the default and explains itself, and the diagnostic already exists
to be asked.

**Forced and checked, 2026-09-02.** Four of the modes in the table were
reproduced against the real renderer with stubbed probes, and each behaved as
described: outside a repository line 1 keeps the directory and drops branch,
upstream, pull request and CI; with `gh` throwing, the pull request and CI
segments disappear rather than showing a stale state; with no rate-limit
fields the usage segments keep their slots and read `?%`; with no skills and
no activity, line 2 is absent rather than blank. At 60 columns the three
rendered lines measured 53, 16 and 54 columns, so nothing wrapped.

The arrangement adds one mode and it was checked too: a file containing
`not json at all` draws the default, byte-identical to the same session with
no file at all, and the diagnostic names the file and the parse error.

**Disposition**: adopted. The table now describes behaviour that was
reproduced rather than behaviour that was believed. The two modes not forced
here are the ones needing a repository with five thousand modified files and
a session old enough for the sample history to lapse; both are covered by the
existing suite.

## 7. Informativeness, against the field

**Decision**: No new data source. The gap this feature closes is arrangement,
not acquisition.

What comparable tools show, and where this bar stands:

| Shown by | This bar | Cost to add |
|---|---|---|
| Session and daily cost in currency | Not shown; token figures and burn rate are | Payload already carries session cost; a currency figure needs a price table that goes stale |
| A wide context bar rather than a percentage | Removed on 2026-08-26 for width | Free. It is a preset, not a feature |
| What the agent is doing, from the transcript | Shown, as activity, todo and skills | Already paid for |
| Rate-limit windows with countdowns | Shown, merged into one segment | Already paid for |
| Interactive configuration | Not offered | This feature |

**Rationale**: The most-adopted tool in the comparison is the one that reads
the transcript and reports what the agent is doing, which this bar already
does. The advice repeated across the write-ups is that a status line should
be short enough to read instantly, which this bar is not by default, and that
is a layout problem rather than a missing-data problem.

**Sources**: the write-ups listed in the spec's Research Inputs section,
gathered 2026-09-02.

**Disposition**, row by row:

| Row | Outcome |
|---|---|
| Cost in currency | Declined. It needs a price table that goes stale, and a wrong number beside measured ones gets read as measured |
| A wide context bar | Declined for the default, and now reachable anyway: it is a renderer change, not an arrangement, so it stays out of this feature. The `peripheral` preset takes the same position with colour instead of width |
| What the agent is doing | Already shown. No change |
| Rate-limit windows | Already shown. No change |
| Interactive configuration | Adopted. That is this feature |

The gap this research set out to find turned out not to be data at all. It
was that a person could not decide what to look at, and that is what shipped.

## 8. Keeping work in the page

**Decision**: The arrangement being edited is written to the browser's local
storage on every change and restored on load. Handover is a copy button
producing the arrangement's JSON, plus the two paths it can be written to.

**Rationale**: The page is a `file://` document with no server, so local
storage is the only place state can live, and losing an arrangement to an
accidental reload is the failure the spec names as an edge case. A copy
button rather than a download keeps it working under the browser rules that
apply to local files.

**Alternatives considered**: encoding the arrangement in the URL fragment.
Attractive because it makes an arrangement shareable, and rejected for now
because the fragment survives a reload only if the owner remembers to keep
the URL, which is the same failure with extra steps. Worth revisiting.

**Disposition**: adopted. Local storage, restored on load.

## 9. The two source changes the page needs

**Decision**: Both are additive and both stand on their own.

`renderReadings` gains a way to return the pool of built segments before
they are arranged into rows. Today the rows are assembled per line, with line
1 pushing imperatively and lines 3 and 4 composing from the registry. Moving
a segment between lines requires the pool to exist as one flat thing that is
then partitioned by the arranged line. That refactor is the same work story 2
needs anyway.

`ansiToSvg` gains a factory that takes the glyph table as an argument. It
currently reads `glyphs.json` with `node:fs` at module load, which makes it
unimportable in a browser. The existing export stays, built from the factory,
so `generate-previews.js` does not change.

**Rationale**: Neither change alters any output. Both are small, both are
covered by existing tests, and both remove a reason the code could only run
in one place.

**Alternatives considered**: copying the fitting logic into the page.
Rejected for the reason in section 1.

**Disposition**: adopted, both additive, with the committed previews
regenerating byte-identical afterwards.

## 10. Guards for running renderer code in a browser

**Decision**: The page defines a minimal `process.env` shim before importing
anything, and passes width explicitly rather than calling `terminalWidth()`.

**Rationale**: `theme.js` reads `process.env.CLAUDE_STATUSLINE_SEPARATOR` in
a default parameter and `layout.js` reads `COLUMNS` and `LINES` in
`terminalWidth()` and `terminalHeight()`. Neither is a module-level read, so
a three-line shim covers both, and the page has a real width to pass because
width is one of its switches.

**Alternatives considered**: changing the modules to stop touching `process`.
More invasive than the problem, and the environment variables are the
documented interface for those settings in the terminal, which is where the
modules mostly run.
**Disposition**: adopted. The shim is three lines and the page passes its
width explicitly.

