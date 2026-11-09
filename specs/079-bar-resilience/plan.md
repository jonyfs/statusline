# Plan: 079 bar resilience

Spec: [spec.md](spec.md). Tasks: [tasks.md](tasks.md).

## Decisions the spec left to the plan

### Glyphs (FR-015 to FR-017)

Measured on `main` with `GLYPHS` imported (not a regex over the file), every value shared by
more than one key in a tier:

| Tier | Shared value | Keys | Decision |
|---|---|---|---|
| nerd | `U+F004D` | `from`, `mcp` | **split**: `mcp` takes `U+F492` (`oct-plug`, BMP, one cell, unused) |
| nerd | `U+F051F` | `timer`, `cacheWarmHalf` | **split**: `timer` takes `U+F0150` (`md-clock_outline`, unused); the cache keeps the hourglass family so its three states stay a sequence |
| nerd | check | `reviewApproved`, `ciPass`, `clean` | allowed: three "good" states, deliberately alike |
| nerd | `U+F0026`-like alert | `bandCritical`, `conflict` | allowed: both are "stop", red, and never on the same line |
| nerd | `md-gauge` | `effortHigh`, `effort` | allowed: `effort` is the family's name |
| emoji | `⏳` | `timer`, `cacheWarm`, `cacheWarmHalf` | **split**: the warm cache takes `💾` (`U+1F4BE`, W, Emoji_Presentation, E0.6); `timer` keeps `⏳` |
| emoji | `🚫` | `prClosed`, `unavailable` | **split**: `unavailable` takes `⛔` (`U+26D4`, W, Emoji_Presentation, E0.6) |
| emoji | `🔄` | `reset`, `ciRunning` | allowed: both mean "comes round again"; line 1 vs line 3 |
| emoji | `✅`, `🎯`, `⬜`, `🟩`, `🔨`, `💤` | families | allowed |
| plain | `?` | `untracked`, `help` | **split**: `help` takes `‽` (`U+203D`, East Asian **N**). `¿` was the spec's candidate and is **A** (Ambiguous) in Unicode 16.0, which the bar avoids; `ⓘ` is A too |
| plain | `!` | `bandCritical`, `yourTurn`, `unavailable` | allowed: the plain tier is the one that has to work in any font, and colour carries which of the three it is. The spec said "MUST change"; changing it would spend three more Narrow codepoints on states that are already told apart by colour and position. Spec FR-016 amended |
| plain | `⇄` | `pr`, `prDraft`, `prMerged`, `prClosed` | allowed: documented in the tier ("every state of a pull request is the exchange arrows"), colour carries the state. Spec FR-016 amended |
| plain | `⎇`, `⌂`, `-`, `.`, `\|`, `✓`, `↯`, `◌`, `⧗` | families | allowed |

Widths checked against `EastAsianWidth.txt` 16.0.0 (fetched from unicode.org for this plan;
the repository's extract keeps only W and F). New Nerd codepoints are extracted with
`scripts/extract-glyphs.py` and the diff of `glyphs.json` is kept to the added and removed
codepoints only (an earlier run drifted `F0004`).

### Width (FR-008, FR-010, FR-011)

FR-008 says the smaller of `COLUMNS` and the tty wins. Search results report that some Claude
Code versions set `COLUMNS=80` whatever the window is; if that holds here, `min()` would put the
help chip back in the middle of a wide window, which is the bug v1.66.3 fixed. The rule is
therefore chosen by measurement (task T3): FR-010's dump is installed into the owner's live
session, read before and after a resize, and the result is written into the spec. Until then
the rule stays as shipped (tty first, `COLUMNS` second).

### Rows (FR-009)

Under every harness except Copilot, rows come from `LINES`, else `Infinity`. The tty's row
count is the terminal's, not the status line's area, and v1.66.3 started using it to shed
lines. Copilot keeps the tty, as specs/033 designed.

### Node reference (FR-019): changed to a doctor warning

`install.js:214-243` records why the two commands differ: the bar uses a bare `node` when a
shell can resolve it, so it follows Node upgrades; the task rows and the skill hook use
`process.execPath` because Principle IX requires a spawned command to use the interpreter
already running, and the bare `node` is a documented exception that does not extend itself.
Making them equal would break one of those two rules. FR-019 becomes: `doctor` warns when
`subagentStatusLine.command`'s interpreter no longer exists (an nvm version removed), and says
`update` rewrites it. Spec amended.

### Performance (FR-001 to FR-007)

Cheap items first, measured after each: FR-003 (state written only on change), FR-004 (compile
cache), FR-005 (lazy harness imports), FR-006 (cache ages from the interval). Replay (FR-001,
FR-002) only if the cheap items leave a full redraw above the target, and then the check runs
in `bin/cli.js` before `src/render.js` is imported (importing the graph alone is ~50 ms). The
`working` animation frames and the change tracker's fade move per redraw, so a replay key must
include them or exclude a session that is animating; that is why replay is last.

### Ceiling for the import graph (FR-005)

Recorded after FR-005 lands, from `performance.now()` around `import("./src/render.js")`, and
asserted with headroom in `bench.test.js`.
