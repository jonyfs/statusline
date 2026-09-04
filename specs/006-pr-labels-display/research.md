# Research: PR Label Display

## Decision: Add `labels` to the existing `gh pr view --json` field list

**Decision**: `probePrResult` (`src/git.js:328`) extends its `--json` argument from `number,state,isDraft,url` to `number,state,isDraft,url,labels`, and reads `pr.labels` (an array of `{name, ...}` objects per `gh`'s JSON schema) into the returned value.

**Rationale**: `gh pr view --json` already supports a `labels` field with no extra API round-trip; this is the smallest change that satisfies FR-001 and FR-007 (reuse the existing cached lookup, no new network call).

**Alternatives considered**: A second `gh` call (e.g. `gh pr view --json labels` separately) was rejected: it would double the network cost this exact function's own comments warn against ("`gh pr view` costs 540ms on a warm network... neither fits in a 300ms redraw").

## Decision: GitLab MRs get labels only when the payload already supplies them

**Decision**: `normalizePr` accepts an optional `raw.labels` and passes it through unchanged when present; no `glab`-shelling equivalent is added for MRs.

**Rationale**: Reading `src/git.js`, only `gh pr view` is invoked from this codebase; GitLab MR data (`kind: "mr"`) already arrives exclusively via the statusLine stdin payload (`normalizePr(raw, "payload")`), not via a local CLI probe. Adding a `glab` shell-out would be new scope beyond what FR-005 asks for ("consistent with the existing unified PR/MR segment") and beyond what the current architecture does for any other MR field (number, status, review state are payload-only too).

**Alternatives considered**: Shelling out to `glab mr view --output json` was considered and rejected as out of scope: it would be new infrastructure this feature doesn't need to introduce, since the existing MR number/status already work payload-only and labels should follow the same path for consistency.

## Decision: Truncate at a fixed count, not by column budget calculation

**Decision**: Show up to 3 labels by name, then a "+N" suffix for the rest, mirroring the existing skills-line pattern (`hiddenCount` / `+${hidden}` in `src/render.js:708-713`).

**Rationale**: The codebase already has a proven, simple pattern for "show a few, count the rest" (skills line); reusing it satisfies FR-004 without inventing a new column-fitting algorithm. The existing line-width trim pass (`trimFromLeft`, `src/render.js:984`) still applies afterward for overall line overflow, so this is a belt-and-suspenders design: a small fixed cap keeps the common case tidy, and the existing trim handles the rare case of an unusually long label name.

**Alternatives considered**: Dynamically computing how many labels fit based on remaining columns was rejected as unnecessary complexity; the existing segment-priority/trim system (Principle II) already handles line-level overflow, so the PR segment doesn't need its own width-aware truncation logic.

## Decision: Empty and unavailable labels render identically to today's segment

**Decision**: When `pr.labels` is an empty array or `undefined` (fetch failed, older `gh` version, non-GitHub host), the label suffix is simply omitted from the segment text, an empty string, not a placeholder.

**Rationale**: Directly satisfies FR-003 and FR-006; the segment's existing text-building code (`src/render.js:665-671`) already conditionally appends the review-state suffix the same way (`${review ? ` ${review}` : ""}`), so labels follow the identical pattern.

**Alternatives considered**: A "no labels" placeholder (e.g. an em-dash or "none") was rejected: it adds visual noise for the common case of an unlabeled PR, which FR-003 explicitly forbids.
