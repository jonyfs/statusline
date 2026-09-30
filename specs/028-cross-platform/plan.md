# Implementation Plan: The same statusline on Linux and Windows

**Branch**: `feat/cross-platform` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Write command strings that every shell Claude Code uses can parse, print real paths instead of
`~`, let `doctor` name a project-level `statusLine` that hides ours, prove the Windows commands
in CI through PowerShell and Git Bash, and rewrite the README install section per platform.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node 18+ · **Dependencies**: none at runtime ·
**Testing**: `npm test` locally and the CI matrix; PowerShell parsing checked in the
`mcr.microsoft.com/powershell` container · **Target**: Linux, macOS, Windows

## Research

**R1. Command form.** Probed on 2026-09-30 in PowerShell 7 and bash:
`"node" "/w/cli.js" render` is a PowerShell `ParserError`; `node "/w/cli.js" render` runs in
both; `& "/opt/my node/node" "/w/cli.js" render` runs in PowerShell and is a bash syntax error;
backslashes inside double quotes survive in bash. Decision: interpreter unquoted, script path
quoted, forward slashes on Windows (the docs' instruction). A whitespace interpreter on Windows
becomes `node` when `node` resolves, else stays quoted with a warning that it needs Git Bash.

**R2. Settings precedence.** Claude Code applies project settings over user settings, so a
project `statusLine` hides the user's. `doctor` reads `<cwd>/.claude/settings.json` and
`<cwd>/.claude/settings.local.json`.

**R3. Existing installs.** `isOurCommand` already normalises slashes and case on Windows, and
`parseCommand` is widened to an unquoted interpreter, so old and new forms are both recognised
and the next install rewrites the old one.

## Constitution Check

IX is amended (FR-007): the "quote both, `process.execPath`" rule becomes FR-001 and FR-002.
It changes what the rule requires, so the bump is MAJOR, 7.0.0. Every other principle passes.

## Source changes

```text
src/install.js     buildCommand(interpreter, cli, sub, platform), hook/task interpreter choice,
                   parseCommand widened, npx refusal with real paths, projectOverrides()
src/update.js      clone command with the real path
src/doctor.js      project override line
bin/cli.js         updates: real settings path
.github/workflows/ci.yml   windows-install and linux-install jobs
README.md          per-platform install, verification, troubleshooting
.specify/memory/constitution.md   IX, 7.0.0
scripts/tests/platform.test.js, install-hook.test.js, new cross-platform.test.js
```

## Results (2026-09-30)

- Local suite: 582 passed. Linux container (node:22): 582 passed, and the three installed
  commands ran through `sh` and `bash`.
- CI run 36770426338 on `feat/cross-platform`: all 15 jobs green, including the nine suite
  combinations and `installed-commands` on Windows, where install wrote
  `node "D:/a/statusline/statusline/bin/cli.js" render` and the status line, skill hook and
  subagent rows each ran through Git Bash, PowerShell 7 and Windows PowerShell.
- The `DEP0040 punycode` warning in that job's log comes from `actions/setup-node`, not from
  this project.
