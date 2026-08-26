# Implementation Plan: Statusline Line-by-Line Audit and Freshness Guarantees

**Branch**: `001-statusline-freshness-audit` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-statusline-freshness-audit/spec.md`

## Summary

A redraw currently gathers everything from scratch, in sequence: four git calls, a
GitHub PR lookup, a savings lookup, and a full read of the session transcript. On a
78 MB transcript that read costs 321 ms (235 ms for `readFileSync` plus 86 ms to
split it into lines), and it grows with session age, which is why skills and usage
figures appear to lag late in a day's work.

The plan does three things. It makes gathering cheap and bounded: one git call
instead of four (31.7 ms against 131.2 ms, measured), a tail read of the transcript
instead of a full one (17 ms against 321 ms, measured), and cached values for the two
sources that hit the network or a slow CLI, refreshed by a detached one-shot process
rather than on the redraw path. It audits each of the four lines and fixes what
misreports: an empty directory label at the filesystem root, ahead/behind counts that
cannot distinguish "in sync" from "no upstream", a detached HEAD rendered as a branch,
an effort slot that silently shows an output style, a countdown that says "resetting
now" hours after the fact, and a width limit nothing checks. And it adds a `doctor`
subcommand plus a benchmark script, so the 300 ms budget can be re-measured after any
change instead of argued about.

## Technical Context

**Language/Version**: JavaScript, ES modules, Node 18 or newer (`engines` in `package.json`)

**Primary Dependencies**: None, and none may be added. Principle IV makes zero runtime dependencies a condition of the clone-and-run install path. Node built-ins only: `node:fs`, `node:child_process`, `node:path`, `node:os`, `node:crypto`.

**Storage**: Plain files under `~/.claude/statusline/`. New: `cache/<repo-key>.json` and `skills/<session-id>.jsonl`. Existing: `state/<session-id>.json`, `backups/`. All disposable, all swept after a week. See [contracts/state-files.md](./contracts/state-files.md).

**Testing**: `node scripts/smoke-test.js` via `npm test`, the project's existing runner. No test framework is added, for the same dependency reason. New: `scripts/bench.js` for the timing measurements FR-018 requires.

**Target Platform**: Linux, macOS and Windows, per Principle IX. CI runs the suite on all three.

**Project Type**: CLI plugin for Claude Code, invoked once per redraw and exiting.

**Performance Goals**: A redraw at p95 under 300 ms on any session age (FR-001), and within 20% of a fresh session's cost after eight hours (SC-002).

**Constraints**: No daemon, no polling loop, no network call on the redraw path. Every displayed value within its maximum age, or absent, except the payload-derived usage segments, which keep their slot and show `?%`. Every source carries a declared budget and the on-path budgets sum to 290 ms; see the source budget table in [data-model.md](./data-model.md). Four lines within 120 characters each, minus the skills line when no skills are active. Exit code always 0, including on an unexpected failure.

**Scale/Scope**: One user, one machine, a redraw every five to six seconds. Transcripts observed up to 78 MB. Repositories up to a few thousand changed files.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Gate | Status |
|---|---|---|
| I. Starship-compatible output | No change to palette, separators or segment format | Pass. Segments may be omitted, never restyled. |
| II. Four-line structure, ≤120 chars | Structure unchanged; the width limit becomes enforced rather than assumed | Pass, and FR-014 closes an existing gap. |
| III. Token tracking grounded in real data | Usage figures stay payload-only and keep `?%` for an absent field; cached values expire rather than pose as current | Pass. FR-009's omission rule explicitly excludes the usage segments, so the two rules no longer collide. Decision 5 in research.md is this principle applied to caching. |
| IV. Clone install, zero dependencies | No dependency added; `git pull` still updates without reinstall | Pass. The new hook is additive and reversible. |
| V. Integration docs | README gains the new environment variable, the hook, and `doctor` | Pass, as a task in Phase 2. |
| VI. English-only | All code, output and docs in English | Pass. |
| VII. MVP-first, local-then-GitHub | Verified locally before any tag | Pass. |
| VIII. Generated previews | Previews must stay reproducible; `CLAUDE_STATUSLINE_NO_REFRESH=1` keeps a background refresh out of generation | Pass. Any segment change regenerates previews in the same commit. |
| IX. Cross-platform | New code touches spawning, file locking and paths, the three places platforms differ | Pass with attention. `rename` for atomic writes, detached spawn via `process.execPath`, the new hook command string also `process.execPath`, no shell string interpolation, `node:path` everywhere. Tested on all three in CI. |
| X. Icons carry live state | Tracked set unchanged: branch, ahead/behind, PR, skills, model, effort. Cached values must not animate on a cache refresh that changed nothing | Pass. Change detection compares values, not gather times. |
| XI. Tag-driven releases | Unchanged | Pass. |

One pre-existing conflict is recorded under Complexity Tracking. It is not introduced
by this feature and is not resolved by it.

**Post-Phase 1 re-check**: no gate changed status. The design adds files under
`~/.claude/statusline/`, one CLI subcommand, one internal subcommand, one optional
hook, and one environment variable. Nothing in it touches the palette, the line
structure, the source of usage numbers, or the release process.

## Project Structure

### Documentation (this feature)

```text
specs/001-statusline-freshness-audit/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output: measurements and decisions
├── data-model.md        # Phase 1 output: shapes passed between gather, cache, render
├── quickstart.md        # Phase 1 output: how to validate each success criterion
├── contracts/
│   ├── cli.md           # Command promises: render, doctor, refresh, install, uninstall
│   ├── state-files.md   # On-disk layout and file formats
│   └── hooks.md         # The optional PostToolUse skill hook
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
bin/
└── cli.js                    # + doctor, refresh, note-skill subcommands

