# Mining the Project for Material

The article is only worth reading if it carries something the reader could not have written
themselves. That material comes from the repository, not from general knowledge about the
technology it uses.

## What to Read, in Order

1. **README and top-level docs**, for what the project claims to be and for whom.
2. **The agent and contributor guides** (`CLAUDE.md`, `CONTRIBUTING.md`). A convention the
   project adopted usually marks a problem it ran into.
3. **Specs, plans and decision records** (`specs/`, `docs/adr/`, design docs). This is the
   richest source, and the one a reader cannot reconstruct from the code.
4. **The code that carries the idea**: the two or three modules where the interesting decision
   is implemented, not an inventory of every file.
5. **Tests**, which name the edge cases the author actually feared.
6. **Git history**. `git log --oneline`, the reverts, and the commits that rewrote something
   twice. A revert usually has a story behind it, and so does a fix whose message explains a
   surprise.
7. **Manifests and lockfiles**, for real version numbers, so the article does not claim
   behavior from a release the project never used.
8. **Issues and changelog**, for what broke for real users.

For an update, add `git log <sourceRef>..HEAD` and read what changed since the article was last
written. That diff is the update's outline.

## Turning It Into a Story

The material is there; the article needs an angle. Useful shapes for a project-based story:

- **The decision**: two credible options, why one won, what it cost.
- **The failure**: what was tried first, how it broke, what the break taught. Usually the most
  readable of the five, because it requires having been there.
- **The mechanism**: how a non-obvious part works, explained so the reader can build it.
- **The measurement**: a real before and after, with numbers you can point at.
- **The pattern**: something learned here that transfers to the reader's own project.

Not useful: a tour of the directory structure, a feature list, a changelog in prose, or a
walkthrough of the framework's own documentation.

## Evidence Rules

- Every number comes from a run, a benchmark, or a file in the repository. If it was not
  measured, do not print it.
- Every quoted error, log line or code sample is copied from something real, then rewritten to
  remove project identifiers.
- Version numbers come from the manifest, not from memory.
- Where the project's own claim is unverified — a README saying something is fast — treat it as
  a claim to check, not as a fact to repeat.
- If the strongest version of a point cannot be substantiated, publish the weaker true version.

## Interviewing the Operator

Some of the best material is not in the repository: why the project was started, what was
frustrating, what surprised them, what they would do differently, who they are writing for. Ask
a handful of these before drafting. Their answers, in their own words, are also the best defense
against prose that sounds machine-made.
