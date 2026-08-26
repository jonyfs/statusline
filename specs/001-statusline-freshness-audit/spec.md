# Feature Specification: Statusline Line-by-Line Audit and Freshness Guarantees

**Feature Branch**: `001-statusline-freshness-audit`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "revise cada linha do statusline para validar e verificar o que pode ser melhorada em cada uma, garantindo que o funcionamento esteja ok, que tudo esteja sempre atualizado e fazendo sentido, parece que em alguns casos, skills ou contextos estão demorando muito a serem atualizadas, verifique o que pode ser melhorado, seja em scripts, hooks etc"

## Problem Context

The statusline redraws by running a command that gathers everything it shows from
scratch, in sequence, on every redraw: four git commands, a GitHub PR lookup, a
savings lookup, and a full read of the session transcript. Nothing is cached and
nothing is bounded by how much work a redraw is allowed to do.

Measurements taken on this machine, on 2026-08-25:

| Work done per redraw | Cost measured |
|---|---|
| Whole redraw, small repo, PR lookup warm | 680 ms |
| PR lookup alone (network) | 540 ms |
| Reading a 78 MB session transcript | 235 ms |
| Splitting that transcript into lines | 86 ms |
| Worst case if every source hits its own timeout | ~9.5 s |

The transcript cost is the one that grows: it is a full read of the file on every
redraw, so a session that has been running all day pays more for the same three
skill names than a session that started a minute ago. Transcripts of 60-80 MB were
found in this user's own project history. That is the most likely reason skills and
usage figures appear to lag: when a redraw takes longer than the interval between
redraws, what is on screen is the answer to a question asked several seconds ago.

Alongside the latency work, every line needs checking against what it claims to
show, so that a segment is either correct or absent, and never wrong.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The line keeps up with the session (Priority: P1)

Someone is working with skills, switching branches, committing, and watching their
context fill up. What the statusline shows should match what has just happened,
within a redraw or two, not lag by ten or twenty seconds, and not lag more in the
afternoon than it did in the morning.

**Why this priority**: This is the reported complaint. A status bar that reports
stale state is worse than one that reports nothing, because it is trusted.

**Independent Test**: Run a redraw against a session transcript of 80 MB and a repo
with thousands of changed files, and confirm the redraw finishes inside the budget
and shows the skill that was invoked immediately before it.

**Acceptance Scenarios**:

1. **Given** a session whose transcript is 80 MB, **When** the statusline redraws,
   **Then** it finishes within the same time budget as it does for a 1 MB transcript.
2. **Given** a skill invoked in the previous turn, **When** the next redraw happens,
   **Then** that skill is on the skills line.
3. **Given** the PR lookup that needs the network is slow or offline, **When** a
   redraw happens, **Then** the rest of the line still renders on time and the PR
   segment shows its last known value or disappears, never blocking the redraw.
4. **Given** a branch switch, **When** the next redraw happens, **Then** the branch
   name, the ahead/behind counts and the working-tree counts all reflect the new
   branch in the same redraw, with no mixture of old and new.

---

### User Story 2 - Every segment says something true (Priority: P2)

Each of the four lines gets read against what it is supposed to mean: directory,
branch, working-tree counts, upstream divergence, PR, skills, model, effort,
context, 5-hour and 7-day windows, both reset countdowns, savings. Anything that
can show a misleading value gets fixed or removed.

**Why this priority**: Correctness matters as much as freshness, but the reported
pain is latency, so this follows it.

**Independent Test**: Feed a captured live payload plus a set of hand-built edge
payloads through the renderer and compare every segment against the value that was
put in.

**Acceptance Scenarios**:

1. **Given** a payload where a usage field is missing, **When** the line renders,
   **Then** that segment shows the unknown marker and no other segment is affected.
2. **Given** a reset timestamp that has already passed, **When** the line renders,
   **Then** the countdown does not show a negative or nonsensical duration.
3. **Given** a repository with no upstream branch, **When** line 1 renders, **Then**
   the ahead and behind counts are absent rather than shown as zero or wrong.
4. **Given** a session where more skills are active than the line has room for,
   **When** line 2 renders, **Then** the most recently used ones are shown and the
   fact that others were dropped is not misrepresented as "these are all of them".
5. **Given** the widest realistic combination of segments, **When** any line renders,
   **Then** it stays inside the width limit the constitution sets.

