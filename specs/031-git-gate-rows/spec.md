---
track: full
status: done
---

# Feature Specification: Rows for git gates running in this repository's worktrees

**Feature Branch**: `031-git-gate-rows`

**Created**: 2026-10-06

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "verifique se é possível colocar linhas de gates do git que possam
estar em execuçao e em quais worktrees, analise o contexto atual e abra um design no chrome para
entender como ficaria, funcionando no claude, codex e copilot tb".

**Track**: `full`. It adds a new source of data (other processes on the machine), extra rows
after the bar in two harnesses, and a platform limit to document.

**Design**: [design/gate-rows.html](design/gate-rows.html). The bar lines in it are the real
renderer's output; the gate rows are mocked in the bar's palette.

## What the investigation found (2026-10-06)

**A "gate" here is a git hook doing its checks.** On this machine the repository that has them is
barbershop: `core.hooksPath = .githooks`, whose `pre-commit` starts lint, typecheck and unit tests
in the background and runs the document gates (`.claude/scripts/gates.sh`, 47 of them) in the
foreground. A commit waits for all of it, often for minutes.

**Several worktrees run gates at once.** The barbershop repository has 36 worktrees. Its
`gates.sh` already guards against two runs in the same worktree: it creates
`<git dir>/gates.lock` and writes its pid there, and a second run in that worktree waits for it.
The git dir is per worktree (`.git/worktrees/<name>` for a linked one), so runs in different
worktrees never wait for each other.

**A live probe saw one running.** While this was written, `ps` showed
`bash …/barbershop/.githooks/pre-commit` (2m54s), its child `bash .claude/scripts/gates.sh`, and
under that `review-cycle.test.sh`; `.git/gates.lock/pid` held the `gates.sh` pid, with the lock
171 seconds old. So each part of a row was observable: the hook, the worktree, the step it was
on, how long it had run, and who held the lock.

**Cost.** `git worktree list --porcelain` took 29 ms with 36 worktrees. One `ps` over all
processes took about 100 ms on macOS. A stat of each worktree's lock is negligible.

**Per harness.**

| | Claude Code | Copilot CLI | Codex CLI |
|---|---|---|---|
| Can draw the rows | yes, the status line command prints any number of lines | yes, the same command, after the subagent rows of specs/030 | no |
| Why | the bar is this project's command | the bar is this project's command | Codex 0.160.1 runs no outside command in its status line: `[tui] status_line` is a fixed, one-line list of built-in items, and none of them describes git hooks |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which gates are running, and where (Priority: P1)

A developer working in one worktree commits in another (or an agent does it for them). While a
hook runs anywhere in the repository, the bar shows a row for it: which hook, which worktree and
branch, what it is doing now, and for how long.

**Why this priority**: it is the whole request. Today the only way to know is to look at each
terminal or run `ps`.

**Independent Test**: start a hook that sleeps in a second worktree of a test repository and
render the bar from the first: one row names the second worktree, the hook and the step.

**Acceptance Scenarios**:

1. **Given** a `pre-commit` running in another worktree of the same repository, **When** the bar
   renders, **Then** a row shows `pre-commit`, that worktree's directory name and branch, the
   deepest named script or command it is running, and its elapsed time.
2. **Given** a hook running in the session's own worktree, **When** the bar renders, **Then** its
   row is marked as this worktree.
3. **Given** no hook running in any worktree of the repository, **When** the bar renders,
   **Then** no gate row and no gate chip appears, and the bar is byte for byte what it was.
4. **Given** a hook running in a different repository, **When** the bar renders, **Then** it is
   not shown.
5. **Given** a hook that ends, **When** the bar next renders, **Then** its row is gone.

---

### User Story 2 - See a run that is waiting for another (Priority: P2)

**Why this priority**: a waiting run looks like a slow one from outside, and the developer may
kill it. Saying "waiting" and for whom answers that.

**Acceptance Scenarios**:

1. **Given** two runs of `gates.sh` in the same worktree, one holding `<git dir>/gates.lock`,
   **When** the bar renders, **Then** the holder's row shows its step and the other's row says it
   is waiting for the lock.
2. **Given** a lock directory whose pid is not running, **When** the bar renders, **Then** nothing
   is shown for it: a stale lock is not a running gate.

---

### User Story 3 - The same rows in Copilot CLI, and an honest answer for Codex (Priority: P2)

**Acceptance Scenarios**:

1. **Given** Copilot CLI running the bar, **When** a gate runs, **Then** the same rows appear,
   after any subagent rows.
2. **Given** a user who reads the README for Codex, **When** they look for gate rows, **Then** it
   says Codex cannot show them and why.

---

### User Story 4 - A count on line 1, and a short window keeps the bar (Priority: P3)

**Acceptance Scenarios**:

