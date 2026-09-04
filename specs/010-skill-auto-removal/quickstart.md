# Quickstart: Skill Auto-Removal

## Prerequisites

- Node.js >=18

## Validate a stale skill is removed automatically

```bash
CLAUDE_STATUSLINE_SKILL_WINDOW_MIN=0.05 node -e '
  const { appendSkillEvent } = await import("./src/skillEvents.js");
  appendSkillEvent("quickstart-session", "some-skill", { now: Date.now() - 5000 });
'
node bin/cli.js   # within a session using "quickstart-session"
```

Expected: `some-skill` is absent, since it aged past the 0.05-minute (3-second) window with no restart or manual step taken.

## Validate an actively used skill is not removed

```bash
node -e '
  const { appendSkillEvent } = await import("./src/skillEvents.js");
  appendSkillEvent("quickstart-session", "some-skill", { now: Date.now() });
'
node bin/cli.js
```

Expected: `some-skill` still shows, since it's within the (default 30-minute) window.

## Validate the delay is configurable

```bash
CLAUDE_STATUSLINE_SKILL_WINDOW_MIN=60 node bin/cli.js
```

Expected: no crash, and a skill up to 60 minutes old (rather than 30) still shows, per README's documented override.

## Validate independence between skills

```bash
# Append an old event for skill A and a fresh one for skill B in the same session, then:
node bin/cli.js
```

Expected: only skill B shows; skill A's staleness doesn't affect B, and B's freshness doesn't keep A visible.

## Run the test suite

```bash
node scripts/test-harness.js
```

Expected: `scripts/tests/skills.test.js` and `skills-freshness.test.js` cover the scenarios above.