---

### User Story 3 - The user can see why a value looks wrong (Priority: P3)

When a number looks off, there is a way to inspect what the statusline gathered,
where each value came from, how old it is, and how long each source took.

**Why this priority**: It helps diagnose problems rather than removing them, and it
makes the first two stories checkable on a live session instead of only in tests.

**Independent Test**: Run the diagnostic on a live session and confirm it names every
segment, its value, its age, its source, and its cost.

**Acceptance Scenarios**:

1. **Given** a live session, **When** the diagnostic runs, **Then** it reports each
   segment's current value, its age in seconds, and the time its source took.
2. **Given** a source that is unavailable, **When** the diagnostic runs, **Then** it
   says which one and why, instead of silently omitting it.

---

### Edge Cases

- A transcript that is compacted, rotated, or truncated mid-session, so that the
  tail no longer contains the entries the previous redraw read.
- A payload with no session identifier, so per-session state cannot be keyed.
- Two sessions in the same repository redrawing at the same moment and writing
  state concurrently.
- A repository with tens of thousands of untracked files, where counting them is
  itself expensive.
- The GitHub CLI installed but not authenticated, so every redraw pays a failure
  that is slower than a success.
- Working offline, where the PR lookup can neither succeed nor fail quickly.
- A machine whose clock jumps, or a reset time that crosses a daylight-saving
  boundary, so the weekday and countdown must still agree with each other.
- The very first redraw of a session, where there is nothing cached and no previous
  snapshot to compare against.
- A skill invoked but whose transcript entry carries no timestamp.
- Nested repositories or a working directory inside a git worktree.

## Requirements *(mandatory)*

### Functional Requirements

**Freshness and cost**

- **FR-001**: A redraw MUST complete within 300 ms at the 95th percentile on a
  session of any age, measured on the reference machine.
- **FR-002**: The cost of a redraw MUST NOT grow with the length of the session.
  Reading session activity MUST be bounded to a fixed amount of work regardless of
  transcript size.
- **FR-003**: No single data source may hold up a redraw. Every source MUST have a
  declared time budget, and the sum of the budgets of the sources a redraw may wait
  on MUST fit inside FR-001. If a source has not answered within its budget, the
  redraw MUST proceed with that source's last known value, or without the segment if
  there is none.
- **FR-004**: Every displayed value MUST have a defined maximum age, and MUST NOT be
  shown once it is older than that: session activity and working-tree state at most
  one redraw old, pull request and savings figures at most 60 seconds old, usage
  percentages always from the current redraw's payload.
- **FR-005**: A skill invoked in the session MUST appear on the skills line on the
  first redraw after its entry exists in the transcript, and MUST disappear within
  one redraw of falling outside its activity window.
- **FR-006**: Values reused from a previous redraw MUST be refreshed in the
  background so that the next redraw has a current value, rather than every redraw
  serving progressively older data.
- **FR-007**: Everything the statusline writes MUST be disposable and MUST be swept
  on a bounded schedule. Session-keyed state MUST NOT outlive its session's sweep,
  and any value shared across sessions MUST be a cache subject to FR-004 rather than
  a record the statusline depends on. Deleting all of it MUST cost at most one
  redraw's animation and one cache miss.

**Per-line correctness**

- **FR-008**: Each of the four lines MUST be audited segment by segment against a
  captured live payload and against the edge payloads listed in Edge Cases, and each
  audited behaviour MUST be covered by a test.
- **FR-009**: A segment whose source is unavailable MUST be omitted entirely rather
  than rendered empty, zero, or with a placeholder that reads as a real value. The
  usage percentages are the one exception, governed by FR-010: they keep their slot
  and show the unknown marker, because a reader who cannot see a context figure needs
  to know it is unknown rather than wonder where the segment went.
- **FR-010**: Usage percentages MUST come only from the fields Claude Code sends. A
  field absent from the payload MUST render as `?%` in its own slot, never as an
  estimate and never as a dropped segment. The reset countdowns follow the same rule
  with their own unknown text.
- **FR-011**: A reset countdown MUST never display a negative duration, and the
  countdown, the clock face and the named day MUST agree with each other for the same
  timestamp, including across a daylight-saving change.
