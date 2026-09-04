# Feature Specification: Statusline English-Only Output

**Feature Branch**: `005-statusline-english-only`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "tudo que o statusline mostrar deve estar em ingles, revise isso" (everything the statusline displays must be in English — review this)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent English labels across all segments (Priority: P1)

A user runs the statusline in a terminal configured with any system locale. Every label, unit, status word, and message the statusline itself writes (segment names, freshness states, git status words, error/fallback text, help output) appears in English, regardless of the user's OS language or shell locale.

**Why this priority**: Mixed-language output reads as unfinished or broken. It's the direct complaint driving this request, and the whole point of the feature.

**Independent Test**: Run the statusline (and its `--doctor`/help/error paths) with `LANG`/`LC_ALL` set to a non-English locale and confirm no statusline-authored string changes language or contains non-English words.

**Acceptance Scenarios**:

1. **Given** the statusline renders normally, **When** a user reads any segment (git, tasks, freshness, tokens, skills, time), **Then** every word the tool itself generated (not raw data passed through) is English.
2. **Given** an error or fallback condition occurs (e.g., missing config, stale cache, offline), **When** the statusline prints a fallback/error message, **Then** that message is in English.
3. **Given** the user runs `--doctor`, `--help`, or any CLI diagnostic output, **When** the output is printed, **Then** it is entirely in English.

---

### User Story 2 - Pass-through data is left untranslated (Priority: P2)

A user has a git branch name, commit message, or task/file name written in a non-English language. The statusline displays that value verbatim as data, not as tool-authored text.

**Why this priority**: Prevents scope creep. The feature must not try to translate or mangle user content, only fix wording the tool itself controls.

**Independent Test**: Point the statusline at a repo with a non-English branch name or commit message and confirm it is shown unchanged, while every surrounding label (e.g. "branch", "ahead", "behind") stays English.

**Acceptance Scenarios**:

1. **Given** a git branch is named in a non-English language, **When** the statusline shows it, **Then** the branch name is untouched and only the surrounding labels are checked for English.
2. **Given** a task title or file path contains non-English text, **When** the statusline renders it, **Then** the content is passed through unchanged.

---

### User Story 3 - Regression guard for future strings (Priority: P3)

A contributor adds a new segment or message to the statusline in the future. Before merge, there is a repeatable way to catch any non-English, tool-authored string that slips in.

**Why this priority**: One-time review fixes today's problem; without a repeatable check the same drift reappears next time someone edits a segment.

**Independent Test**: Introduce a deliberately non-English literal string into a segment file, run the check, and confirm it flags the new string.

**Acceptance Scenarios**:

1. **Given** a new tool-authored string is added to any segment/render/CLI file, **When** the review check runs, **Then** it flags strings outside the allowed English word list for manual confirmation.
2. **Given** the check runs against the current codebase before any fix, **When** it completes, **Then** it reports which files (if any) contain non-English tool-authored strings.

### Edge Cases

- What happens when a data value (branch name, commit message, task text) happens to contain English words that look like statusline labels? It must still be treated as pass-through data, not rewritten.
- How does the check distinguish a comment/log string that never reaches the rendered statusline from a string that is actually displayed? Only rendered/output-facing strings are in scope; internal-only comments and dev logs are out of scope.
- What happens to third-party or plugin-provided segment text (if the statusline supports extensions)? Out of scope for this feature and flagged as a known limitation, not fixed here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The statusline MUST render all tool-authored labels, unit names, and status words (segment names, freshness/staleness words, git status words, time-of-day words, skill/task status words) in English.
- **FR-002**: The statusline MUST render all error messages, fallback messages, and warnings it generates itself in English.
- **FR-003**: The statusline CLI (help text, `--doctor` output, install/setup prompts) MUST be in English.
- **FR-004**: The statusline MUST continue to pass through user-owned data (branch names, commit messages, file paths, task titles, skill names) unchanged, without attempting translation.
- **FR-005**: The review MUST produce a list of every non-English, tool-authored string found in the current codebase, with file and line reference, so each can be fixed.
- **FR-006**: Every non-English, tool-authored string identified MUST be replaced with an English equivalent that preserves the original meaning and rendered width/formatting constraints (segment widths, truncation).
- **FR-007**: The project MUST gain a repeatable, low-effort way (script or test) to re-check tool-authored strings for non-English content, so future additions can be caught before merge.

### Key Entities

- **Tool-authored string**: Any label, unit, status word, error message, or CLI text that the statusline source code itself defines as a literal, as opposed to data read from git, tasks, files, or other external sources.
- **Pass-through data**: Text sourced from the user's environment (branch names, commit messages, file/task names) that the statusline displays as-is and must not alter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tool-authored strings found during the review render in English after the fix.
- **SC-002**: Zero regressions in existing segment widths/alignment caused by wording changes (verified against existing golden/snapshot tests).
- **SC-003**: A contributor can run the new check in under 10 seconds and get a pass/fail result on tool-authored string language.
- **SC-004**: Pass-through data (branch names, commit messages, task titles) remains byte-for-byte unchanged after the fix, confirmed by existing tests covering those paths.

## Assumptions

- "Statusline shows" means anything written to the terminal by this tool: rendered segments, CLI help/doctor output, and error/fallback messages. It does not include internal logs, comments, or documentation files.
- The current codebase's English-only gap, if any, is limited to isolated literal strings rather than a systemic bilingual design; no architectural change is assumed necessary.
- User-supplied data (git metadata, task/file names) is explicitly out of scope for translation and is expected to remain in whatever language it already is.
- A lightweight static check (e.g., a grep-based or word-list script) is sufficient for the regression guard; no full i18n/l10n framework is being introduced.
