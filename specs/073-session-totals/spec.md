---
track: quick
status: done
---

# Session totals: what the session has spent, read as it is written

**Feature Branch**: `feat/073-backlog-batch`

**Created**: 2026-11-05

**Input**: Backlog items 1, 3, 4, 8, 9 and 11 of the owner's selection (statusline backlog, 2026-11-05):
the session's tokens, the output rate, the tool calls, the subagents' tokens, the model mix, and
the time spent above 200k tokens.

**Track**: `quick`: one incremental reader, two segments, one tail on the context chip.

## Why this exists

The bar shows the context and the credits, which say how much is left. It does not say what the
session itself has consumed. The transcript carries every answer's `message.usage` (input, output,
cache read, cache written), its `message.model`, and every `tool_use` block; subagents write their
own `subagents/agent-*.jsonl` beside it. Reading the whole file on every redraw is what
`transcriptTail.js` was built to avoid, so this reader keeps an offset per file and reads only what
was appended since the last redraw.

## Requirements

- **FR-001**: `src/sessionTotals.js` keeps, per session, under the state root: the byte offset read
  of the main transcript and of each subagent file, the summed `input_tokens`, `output_tokens`,
  `cache_read_input_tokens` and `cache_creation_input_tokens`, the count of assistant turns, the
  count of `tool_use` blocks per tool name, the output tokens per model, the tokens attributed to
  subagents (sidechain entries and `subagents/*.jsonl`), the milliseconds spent with
  `exceeds_200k_tokens` true, and a fifteen-minute ring of output-token samples. One redraw reads
  at most 2 MiB of new bytes and finishes the rest on later redraws. A file that shrank is read
  again from zero. A malformed line is skipped.
- **FR-002**: Segment `sessionTokens` (line 3, savings, after the duration): `Σ 1.2M` is the total of
  all four token counts, main session and subagents; tails `· ↑3.1k/min` (output tokens per minute
  over the ring, two samples spanning a minute at least), `· agents 420k` when subagents spent any,
  `· opus 20%` when more than one model answered (the share of output tokens of the model that is
  not the session's own, the largest one). Width sheds the tails right to left.
- **FR-003**: Segment `toolCalls` (line 2, after the activity): `tools 42`. Absent at zero.
- **FR-004**: The context chip's `200k+` mark carries `· 12m` once the session has spent a minute
  above the threshold, measured between redraws that saw the flag.
- **FR-005**: The doctor describes `sessionTokens` with the four counts and the turn count, and
  `toolCalls` with the three most used tools.
- **FR-006**: Nothing is read when the payload names no transcript (which only Claude Code's payload
  carries, so Codex, OpenCode and Copilot read nothing), or when the state root cannot be written
  (a passive render without a cache directory): without a kept offset every redraw would sum part
  of the transcript. The state is written only when an offset or a counter moved.

## Out of scope

Money for any of it; a per-turn breakdown; reading the whole transcript on the first redraw (it is
read in 2 MiB steps).
