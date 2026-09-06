# Tasks: PR Status Freshness & Cache Correctness

## Phase 1: Analysis (Blocking Prerequisites)

- [ ] T001 Read `src/cache.js` to understand current cache key structure and invalidation API
- [ ] T002 Read `src/render.js` `gather()` function to see how PR info is currently fetched and cached
- [ ] T003 Identify current cache key format for PR data (likely uses cwd only, not branch)
- [ ] T004 Identify where branch context is available in render cycle

## Phase 2: Fix & Implementation

- [ ] T005 Modify `src/cache.js` to accept branch name as part of cache key (update key generation function)
- [ ] T006 In `src/render.js` `gather()`, detect current branch name and pass to cache lookups
- [ ] T007 Detect branch changes between render cycles (compare previous branch vs current)
- [ ] T008 Add cache invalidation logic: clear PR cache on branch change
- [ ] T009 Test: single branch → verify PR status stable over multiple renders
- [ ] T010 Test: branch A (with PR #100) → branch B (with PR #200) → verify immediate switch to PR #200

## Phase 3: Edge Cases & Validation

- [ ] T011 Test: detached HEAD → verify no cached PR from last branch shown
- [ ] T012 Test: rapid switches A→B→A → verify correct PR at each step
- [ ] T013 Test: PR merged remotely → verify statusline updates to "merged" within render cycle
- [ ] T014 Extend `tests/smoke-test.js` with branch-switching scenario
- [ ] T015 Create `tests/test-pr-cache.js` with cache correctness tests

## Phase 4: Polish

- [ ] T016 Code review: verify cache key includes branch (no unintended cross-branch hits)
- [ ] T017 Verify cache invalidation doesn't cause performance regression (hit rate still >80%)
- [ ] T018 Update comments in cache.js and render.js documenting branch context
- [ ] T019 Commit and prepare for release

---

## Implementation Strategy

### MVP (Minimal Fix)
1. Add branch to cache key (T005, T006)
2. Invalidate on branch change (T007, T008)
3. Verify tests pass (T009, T010)
4. **Total time**: ~2–3 hours

### Full Coverage
1. All MVP steps
2. Edge cases: detached HEAD, rapid switches (T011, T012, T013)
3. Comprehensive tests (T014, T015)
4. **Total time**: ~4–5 hours

Recommend: MVP first, then edge cases.
