# Research: Skills Line Completeness

## Decision: Report the true active-skill count separately from the scanned count

**Decision**: `getActiveSkillsDetailed` already tracks `truncated` (whether the scan gave up before exhausting the window). Extend the overflow math in `src/render.js` to use that signal: when `truncated` is true, the "+N" shown MUST be marked as a lower bound (or the scan depth increased for the count pass specifically), rather than presenting `list.length - SKILLS_SHOWN` as if it were exact.

**Rationale**: `SKILLS_PROBED = 12` (`src/render.js:238`) caps `scanTailForSkills`'s result at 12 entries; if 19 skills were actually active in the window, `hiddenCount` computes as `12 - 5 = 7` when the true figure is 14. FR-002 requires the overflow count to reflect the true total, not the scanned subset.

**Alternatives considered**: Raising `SKILLS_PROBED` to a very large number was rejected: it just moves the same bug to a higher threshold rather than fixing the category error of conflating "scanned" with "true total." The fix is to track and expose the distinction, not to make the cap big enough that nobody notices.

## Decision: Extend the hook-based event log to subagent-invoked skills

**Decision**: `appendSkillEvent` (`src/skillEvents.js`) is called from a `PostToolUse` hook keyed by session id. Investigate during implementation whether Claude Code's subagent/Task-tool invocations fire that same hook with the parent session's id (likely fixable by ensuring the hook fires for nested tool calls too) or whether the transcript-tail fallback's block-matching (`String(block.name).toLowerCase() !== "skill"`, `src/transcriptTail.js:152`) needs to also walk sub-transcripts. The chosen approach is whichever requires the smaller change while keeping a single source of truth (the fallback remains authoritative per the existing doc comment in `src/skillEvents.js`).

**Rationale**: FR-003 requires parity between direct and delegated skill invocations. The current design deliberately keeps the transcript scan as the source of truth and the hook as an accelerator (`src/skillEvents.js` doc comment: "the fallback is the source of truth for correctness"); the fix must preserve that relationship rather than making the hook a second, divergent source.

**Alternatives considered**: Building a wholly separate subagent-activity channel was rejected as unnecessary complexity; the existing dual-path (hook + transcript fallback) design already generalizes to this case once the transcript walk (or hook firing) covers subagent-originated tool_use blocks.

## Decision: Doctor output gains three new facts, using existing infrastructure

**Decision**: `src/doctor.js` already prints skill-related state ("no skill used inside the activity window", `src/doctor.js:107`). Extend it to report, per FR-004/FR-005: (a) for an expected-but-absent skill, whether it was last seen outside the window (with a timestamp) versus never detected; (b) whether the hook-based fast path or the transcript-scan fallback supplied the current skill list.

**Rationale**: `getActiveSkillsDetailed` already returns a `source` field (`"hook"` or `"transcript"`, `src/skills.js`), so surfacing it in doctor output is additive, not a new capability. Timestamps for "last seen" already exist in the underlying event/transcript records (`readSkillEvents`, `scanTailForSkills`), just not currently surfaced past the active window.

**Alternatives considered**: A separate `--skills-doctor` flag was rejected as unnecessary; the existing `--doctor` output already covers the skills segment and is the natural place to extend (User Story 3's acceptance scenarios reference "diagnostic/doctor output" generically, matching the existing single `--doctor` entry point).
