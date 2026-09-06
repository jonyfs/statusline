# Tasks: Statusline UX Redesign (v1.3.0)

## Phase 1: Layout Refactor & Segment Organization

- [ ] T001 Create `src/lines.js` - Line renderer abstraction (Line1, Line2, Line3, Line4 classes)
- [ ] T002 [P] Extract Line 1 segments: folder, remote, branch, divergence, status, PR, CI
- [ ] T003 [P] Extract Line 2 segments: activity, shell count, agent display, skills
- [ ] T004 [P] Extract Line 3 segments: model, effort, feature ID, task progress
- [ ] T005 [P] Extract Line 4 segments: duration, RTK, context %, rate limit
- [ ] T006 Create line width priority logic - graceful truncation on narrow terminals
- [ ] T007 Implement 4-line render pipeline in `src/render.js`
- [ ] T008 Test layout at 80, 120, 200 column widths
- [ ] T009 Run full test suite (smoke-test.js)

## Phase 2: Icon Unification & Visual Polish

- [ ] T010 Audit all Nerd Font glyphs in GLYPHS constant (render.js)
- [ ] T011 [P] Replace ASCII indicators with Nerd Font where missing
- [ ] T012 [P] Verify glyph consistency across all lines (no duplicate meanings)
- [ ] T013 Test glyph rendering on FiraCode Nerd Font
- [ ] T014 Create fallback ASCII mode for non-Nerd-Font terminals
- [ ] T015 Verify Catppuccin color palette applies correctly to new layout

## Phase 3: Animation & Status Transitions

- [ ] T016 Add subtle animation on working ↔ idle transition (200ms)
- [ ] T017 Implement animation in `src/animation.js` (if needed)
- [ ] T018 Test animation smoothness on various terminal emulators
- [ ] T019 Add performance guard: skip animation if render budget tight

## Phase 4: Multi-Agent Display (spec 015 integration)

- [ ] T020 Verify spec 015 skills aggregation works with new Line 2 layout
- [ ] T021 Test agent display with 1, 2, 5 concurrent agents
- [ ] T022 Test agent cleanup when agents finish (tasks/latest.json)
- [ ] T023 Test overflow handling (+N more) with agent names

## Phase 5: Testing & Validation

- [ ] T024 Create visual regression tests for all 4 lines
- [ ] T025 Create test fixtures for different scenarios (single dev, multi-agent, PR active)
- [ ] T026 Test narrow terminal degradation (drop segments in order)
- [ ] T027 Run full smoke-test suite (440+ tests)
- [ ] T028 Test with different Catppuccin flavors (mocha, macchiato, frappe, latte)

## Phase 6: Documentation & Release

- [ ] T029 Update README with new layout description
- [ ] T030 Update CHANGELOG with v1.3.0 changes
- [ ] T031 Bump version in package.json to 1.3.0
- [ ] T032 Create git tag v1.3.0
- [ ] T033 Push to GitHub and install in Claude Code

---

## Implementation Strategy

### MVP (Phase 1-2)
- Refactor render pipeline into 4 lines
- Unify icons with Nerd Font
- ~2-3 hours

### Full Release (Phase 1-6)
- Add animation polish
- Complete testing suite
- Documentation update
- ~5-6 hours total

---

## Task Notes

**Parallel tasks**: T002-T005 can run concurrently (different line segments)
**Blocking**: T006 requires T001-T005 complete
**Testing**: T008 runs after T007, gates Phase 2
**Agent integration**: T020-T023 depend on spec 015 already deployed (✓ v1.2.8)

## Execution Order

1. T001 (setup)
2. T002-T005 (parallel)
3. T006, T007 (sequential on phase 1 results)
4. T008, T009 (test phase 1)
5. T010-T015 (phase 2, parallel where noted)
6. T016-T019 (phase 3)
7. T020-T023 (phase 4)
8. T024-T028 (phase 5)
9. T029-T033 (phase 6)
