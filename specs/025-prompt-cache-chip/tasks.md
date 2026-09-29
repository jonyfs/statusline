---
description: "Task list for the prompt-cache chip"
---

# Tasks: The bar says when the prompt cache goes cold, and why it did

**Input**: Design documents from `specs/025-prompt-cache-chip/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/output.md

**Tests**: Included. The repository works test-first, and every row of `contracts/output.md`
is a case a test can check. All tests run in the suite's throwaway HOME.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1 to US4)

## Phase 1: Setup

- [ ] T001 Amend Principle III in `.specify/memory/constitution.md` to list `prompt_cache` among the displayed payload fields, bump to 6.3.0 with a Sync Impact Report entry pointing at `specs/025-prompt-cache-chip/` (FR-012)

## Phase 2: Foundational (blocks every story)

- [ ] T002 Write failing tests for `getPromptCache(payload, now)` in `scripts/tests/prompt-cache.test.js`: null when the block is absent, when `warm` is not a boolean, or when unusable; `state` is `cold` when `warm` is true and `expires_at` has passed; `ttl` is null for anything other than `5m` or `1h`; `closing` is true at 120 s on `5m` and 600 s on `1h` and false one second beyond; `expires_at` more than 3,600 s ahead gives `secondsLeft` null; negative, NaN or string `recache_tokens_if_cold`, `hit_ratio`, `misses` are null; cause table per FR-006, including several causes, `unknown`, the TTL expiries, and an unlisted code passed through `payloadText`
- [ ] T003 Implement `getPromptCache` and the cause table in `src/tokens.js` per `data-model.md` until T002 passes
- [ ] T004 Add the `promptCache` reading to `gather()` in `src/render.js` and a `promptCache: 1_000` entry to `MAX_AGE_MS` in `src/freshness.js`

**Checkpoint**: the reading exists, nothing on the bar changed, `npm test` is green.

## Phase 3: User Story 1, see how long the cache stays warm (P1) MVP

**Goal**: a warm chip inside the closing window, silent otherwise.

**Independent Test**: render a warm `5m` payload at 110 s and at 250 s left.

- [ ] T005 [US1] Add failing render tests to `scripts/tests/prompt-cache.test.js` for the warm rows of `contracts/output.md`: no chip at 250 s on `5m` and 2,820 s on `1h`; `cache warm · 1m` at 110 s; `<1m` at 40 s; `9m` at 540 s on `1h`; no chip with a missing TTL or null `expires_at`; `cache cold` when `expires_at` passed 5 s ago; no chip when the block is absent or `caching_observed` is false; line 3 byte-identical to before in both of those cases (SC-004)
- [ ] T006 [P] [US1] Add the registry row `{ key: "promptCache", line: 3, order: 54, priority: 80, colour: "ramp", source: "payload" }` and its `SEGMENT_ABOUT` sentence in `src/segments.js`
- [ ] T007 [P] [US1] Add `NF_THERMOMETER = "\u{F050F}"` and `NF_SNOWFLAKE = "\u{F0717}"` with evidence comments, the glyph keys `cacheWarm` (plain `↻`) and `cacheCold` (plain `❄`) to `GLYPHS` in `src/render.js`, and both codepoints to `WANTED` in `scripts/extract-glyphs.py`
- [ ] T008 [US1] Add the `promptCache` builder to `line3Content` in `src/render.js`: warm chip `cache warm · <minutes>` in the warning colour inside the closing window, `cache cold` in the critical colour, nothing otherwise
- [ ] T009 [US1] Regenerate `src/preview/glyphs.json` with `python3 scripts/extract-glyphs.py`, confirming only F050F and F0717 are added

**Checkpoint**: Story 1 works alone.

## Phase 4: User Story 2, see that the cache went cold and what it costs (P1)

**Independent Test**: render a cold payload with 184,000 re-cache tokens.

- [ ] T010 [US2] Add failing tests to `scripts/tests/prompt-cache.test.js`: `cache cold · 184k` with 184,000; no token figure when `recache_tokens_if_cold` is null; the token count shed at a width where the chip survives
- [ ] T011 [US2] In `src/render.js`, add the token count to the cold chip using `abbreviate`, and add the `cacheTokens` trim option to `buildLine3` and the trim ladder per research R6

**Checkpoint**: Stories 1 and 2 pass.

## Phase 5: User Story 3, know why the cache was lost (P2)

**Independent Test**: render a cold payload with cause `tools_changed`.

- [ ] T012 [US3] Add failing tests to `scripts/tests/prompt-cache.test.js` for the cold rows with causes in `contracts/output.md`, the cause shed before the token count under width pressure, and no cause on a warm chip
- [ ] T013 [US3] In `src/render.js`, add the cause to the cold chip and the `cacheCause` trim option ahead of `cacheTokens` in the ladder

## Phase 6: User Story 4, the diagnostic reports the whole block (P3)

- [ ] T014 [US4] Add failing tests to `scripts/tests/prompt-cache.test.js` for the four `doctor` rows in `contracts/output.md` and for `doctor --explain` describing `promptCache`
- [ ] T015 [US4] In `src/doctor.js`, add the `promptCache` entry to `DESCRIBE` and the absence reasons: outside the closing window, caching not reported, and not in the payload

## Phase 7: Polish

- [ ] T016 Add `prompt_cache` (cold, with a cause) to `PAYLOAD` in `scripts/composer-fixture.js`, regenerate `scripts/tests/fixtures/composer-bar.txt` deliberately, and add `promptCache` to the `lean` and `oneLine` presets in `scripts/composer-presets.js` if their descriptions still hold
- [ ] T017 [P] Add a `prompt-cache-cold.svg` case to `scripts/preview-fixtures.js`, then run `npm run previews` and `npm run composer`
- [ ] T018 [P] Document the chip, the closing windows, the cause phrases and how to capture a payload with `CLAUDE_STATUSLINE_DEBUG=1` in `README.md`, and add both icons to its glyph table; apply the humanizer to the new prose (FR-011)
- [ ] T019 Run `npm test` and the commands in `specs/025-prompt-cache-chip/quickstart.md`, and record the results
- [ ] T020 Set `status: done` in `specs/025-prompt-cache-chip/spec.md`

## Dependencies

- T001 has no code dependency but must land before shipping.
- T002 to T004 block every story.
- US1 (T005 to T009) comes first; US2 and US3 extend the same builder in `src/render.js`, so they run in order after it. US4 depends only on Phase 2.
- Polish depends on the stories it documents.

## Parallel opportunities

- T006 and T007 touch different files.
- T014 and T015 (US4) can run alongside US2 and US3.
- T017 and T018.

## Implementation strategy

MVP is Phase 1 to Phase 3: the warm countdown answers "should I send it now". Phase 4 adds
the cost of having waited, Phase 5 the reason, Phase 6 the diagnostic. Each phase ends with a
green `npm test`.
