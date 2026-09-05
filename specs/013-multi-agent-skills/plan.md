# Implementation Plan: Multi-Agent Skills Visibility

**Branch**: `013-multi-agent-skills` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-multi-agent-skills/spec.md`

## Summary

Extend the statusline skills line to display skills invoked by all currently running agents, not just the top-level session. Skills are grouped by agent identifier (e.g., "A: skill1, skill2; B: skill3"), aggregated into a deduplicated set on the line, and cleared as agents finish. Integration uses the existing subagent task snapshot as the source of agent skill data, with skill sources derived from formal `/skill` invocations or agent task descriptions (whichever is available).

## Technical Context

**Language/Version**: Node.js (ES modules, v18+)

**Primary Dependencies**: Existing codebase uses `fs`, `path`, `os` (built-in); no runtime dependencies per Constitution Principle IV

**Storage**: File-based state via `.claude/statusline/tasks/latest.json` (task snapshot written by subagent-row mechanism); no new storage needed

**Testing**: Node.js test runner; smoke-test.js covers cross-platform compatibility (Linux, macOS, Windows)

**Target Platform**: CLI plugin for Claude Code (cross-platform: Linux, macOS, Windows) per Constitution Principle IX

**Project Type**: CLI tool / plugin (stateless command-line utility)

**Performance Goals**: Render must complete in <100ms total (statusline is invoked ~every 5–6 seconds); skill aggregation overhead <5ms

**Constraints**: 
- Visual: Line 2 of four-line statusline, max width per terminal `COLUMNS` (default 120), overflow via "+N" indicator
- Data: 5–10 concurrent agents typical; graceful degradation beyond 10
- Architectural: Zero new runtime dependencies; stdin payload extension for subagent data (no new IPC)

**Scale/Scope**: Single CLI command (`statusline`), processes stdin payload once per render, outputs ANSI formatted string once

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Starship-Compatible Output | Skills use existing Nerd Font glyphs from glyph table; no new glyphs or emoji for skill names | ✓ Pass |
| II. Four-Line Display Structure | Skills remain on line 2 with existing overflow handling; grouping format does not increase base width | ✓ Pass (formatting only) |
| III. Token Tracking Grounded in Real Data | Feature does not introduce token/usage tracking; operates on existing skill data | ✓ Pass (N/A) |
| IV. Installable by Clone, With Install/Uninstall Commands | Zero new dependencies; no package manager needed | ✓ Pass |
| V. Integration Documentation & Configuration Guide | Plan includes quickstart; README updates deferred to release checklist | ✓ Pass (planned) |
| VI. English-Only Codebase | Code, comments, output all English | ✓ Pass (planned) |
| VII. MVP-First, Local-Then-GitHub | Scope: multi-agent skill display only; consistent with v1.1 scope | ✓ Pass |
| VIII. Documentation Shows Generated, Not Hand-Drawn, Output | Feature generates preview output same way existing previews do | ✓ Pass (planned) |
| IX. Runs on Linux, macOS and Windows | Implementation uses only cross-platform APIs (`path`, `fs`, `os`); no platform-specific shelling | ✓ Pass (planned) |
| X. Icons Carry Live State | Skills are discrete state (active/gone); no animation; consistent with existing skill display | ✓ Pass |
| XI. Releases Are Tag-Driven and Verified | Feature is part of normal release cycle; no special gates | ✓ Pass (planned) |

**Gate Result**: PASS — No Constitution violations. Feature is scoped and designed within all 11 principles.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── render.js                # Main entry point (already exists; will extend stdin handling)
├── skills.js                # Skill tracking (spec 011; will extend to aggregate agent skills)
├── skillEvents.js           # Skill event parsing (already exists; no changes needed)
├── segments.js              # Segment definitions (already exists; "skills" segment unchanged)
├── arrangement.js           # Line layout logic (already exists; will extend grouping)
├── cache.js                 # State cache (already exists; will cache agent identifiers)
└── [new] skillAggregation.js # New module: aggregation logic, deduplication, grouping

tests/
├── smoke-test.js            # Cross-platform smoke test (already exists; will extend)
├── [new] test-skill-aggregation.js # New: unit tests for grouping, deduplication
└── [new] test-agent-integration.js # New: integration tests with mock task snapshot
```

**Structure Decision**: Single project (existing `src/` directory extended with one new module). Aligns with existing architecture: render command invokes skills module, which now aggregates both direct-invoke and agent-based skills before feeding to segments/arrangement modules.

## Complexity Tracking

No Constitution violations requiring justification. Feature scope is well-contained within Principle II (line layout) and Principle III (no new data sources, reuses existing task snapshot).

---

## Phase 0: Research & Technical Design

### Unknowns Resolved

1. **Subagent State Availability** ✓
   - Clarified: Use existing task snapshot (`.claude/statusline/tasks/latest.json`) written by spec 011 mechanism
   - Source: `src/skills.js` already reads this file; no new channel needed
   - Payload extension: Claude Code harness to include agent metadata in stdin JSON (implementation detail for harness, not this feature)

2. **Skill Source Priority** ✓
   - Clarified: Formal `/skill` invocations first, then agent task description/label
   - Implementation: `src/skillEvents.js` tracks formal skills; task snapshot provides agent labels as fallback

3. **Agent Grouping Format** ✓
   - Clarified: "AgentID: skill1, skill2; AgentID2: skill3" format
   - Implementation: New `skillAggregation.js` module handles grouping; existing `arrangement.js` formats for line width

4. **Deduplication Strategy** ✓
   - Clarified: Same skill by multiple agents shown once; "+N" count reflects distinct skills, not total invocations
   - Implementation: Aggregation module maintains Set of unique skills, then reconstructs grouped display

### Best Practices Applied

- **State Management**: Immutable updates (no mutation of skill cache); snapshot freshness check (30s threshold from spec 011)
- **Error Handling**: Missing/stale task snapshot returns empty agent list (graceful degradation); invalid JSON logged, render continues
- **Performance**: Single pass through agent list; Set operations for deduplication (O(n log n) worst case, acceptable for ≤10 agents)
- **Testing**: Cross-platform path handling verified in smoke-test; mocked task snapshots for unit tests

---

## Phase 1: Design & Contracts

### 1. Data Model (data-model.md) — Planned

**Entities**:

- **Skill**: Named activity invoked by top-level session or agent
- **Agent**: Running subagent with active work
- **AggregatedSkillSet**: Union of all active skills from top-level and all agents

### 2. Contracts (contracts/) — Planned

**File**: `stdin-payload-extension.md`

Documents extension to existing Claude Code statusline stdin JSON payload with new `activeAgents` field.

### 3. Quickstart Validation Guide (quickstart.md) — Planned

Validation scenarios and test commands for single agent, multiple agents, shared skills, and no agents.

### 4. Agent Context Update

Update `.claude/CLAUDE.md` to point to this plan as the current reference for implementation.

---

## Implementation Phases (Preview)

*Detailed breakdown in tasks.md (Phase 2 output)*

1. **Data Aggregation** — Extend skills.js and create skillAggregation.js module
2. **Display & Formatting** — Modify arrangement.js for agent-grouped skill display
3. **Testing & Verification** — Extend smoke-test.js and add unit/integration tests
4. **Documentation & Polish** — Update README, prepare for release

---

## Status

✓ Spec clarified (4 Q/A resolved)
✓ Plan framework complete
⏭ Ready for Phase 1 design artifact generation
