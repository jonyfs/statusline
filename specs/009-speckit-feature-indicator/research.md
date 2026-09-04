# Research: Speckit Feature Indicator

## Decision: Read `.specify/feature.json`'s `feature_directory` field, and derive the identifier from it

**Decision**: A small reader parses `.specify/feature.json` from the project root, reads `feature_directory` (e.g. `"specs/009-speckit-feature-indicator"`), and takes its basename (`"009-speckit-feature-indicator"`) as the feature identifier.

**Rationale**: This is the exact file every `/speckit-specify`, `/speckit-plan`, and `/speckit-tasks` invocation already writes before doing its work (confirmed live: this session's own transcript shows `.specify/feature.json` updated before each spec/plan/tasks step across specs 005 through 009). It is the single source of truth FR-002 asks for, with zero new infrastructure.

**Alternatives considered**: Parsing the git branch name for a feature-like prefix was rejected: FR-002 explicitly rules out inferring from unrelated signals, and a branch name is independent of the spec directory by this project's own design (`speckit-specify`'s own instructions: "the spec directory name and the git branch name are independent"). Scanning `specs/` for the most recently modified directory was rejected as a fragile heuristic when `feature.json` already states the answer directly.

## Decision: The feature identifier replaces the SDD-step label in the same parenthetical, rather than both appearing together

**Decision**: `sddStepFor(skills[0])`'s result is dropped from the skills-chip parenthetical wherever a feature identifier is available; the feature identifier takes that slot instead. When no feature identifier is available (FR-004) but a step label is, the step label is shown, so the related feature's behavior degrades gracefully rather than disappearing.

**Rationale**: FR-001 specifies the exact format `<skill-name> (<feature-identifier>)`, with no room for a second parenthetical element; showing both (`speckit-plan (Planning) (009-speckit-feature-indicator)`) would violate that literal format and clutter a line already competing for width (Principle II). A feature identifier is also more specific and durable than a step label (it says *which* feature, the step label only says *what phase*), so it is the more valuable thing to show when only one can fit.

**Alternatives considered**: Combining both into one string (`speckit-plan (009-speckit-feature-indicator · Planning)`) was considered and rejected for this iteration: it doesn't match FR-001's literal format, and a feature identifier is frequently a full sentence-length directory name already (e.g. `009-speckit-feature-indicator`), so appending a step label risks the whole parenthetical becoming the widest thing on the line. This can be revisited if user feedback asks for both.

## Decision: Missing or malformed `feature.json` degrades to "no feature identifier", not an error

**Decision**: A missing file, invalid JSON, or a `feature_directory` field that is absent/not a string all result in no feature identifier being shown (falls through to the step label if any, per the decision above), never a thrown error or a placeholder string.

**Rationale**: Directly satisfies FR-004 and the spec's edge case for "a project not using Spec Kit's per-feature tracking." The statusline's existing design philosophy (seen throughout `src/render.js` and `src/skills.js`) already treats a missing signal as "nothing to show" rather than a failure; this feature follows the same pattern.

**Alternatives considered**: Surfacing a warning or error state on the line was rejected: `.specify/feature.json` legitimately does not exist in any project that hasn't run a Spec Kit command yet, so its absence is normal, not exceptional.
