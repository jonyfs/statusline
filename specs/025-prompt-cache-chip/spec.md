---
track: full
status: done
---

# Feature Specification: The bar says when the prompt cache goes cold, and why it did

**Feature Branch**: `025-prompt-cache-chip`

**Created**: 2026-09-29

**Status**: Completed (the declaration above is authoritative)

**Input**: User description: "chip de estado do cache de prompt no statusline, usando o bloco
prompt_cache do payload do Claude Code (warm, expires_at, hit_ratio, misses, last_miss_cause,
recache_tokens_if_cold, caching_observed, ttl), para o usuário saber se o cache está quente,
quando esfria e por que perdeu cache" (a prompt-cache chip on the statusline, built from the
payload's `prompt_cache` block, so the user knows whether the cache is warm, when it goes cold,
and why it was lost).

**Track**: `full`. It adds a payload block the bar has never read, a new segment with its own
glyph, a width priority, a doctor row, a README section and a Principle III amendment.

## Why this exists

Claude Code keeps the start of a conversation in a prompt cache. While the cache is warm, the
next request reads that prefix cheaply. Once it goes cold, the next request writes the whole
prefix again, and on a long session that is the most expensive request of the hour. Nothing on
the bar says which state the session is in, so a user who steps away for six minutes on a
five-minute cache pays for it without knowing.

Claude Code 2.1.283 and later already describe the cache on every redraw. The bundled
statusline schema documents an optional `prompt_cache` block, "present after the first API
response", with these fields, among others:

- `warm`: the cached prefix is still inside its TTL right now
- `caching_observed`: any response reported cache tokens (false means caching is off or not
  reported by this provider)
- `ttl`: `5m` or `1h`, the TTL the last request wrote
- `expires_at`: when the prefix goes cold, in Unix seconds, or null
- `hit_ratio`: cache reads over all input, from 0 to 1, or null
- `misses`: requests whose cached prefix shrank without a compaction to explain it
- `last_miss_cause`: the likely cause of the latest miss, from a closed set such as
  `system_prompt_changed`, `tools_changed`, `model_changed`, `messages_rewritten`,
  `ttl_expired_5m`, `ttl_expired_1h`, `likely_server_side` and `unknown`
- `recache_tokens_if_cold`: how many tokens the next request re-caches if the cache is cold by
  then, or null right after a compaction

The same schema says Claude Code re-runs the statusline when a warm cache "reaches its
`expires_at` time", so the bar is redrawn at the moment the state changes, without a timer
of its own.

## Clarifications

### Session 2026-09-29

- Q: When does a warm cache chip appear? → A: Only when it is close to going cold: 2 minutes
  or less left on a 5-minute TTL, 10 minutes or less on a 1-hour TTL. A cold cache always
  shows. A warm cache with more time left draws no chip, since there is nothing to decide.
- Q: What does a cold chip show? → A: Both the tokens to re-cache and the miss cause, as in
  `cold · 184k · tools changed`. Under width pressure the cause goes first, then the token
  count, and only then the chip.
- Q: How does the miss cause read on the chip? → A: As a fixed short phrase:
  `tools_changed` reads `tools changed`, `system_prompt_changed` reads `prompt changed`,
  `model_changed` reads `model changed`, `messages_rewritten` reads `history rewritten`,
  `likely_server_side` reads `server side`. `unknown` and the TTL expiries show no cause. A
  code outside this list is shown as sent, through the text boundary.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how long the cache stays warm (Priority: P1)

A user in a long session glances at the bar before a break. When the cache is close to going
cold, the bar says how long it has left, so they can decide whether to send the next message
now or accept the re-cache. While there is plenty of time, the bar stays quiet.

**Why this priority**: It is the decision the data exists for. Everything else explains what
already happened.

**Independent Test**: Render a warm 5-minute payload expiring in 90 seconds and confirm the
chip reads warm with `1m` left; render one expiring in 4 minutes and confirm there is no chip.

**Acceptance Scenarios**:

1. **Given** a warm 5-minute cache expiring in 4 minutes 20 seconds, **When** the bar renders,
   **Then** no chip appears.
2. **Given** a warm 5-minute cache expiring in 1 minute 50 seconds, **When** the bar renders,
   **Then** the chip shows the cache as warm with `1m` left, in the warning band.
