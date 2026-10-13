# Research: Runs output and failure contract

## Decision 1: convert the renderer's final lines, not a second render path

- **Decision**: `src/runs.js` turns the lines the renderer returns into runs. It reads the
  sequences the renderer emits: `38;2;r;g;b` and `48;2;r;g;b`, `1`, `2`, `4`, `22`, `24`, `39`,
  `49`, `0`, `53` and `55` (dropped), and OSC 8 with a BEL or ST terminator.
- **Rationale**: the bar is built in several producers (`renderRow`, the agent rows, the gate
  rows, the fallback chip), each writing escapes of its own. A structured second path would
  have to be threaded through all of them and kept equal to the first; one converter at the end
  sees everything and makes "same plain text, column for column" true by construction. The
  parser moves from the host to this repository, where a test replays the runs and compares
  them with the ANSI output.
- **Alternatives**: (a) return structured segments from `renderRow` and build ANSI from them:
  the right shape, but a rewrite of every producer and a risk to the byte-for-byte rule.
  (b) leave the host parsing: the problem the spec exists to remove.

## Decision 2: runs mode forces truecolor

- **Decision**: in runs mode the colour depth is truecolor whatever the terminal environment
  says, by setting `COLORTERM=truecolor` before the renderer is imported.
- **Rationale**: the contract says the colour of a run is its resolved truecolor value. A host
  has no terminal, so `TERM` and `COLORTERM` describe nothing it draws on.
- **Alternatives**: read `38;5;n` and map back to hex: lossy, and the host would not get the
  value the palette resolved.

## Decision 3: colours without a hex value are left out

- **Decision**: the `terminal` palette draws `ansi:N` tokens, which have no hex. In runs mode
  they become SGR default (`39`, `49`) so a run carries no `fg` or `bg`. The same holds for
  `NO_COLOR`, where the renderer emits no escape and runs carry only `text`.
- **Rationale**: inventing a hex for the terminal's own colour would be a guess the host cannot
  tell from a measurement (Principle III, by analogy).

## Decision 4: `href` allow-list and `id`

- **Decision**: an OSC 8 target is kept when its scheme is `http`, `https` or `file`; any other
  target leaves the text and drops the link. The `id=` parameter is not carried.
- **Rationale**: the host opens or shows links, and `javascript:` or a bare `cmd:` target is not
  something to hand over. The renderer only emits the three schemes today, so the filter
  changes nothing now and guards the contract later.

## Decision 5: exit 75 only in runs mode

- **Decision**: the default mode keeps exit 0 and the legacy fallback lines, as `bin/cli.js`
  documents. Exit 75 (`EX_TEMPFAIL` in `sysexits.h`) is used only when runs mode is on.
- **Rationale**: Claude Code stops calling a command that exits non-zero, so a failure in the
  default mode must still look like a bar. A host that asked for runs asked for a contract.
- **Alternatives**: a distinct code per error: more to document and no host benefit, since
  `error.code` carries the reason.

## Decision 6: the Node message states the real minimum

- **Decision**: the `node-version` message is built from `MIN_NODE_MAJOR` (18), not from the
  `20` in the spec's example.
- **Rationale**: a message that names a version the renderer does not require would be wrong
  on Node 18, which runs it fine. The spec's number is an example of the shape.

## Decision 7: empty and non-object input are `bad-payload`

- **Decision**: in runs mode, empty or whitespace-only stdin, invalid JSON, and JSON whose top
  level is not an object (array, string, number, `null`) are `bad-payload`. The ANSI mode keeps
  reading empty input as `{}`.
- **Rationale**: the spec says input that is not valid JSON is `bad-payload`, and empty input is
  not valid JSON. A host that wants a footer with no payload sends `{}`.

## Decision 8: the switch is read in `bin/cli.js`, before imports

- **Decision**: `bin/cli.js` computes `runsMode` from `argv` and the environment at the top,
  next to the Node check, and imports `src/runs.js` only on the runs path. The Node check and
  the catch-all use a small inline error writer, as `renderFallback()` already does.
- **Rationale**: the error object has to print even when most modules cannot load, which is
  exactly what the existing top-of-file comment describes.

## Decision 9: how a render failure is told from a legitimately empty bar

- **Decision**: an empty status is `{"contract":1,"lines":[]}` with exit 0. A thrown exception
  is `internal`. The renderer's own fallback chip ("statusline unavailable") is not reachable
  in runs mode: `bin/cli.js` catches and reports `internal` instead.
- **Rationale**: it removes the string comparison the host does today.

## Decision 10: no run is empty

- **Decision**: runs with empty text are not emitted. Adjacent runs with the same style are
  merged. Control characters other than the escapes the converter reads are removed from
  `text`.
- **Rationale**: the contract says `text` is non-empty and has no control characters. Merging is
  allowed and makes the output smaller.
