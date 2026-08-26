# Contract: what install writes

**Feature**: `specs/002-statusline-design-review`

Feature 001's `contracts/cli.md` still governs `render`, `doctor`, `refresh`, `install`
and `uninstall`. This adds what changes in the settings file.

## `statusLine.refreshInterval`

Item F1, at 60 seconds.

Updates are event-driven, and the events go quiet while a session is idle. A countdown
and a clock are exactly the segments that keep changing while nothing else does, so
without an interval they freeze at whatever they said when the last event fired.

- `install` writes `refreshInterval: 60` alongside `command`.
- `--no-refresh-interval` skips it, for anyone who would rather the command only run on
  events.
- `uninstall` removes it along with the rest of the `statusLine` object, which it already
  deletes wholesale.
- The value is documented in the README next to the environment variables, since it is
  the one setting that lives outside them.

## The task-row command

Item F2. Declared beside `statusLine` and registered by the same install, removed by the
same uninstall, matched on this plugin's own CLI path exactly as the hook and the
statusline command already are.

## Reversibility

Everything install writes, uninstall removes, and settings it did not write it does not
touch. That rule already has a test against a throwaway HOME; it extends to cover the
refresh interval and the task-row command.
