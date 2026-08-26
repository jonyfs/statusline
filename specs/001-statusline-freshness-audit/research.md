# Phase 0 Research: Statusline Line-by-Line Audit and Freshness Guarantees

**Feature**: `specs/001-statusline-freshness-audit`
**Date**: 2026-08-25

All timings below were measured on the reference machine (macOS 24.6.0, Node 18+,
this repository) on 2026-08-25. Every command shown was actually run; no figure here
is estimated.

## Baseline: where a redraw spends its time

| Work | Cost |
|---|---|
| Whole redraw, this repo, PR lookup warm | 680 ms |
| `gh pr view --json ...` alone | 540 ms |
| Four separate git calls (branch, ahead/behind, status, remote) | 131 ms |
| `readFileSync` of a 78 MB transcript | 235 ms |
| `split("\n")` on that string | 86 ms |
| Parsing the last 2,000 lines | 20 ms |
| Sum of every timeout, if all sources hang | ~9.5 s |

Two findings stand out. The transcript read is the only cost that grows with session
age, and it dominates everything except the network call. The PR lookup is the single
most expensive source and the one least likely to have changed since the last redraw.

## Decision 1: read the transcript from the tail, not the whole file

**Decision**: Read the transcript backwards in chunks through a file descriptor,
stopping as soon as enough recent skills are found or the entries being read fall
outside the activity window. Cap the total bytes read per redraw.

**Rationale**: Measured on the same 78 MB transcript, reading the final 2 MB through
`openSync`/`readSync` took 9 ms and parsing it took 8 ms, against 321 ms for the
current full read and split. That is the difference between a cost that grows all day
and one that does not.

One complication showed up in the measurement: 2 MB of that transcript held only 153
lines, because individual entries run to several kilobytes. A fixed tail size is
therefore not enough on its own. Chunks have to be read backwards until either the
skill limit is satisfied or a timestamp older than the window appears, with a hard
byte cap so a pathological transcript cannot blow the budget.

The first line of any chunk that does not start at byte 0 is a partial line and gets
discarded, exactly as the measurement did.

**Alternatives considered**:

- Remember a byte offset between redraws and read only what was appended. Rejected as
  the primary mechanism: transcripts get compacted and rewritten mid-session, so a
  remembered offset can point into the middle of a line of a different file. It stays
  available as an optimization once the tail read is correct.
- Keep the full read but cache the parsed result by file size and mtime. Rejected:
  the file changes on nearly every turn, so the cache would almost never hit.

## Decision 2: one git call instead of four

**Decision**: Replace the branch, ahead/behind and status calls with a single
`git --no-optional-locks status --porcelain=v2 --branch -z`.

**Rationale**: Measured over 20 runs each, the combined call takes 31.7 ms against
131.2 ms for the four separate calls. It also fixes a correctness problem: the
current code reports `ahead 0, behind 0` both when a branch is in sync and when it
has no upstream at all. Porcelain v2 emits `# branch.ab` only when an upstream
exists, so the two cases become distinguishable, which is what FR-012 asks for.
Verified in a throwaway repository with no remote: the header is absent and
`git rev-list @{u}...HEAD` fails with `fatal: no upstream configured`.

`--no-optional-locks` keeps a redraw from taking the index lock, so redrawing during
a rebase or a long checkout cannot contend with the user's own git command. `-z`
removes the quoting rules that apply to paths with spaces or non-ASCII characters.

The remote URL stays a separate call but moves behind a cache: a repository's origin
changes on the order of never.

**Alternatives considered**: `git status --porcelain=v1` plus `git rev-parse
--abbrev-ref`. Rejected, since v1 has no branch header and would keep the second
call.

## Decision 3: expensive sources answer from cache, refreshed out of band

**Decision**: The PR lookup and the savings lookup read from a per-repository cache
file. A redraw uses the cached value when it is within its maximum age, shows nothing
when it is not, and starts a detached one-shot refresh process when the value is
older than half its maximum age. The refresh writes the cache and exits.

**Rationale**: The PR lookup is 540 ms on a warm network and the whole 2 s timeout
when the network is unreachable or the CLI is not authenticated. It cannot be on the
path of a 300 ms redraw. It also changes rarely, so a value up to 60 seconds old is
honest.