3. **Given** a warm 1-hour cache expiring in 47 minutes, **When** the bar renders, **Then** no
   chip appears; expiring in 9 minutes, **Then** the chip shows `9m` left.
4. **Given** a warm cache expiring in under a minute, **When** the bar renders, **Then** the
   chip shows `<1m`.
5. **Given** a warm cache whose `expires_at` has already passed but whose `warm` is still
   true (a redraw that raced the expiry), **When** the bar renders, **Then** the chip reads
   cold rather than counting down from a negative time.

---

### User Story 2 - See that the cache went cold, and what the next request will cost (Priority: P1)

A user comes back from a break. The bar says the cache is cold and how many tokens the next
request will write again, so the cost of the next message is not a surprise.

**Why this priority**: Being told after the fact still changes behaviour, and the re-cache
size is the number that makes the cost concrete.

**Independent Test**: Render a payload with `warm: false`, `caching_observed: true` and a
`recache_tokens_if_cold` value, and confirm the chip reads cold with that token count.

**Acceptance Scenarios**:

1. **Given** a cold cache with `recache_tokens_if_cold` of 184,000, **When** the bar renders,
   **Then** the chip reads cold and shows `184k` to re-cache, in the critical band.
2. **Given** a cold cache with `recache_tokens_if_cold` null (right after a compaction),
   **When** the bar renders, **Then** the chip reads cold without a token figure.
3. **Given** `caching_observed: false`, **When** the bar renders, **Then** no chip appears,
   because a provider that reports no cache tokens is not a cold cache.
4. **Given** no `prompt_cache` block at all (an older Claude Code, or before the first
   response), **When** the bar renders, **Then** no chip appears and line 3 is unchanged.

---

### User Story 3 - Know why the cache was lost (Priority: P2)

A user sees the cache went cold in the middle of active work, which the countdown cannot
explain. The chip names the likely cause, such as a tool list that changed or a model switch,
so they know what to avoid.

**Why this priority**: It turns a surprise into something the user can act on, but only
after Stories 1 and 2 exist.

**Independent Test**: Render a cold payload whose `last_miss_cause.causes` is
`["tools_changed"]`, and confirm the chip names the cause in plain words.

**Acceptance Scenarios**:

1. **Given** a cold cache whose latest miss cause is `tools_changed`, **When** the bar renders,
   **Then** the chip names the cause in a short plain-English phrase.
2. **Given** a cold cache whose latest cause is `ttl_expired_5m` or `ttl_expired_1h`, **When**
   the bar renders, **Then** the chip shows no cause, since "the time ran out" is what cold
   already means.
3. **Given** a cause outside the known set, **When** the bar renders, **Then** the chip shows
   the cause name as sent, passed through the bar's text boundary, rather than dropping it or
   inventing a description.
4. **Given** a cold cache whose latest cause is `unknown`, **When** the bar renders, **Then**
   the chip shows no cause.
5. **Given** a latest miss with several causes, **When** the bar renders, **Then** the chip
   names the first one that has something to say, skipping `unknown` and the TTL expiries.
6. **Given** a warm cache with a past miss, **When** the bar renders, **Then** the chip does
   not show the old cause, which belongs to the diagnostic.

---

### User Story 4 - The diagnostic reports the whole block (Priority: P3)

**Acceptance Scenarios**:

1. **Given** a payload with a `prompt_cache` block, **When** the user runs `doctor`, **Then**
   a `promptCache` row reports warm or cold, the TTL, the time left, the hit ratio, the miss
   count and the latest cause.
2. **Given** no block, **When** the user runs `doctor`, **Then** the row is off and says the
   payload carries none, naming the Claude Code version that introduced it.

### Edge Cases

- `expires_at` more than the TTL allows in the future (more than an hour out), or in
  milliseconds: the time left reads `?` rather than a nonsense countdown.
- `hit_ratio`, `misses` or `recache_tokens_if_cold` negative, not a number or infinite: that
  field is treated as absent, and the rest of the chip still renders.
- `warm` missing or not a boolean: the chip is not drawn, since warm or cold is its subject.
- A narrow terminal: the cold chip gives up its cause first, then its token count, and only
  then is the chip itself shed by priority like any other segment.
