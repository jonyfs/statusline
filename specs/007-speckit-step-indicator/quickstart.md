# Quickstart: Spec-Driven Development Step Indicator

## Prerequisites

- Node.js >=18
- A session where `speckit-*` skills can be invoked (this repo already has them installed under `.claude/skills/`)

## Validate a step label appears while a speckit skill runs

```bash
# Invoke /speckit-plan (or any other speckit-* skill) in a session, then within
# the active window run:
node bin/cli.js
```

Expected: the line-2 skills chip includes a plain-language step label, e.g. `speckit-plan (Planning)`, not the raw skill id alone.

## Validate the indicator disappears after expiry

```bash
CLAUDE_STATUSLINE_SKILL_WINDOW_MIN=0.02 node bin/cli.js   # ~1s window, for a fast manual check
# wait past the window, then:
node bin/cli.js
```

Expected: no SDD step indicator on the second render (User Story 2).

## Validate every installed speckit-* skill maps to something readable

```bash
ls .claude/skills/ | grep '^speckit-'
```

Cross-check each name against the lookup table in data-model.md (or its fallback rule); confirm none would print a raw `speckit-*` string.

## Validate a non-speckit skill shows no SDD indicator

```bash
# Invoke a non-speckit skill only, e.g. /humanizer, then:
node bin/cli.js
```

Expected: skills chip shows the skill name with no step label attached.
