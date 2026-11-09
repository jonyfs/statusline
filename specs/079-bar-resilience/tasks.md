# Tasks: 079 bar resilience

Order follows [plan.md](plan.md). A task is checked when its test is green and the suite passes.

- [ ] T1 FR-009: rows from `LINES` under Claude Code; failing test first (10-row tty, `LINES`
      unset, all three lines drawn). `terminalFor`, `copilot-parity.test.js`.
- [ ] T2 FR-010: `CLAUDE_STATUSLINE_DEBUG=1` writes `debug-last-env.json` (COLUMNS, LINES,
      TERM_PROGRAM, tty size, chosen width and source).
- [ ] T3 Measure in the owner's live session: before and after one resize. Record in spec.md.
- [ ] T4 FR-008 rule per T3; FR-011 `CLAUDE_STATUSLINE_WIDTH_MARGIN`; FR-012 pinned row never
      overflows (failing test first); FR-013 task rows width; FR-014 doctor wording.
- [ ] T5 FR-003 write state only on change; FR-004 compile cache; FR-005 lazy harness imports;
      FR-006 cache ages from the interval. Bench before and after.
- [ ] T6 FR-001/FR-002 replay: only if T5 leaves a full redraw over target. Otherwise deferred,
      with the measured numbers.
- [ ] T7 FR-015 to FR-017 glyphs: allow-list test (fails on `main`), the four splits, outlines,
      help page, goldens.
- [ ] T8 FR-018 `CLAUDE_STATUSLINE_NERD_WIDTH=2`; doctor font hint; README and four locales.
- [ ] T9 FR-019 as amended: doctor warns when the task-rows interpreter is gone.
- [ ] T10 FR-020 docs: spec 071, README cadence and samples, `freshness.js`/`samples.js`
      comments, constitution 8.15.0.
- [ ] T11 Full suite, bench numbers in the PR, `/verify`, PR, `/review`, fix findings.
