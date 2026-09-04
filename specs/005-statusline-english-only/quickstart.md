# Quickstart: Statusline English-Only Output

## Prerequisites

- Node.js >=18 (per `package.json` engines)
- Repository checked out, dependencies none beyond Node itself

## Validate the regression check runs and passes

```bash
node scripts/check-english-strings.js
```

Expected: exits 0, prints "no non-English tool-authored strings found" (or equivalent), completes in well under 10 seconds (SC-003).

## Validate it catches a real violation

```bash
# Temporarily inject a non-English literal into a segment file, e.g.:
#   text: ` ${g.pr} PR #${pr.number} revisão `
node scripts/check-english-strings.js
# Expected: non-zero exit, reports file:line of the injected string
git checkout -- src/render.js   # revert the temporary change
```

## Validate pass-through data is unaffected

```bash
node scripts/smoke-test.js
```

Expected: existing smoke tests covering branch names, commit messages, and task titles in non-English content still pass unchanged (SC-004). This feature's check only inspects `src/`/`bin/` literals, never runtime data.

## Validate CLI/doctor output

```bash
node bin/cli.js --doctor
node bin/cli.js --help
```

Expected: both outputs are entirely in English (FR-003), and, per the check above, both files are included in the regression scan's file list.
