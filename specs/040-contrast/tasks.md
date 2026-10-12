# Tasks: readable chips in every palette

**Plan**: [plan.md](./plan.md)

Every code task is test first: the test is written and seen failing, then the code.

## Phase 1: contrast (US1)

- [x] T001 `scripts/tests/contrast.test.js`: ratio and luminance on known pairs; the ten Latte
  accents and their text colours and ratios; a background no candidate reaches is darkened and
  then reaches 4.5:1; memoised result is the same object. RED.
- [x] T002 `src/contrast.js`: luminance, ratio, OKLab and OKLCH, `chipColours`. GREEN.
- [x] T003 `src/theme.js`: `renderRow` uses `chipColours` for the text colour and the darkened
  background, and the arrow takes the same colours. The fixed surface-text rule goes.
- [x] T004 Test: every segment key rendered in all six palettes, every emitted fg/bg pair at
  4.5:1 or more; Mocha output equals the output before this feature.

## Phase 2: neighbours (US2)

- [x] T005 Test: no adjacent pair of different neutral backgrounds under 1.6:1 in any palette,
  and the repository sits on the directory chip's background. RED.
- [x] T006 `src/theme.js`: `quietText`, `quiet` in `renderRow`. `src/render.js`: the repository
  chip on `surface1`, `quiet`. GREEN.

## Phase 3: terminal profile (US3, US4)

- [ ] T007 Test: `COLORFGBG` light, dark, malformed and unset with and without a flavor;
  `doctor` names the source. RED.
- [ ] T008 `src/config.js`, `src/doctor.js`: flavor from the terminal background. GREEN.
- [ ] T009 Test: `COLORTERM` truecolor, 24bit, unset, other; no `38;2` or `48;2` at 256 depth;
  every pair at 4.5:1 on the quantised values; `NO_COLOR` wins. RED.
- [ ] T010 `src/theme.js`: depth, nearest-index palette, `fgSeq`/`bgSeq`. `src/taskRows.js`,
  `src/gateRows.js`: use them. GREEN.

## Phase 4: details (US5, US6, US7)

- [ ] T011 Test: dotted underline on a supporting terminal and not on an unknown one, `NO_COLOR`
  keeps it; `displayWidth` ignores `\x1b[4:4m`. RED, then `src/theme.js`. GREEN.
- [ ] T012 Test: `NO_COLOR` chips start with `▏`, width one column, two with
  `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE=1`. RED, then `src/theme.js`. GREEN.
- [ ] T013 Test: OKLCH lighten keeps hue within 3 degrees, raises lightness, and the 4.5:1 rule
  holds on the result. RED, then `lighten` via `src/contrast.js`. GREEN.

## Phase 5: close

- [ ] T014 `npm test`, `node scripts/bench.js` (p95 at or under 25 ms), `npm run previews`;
  each changed preview explained in the commit.
- [ ] T015 README: flavor from the terminal, `COLORTERM`, `COLORFGBG`, the `NO_COLOR` edge.
- [ ] T016 Spec `status: done`, version bump, PR, merge.
