# Tasks: The same statusline on Linux and Windows

- [X] T001 Amend Principle IX in `.specify/memory/constitution.md` to FR-001/FR-002, bump to 7.0.0 (FR-007)
- [X] T002 [US1] Write failing tests in `scripts/tests/cross-platform.test.js` for `buildCommandForTest(interpreter, cli, sub, platform)`: win32 gives `node "C:/Users/x/cli.js" render` for bare node and forward slashes throughout; a win32 interpreter with a space becomes `node` when the resolver says node runs, else stays quoted; POSIX keeps an interpreter with a space quoted and leaves one without unquoted; the script path is always quoted
- [X] T003 [US1] Implement the command form in `src/install.js` (`buildCommand`, `buildHookCommand`, `buildTaskRowCommand`, `parseCommand`), update `scripts/tests/platform.test.js` and `scripts/tests/install-hook.test.js` to the new form, and warn from `install` when a Windows interpreter had to stay quoted
- [X] T004 [US1] Add a test that a command in the old form and one in the new form are both recognised as ours by uninstall and `checkInstall`
- [X] T005 [US2] Failing tests, then real paths in the `update` clone command (`src/update.js`), the npx refusal (`src/install.js`) and `updates` (`bin/cli.js`)
- [X] T006 [US3] Failing tests, then `projectOverrides(cwd)` in `src/install.js` and its line in `src/doctor.js`
- [X] T007 [US1] Add `windows-install` and `linux-install` jobs to `.github/workflows/ci.yml` that install into a temporary profile and run the written statusLine, hook and task-row commands through PowerShell and Git Bash, and through `sh`
- [X] T008 [US4] Rewrite the README install section per platform with prerequisites, commands, verification and troubleshooting, including the project-override case; apply the humanizer
- [ ] T009 Run the suite locally and in the Linux container, trigger CI on the branch, and record the results
- [ ] T010 Set `status: done` in `specs/028-cross-platform/spec.md`
