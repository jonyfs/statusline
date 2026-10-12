# Plan: session state you can read at a glance

**Spec**: [spec.md](./spec.md)

## Decisions

1. **The counter already exists.** `changeTracker` keeps a `frame` in the session's state file
   that advances once per redraw, 0 to 3. It is now returned, and the working chip indexes
   four glyph keys with it. Nothing reads the clock, which is what the constitution's rule
   (8.4.1) asks for.
2. **Idle is a clock the transcript scan already has.** `scanTail` returns `lastAt`; the
   activity gains `idleMs`. Five minutes of quiet is sleeping, an unknown clock is idle. While
   sleeping, line 2's chips are drawn `quiet`.
3. **Your turn is two tool calls, not a guess.** The scan notes whether the newest message is
   an assistant tool call named `AskUserQuestion` or `ExitPlanMode` with nothing after it.
   Permission prompts are not in the transcript and Claude Code hides the bar while one is
   open, so they are left out and said so in the spec. The state is a different text and
   colour on the `activity` segment, so no new registry row is needed.
4. **Hold is per key.** `HOLD_MS` maps branch and model to 10 seconds, pull request and CI to
   120, skills to 30. CI joins the tracked set, with its status in the snapshot.
5. **Update and failure are icons.** The update chip is its icon (`F12CC` after an update),
   and `doctor` already prints the sentence. The fallback is a neutral chip with `F00E8`, in
   `src/unavailable.js` and an inlined copy in `bin/cli.js`, because it runs when imports
   have failed.
6. **A failed pull request lookup leaves a marker.** `runRefresh` writes `prFailed` when the
   lookup fails and clears it when one answers; `getPrLookupFailed` reads it within the cache's
   maximum age; the bar draws a dim icon with no number while it stands.
7. **Small ones.** Conflicts go to priority 99; a clean tree in step with its upstream draws a
   green `F4A4` as the `worktreeState` chip; allow-all text is bold.

## Files

| File | Change |
|---|---|
| `src/changeTracker.js` | `frame`, per-key hold, `ci` tracked |
| `src/transcriptTail.js`, `src/skills.js` | `awaiting`, `idleMs` |
| `src/render.js` | spinner, sleeping, your turn, update icon, clean mark, dim PR, bold allow-all, glyph keys |
| `src/refresh.js`, `src/git.js` | the failed-lookup marker |
| `src/unavailable.js`, `bin/cli.js`, `src/codexPane.js` | the failure chip |
| `src/segments.js`, `src/colourRoles.js` | conflict priority, roles |
| `specs/048-state-feedback/glyph-sheet.py`, `glyph-evidence.png` | the proof |
| `scripts/tests/state-feedback.test.js` | new |

## Risks

- The working chip's glyph changes every redraw, so the golden bar and previews pin a frame.
  The preview generator runs with the tracker off, which is frame 0.
- A transcript fixture that is old now reads as sleeping, which several tests assumed idle.