- Plain mode and `NO_COLOR`: the chip stays readable, with every glyph in the glyph table and
  a plain substitute, and the band marked by characters as well as colour.
- A payload arrives every few seconds during work: the chip changes only when the state
  changes, and the countdown moves by whole minutes, so it does not flicker.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST read the payload's `prompt_cache` block and validate each
  field it uses, treating any unusable field as absent.
- **FR-002**: When the block is present, `warm` is a boolean and `caching_observed` is true,
  line 3 MUST show a cache chip if the cache is cold, or if it is warm and inside its closing
  window: 2 minutes or less left on a `5m` TTL, 10 minutes or less on a `1h` TTL. Otherwise it
  MUST show none and reserve no space. A warm cache with an unknown TTL or a null
  `expires_at` shows no chip.
- **FR-003**: A warm chip MUST show the time left until `expires_at`, in whole minutes rounded
  down, with `<1m` under a minute, and MUST use the warning band.
- **FR-004**: A chip whose `warm` is true but whose `expires_at` has passed MUST read cold.
- **FR-005**: A cold chip MUST read cold, use the critical band and, when
  `recache_tokens_if_cold` is a usable number, show it abbreviated in the bar's existing token
  form (for example `184k`).
- **FR-006**: A cold chip MUST name the latest miss cause using this table: `tools_changed`
  as `tools changed`, `system_prompt_changed` as `prompt changed`, `model_changed` as
  `model changed`, `messages_rewritten` as `history rewritten`, `likely_server_side` as
  `server side`. It MUST show no cause for `unknown`, `ttl_expired_5m` and `ttl_expired_1h`,
  and MUST show any other code as sent, through the text boundary. With several causes, it
  names the first one that is not skipped.
- **FR-007**: The chip MUST NOT show a figure the payload did not carry. It does not estimate
  cost in currency, and does not compute its own countdown when `expires_at` is null.
- **FR-008**: The chip MUST take part in width shedding at a priority in the actionable band.
  A cold chip's text MUST be shed in this order before the chip itself: the miss cause, then
  the token count.
- **FR-009**: `doctor` MUST report the block as described in Story 4, and `doctor --explain`
  MUST describe the segment.
- **FR-010**: The chip MUST stay legible in plain mode and with `NO_COLOR`, with its glyph
  declared in the glyph table with a plain substitute and adopted with rendered evidence under
  Principle X.
- **FR-011**: The README MUST document the chip with a generated preview, and MUST say how to
  capture the payload with `CLAUDE_STATUSLINE_DEBUG=1`, since that is the only way a user can
  check what their Claude Code sends.
- **FR-012**: Principle III MUST be amended before this ships to list `prompt_cache` among the
  displayed payload fields.

### Key Entities

- **Prompt cache state**: warm or cold, the TTL, the moment it goes cold, and, for a cold
  cache, the tokens the next request writes again and the latest miss cause. Derived per
  redraw from the payload, with nothing stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Whenever the cache is inside its closing window, the bar shows how many minutes
  it has left; whenever it is cold, the bar says so. No chip means the cache is warm with time
  to spare, or caching is not reported.
- **SC-002**: After the cache goes cold, the bar says so on the first redraw that reports it,
  including the one Claude Code triggers at `expires_at`.
- **SC-003**: No render in any tested state shows a cache figure that was not in the payload.
- **SC-004**: A payload without the block, or with `caching_observed: false`, renders line 3
  byte for byte as before the change.
- **SC-005**: The full test suite passes.

## Assumptions

- The block's shape comes from the statusline schema bundled in Claude Code 2.1.283 (the
  version installed here is 2.1.284). No live payload with the block has been captured on this
  machine: the last capture is from 2.1.231, because capture only happens with
  `CLAUDE_STATUSLINE_DEBUG=1`. A live capture should be taken during planning to confirm the
  field names and value ranges.
- The chip belongs on line 3, with the other things being spent. Its exact position and
  priority are a planning decision within the actionable band.
- Showing the hit ratio and the miss count on the bar is out of scope: they are history, not a
  decision, and the line has little width left. Both go to `doctor`.
- Per-cause advice ("pin your tools", "do not switch models") is out of scope. The chip names
  the cause; the README explains the causes.
- Cost in currency is out of scope, as it is for every other figure on the bar.
