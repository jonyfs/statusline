# Tasks: one meaning per colour

**Plan**: [plan.md](./plan.md)

- [ ] T001 Test: every segment key has a role; no token under two roles; every pooled fill is
  one its key may take; skills are all `flamingo`. RED.
- [ ] T002 `src/colourRoles.js`, `surface0` in the palettes, `src/render.js` colours from `ROLE`.
  GREEN.
- [ ] T003 Test: gauge bands (ok `surface0` plus `green` icon, warn `peach`, critical `red`),
  the single red among several critical gauges, the tie, unknown level. RED.
- [ ] T004 `src/ramp.js` `gaugeChip`, `icon`/`tone` in `renderRow`, `readableOn`, the red pass in
  `src/render.js`. GREEN.
- [ ] T005 Test: change highlight is bold plus underline with colours unchanged, clears after 30
  seconds, survives `NO_COLOR`. RED, then `src/changeTracker.js` and `renderRow`. GREEN.
- [ ] T006 Test: `doctor --explain` legend with swatches and without under `NO_COLOR`. RED, then
  `src/doctor.js`. GREEN.
- [ ] T007 Update tests that encode the old colours; the 4.5:1 test of 040 passes unchanged.
- [ ] T008 `npm test`, bench, `npm run previews`; the near-limit preview has one red chip.
- [ ] T009 README colour section; spec `status: done`; version bump; PR; merge.
