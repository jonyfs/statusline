# Implementation Plan: Explaining a segment

**Feature**: `019-explaining-a-segment` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Route B, at the owner's decision of 2026-09-07 — every segment
carries a link to the README section that explains it, so a terminal that
previews link targets says something on hover and a click opens the page.

## Summary

Every segment gets a `url`. Three already have one, pointing somewhere more
useful than documentation; those keep it. The rest point at the README section
that explains them. The link costs zero display columns, so nothing on the bar
moves.

The visible change is that terminals which underline linked text will underline
almost the whole bar. That is the trade the owner accepted, and it gets an
environment switch because every other change of appearance in this project has
one.

## Technical Context

**Language/Version**: JavaScript, Node 18+, unchanged

**Primary Dependencies**: none added. OSC 8 is already implemented in
`src/theme.js` and already used by three segments

**Storage**: none

**Testing**: the existing smoke suite

**Target Platform**: any terminal; a terminal without OSC 8 support shows the
text unchanged, which is the same fallback the three existing links rely on

**Performance Goals**: no measurable change. The map is a constant; no lookup
touches the filesystem or the network

**Constraints**: the rendered text must not gain a column, and the ASCII and
`NO_COLOR` modes must behave as they do today

**Scale/Scope**: 22 segments, one anchor each

## Constitution Check

| Principle | Verdict |
|---|---|
| I — Starship-compatible output | PASS. OSC 8 is already emitted; this adds no new sequence |
| II — Three-line structure | PASS. No segment moves, and no line changes width |
| III — Token tracking grounded in real data | Not touched |
| IV — Installable by clone | PASS. Links target the public repository, which is how it is distributed |
| V — Integration documentation | PASS. The switch is documented with the others |
| VI — English-only codebase | PASS |
| VII — MVP-first | PASS. Routes A and C are deferred, not built |
| VIII — Generated, not hand-drawn, output | PASS. Previews regenerate; the SVG converter already strips OSC 8 |
| IX — Linux, macOS, Windows | PASS. Nothing platform-specific |
| X — Icons carry live state | PASS. No icon changes |
| XI — Tag-driven releases | Unchanged |

**One thing to watch.** Principle I says the bar's output must stay
Starship-compatible plain text. A link is invisible to a terminal that does not
support it, but it is not invisible to `displayWidth`, which strips OSC 8
before counting — that behaviour already exists and a case pins it.

## Design

### Where a link points

A segment's link is its most useful destination, and documentation is the
fallback rather than the rule:

| Segment | Points at | Why |
|---|---|---|
| `dir` | the directory itself | already does; opening the folder beats reading about it |
| `branch` | the branch on GitHub | already does |
| `pr` | the pull request | already does |
| everything else | the README section explaining it | there is nothing better to point at |

### Which section

Grouped by what the section actually covers, so several segments share one
anchor rather than each getting a heading invented for it:

| Anchor | Segments |
|---|---|
| `#git-and-github-status` | repo, projectDir, worktree, conflicts, worktreeState, ci |
| `#what-it-knows-about-the-work` | skills, todo, activity, linesChanged |
| `#reading-a-level-at-a-glance` | context, fiveHour, sevenDay |
| `#where-a-number-is-heading` | burnRate, projection |
| `#model-and-effort` | model, effort |
| `#what-line-3-can-tell-you` | duration |
| `#where-the-numbers-come-from` | rtk |

### The switch

`CLAUDE_STATUSLINE_NO_HELP_LINKS=1` drops the documentation links and leaves the
three that point at real things. It exists because underlining is the one cost
here, and a person who finds it noisy should not have to choose between that and
uninstalling — the same reasoning `NO_COLOR` and `CLAUDE_STATUSLINE_SEPARATOR`
already carry.

## Phases

**Phase 0 — research.** Confirm that OSC 8 costs no columns in this renderer,
that the SVG converter drops it, and that GitHub's anchor for each heading is
what the map assumes. Recorded in [research.md](research.md).

**Phase 1 — the map.** One table, segment key to anchor, beside the registry it
mirrors. A segment absent from it fails a test, and an anchor absent from
README.md fails a test. Shape in [data-model.md](data-model.md).

**Phase 2 — the renderer.** Attach the link where a segment does not already
have one. Honour the switch.

**Phase 3 — proof.** Regenerate previews and the composer page; both must come
back with no diff, since a link changes no pixel. Validate by hand in a terminal
that previews link targets. Steps in [quickstart.md](quickstart.md).

## Risks

**Underlining.** The accepted cost. Mitigated by the switch, and by the fact
that a reader who dislikes it sees it immediately rather than discovering it
later.

**A heading renamed in the README breaks a link silently.** Mitigated by the
test that every anchor in the map exists in README.md — a rename fails the suite
rather than shipping a dead link.

**A link that never resolves offline.** Accepted. The three existing links
already assume a browser, and the fallback is the text, which is unchanged.
