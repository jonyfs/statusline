# Feature Specification: Statusline UX Redesign

**Feature ID**: `016-statusline-ux-redesign`

**Status**: Draft

**Date Created**: 2026-09-06

## Problem

Current statusline displays information densely without clear visual hierarchy. Users struggle to quickly parse repository context, agent activity, and system status. Layout doesn't adapt well to multi-agent scenarios. Icons and visual design could follow modern UX patterns for better readability.

## Vision

Redesign statusline with:
- **Clear hierarchy**: Line-by-line information organization
- **Visual clarity**: Modern Nerd Font icons, consistent spacing
- **Multi-agent support**: Prominent agent/skill display
- **Better UX**: Animation hints for status changes, icon consistency
- **Scalability**: Graceful degradation on narrow terminals

## Layout Specification

### Line 1: Repository & Branch Context
Shows: folder, remote URL, branch, divergence, modified/added files, unmerged conflicts, PR status, CI status

**Format**:
```
📁 folder-name  ↙ remote/origin  ⎇ main  ⇅ +5-3  ◆ 2M 1A  ⚠ unmerged  PR #52 ✓ passed
```

**Elements**:
- `📁`: Repository folder (Nerd Font)
- `↙`: Remote origin link
- `⎇`: Branch name, or `●` for detached HEAD
- `⇅`: Divergence from upstream (+ahead -behind)
- `◆`: Modified (M) and Added (A) file counts
- `⚠`: Unmerged paths indicator
- `PR #52`: Pull request number and state
- Status: `✓ passed`, `✗ failed`, `◐ running`, `?` unknown

### Line 2: Skills & Work Status
Shows: activity status, shell count, agent count, agent names with skills

**Format - No agents**:
```
○ idle · 2 shells          🧩 spell-check, format
```

**Format - With agents**:
```
🔵 working · ← 2 agents    🧩 Agente-review: code-review, test; Agente-build: build
```

**Elements**:
- `🔵`: Working (filled circle), `○`: Idle (hollow)
- `← N agents`: Agent count indicator
- `🧩`: Skills icon
- `Agente-name: skill1, skill2`: Agent grouping
- `;` separates agents
- `,` separates skills within agent

### Line 3: Harness & Execution Context
Shows: model, effort level, feature in progress (Spec Kit), task count (if any)

**Format**:
```
🤖 Opus 5 (1H context)  ⚡ high  🎯 spec-015  📋 3 tasks [2/3 ✓]
```

**Elements**:
- `🤖`: Model name
- `(1H context)`: Context usage
- `⚡`: Effort level (low/medium/high/max) with icon
- `🎯`: Feature ID from Spec Kit
- `📋`: Task count and progress

### Line 4: Context & Token Usage
Shows: session duration, session token usage, RTK savings, rate limits

**Format**:
```
⏱ 1h52m / 1d limit  🔥 74% saved (rtk)  📊 Context: 62% · Rate: Sh 40% · 5h limit
```

**Elements**:
- `⏱`: Session duration / total time limit
- `🔥`: RTK token savings percentage
- `📊`: Context usage % · Rate limit usage % · Reset time

## Visual Design Principles

1. **Icons**: Nerd Font glyphs for all indicators
2. **Color**: Catppuccin palette (existing)
3. **Animation**: Subtle status transitions (working ← → idle)
4. **Spacing**: Consistent padding, proper alignment
5. **Overflow**: Graceful line wrapping on narrow terminals

## User Scenarios

### Scenario 1: Single Developer, No Agents
- Line 1: Shows repo, branch, clean working tree
- Line 2: Shows skill being used, idle status
- Line 3: Shows model/effort
- Line 4: Shows context and token usage

### Scenario 2: Multi-Agent Orchestration
- Line 1: Shows repo context (unchanged)
- Line 2: Shows all agents running with their skills
- Line 3: Shows task progress (if Spec Kit active)
- Line 4: Shows combined context usage

### Scenario 3: Active PR & Unmerged Paths
- Line 1: Highlights PR status, unmerged conflicts
- Line 2: Shows agent activity (if any)
- Lines 3-4: Show execution context

## Functional Requirements

**FR-001**: Line 1 displays all repository context without truncation (folder, remote, branch, status)

**FR-002**: Line 2 shows agent names and their skills clearly, organized by semicolon separation

**FR-003**: Line 3 displays model, effort, and feature context with proper icons

**FR-004**: Line 4 shows context usage and token savings with accurate percentages

**FR-005**: All Nerd Font icons are consistent across all lines

**FR-006**: Icons animate subtly on status changes (working ↔ idle transition)

**FR-007**: Layout adapts gracefully when terminal width < 120 columns

**FR-008**: Display is readable and scannable (< 1 second to understand status)

## Success Criteria

- All 4 lines render without wrapping text (unless terminal < 80 columns)
- Users can identify repo, agents, and status at a glance
- Agent/skill information prominent in line 2
- Icons are consistent with Nerd Font standards
- Animation smooth (no flicker) on status transitions
- Works with terminals from 80-200 columns width

## Design Research Needed

- Review modern CLI tools (starship, oh-my-posh, etc.) for UX patterns
- Survey Nerd Font icon options for each element
- Test animation performance on various terminal emulators
- Verify readability with different color schemes (Catppuccin flavors)

## Assumptions

- Terminal supports Nerd Font (FiraCode Nerd Font)
- Minimum terminal width 80 columns
- User familiar with git/GitHub terminology
- Color support available (or ASCII fallback mode)

## Dependencies

- Spec 015 (multi-agent skills display) - baseline
- Existing Nerd Font glyph set
- Catppuccin color palette
