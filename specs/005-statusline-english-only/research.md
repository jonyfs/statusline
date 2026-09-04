# Research: Statusline English-Only Output

## Decision: Scope the check to rendered/output-facing strings only

**Decision**: The regression check scans `src/*.js` and `bin/cli.js` string literals that reach the terminal (segment `text:` fields, thrown/logged user-facing messages, CLI help/doctor strings), not source comments or internal dev logs.

**Rationale**: FR-005 requires flagging what the review must fix; comments and internal logs never reach the statusline output, so flagging them would produce noise unrelated to the user's complaint (mixed-language *display*).

**Alternatives considered**: Scanning the whole repository including comments and docs was rejected as out of scope per the spec's Assumptions; it would also fail Principle VI's existing (broader) English-only-codebase rule for a different reason than this feature addresses.

## Decision: Baseline scan confirms no current violations

**Decision**: A pre-planning grep for non-English string literals (accented characters, common Portuguese words) across `src/`, `bin/`, and `scripts/` found zero tool-authored strings needing translation.

**Rationale**: Grounds Success Criterion SC-001 ("100% of tool-authored strings found... render in English") as already met; this plan's job is the verification tooling and guard, confirmed by re-running the same scan as part of Phase 1 design validation.

**Alternatives considered**: Assuming violations exist without checking was rejected: it would risk inventing fixes for a problem not present.

## Decision: Static allowlist/denylist check, not an NLP/language-detection library

**Decision**: The regression guard is a small Node script that extracts string literals from the segment/render/CLI files and flags any containing characters or word patterns outside a maintained list of expected English tokens (labels already in use, git/tech terms, format placeholders).

**Rationale**: Matches the project's zero-dependency constraint (Principle IV) and the "under 10 seconds" performance bar (SC-003); a full language-detection dependency would be disproportionate for a codebase with a few dozen literal strings.

**Alternatives considered**: A third-party language-detection npm package was rejected, since it adds a runtime/dev dependency the constitution's clone-install model doesn't currently carry. An i18n framework was rejected per the spec's Assumptions, since this is not a localization feature.

## Decision: Check runs as an added `scripts/tests` entry, wired into the existing harness

**Decision**: `scripts/check-english-strings.js` is added next to the existing `scripts/tests/*.test.js` files and invoked by `scripts/test-harness.js`, so it runs the same way as every other regression test (`npm test` / CI, if configured).

**Rationale**: Reuses the existing test-discovery and reporting path instead of inventing a second one; keeps the "repeatable, low-effort" requirement (FR-007) consistent with how the project already catches regressions.

**Alternatives considered**: A separate pre-commit hook was rejected as a first step. The project's existing CI/test entry point already covers "before merge" per FR-007's intent, and a git hook can be layered on later without changing this design.
