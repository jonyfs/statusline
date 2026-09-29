# Research: The statusline tells you it has an update, and can take it

## R1. How the user is told: a chip on the bar, not a session-start message

**Decision**: The notice is a chip on line 1 of the bar. No `SessionStart` hook is added.

**Rationale**: The spec assumed Claude Code could run a command at session start and show its
output to the user, and said what to do if it could not. The hooks reference
(https://code.claude.com/docs/en/hooks, `SessionStart` and `systemMessage`) settles it:

- `SessionStart` fires on `startup`, `resume`, `clear`, `compact` and `fork`, cannot block, and
  runs while the user can already type.
- Its plain stdout, and a JSON `additionalContext`, go into Claude's context, not to the user.
- `systemMessage` on `SessionStart` is "Not shown to the user in the transcript. The field is
  accepted but discarded."
- Nothing documents a hook reading keyboard input.

So a session-start hook could only reach the user by asking the model to repeat a message,
which costs tokens on every session and depends on the model doing it. The bar is on screen for
the whole session and is drawn by code this project controls. It is also redrawn constantly,
which gives the check a trigger without registering anything new in the user's settings.

"At session start" in the spec becomes "for the first session that draws the bar after the
result": the chip carries the payload's `session_id` it was first shown to, and shows for that
session only.

**Alternatives considered**: A `SessionStart` hook printing an instruction for Claude to relay.
Rejected for the token cost and the reliance on the model. A macOS or desktop notification.
Rejected: platform-specific (Principle IX), and invisible over SSH.

## R2. The chip, its states and its width

**Decision**: Registry row `{ key: "update", line: 1, order: 70, priority: 60 }`, identity
colour. Four texts:

| State | Chip |
|---|---|
| `auto`, applied | `⤒ statusline updated · 1 feature, 2 fixes` |
| `notify`, pending | `⤓ update ready · 1 feature, 2 fixes` |
| refused (either mode) | `⤓ update blocked · local edits` / `· history diverged` |
| failed | `⤓ update failed` |

Counts omit a zero (`2 fixes`). Commit subjects do not fit on the bar; `update` and the new
`check-updates` command print them, which is where the spec's "up to three subject lines" goes.

A `ready` or `blocked` chip stays while the condition holds, since each asks the user to act.
An `updated` or `failed` chip shows in the first session that draws after the event, then goes.

**Rationale**: Line 1 holds the repository and its state, and "this tool has an update" is
about the install, not the session. Order 70 puts it after the CI tick, so nothing existing
moves. Priority 60 sits in the useful band: it gives way before the branch or the pull request,
and a user on a wide enough terminal sees it.

## R3. Icons

**Decision**: `U+F01DA` nf-md-download for ready, blocked and failed; `U+F0737`
nf-md-arrow_up_bold for updated. Plain substitutes `⤓` (U+2913) and `⤒` (U+2912), both East
Asian Narrow.

**Rationale**: Rendered from the installed font, evidence in
`specs/026-update-check/glyph-evidence.png`. Three more names proved wrong: F0CE0, listed as an
up arrow in a circle, points right; F4A9, listed as a rocket, draws a monitor; F06B1, listed as
update, draws a vibrating watch.

## R4. When the check runs, and what triggers it

**Decision**: The redraw reads one cache entry, `update`, keyed by the clone's own directory.
When it is missing or at least 24 hours old, the redraw starts the existing detached refresh
(`cli.js refresh update <key>`) through `spawnRefresh`, with its lock and its
`CLAUDE_STATUSLINE_NO_REFRESH` switch. The redraw itself never waits.

**Rationale**: `src/cache.js` already does exactly this for the pull request and CI lookups:
lock, detached process, atomic write, abandoned-lock expiry. The 24-hour rule is checked
directly rather than through `shouldRefresh`, whose half-age rule would make it 12 hours.

## R5. What the check does

**Decision**, in the detached process:

1. `git fetch --quiet` for the clone's upstream, with `GIT_TERMINAL_PROMPT=0`, stdin closed and
   a 30-second limit.
2. `git log --format=%H%x09%s HEAD..@{u}` for what is pending, and `git rev-list --count
   @{u}..HEAD` to know whether the clone has commits of its own.
3. Classify each subject by prefix: `feat` (with or without a scope, with or without `!`) is an
   improvement, `fix` a bug fix, anything else neither.
4. In `auto` with at least one improvement or fix: call `update()` from `src/update.js`, the
   same function the `update` command uses, with every refusal it already has. It pulls
   `--ff-only` and runs `install` in a new process from the new code.
5. Write the result to the cache entry.

**Rationale**: Reusing `update()` keeps one path that changes the clone, already tested
against real repositories. `GIT_TERMINAL_PROMPT=0` and a closed stdin mean a fork behind
credentials fails instead of waiting for a password nobody can type.

**Found in the quickstart**: the refresh process receives the directory it was started in as
`cwd`, and the first version checked that directory. Run by hand from another repository, it
checked the wrong one, and in `auto` it would have pulled it. The `update` probe now ignores
`cwd` and always checks the clone its own code lives in.

## R6. Where the behaviour is set

**Decision**: `~/.claude/statusline/updates.json`, holding `{ "mode": "auto" | "notify" |
"off" }`, written by a new `statusline-plugin updates [auto|notify|off]` command. The
environment variable `CLAUDE_STATUSLINE_UPDATES` wins over the file. No file means `auto`.

**Rationale**: The existing `.statusline.json` is per repository and deliberately ignores the
home directory. Update behaviour belongs to the install, not to a project, so it needs its own
file beside the cache. An environment variable matches every other switch this project has.

## R7. Security

`auto` is the default (clarification of 2026-09-29), so these are requirements rather than
options:

- **Trust**: the clone runs whatever its upstream serves, after a fast-forward. That is the
  trust `update` already asks for, extended to happen without the user present. It is stated in
  the README and in `install`'s output (FR-014).
- **Only fast-forward, only to the configured upstream**: no URL comes from anywhere but the
  clone's own git config. Local edits, local commits and diverged history all refuse.
- **No hook execution from the remote**: git does not transfer hooks, so a fetch or pull runs
  none of the remote's code. The first code from the remote that runs is the `install` that
  `update()` starts, and then the next redraw.
- **Text from the remote**: commit subjects go through `plainText` and are cut to a length
  before `check-updates` or `doctor` prints them. The chip shows only counts.
- **No credential prompts**: `GIT_TERMINAL_PROMPT=0`, stdin closed, 30-second limit.
- **Not signed**: commits are not verified against a signature. Doing so would need a key
  distribution story this project does not have; recorded as a known limit in the README.

## R8. A redraw during the update

**Decision**: Accepted as the clarification states. `git pull` replaces files one at a time,
and a redraw that starts in that window may import a mix of old and new modules. `bin/cli.js`
already catches any failure in `render` and prints ` statusline unavailable `, exit 0; the next
redraw loads the new files.

## R9. Constitution

Principle IV says updating is a `git pull` with no reinstall; the automatic update is a pull
plus the idempotent install, and a manual pull still works. Principle IX: the refresh is spawned
with `process.execPath` and argument arrays. Principle X: two icons with rendered evidence. The
2026-08 note that "the statusline deliberately never fetches" was about fetching on every
redraw for the behind count; this is one fetch a day, in the background, the same shape as the
pull-request lookup that already reaches GitHub. No amendment is needed.
