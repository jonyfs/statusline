# Tasks: 080 links that open on Linux

Order follows [plan.md](plan.md). A task is checked when its test is green and the suite passes.

- [x] T1 Measure the bar's link bytes under a Linux-like environment; record in spec.md
      (Context). All links well-formed, BEL-terminated, the same on every platform.
- [x] T2 Clarify the reported setup with the owner: all links, GNOME Terminal, tmux, SSH,
      plain click. Recorded in spec.md.
- [x] T3 `src/linkEnv.js`: `isRemoteSession`, `linkGesture`, `tmuxLinks`, `linkStatus`.
- [x] T4 FR-004: no folder link over SSH, text unchanged, no open-tab script written
      (`render.js`). The suite clears the SSH variables so it passes inside an SSH session.
- [x] T5 FR-007: the doctor's `links:` lines (`doctor.js`), with the `printf` host test in place
      of a version table (plan, amended).
- [x] T6 FR-010: `scripts/tests/linux-links.test.js` pins the bytes, the folder URLs (Linux,
      Windows drive, space and `#`), SSH, gesture, tmux and the doctor's order.
- [x] T7 FR-008: README "When a link does not open", stale help paragraph fixed; help page p5
      and footer in four locales, `help/index.html` regenerated; constitution 8.15.1.
- [x] T8 FR-001 as far as it can go from macOS: the reported failure is explained by T2's
      conditions; a run on Ubuntu after the release confirms SC-001 and SC-005.
- [x] T9 Full suite, `/verify`, PR, `/review`, fix findings, release.
