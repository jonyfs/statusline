# Feature Specification: Links that belong to the project you are in

**Feature ID**: `020-links-that-belong-here`

**Status**: Implemented — option D, at the owner's decision of 2026-09-07

**Date**: 2026-09-07

**Input**: The links opened from the statusline look mixed between projects —
one repository appears to open another project's repository. The statusline
should be isolated from the other projects using it.

## What the evidence shows

The literal reading of the report is that per-project data is leaking between
sessions. It is not. Every link family was checked against the live cache on
this machine:

| Family | How it is keyed | Verified |
|---|---|---|
| Directory | a script named by `sha256(terminal, directory)`, which `cd`s into that directory | per directory |
| Branch, pull request, CI | the repository cache, keyed by `sha256(directory)` | per repository |

The two projects side by side hold exactly their own values:

```
statusline   remote https://github.com/jonyfs/statusline    ci CI        pr branch main
barbershop   remote https://github.com/jonyfs/barbershop    ci revisão   pr #52 -> /barbershop/pull/52
```

Nothing crosses. There is no cache leak to fix.

## What is actually wrong

Feature 019 shipped a link on every segment, and nineteen of them point at the
plugin's own repository, because that is where the documentation lives. In the
barbershop window, five of the eight distinct link targets on the bar are
`github.com/jonyfs/statusline`:

```
file:///Users/jony/repositorios/ai/barbershop                 the directory
github.com/jonyfs/barbershop/tree/governanca/…                the branch
github.com/jonyfs/barbershop/pull/52                          the pull request
github.com/jonyfs/statusline#git-and-github-status            documentation
github.com/jonyfs/statusline#reading-a-level-at-a-glance      documentation
github.com/jonyfs/statusline#where-a-number-is-heading        documentation
github.com/jonyfs/statusline#model-and-effort                 documentation
github.com/jonyfs/statusline#where-the-numbers-come-from      documentation
```

A bar rendered inside barbershop mostly points at a different repository. That
is correct by construction and wrong by experience: a reader hovering a segment
in their own project has no way to tell "this is the tool's manual" from "this
is the wrong repository", and the second is what it looks like.

This is a regression introduced yesterday by feature 019, not a long-standing
defect. It was reported within a day of shipping, which is the shortest
feedback this project has had on a design decision.

## Requirements

- **FR-001**: A segment's link never suggests the session is in a repository
  other than the one it is in.
- **FR-002**: The three links that point at the project itself — the
  directory, the branch and the pull request — keep working exactly as they do.
- **FR-003**: Whatever answers "what does this segment mean" stays reachable,
  since the need feature 019 addressed has not gone away.
- **FR-004**: The default costs a reader no explanation. Anything surprising is
  opt-in rather than opt-out.

## Options

Each satisfies FR-001. They differ in what happens to FR-003.

**D. Point every link into the project you are in.** Chosen. The segments that
describe the repository link into it — the repository itself, and the CI runs
for the branch the segment answered about — and the ones describing the
session, the model or a limit carry no link, since the project has nothing for
them to point at. Five links on line 1, all of them the reader's own. The
question feature 019 answered goes back to this README and `doctor`, which is
where it was before and needs no link on the bar to be reachable.

**A. Remove the documentation links.** The bar goes back to three links, all
pointing into the project. FR-003 is dropped: the question feature 019 answered
goes unanswered again.

**B. Default them off, opt-in by environment variable.** The capability stays
for anyone who wants it, and no project's bar points elsewhere unless its owner
asked. The switch already exists and is inverted; the documentation changes with
it. Recommended.

**C. Point at the installed copy instead of the repository.** A `file://` link
under `~/.claude/statusline-plugin/` reads as the tool rather than as a
repository. It also opens raw markdown, where anchors do not resolve, so a
reader lands at the top of an 880-line file rather than at the section.

## Success Criteria

- In any project, every link the bar renders resolves to that project, or to
  nothing, unless the reader opted in.
- The directory, branch and pull request links are unchanged.
- A reader can still find out what a segment means without reading the source.

## Assumptions

- The three project links are wanted and are not part of the complaint: they
  already pointed at the right repository and the evidence confirms it.

## Out of Scope

- Route A of feature 019 — descriptions on hover on the composer page — which
  has no such problem, since that page is the tool and not a project.
