# Implementation Plan: PR Status Freshness & Cache Correctness

**Branch**: `014-pr-status-freshness` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

## Summary

Fix PR status cache to be branch-aware: cache entries keyed by branch context (branch name or commit SHA) so switching branches clears stale cached PR data. Invalidate cache on git operations. Ensures statusline PR segment always reflects current branch's actual PR state.

## Technical Context

**Language/Version**: Node.js (ES modules, v18+)

**Primary Dependencies**: Existing `gh pr view` command (git/GitHub CLI); `src/render.js` already calls `probe.getPrInfo()`

**Storage**: In-memory cache (via `src/cache.js`); keyed by branch name

**Testing**: Node.js test runner; smoke-test.js

**Target Platform**: CLI plugin for Claude Code (cross-platform)

**Project Type**: CLI tool / plugin

**Performance Goals**: Cache hit rate >80% within same branch; zero stale hits across branches

**Constraints**: 
- Cache must be invalidated on branch switch (not persist across contexts)
- Cache key must include branch identifier
- Must work with detached HEAD (show "no PR", not cached value)

**Scale/Scope**: Single cache invalidation fix; localized to cache.js and render.js

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| Principle | Check | Status |
|-----------|-------|--------|
| I–XI | Bug fix, no architecture change | ✓ PASS |

**Gate Result**: PASS — Bug fix within existing architecture.

## Project Structure

```text
src/
├── render.js                # Get branch context for cache key validation
├── cache.js                 # PR cache: key by branch, invalidate on branch switch
└── git.js                   # Branch detection (already exists)

tests/
├── smoke-test.js            # Cross-platform validation
└── test-pr-cache.js         # New: cache correctness tests
```

## Phase 0: Research & Root Cause Analysis

**Issue**: PR status persists across branch switches because cache not branch-aware

**Root Cause**: Cache key likely uses `cwd` only, not branch name. Switching branches doesn't invalidate cache.

**Fix**: 
1. Add branch name to cache key (e.g., `"pr:{branch}:{cwd}"`)
2. Detect branch changes in render.js
3. Invalidate cache when branch changes (call `cache.invalidate("pr:*")` or similar)

## Phase 1: Design & Implementation

**Tasks**:
1. Read `src/cache.js` to understand cache structure
2. Update cache key generation: add branch name parameter
3. In `render.js`, detect branch context and pass to cache lookups
4. On branch change, invalidate PR cache entries
5. Test: verify no stale PR across branch switches
6. Test: verify cache still works within same branch

## Status

✓ Spec complete  
⏭ Ready for implementation  

---

## Implementation Phases (Preview)

1. **Cache Keying** — Add branch to cache key generation
2. **Branch Detection** — Detect branch changes in render cycle
3. **Cache Invalidation** — Clear PR cache on branch switch
4. **Testing** — Verify correctness across branch switches
5. **Polish** — Edge cases (detached HEAD, rapid switches)