src/
├── render.js                 # renders from readings rather than probing sources directly
├── git.js                    # one porcelain=v2 call; upstream absence distinct from in-sync
├── skills.js                 # bounded tail read; reads the hook's event file when present
├── rtk.js                    # cached reading
├── tokens.js                 # countdown fixes (no "resetting now" for a long-past reset)
├── timeIcons.js              # unchanged
├── theme.js                  # unchanged
├── changeTracker.js          # sweep extended to cache/ and skills/
├── install.js                # + hook registration (default on, --no-hook), matching removal
├── openTerminalTab.js        # unchanged
├── freshness.js              # NEW: readings, maximum ages, staleness decisions
├── cache.js                  # NEW: atomic read/write, locks, detached refresh spawn
├── transcriptTail.js         # NEW: backward chunked reader with a byte cap
├── skillEvents.js            # NEW: append and tail-read the hook's event file
└── doctor.js                 # NEW: diagnostic report over the same gathering path

scripts/
├── smoke-test.js             # + per-segment present/absent/degraded, width check
├── bench.js                  # NEW: p95 redraw timing and per-source breakdown
├── generate-previews.js      # unchanged
└── preview-fixtures.js       # + fixtures for the newly distinguishable states
```

**Structure Decision**: The existing flat `src/` layout stays. Every file is a module
with one job and the project has no build step, so adding four modules alongside the
current ones matches what is there rather than introducing a directory hierarchy for
fourteen files. The new modules sit between the sources and the renderer: `render.js`
stops calling `getPrInfo` and friends directly and instead asks `freshness.js` for
readings, which is what makes the maximum-age rules enforceable in one place instead
of scattered through the render.

## Implementation sequence

Ordered so each step is independently verifiable and none depends on a later one.

1. **Bounded transcript read** (`transcriptTail.js`, `skills.js`). The largest single
   win and the direct cause of the reported lag. Verifiable with a real 78 MB
   transcript before anything else changes.
2. **One git call** (`git.js`). Four spawns to one, and the upstream-absence fix
   comes with it.
3. **Readings and maximum ages** (`freshness.js`, `render.js`). Refactor the renderer
   to consume readings. No behaviour change on its own, which makes it safe to land
   before the cache exists.
4. **Cache and detached refresh** (`cache.js`, `rtk.js`, PR path). Removes the
   network from the redraw path.
5. **Per-line audit fixes** (`git.js`, `tokens.js`, `render.js`, `skills.js`): empty
   directory label, detached HEAD, effort fallback, past-reset countdown, skill
   truncation marker, width enforcement.
6. **Diagnostic and benchmark** (`doctor.js`, `bin/cli.js`, `scripts/bench.js`).
7. **Optional hook** (`skillEvents.js`, `install.js`, `bin/cli.js note-skill`), plus
   its removal path.
8. **Docs and previews**: README for the new variable, `doctor` and the hook;
   regenerated previews for any segment that changed.

Steps 1 and 2 alone should take the p95 well under the budget in the common case.
Step 4 is what makes it hold when the network is slow or `gh` is unauthenticated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Pre-existing: `install.js` writes a bare `node` for the `statusLine` command where Principle IX says `process.execPath` | Not introduced here. The code probes that a shell resolves `node` first, and its comment explains that a version-pinned interpreter path breaks on the next Node upgrade. | Neither side is obviously wrong, and changing installed behaviour is out of scope for a freshness feature. Recorded so a constitution amendment can settle it. The exemption is scoped to that one existing string: the new hook command this feature writes uses `process.execPath`, since new code may not inherit an unresolved conflict. |
| A detached refresh process | The PR lookup is 540 ms warm and 2 s when it fails. Nothing else keeps it off a 300 ms redraw path while still showing the segment. | A shorter inline timeout was measured against the real cost: at 150 ms the segment would essentially never render. A daemon was rejected as heavier than the problem. |
| Four new source modules | Each holds one responsibility that the existing modules do not have: reading a file backwards, deciding staleness, managing cache locks, reporting diagnostics. | Folding them into `render.js` would put the freshness rules back where they cannot be tested in isolation, which is the state that allowed the current lag to go unnoticed. |
