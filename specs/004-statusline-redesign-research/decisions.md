# Decisions: Research It, Then Let the Owner Build the Bar

**Decided**: 2026-09-02, by the owner, from the generated page
**Page**: [composer.html](./composer.html)

## Outcome: the bar stays as it is

```json
{
  "version": 1,
  "name": "today",
  "segments": {}
}
```

The arrangement chosen is the empty one. Every segment keeps the line, the
order and the alignment `src/segments.js` gives it, and nothing is switched
off. A fresh install draws exactly what it drew before this feature started.

This is the second time a board in this project has come back with "keep what
we have", after the animation candidates on 2026-09-01, and it is a
legitimate answer rather than a failed one. User Story 1 was built to get an
answer, not to get a change.

## What that closes

| Story | State |
|---|---|
| US1, build the bar in the browser | Done. The page exists, and it produced this decision |
| US2, the bar obeys an arrangement | Still open, and still worth building. It is what lets this decision be revisited without another feature |
| US3, the chosen design becomes the default | Closed by this decision. The chosen design is already the default, so there is nothing to fold in, no preview to regenerate and no principle to amend |
| US4, the research record | Still open. Two findings surfaced while the page was built and are recorded in [research.md](./research.md) |

## The presets, and what happened to them

The owner judged these on the page, at 80, 120 and 160 columns, in both the
Nerd Font and the plain form.

| Preset | Chosen | Reason recorded |
|---|---|---|
| today | yes | |
| lean | no | |
| operational | no | |
| peripheral | no | |
| twoLine | no | |
| oneLine | no | |

No per-preset reason was given at the time of deciding. The rows are left
empty rather than filled in with a guess: a reason nobody stated is not a
reason, and inventing one here would make the record less useful than an
honest blank. They can be filled in later if the owner wants them on record.

## What the page cost

One fixture, one preset table, one resolver, one generator and two additive
changes to existing modules. No render function changed behaviour, and the
committed previews regenerate byte-identical, so the answer "nothing changes"
really did cost nothing on the bar.