- **FR-012**: Upstream divergence counts MUST be absent when there is no upstream,
  and MUST be distinguishable from a branch that is in sync.
- **FR-013**: When more skills are active than the line shows, the ones shown MUST be
  the most recently used, and the line MUST make the truncation visible.
- **FR-014**: Every line MUST stay within the width limit set by the constitution for
  the widest realistic combination of segments, in both glyph modes.
- **FR-015**: A failure in any one line MUST NOT prevent the other lines from
  rendering, and MUST NOT produce a non-zero exit or an error on the bar. This holds
  for an unexpected failure anywhere in the render, not only for a failing source.
- **FR-021**: Effort and output style MUST NOT share a slot. The effort segment MUST
  render only a real effort level; an output style MUST have its own segment and its
  own icon, and MUST be absent when it is the default. A reader MUST be able to tell
  which of the two they are looking at without knowing the payload.

**Diagnosis**

- **FR-016**: A diagnostic mode MUST report, for each segment: current value, source,
  age, whether it came from this redraw or a reused one, and how long the source took.
- **FR-017**: The diagnostic MUST state why an absent segment is absent, separating
  "not applicable here" from "the source failed".
- **FR-018**: Measuring the timings MUST be possible without editing the code, so the
  budget in FR-001 can be re-checked after any change.

**Automation surfaces**

- **FR-019**: If session lifecycle events are used to keep any value current, they
  MUST be optional: with them absent the statusline MUST still meet FR-001 through
  FR-005, only with less headroom.
- **FR-020**: Any automation added by the installer MUST be reversible by the
  uninstall command, and MUST leave unrelated user settings untouched.

### Key Entities

- **Segment**: One coloured block on a line. Has a value, a source, a maximum age,
  and a rule for what happens when its source is unavailable.
- **Line**: An ordered group of segments with a width limit, rendered independently
  of the other lines.
- **Source**: Something the statusline reads: the payload from Claude Code, the git
  repository, the GitHub CLI, the session transcript, and `rtk` for the savings
  figure. Each has a cost, a declared time budget, and a defined failure mode.
- **Cache entry**: A value carried over from an earlier redraw, with the time it was
  gathered, so its age can be checked against the segment's maximum age. Called a
  cache entry everywhere in this feature's documents; "reused value" is not a second
  concept.
- **Session state**: The per-session record already kept for change animation, keyed
  by session identifier and swept after a week.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A redraw completes in under 300 ms in 95 out of 100 consecutive runs,
  with an 80 MB transcript and a repository with 5,000 changed files.
- **SC-002**: Redraw time on a session that has run for eight hours is within 20% of
  redraw time on a session that started a minute earlier.
- **SC-003**: A skill invoked in the session shows up on the line within one redraw,
  measured over 20 consecutive invocations.
- **SC-004**: With the network unreachable, a redraw still completes within the
  budget in every one of 20 runs.
- **SC-005**: Every segment across all four lines has at least one test covering its
  present, absent, and degraded states.
- **SC-006**: No rendered line exceeds the constitutional width limit across the full
  set of preview fixtures, in both glyph modes.
- **SC-007**: The diagnostic accounts for every segment on screen, with no segment
  unexplained.
- **SC-008**: Uninstalling removes everything the install added and leaves the rest of
  the user's settings byte-identical apart from the removed keys.

## Assumptions

- Claude Code triggers redraws itself, roughly every five to six seconds during
  activity. Nothing here changes that; the goal is for each redraw to answer with
  current data rather than to redraw more often.
- The 300 ms budget in FR-001 is chosen as roughly a twentieth of the redraw
  interval, leaving room for the process to start and the terminal to paint. It was
  not specified by the user.
- The 60-second maximum age for pull request and savings figures reflects how rarely
  they change, against how expensive they are to fetch.
- The existing 30-minute skill activity window stays the default and stays
  configurable. The reported lag is about how quickly changes show up, not about
  skills lingering.
- Transcript format remains what it is today, and remains something to read
  defensively rather than a stable contract.
- The reference machine for all timings is the one these measurements were taken on;
  results elsewhere will differ, but the relative targets hold.
- No background daemon and no polling loop. Whatever keeps values current has to fit
  inside the redraw the harness already runs, or inside events it already emits.
- The four-line structure, the palette and the glyph vocabulary are settled by the
  constitution and are not reopened here.