Refreshing at half the maximum age means the cache is normally replaced before it
expires, so the segment does not flicker between present and absent (FR-006). A lock
file holding the refresh start time stops every redraw from spawning its own process:
if a refresh started less than its maximum age ago, no new one starts.

This is not a daemon. Each refresh is a process that does one lookup and exits, and
if none ever runs the statusline still renders, only without those two segments.

**Alternatives considered**:

- Keep the calls inline with a much shorter timeout, such as 150 ms. Rejected: on a
  warm network the lookup takes 540 ms, so a 150 ms timeout means the segment is
  essentially never shown.
- A long-running background process. Rejected: nothing in this design needs to
  outlive a redraw, and a daemon adds lifecycle, restart and cleanup problems the
  project does not have today.

## Decision 4: a hook makes the skills line immediate, and is optional

**Decision**: Ship an optional Claude Code `PostToolUse` hook matching the `Skill`
tool that appends the skill name and a timestamp to a small per-session file. The
skills segment reads that file when it exists and falls back to the bounded tail
read when it does not.

**Rationale**: Reading a few hundred bytes is faster than any transcript scan, and
the hook fires when the skill is invoked rather than when the transcript happens to
be flushed, which removes the lag entirely. FR-019 requires the fallback path to meet
the same budget on its own, which Decision 1 already does. The hook is an
optimization, never a dependency.

The file is appended to, never rewritten, so a hook running while a redraw reads
cannot produce a half-written record. It is keyed by session and swept on the same
schedule as the existing animation state.

**Alternatives considered**: A `SessionStart` hook to pre-warm the caches. Kept as a
possibility for a later feature; it saves only the first redraw of a session, which
is not where the reported pain is.

## Decision 5: honest staleness, never a stale value dressed as current

**Decision**: Every cached value carries the time it was gathered. A segment renders
only when its value is within the maximum age FR-004 sets for it. Past that, the
segment disappears.

**Rationale**: Principle III forbids showing a number that is not the real one. A PR
state from ten minutes ago rendered identically to one from this second is exactly
that. Dropping the segment is consistent with how the statusline already handles a
missing source, and a reader already knows a segment can be absent.

**Alternatives considered**: Mark stale values visually, with a dimmed colour or a
tilde. Rejected for now: it spends width on a state that should be rare, and the
diagnostic in FR-016 already explains an absence when someone asks.

## Decision 6: concurrent writers and atomic files

**Decision**: Every cache and state file is written to a temporary file in the same
directory and then renamed over the target. Readers treat a parse failure as a cache
miss.

**Rationale**: Two sessions in the same repository redraw independently, and a
detached refresh can write while a redraw reads. `rename` within a directory is
atomic on all three target platforms, so a reader sees either the old file or the new
one. This matches how the existing animation state already fails safe, and keeps
Principle X's rule that state must never break rendering.

## Decision 8: git answers from cache when the repository is too big to ask

**Decision**: The git snapshot is gathered synchronously with a 150 ms budget. When
git answers inside it, which is the normal case, the reading is fresh and is written
to the cache. When it does not, the redraw falls back to the cached snapshot if one
is inside its 5-second maximum age, and starts a detached refresh with a 10-second
budget. A redraw never waits longer than the budget for git.

**Rationale**: This came out of building the SC-001 fixture. A repository with 5,000
modified tracked files costs far more than the budget, measured over six runs each on
the reference machine:

| Command | Median |
|---|---|
| `status --porcelain=v2 --branch -z` | 812 ms |
| the same with `-uno` | 718 ms |
| the same with `-unormal --ignore-submodules=all` | 650 ms |
| `status --porcelain -z` (v1) | 633 ms |

No flag combination brings it near 300 ms, because the work is inherent: git stats
and diffs every one of those files. The 31.7 ms measured in Decision 2 holds for an
ordinary repository, and that is what almost every redraw sees.

The alternative would be to let git run as long as it likes, which puts an 800 ms
source on a 300 ms path, or to abandon it at the budget and show no branch at all in
exactly the repositories where the branch matters most. Caching keeps the segment and
keeps the budget. A cached snapshot at most 5 seconds old is still inside the
one-redraw maximum age FR-004 sets for working-tree state.

What this costs: the first redraw after opening such a repository shows no git
segments, because there is nothing cached yet and the synchronous attempt is
abandoned at 150 ms. The next redraw, five or six seconds later, has them. That is
visible and bounded, unlike a bar that freezes for most of a second on every redraw.