1. **Given** any gate running, **When** the bar renders, **Then** line 1 carries a chip with the
   count and this worktree's elapsed time when one runs here (design, variant B), as a registered
   segment the arrangement can move or switch off.
2. **Given** a window too short for the bar plus the gate rows, **When** the bar renders,
   **Then** the rows are left out before any of the bar's own lines is shed, and the chip stays.
3. **Given** more running gates than the row cap, **When** the bar renders, **Then** the rows
   stop at the cap and one more row says how many are left out.

### Edge Cases

- A directory that is not a git repository: no lookup runs, no row.
- A worktree that `git worktree list` marks prunable (its directory is gone): skipped.
- A hook whose working directory cannot be read (another user's process, a sandbox): matched by
  the hook's path when that path names a worktree, else not shown.
- A hook launched with a relative `core.hooksPath`: the path is relative to that worktree, so the
  working directory decides.
- Windows: the process list and a process's working directory are not available without slow
  tools. There, only the lock convention is read (User Story 2), and the README says so.
- The process lookup fails or exceeds its time budget: no rows on that redraw, never an error and
  never a stale row presented as live.
- Hook names: `pre-commit`, `pre-push`, `commit-msg`, `prepare-commit-msg`, `pre-rebase`,
  `pre-merge-commit`, `post-checkout`, `post-merge` and any other script in the hooks directory
  are all gates for this purpose; the row names the one that is running.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bar MUST find the running git hooks of the repository it is in, across all of
  that repository's worktrees, and only that repository's.
- **FR-002**: Each running hook MUST be shown as one row with: the hook's name, the worktree's
  directory name, its branch (or short commit when detached), the deepest named script or command
  it is running now, and its elapsed time. The session's own worktree MUST be marked.
- **FR-003**: When a worktree's `gates.lock` is held by a live pid, a second run in that worktree
  MUST be shown as waiting for it. A lock whose pid is not alive MUST be ignored.
- **FR-004**: Under Claude Code and Copilot CLI the rows MUST follow the bar's lines (in Copilot,
  after the subagent rows), MUST NOT count toward Principle II's three lines, and MUST NOT appear
  in the doctor's per-line view or the composer pool.
- **FR-005**: The rows MUST be fitted to the bar's width and capped at 6, with a `+N more` row.
- **FR-006**: Line 1 MUST carry a chip counting the running gates whenever any run. On a window
  too short for the rows, the rows MUST be left out before any line of the bar is shed, and MUST
  return when there is room.
- **FR-007**: The lookup MUST stay within a time budget per redraw and MUST cache its answer for
  a few seconds, so several redraws in a row do not each pay for it. On failure or timeout it
  shows nothing.
- **FR-008**: On Windows the bar MUST read only the lock convention and MUST NOT spawn a slow
  process lookup; the README MUST say so (Principle IX, graceful degradation).
- **FR-009**: The README MUST document the rows, where their data comes from, the Windows limit,
  and that Codex cannot show them.
- **FR-010**: The rows MUST be a segment the arrangement can switch off, like any other.

### Key Entities

- **Worktree**: a checkout of the repository, with its directory, its git dir, and its branch or
  detached commit.
- **Running gate**: a hook process attributed to one worktree, with its hook name, start time,
  current step, and whether it holds or waits for that worktree's lock.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a hook running in another worktree, the developer can tell from the bar
  alone, within one redraw, which worktree is busy and what it is doing.
- **SC-002**: With no hook running, the bar is identical to today's, byte for byte, in every
  render the existing suite checks.
- **SC-003**: A redraw in a repository with 36 worktrees spends no more than 150 ms on this
  lookup on macOS and Linux, and is unaffected when the lookup's answer is cached.
- **SC-004**: A run waiting for another's lock is never shown as running a step.
- **SC-005**: The full suite passes on all CI platforms.

## Assumptions

- "Gates" means git hooks and what they run, which is how barbershop uses the word (portões).
  The lock is a barbershop convention, read when present and harmless when absent.
- Scope is the current repository's worktrees, not every repository on the machine: a
  developer's question is "is anything in this project busy".
- Both, by default: the chip is the count a reader sees at a glance and the one place the
  arrangement can move; the rows carry the detail and are the first thing a short window drops.
  Settled during planning, when the chip had to be a registered segment the composer can arrange.
- No pass or fail result is shown after a hook ends: nothing a hook leaves behind records it,
  and a result inferred from a vanished process would be invented (Principle III's spirit).
- The row's icons are placeholders in the design. Their final glyphs need rendered evidence
  (Principle X).

## Out of Scope

- Codex CLI: no way to draw rows in its footer. A separate `gates --watch` command for a side pane
  would be a different feature.
- Hooks of other repositories, and server-side hooks.
- Showing which of the 47 gates is current when `gates.sh` does not expose it outside its
  process; the step shown is the deepest running script or command.
