# Quickstart: Speckit Feature Indicator

## Prerequisites

- Node.js >=18
- A session with `.specify/feature.json` present (any Spec Kit project after its first `/speckit-specify`)

## Validate the feature identifier appears

```bash
cat .specify/feature.json   # confirm feature_directory, e.g. "specs/009-speckit-feature-indicator"
# with a speckit-* skill active in the session's recent activity:
node bin/cli.js
```

Expected: the line-2 skills chip shows `<skill> (009-speckit-feature-indicator)`.

## Validate it updates when the feature changes

```bash
echo '{"feature_directory": "specs/999-something-else"}' > .specify/feature.json
node bin/cli.js
```

Expected: the shown identifier is now `999-something-else`, not the previous one.

## Validate graceful absence

```bash
mv .specify/feature.json /tmp/feature.json.bak
node bin/cli.js
mv /tmp/feature.json.bak .specify/feature.json
```

Expected: the skills chip shows the skill name with no feature-identifier parenthetical (falling back to the step label if the related feature supplies one, per research.md).

## Validate a non-speckit skill shows nothing

```bash
# With only a non-speckit skill active in recent session activity:
node bin/cli.js
```

Expected: no feature identifier and no step label, matching the existing rule that this indicator is speckit-specific.

## Run the test suite

```bash
node scripts/test-harness.js
```

Expected: the extended `sdd-step-indicator.test.js` (or its sibling) covers the scenarios above.