Two things came out of building it. Asking git on every redraw and abandoning the
call at the budget still costs the whole budget: measured over 100 runs in the
5,000-file fixture, p95 was 180 ms, of which git was 150 ms spent learning nothing.
So the cost of the last attempt is recorded alongside the snapshot, and a repository
that has already failed the budget is read from cache until a refresh says otherwise.
The refresh measures again with its own generous budget, so a repository that becomes
small again returns to the direct call on its own.

The second is that "git was too slow" and "this is not a repository" both looked like
a failed command. They need to be told apart: the first deserves a background refresh
and a cached snapshot, and the second deserves neither, since spawning a process for
every non-repository directory would be pure waste. The timeout case is identified by
the signal the child was killed with.

Measured after both: p95 of 47 ms in an ordinary repository against a real 75 MB
transcript, and 3 ms in the 5,000-file repository once its cache is warm.

**Alternatives considered**:

- Shrink SC-001's fixture until the budget passes. Rejected: the criterion would then
  measure a repository size chosen to make the number look good.
- Drop the working-tree counts in large repositories. Rejected: it removes the
  information the user asked for rather than the delay.
- `core.fsmonitor`. Not pursued: it is per-repository user configuration the
  statusline has no business writing, and it does not exist on a fresh clone.

## Decision 7: the diagnostic is a CLI subcommand

**Decision**: Add `node bin/cli.js doctor`, which runs the same gathering the
renderer runs, then prints per segment: the value, the source, its age, whether it
came from this run or from cache, and how long the source took. Absent segments are
listed with the reason.

**Rationale**: FR-016 through FR-018 need timings measurable without editing code.
Reusing the real gathering path means the diagnostic cannot drift from what the
renderer does. A subcommand fits the existing CLI, needs no new file, and stays out
of the redraw path.

**Alternatives considered**: An environment variable that makes `render` print
timings to stderr. Rejected: it mixes diagnostics into the hot path, and stderr from
the statusline command is not somewhere a user looks.

## Line-by-line audit findings

These came out of reading the current code against what each segment claims. Each one
is a defect to fix, not a design question.

**Line 1, directory**: `path.basename("/")` returns an empty string, so a session at
the filesystem root renders an empty label between the folder icon and the separator.
Verified in Node. Same for a bare drive root on Windows.

**Line 1, branch**: a detached HEAD renders the short commit SHA in the branch slot,
which then links to `<remote>/tree/<sha>`. The link resolves, but the icon and slot
say "branch" while the content is not one.

**Line 1, upstream**: covered by Decision 2. Today `ahead 0, behind 0` and "no
upstream" render identically.

**Line 1, counts**: the porcelain v1 parser counts a renamed entry once and treats
every non-`??` line as one changed file, which is right, but it never sees ignored or
submodule state. Worth confirming against a repository with submodules rather than
assuming.

**Line 2, skills**: the line shows at most three names and gives no sign that a fourth
was dropped (FR-013). The 2,000-line scan cap can also miss a skill in a session with
very large entries, which is the same problem Decision 1 fixes.

**Line 3, effort**: the effort slot falls back to `output_style.name` when
`effort.level` is absent. Those are different things, and the lightning icon labels
whatever lands there as effort. Needs either a separate slot or an honest fallback.

**Line 4, countdowns**: `formatResetCountdown` returns "resetting now" for any past
timestamp, including one that passed hours ago, which happens whenever a payload is
stale. The 7-day segment also prints both a named moment and a countdown, which is
the widest thing on the line and the first candidate if FR-014 fails.

**All lines**: the constitution caps a rendered line at 120 characters and nothing
currently checks it.

## Known constitution conflict, pre-existing

Principle IX states that the interpreter written into `settings.json` MUST be
`process.execPath` rather than a bare `node`. `src/install.js` deliberately does the
opposite, with a comment explaining that a version-pinned interpreter path breaks on
the next Node upgrade, and probes that a shell can resolve `node` before choosing it.

The code's reasoning is sound and the behaviour predates this feature. This plan does
not change it. It is recorded here and in the plan's Complexity Tracking so the next
constitution amendment can settle which rule stands.

The exemption is scoped to that one existing string. The `PostToolUse` hook command
this feature writes is new code, so it uses `process.execPath` as Principle IX
requires. Inheriting an unresolved conflict into a command that does not exist yet
would turn a documented exception into a spreading one.
