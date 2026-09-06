# Implementation Plan: Statusline UX Redesign

**Branch**: `016-statusline-ux-redesign` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Complete statusline redesign with improved visual hierarchy, agent display, and modern UX

## Summary

Redesign statusline from current dense format to 4-line structured layout. Each line handles specific information: repo context (L1), agent/skills/activity (L2), harness context (L3), token usage (L4). Improves readability, supports multi-agent scenarios, uses consistent Nerd Font icons.

## Technical Context

**Language/Version**: JavaScript (Node.js 18+), same as existing statusline

**Primary Dependencies**: Existing: render.js, skills.js, segments.js | New: animation framework (optional), icon sets

**Storage**: N/A - CLI tool, no persistent storage

**Testing**: Existing smoke-test.js suite, visual regression tests for layout

**Target Platform**: Terminal (80-200 column width), any OS supporting Nerd Font

**Project Type**: CLI tool / terminal plugin

**Performance Goals**: Render in <100ms, animation smooth (no flicker)

**Constraints**: Must work on narrow terminals (80 cols), backward compat with spec 015

**Scale/Scope**: 4 lines, ~15-20 segments total, handles 1-10 parallel agents

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
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
