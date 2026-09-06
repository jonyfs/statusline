# Research: Statusline UX Redesign

## UX Pattern Research

### Modern CLI Tools Analyzed
- **starship**: Multi-line prompt with modules, clear separation
- **oh-my-posh**: Configurable segments with icons and colors
- **git-cliff**: Clean layout with key info prioritized
- **ripgrep**: Minimal output, focus on results

**Pattern**: Information organized by importance, one concept per visual block

### Nerd Font Icon Selection
- **Repository**: `📁` (nf-emoji-file_folder) for folder
- **Branch**: `⎇` (nf-fa-code_branch) or `◆` for current branch
- **Status**: `✓`, `✗`, `◐` for pass/fail/running
- **Activity**: `🔵` (filled) vs `○` (hollow) for working vs idle
- **Skills**: `🧩` (nf-emoji-puzzle) for skills/tools
- **Model**: `🤖` (nf-emoji-robot) for AI model
- **Effort**: `⚡` (nf-fa-bolt) for effort level
- **Context**: `📊` (nf-emoji-bar_chart) for metrics
- **Time**: `⏱` (nf-fa-stopwatch) for duration
- **Tokens**: `🔥` (nf-emoji-fire) for RTK savings

### Animation Strategy
- Subtle fill animation: `○` → `🔵` on activity start (200ms)
- No strobe effects, smooth transitions
- Blink only on critical alerts (rare)

## Design Decisions

**Decision 1**: Four-line layout (not 3, not 5)
- **Rationale**: Balances information density with readability
- **Alternative rejected**: 3 lines too cramped; 5 lines too tall

**Decision 2**: Agent names on line 2 (with skills)
- **Rationale**: Multi-agent display most critical in real-time visibility
- **Alternative rejected**: Putting agents on line 1 conflicts with repo info

**Decision 3**: Nerd Font icons (not emoji, not ASCII)
- **Rationale**: Nerd Font renders consistently, single-column width
- **Alternative rejected**: Emoji variable width causes alignment issues

**Decision 4**: Graceful truncation on narrow terminals
- **Rationale**: Drops low-priority segments rather than wrapping
- **Alternative rejected**: Wrapping creates visual clutter, breaks scanning

## Implementation Approach

### Phase 1: Layout Refactor
- Reorganize segments by line (1-4)
- Create line renderers with priority logic
- Implement segment dropping on width constraints

### Phase 2: Icon Unification
- Audit all glyph usage across lines
- Replace ASCII where possible with Nerd Font
- Ensure consistency across themes (Catppuccin)

### Phase 3: Animation
- Add subtle transitions for status changes
- Test performance on various emulators
- Fallback to static for low-spec terminals

### Phase 4: Polish
- Visual regression tests
- Accessibility review
- Documentation update
