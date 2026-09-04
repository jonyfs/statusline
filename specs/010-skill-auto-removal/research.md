# Research: Skill Auto-Removal

## Decision: The existing `windowMs()` mechanism already satisfies FR-001, FR-004, FR-005, FR-006

**Decision**: No new expiry mechanism is built. `src/skills.js`'s `windowMs()` (30-minute default) already gates every skill returned by `getActiveSkills`/`getActiveSkillsDetailed`, on both the hook-log path (`readSkillEvents`) and the transcript-fallback path (`scanTailForSkills`/`scanTail`); each is filtered against `now - windowMs` independently per skill, satisfying per-skill independence (FR-004) without extra work. The existing test `scripts/tests/skills.test.js`'s "skills expire once they stop being used" already proves a stale skill (2 hours old) doesn't sit beside a fresh one (5 minutes old) on a single scan, confirming FR-005 and the mechanics of FR-001.

**Rationale**: Rebuilding a mechanism that already exists and is already partly tested would be waste; the spec's own Assumptions section anticipated this ("this feature formalizes and verifies an automatic-removal guarantee already partially present").

**Alternatives considered**: An event-based "skill finished" signal was considered (matching a literal reading of "stops being used") and rejected: `src/skillEvents.js`'s own doc comments state plainly that Claude Code emits no such event, so this would require infrastructure that doesn't exist upstream. Time-since-last-invocation is the only observable signal, and the spec's Assumptions section already accepts this as the honest approximation.

## Decision: SC-002 is already satisfied; no documentation gap to close

**Decision**: README already documents both the default delay and its override (`CLAUDE_STATUSLINE_SKILL_WINDOW_MIN`, default 30 minutes, listed in the settings table and explained again near the skills-line description). No new documentation task is needed.

**Rationale**: A search of the current README (`CLAUDE_STATUSLINE_SKILL_WINDOW_MIN`, "skill window") found it already covered in two places, including the exact reasoning ("Code emits no 'skill unloaded' event, so a time window is the closest approximation available"). Assuming a gap here without checking would have added redundant, drifting documentation.

**Alternatives considered**: None; this decision reverses an initial assumption once the actual README content was checked.

## Decision: Verify parity between the hook path and the transcript-fallback path for expiry, not just for detection

**Decision**: A test is added confirming both `readSkillEvents` (hook) and `scanTailForSkills`/`scanTail` (transcript) apply the same window consistently, so a session with the optional hook installed and one without it expire skills the same way.

**Rationale**: `src/skillEvents.js`'s own doc comments already establish "the fallback is the source of truth for correctness," and existing tests (`skills-freshness.test.js`) cover detection parity between the two paths, but not explicitly that expiry timing is consistent between them. FR-002 requires one delay "the same for every skill," and by extension the same regardless of which detection path answered.

**Alternatives considered**: Skipping this check was rejected: an undetected divergence between the two paths would mean a developer's experience of "when does it go away" silently depends on whether they installed the optional hook, contradicting FR-002's single-delay guarantee.
