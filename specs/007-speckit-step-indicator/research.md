# Research: Spec-Driven Development Step Indicator

## Decision: Static skill-name to step-label lookup table, defined once in `src/skills.js`

**Decision**: A plain object maps each installed `speckit-*` skill name to a short English label (e.g. `speckit-specify` -> "Specifying", `speckit-plan` -> "Planning", `speckit-tasks` -> "Writing tasks", `speckit-implement` -> "Implementing", `speckit-clarify` -> "Clarifying", `speckit-analyze` -> "Analyzing", `speckit-checklist` -> "Checklisting"... one entry per skill currently listed under this project's `speckit-*` skills).

**Rationale**: Satisfies FR-003 directly; a static table is the simplest thing that works, matches the project's "no new dependency" posture (Principle IV), and is trivial to extend when a new speckit skill is added.

**Alternatives considered**: Deriving the label programmatically from the skill name (e.g. stripping the `speckit-` prefix and capitalizing) was considered for the fallback case (FR-006) but rejected as the primary mechanism, since "tasks" -> "Tasks" reads worse than the intentional "Writing tasks", and FR-003 asks for a label reflecting the step, not just a reformatted identifier.

## Decision: Unmapped `speckit-*` skills fall back to a formatted version of the skill name

**Decision**: For any `speckit-*` skill not in the table, strip the `speckit-` prefix, replace hyphens with spaces, and capitalize the first letter (e.g. `speckit-taskstoissues` -> "Taskstoissues" absent an explicit entry).

**Rationale**: Directly satisfies FR-006; guarantees a label always exists without the renderer needing to special-case "no mapping found."

**Alternatives considered**: Showing nothing for an unmapped skill was rejected, since FR-006 explicitly requires a fallback rather than omission; showing the raw `speckit-*` id was rejected, since FR-002 and SC-003 explicitly forbid ever surfacing the raw identifier.

## Decision: Step label attaches to the existing skills chip text, most-recent-first

**Decision**: When the most recently active skill (index 0 of the array `getActiveSkills` already returns, which is newest-first per its own doc comment) is a `speckit-*` skill, its step label is appended to the line-2 skills chip text (e.g. `speckit-plan, speckit-tasks (Planning)`). No separate segment/row is introduced.

**Rationale**: `getActiveSkills`'s existing contract is already "most recent first, deduplicated" (`src/skills.js` doc comment); reusing index 0 satisfies FR-005 (most recent wins) with no new ordering logic. Matches Principle II's rule that Line 2 already owns "active skills"; the step label is presented as an attribute of that line, not a new line.

**Alternatives considered**: A dedicated new chip/segment for the SDD step was rejected: the spec's Assumptions state this is "a label addition to the existing skills area... not a new dedicated line or panel."

## Decision: Reuse the existing 30-minute active-skill window verbatim

**Decision**: No new expiry logic. The step label simply reflects whatever `getActiveSkills` currently returns; when a `speckit-*` skill ages out of that list, its step label disappears with it on the very next render.

**Rationale**: Directly satisfies FR-007 and User Story 2; introducing a second, independent expiry timer for the step label would risk the two indicators disagreeing (e.g. step label outliving the skill chip it's attached to).

**Alternatives considered**: A longer window specifically for SDD steps (on the theory that planning/implementation phases can span longer than a typical skill's "still relevant" window) was considered but rejected: it isn't requested by the spec, and it would reintroduce the exact "stale skill" problem the existing window was built to solve (per `src/skills.js`'s own doc comments).
