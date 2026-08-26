# Contract: the optional skill hook

**Feature**: `specs/001-statusline-freshness-audit`

The statusline meets its budget without any hook. This one exists so the skills line
reacts the moment a skill is invoked, instead of when the transcript is next
readable. Everything below is optional by construction: with the hook absent, the
skills segment falls back to the bounded transcript tail read and renders the same
names.

## What gets registered

A `PostToolUse` entry in `~/.claude/settings.json`, matching the `Skill` tool, that
runs this plugin's CLI:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          { "type": "command", "command": "\"<interpreter>\" \"<cli path>\" note-skill" }
        ]
      }
    ]
  }
}
```

`<interpreter>` is `process.execPath`, the absolute path of the Node binary running
the install, as Principle IX requires for a spawned command. The `statusLine` command
written by the same installer uses a bare `node` for reasons predating this feature;
that exemption covers existing behaviour and does not extend to a command string this
feature introduces.

Both the interpreter and the script path are quoted, for the same reason the
`statusLine` command already quotes them: either can contain spaces on any platform.

## `note-skill`

**Input**: the hook payload on stdin, which carries the session identifier and the
tool call's input.

**Behaviour**: extract the skill name and append one record to the session's skill
event file, as specified in `state-files.md`.

**Output**: nothing on stdout or stderr.

**Exit code**: always 0. A non-zero exit from a `PostToolUse` hook is feedback to the
agent, and a statusline has nothing to say to it.

**Promises**:

- Completes in single-digit milliseconds: it appends one short line and exits.
- Never blocks the tool call it observes.
- A missing session identifier, an unrecognised payload shape, or an unwritable file
  all mean "do nothing", not "fail".
- Writes to no path other than the session's own skill event file.

## Installation and removal

`install` registers this entry by default and prints a line saying so; `--no-hook`
skips it. Registration is not interactive: an install that stops to ask a question
cannot run from a script and is no longer idempotent, both of which Principle IV
requires.

`install` records that it added this entry. `uninstall` removes exactly the entry it
added, matched on this plugin's own CLI path, and leaves every other `PostToolUse`
hook alone. This is the same matching rule the `statusLine` key already uses, and it
is what FR-020 requires.

A user who registered the hook by hand, or who edited the command, keeps it:
uninstall removes only what it can prove it wrote.

## Why the fallback is not optional

FR-019 exists because a hook is a second place for behaviour to live, and behaviour
that only works when a hook fired is behaviour that breaks silently for anyone who
skipped the hook, uses a second machine, or edits their settings. The transcript tail
read stays the source of truth for correctness; the hook only makes it faster.
