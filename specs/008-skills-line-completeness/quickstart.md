# Quickstart: Skills Line Completeness

## Prerequisites

- Node.js >=18
- A session's transcript or hook event log with more than 5 distinct skills invoked (to exercise overflow), and ideally more than 12 to exercise the scan-depth fix

## Validate the overflow count is accurate

```bash
node bin/cli.js --doctor
```

Expected: the reported skill count and the shown-plus-hidden math on the live statusline agree with the true number of skills invoked in the window (SC-001), not merely the number the scan happened to examine.

## Validate a subagent-invoked skill is counted

```bash
# Dispatch a subagent/Task-based agent that itself invokes a named skill,
# then within the active window:
node bin/cli.js
```

Expected: that skill appears on the parent session's skills line (SC-002).

## Validate doctor output explains a missing skill

```bash
# After a skill has aged out of the active window:
node bin/cli.js --doctor
```

Expected: doctor output states the skill expired and when it was last seen, rather than staying silent about it (SC-003, User Story 3).

## Validate hook-vs-fallback visibility

```bash
# With the optional PostToolUse hook not installed:
node bin/cli.js --doctor
```

Expected: doctor output states that the slower transcript-scan fallback is in use.

## Run the extended test suite

```bash
node scripts/test-harness.js
```

Expected: extended skills/doctor tests (per plan.md) cover the overflow-accuracy and diagnostic cases above without needing a live multi-skill session.
