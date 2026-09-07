# Data Model: Explaining a segment

One table, mirroring the registry it explains.

## `SEGMENT_HELP`

`segment key -> README anchor`. Nothing else: the link target is the whole
value, and the section behind it is the explanation.

```
repo, projectDir, worktree,        -> #git-and-github-status
conflicts, worktreeState, ci
skills, todo, activity,            -> #what-it-knows-about-the-work
linesChanged
context, fiveHour, sevenDay        -> #reading-a-level-at-a-glance
burnRate, projection               -> #where-a-number-is-heading
model, effort                      -> #model-and-effort
duration                           -> #what-line-3-can-tell-you
rtk                                -> #where-the-numbers-come-from
```

`dir`, `branch` and `pr` are deliberately absent. Each already points somewhere
better than documentation, and the renderer only supplies a help link where a
segment has none.

## Invariants, each with a case

1. **Every segment is covered.** A key in `SEGMENTS` that is neither in
   `SEGMENT_HELP` nor in the already-linked set fails the suite. This is what
   stops the table drifting from the registry the way the README did.
2. **Every anchor resolves.** Each distinct anchor must match a heading in
   README.md, slugified as GitHub slugifies it. A renamed heading fails the
   suite rather than shipping a dead link.
3. **An existing link is never replaced.** `dir` still opens the folder,
   `branch` still opens the tree, `pr` still opens the pull request.
4. **The bar does not move.** The rendered width of every line is unchanged
   with links on and off.

## The switch

`CLAUDE_STATUSLINE_NO_HELP_LINKS=1` suppresses the help links only. The three
that point at real things stay, because they are not what the switch is for:
underlining is, and those three were already underlined before this feature.
