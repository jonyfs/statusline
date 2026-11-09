import { fileURLToPath } from "node:url";
import path from "node:path";
import { canWrite, stateRoot } from "./paths.js";
import os from "node:os";
import { realpathSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { PALETTES, renderRow, displayWidth, separatorStyle, colourEnabled, bgSeq, STRONG, QUIET, MARK_OFF, GOOD, WARM, BEHIND } from "./theme.js";
import {
  getDirLabel,
  getDirUrl,
  getGitInfo,
  isRepository,
  getPrInfo,
  getPrLookupFailed,
  getRemoteUrl,
  getCiStatus,
  normalizePr,
  repoUrlFromPayload, getAlerts, getBranchMeta } from "./git.js";
import {
  getActiveSkills,
  getActiveSkillsTrueCount,
  getSessionActivity,
  sddStepFor,
  inProgressFeatureId,
  subagentActivity,
} from "./skills.js";
import {
  getContextPercent,
  getRateLimits,
  formatResetCountdown,
  shortCountdown,
  getContextTokens,
  getSessionCost,
  formatDuration,
  abbreviate,
  MAX_PLAUSIBLE_SPEND_PERIOD_MS,
  budgetPace,
  monthPeriodMinutes,
  getPromptCache,
  cacheMinutesLeft,
} from "./tokens.js";
import { getRtkSavings } from "./rtk.js";
import { maybeStartUpdateCheck, getUpdateNotice } from "./updateCheck.js";
import { detectHarness } from "./harness.js";
import { accountKindOf, apiResponded, getAccountKind, noteAccountKind } from "./accountKind.js";
import { readUsageCredits, readAccountIdentity, cacheAgeMark, monthResetAt } from "./usageCredits.js";
import { creditsTrend } from "./creditsHistory.js";
import { getSessionTotals, modelFamily } from "./sessionTotals.js";
import { countMcpServers } from "./mcp.js";
import { readSkillEventsTrueCount } from "./skillEvents.js";

/**
 * Where a credit figure can be looked at in full (specs/070, FR-009). A
 * terminal cannot open Claude Code's own `/usage` screen from a link, so the
 * chip opens the account's usage page on the web instead: the reader's own
 * account, never another project's repository (specs/020). The gateway's
 * spend limit has no page the payload names, so that chip stays unlinked.
 */
/**
 * The help page that ships with the statusline (specs/078-help-page): one
 * file in the clone, beside `src`, opened from disk. A copy without it (a
 * render-only copy for a host) simply draws no help chip.
 */
export const HELP_PAGE = fileURLToPath(new URL("../help/index.html", import.meta.url));

/** A probe that throws costs its own figure and nothing else. */
function safeProbe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export const USAGE_PAGES = Object.freeze({
  claude: "https://claude.ai/settings/usage",
  codex: "https://chatgpt.com/codex/settings/usage",
  copilot: "https://github.com/settings/billing",
});
import { copilotSessionActivity, AGENT_ROW_CAP } from "./copilotEvents.js";
import { readGateRuns, GATE_ROW_CAP } from "./gateRuns.js";
import { gateRows, gateChip } from "./gateRows.js";

/**
 * Under Copilot CLI, the transcript probes read its session's `events.jsonl`
 * instead of a Claude transcript, and return the same shapes, so nothing
 * downstream changes (specs/029-multi-harness). Its reader also returns the
 * running subagents, which the bar prints as rows after its lines
 * (specs/030-copilot-agent-rows); `subagentActivity`, the Claude Code roster,
 * has nothing to say here.
 */
/** The rollout's windows that have no chip of their own, as the payload carries them. */
function codexWindowsOf(payload) {
  const list = payload?.rate_limits?.other_windows;
  if (!Array.isArray(list)) return null;
  const ok = list.filter(
    (w) =>
      w &&
      typeof w.label === "string" &&
      Number.isInteger(w.window_minutes) &&
      w.window_minutes > 0 &&
      typeof w.used_percentage === "number" &&
      Number.isFinite(w.used_percentage)
  );
  return ok.length ? ok : null;
}

/** The rollout's credit balance, as text, or null. */
function codexCreditsOf(payload) {
  const balance = payload?.rate_limits?.credits?.balance;
  return typeof balance === "string" && balance.length ? { balance } : null;
}

export function harnessProbes(probe, harness, payload = null) {
  // OpenCode keeps no transcript either. Its plugin puts the working state and
  // the todo list in the payload it builds (specs/038-opencode).
  if (harness === "opencode") {
    return {
      ...probe,
      getSessionActivity: () => payload?.opencode?.activity ?? null,
      getActiveSkills: (_path, _limit, { scanned } = {}) => scanned ?? [],
      getActiveSkillsTrueCount: (_path, { scannedTrueCount } = {}) => scannedTrueCount ?? 0,
      subagentActivity: () => [],
    };
  }
  // Codex writes no Claude transcript and no skill events, and its subagents
  // are not Claude Code's (specs/035-codex-pane). The working state comes from
  // the rollout, which the pane passes in as its own getSessionActivity.
  if (harness === "codex") {
    return {
      ...probe,
      getActiveSkills: (_path, _limit, { scanned } = {}) => scanned ?? [],
      getActiveSkillsTrueCount: (_path, { scannedTrueCount } = {}) => scannedTrueCount ?? 0,
      subagentActivity: () => [],
    };
  }
  if (harness !== "copilot") return probe;
  return {
    ...probe,
    // A Copilot payload always names its session directory. One that does not
    // has no log to read, so the probe it came with answers instead; that is
    // what lets a fixture with Copilot's fields keep its own session.
    getSessionActivity: (sessionDir, opts) =>
      sessionDir ? copilotSessionActivity(sessionDir, opts) : probe.getSessionActivity(sessionDir, opts),
    getActiveSkills: (_path, _limit, { scanned } = {}) => scanned ?? [],
    getActiveSkillsTrueCount: (_path, { scannedTrueCount } = {}) => scannedTrueCount ?? 0,
    subagentActivity: () => [],
  };
}
import { elapsed, harnessAgentRows } from "./taskRows.js";
import { getOpenTabUrl, pathToFileUrl } from "./openTerminalTab.js";
import { HELP_URL } from "./helpLink.js";
import { resetMomentLabel } from "./timeIcons.js";
import { trackChanges, loadSamples } from "./changeTracker.js";
import { reading, missing, isRenderable } from "./freshness.js";
import { byLine, segment, inChannel, SEGMENTS } from "./segments.js";
import { resolveArrangement } from "./arrangement.js";
import { resolveLayout, iconTier, repoConfig, omittedKeys } from "./config.js";
import { abbreviateBranch, cutMiddle, DEFAULT_BRANCH_PREFIXES, BRANCH_COLUMNS } from "./names.js";
import { gaugeChip, bandFor, track, paceBand, contextBand } from "./ramp.js";
import { ROLE } from "./colourRoles.js";
import { plainText } from "./text.js";
import { ratePerHour, projectFull, pushSample, sparkline } from "./samples.js";
import { fitToWidth, alignColumns, linesToRender, rowWidth, terminalWidth, terminalHeight, terminalFor, readTtySize } from "./layout.js";
import { loadCopilotSettings } from "./copilotSettings.js";
import { getCopilotQuota, formatQuotaDate } from "./copilotQuota.js";

// Nerd Font glyphs, written as escapes rather than literal private-use
// characters: pasted literals silently vanished from this file once
// already, leaving empty strings that rendered as a bare gap. Every
// codepoint here was checked against the installed FiraCode Nerd Font's
// cmap table and then rendered from that font and looked at, because a
// codepoint's name is not evidence of its glyph (Principle X). The proof
// sheet is docs/glyph-evidence.png.
//
// Octicons wherever the segment shows git or GitHub state, so the line
// reads in the vocabulary its audience already knows; Material Design and
// Devicon elsewhere.
const NF_BRANCH = "\u{F418}";    // nf-oct-git_branch (GitHub's branch icon)
const NF_PR = "\u{F407}";        // nf-oct-git_pull_request

// A blank calendar grid, deliberately NOT the 📆 emoji: every emoji font
// draws a fixed date on that glyph (Apple renders "17"), so beside a real
// expiry day it reads as a date that never changes and contradicts the
// text next to it. Unicode has no per-date emoji, so the day is text.
const NF_CALENDAR = "\u{F0A33}";  // a calendar with a week bar: the 7-day window (specs/047)

// GitHub's own diff and sync markers, so the working-tree state reads in
// the vocabulary anyone who uses GitHub already knows. Each glyph was
// rendered and inspected before being adopted: codepoint names in Nerd
// Font tables proved unreliable (F433 "repo_push" draws a down arrow,
// F45D "arrow_up" draws a signpost), so the name is not evidence.
const NF_MODIFIED = "\u{F459}";  // boxed dot, GitHub's "modified" marker
const NF_ADDED = "\u{F457}";     // boxed plus, GitHub's "added" marker
const NF_PUSH = "\u{F431}";      // nf-oct-arrow_up: commits waiting to be pushed (v8.1.0)
const NF_PULL = "\u{F433}";      // nf-oct-arrow_down: commits waiting to be pulled

// A commit, for a detached HEAD. The branch icon would claim the line is
// showing a branch when it is showing a commit id.
const NF_COMMIT = "\u{F417}";    // nf-oct-git_commit

// The rest of line 1's git and GitHub state, in the same Octicon set.
const NF_DIR = "\u{F4D4}";       // nf-oct-file_directory_open_fill: the working directory
const NF_HOME = "\u{F02DC}";     // nf-md-home: the working directory when it is $HOME
const NF_REPO = "\u{F401}";      // nf-oct-repo: the repository
const NF_WORKTREE = "\u{E5FB}";  // nf-custom-folder_git_branch: a linked worktree
const NF_REMOVED = "\u{F458}";   // nf-oct-diff_removed: boxed minus
const NF_RESET = "\u{F04E6}";    // two circular arrows: the window comes back
const NF_PR_DRAFT = "\u{F4DD}";  // nf-oct-git_pull_request_draft
const NF_PR_MERGED = "\u{F419}"; // nf-oct-git_merge
const NF_PR_CLOSED = "\u{F4DC}"; // nf-oct-git_pull_request_closed
const NF_REVIEW_APPROVED = "\u{F4A4}"; // nf-oct-check_circle_fill
const NF_REVIEW_COMMENTS = "\u{F442}"; // nf-oct-comment_discussion
const NF_REVIEW_REQUESTED = "\u{F441}"; // nf-oct-eye
const NF_EFFORT_LOW = "\u{F0875}";    // nf-md-gauge_low
const NF_EFFORT_MEDIUM = "\u{F029A}"; // nf-md-gauge
const NF_EFFORT_HIGH = "\u{F0874}";   // nf-md-gauge_full
const NF_FROM = "\u{F004D}";     // nf-md-arrow_left: what this came from
const NF_ALERT = "\u{F40C}";     // nf-oct-alert_fill: unmerged paths
const NF_CHECK = "\u{F4A4}";     // nf-oct-check_circle_fill: the run passed
const NF_CI_SKIPPED = "\u{F517}"; // nf-oct-skip: a skipped or cancelled run
const NF_X = "\u{F530}";         // nf-oct-x_circle_fill: the run failed
// F0997 was here until 2026-10-06, under the name progress_clock, and it
// draws md-progress_download: a CI run still going read as a download
// (specs/031-git-gate-rows/glyph-evidence.png shows both side by side).
const NF_RUNNING = "\u{F0996}";  // nf-md-progress_clock: still going

// Lines 2, 3 and 4. These carried emoji until 2026-09-01, and emoji cost
// two columns each where a private-use glyph costs one: eight of them were
// spending eight columns of a bar whose segments already compete for the
// width COLUMNS reports (Principle I, Glyphs).
const NF_TASKLIST = "\u{F0756}";  // nf-md-format_list_checks (was nf-oct-tasklist). F0BE, listed as
                                 // "checklist", draws the App Store logo
// A hammer and a coffee cup, chosen by the owner on 2026-09-06 from a sheet
// of twelve candidate pairs rendered from the installed font. What they
// replace is nf-md-circle against nf-md-circle_outline, which works only
// after a reader has been told what it means: a filled disc and a hollow one
// say nothing about work. These do, at a glance and without instruction, and
// their silhouettes stay apart at the one column they get.
const NF_WORKING = "\u{F08EA}";  // nf-md-hammer
const NF_IDLE = "\u{F0176}";     // nf-md-coffee
const NF_SKILLS = "\u{F0431}";   // nf-md-puzzle
const NF_MODEL = "\u{F167A}";    // nf-md-robot_outline (was nf-md-robot)
const NF_EFFORT = NF_EFFORT_HIGH;
const NF_CONTEXT = "\u{F09D1}";  // nf-md-brain: the context window (guide section 5.3)
                                 // F09DA, listed as "brain", draws a boxed
                                 // chevron in this build
const NF_TIMER = "\u{F051F}";    // an hourglass: a window that runs out, time remaining. F44E, listed as "stopwatch",
                                 // draws three flat bars in this build
const NF_STOPWATCH = "\u{F520}"; // a stopwatch: session duration, time elapsed
const NF_BURN = "\u{F0238}";     // nf-md-fire: how fast the window is going
const NF_RUST = "\u{F1679}";     // a piggy bank, which is what rtk keeps: savings
// The spend limit. Rendered from the installed font before adoption
// (specs/023-extra-usage-limit/glyph-evidence.png): F0114 nf-md-cash draws a
// banknote, which reads as currency rather than a budget being spent, and
// F00F6, listed in one cheat sheet as a cart, draws a calendar.
const NF_WALLET = "\u{F0584}";  // nf-md-wallet
const NF_ACCOUNT = "\u{F0004}"; // nf-md-account: who is signed in (specs/071)
const NF_HELP = "\u{F059}";     // nf-fa-question_circle: the help page (specs/078)
// The prompt cache, one icon per state so the icon itself says which
// (Principle X). Rendered before adoption (specs/025-prompt-cache-chip/
// glyph-evidence.png): F09A2, listed as a database refresh, draws a speaker
// with a Bluetooth mark, and F06B0 draws a clock with an arrow.
const NF_HOURGLASS_FULL = "\u{F078C}";  // a warm cache with most of its life left
const NF_HOURGLASS_HALF = "\u{F051F}";  // about half of it
const NF_HOURGLASS_EMPTY = "\u{F06AD}"; // the last third
const NF_SNOWFLAKE = "\u{F0717}";   // nf-md-snowflake: cold
// The statusline's own updates, one icon per direction (specs/026-update-
// check/glyph-evidence.png). F0CE0, listed as an up arrow in a circle, points
// right; F4A9, listed as a rocket, draws a monitor; F06B1 draws a watch.
const NF_DOWNLOAD = "\u{F0394}";      // nf-md-new_box: an update is waiting
const NF_UPDATED = "\u{F12CC}";       // a cloud with a tick: updated this session
// Two modes the payload reports (specs/027-bar-polish/glyph-evidence.png).
const NF_VIM = "\u{E62B}";           // nf-custom-vim: the vim mode
const NF_SPEEDOMETER = "\u{F140B}";  // a lightning bolt: fast mode
// Copilot CLI's two figures (specs/029-multi-harness/glyph-evidence.png).
// F0565, listed as a ticket, draws a shield with a tick.
const NF_COPILOT = "\u{F4B8}";       // nf-oct-copilot: premium requests
const NF_SHIELD_OFF = "\u{F099E}";   // nf-md-shield_off: allow all
// The git gates running in this repository (specs/031-git-gate-rows/
// glyph-evidence.png). A clock reads as "still going"; a lock with a clock as
// "waiting on a lock". F0299 md-gate draws a fence and F0E86 md-boom_gate a
// crane at one cell. A gate still running and a CI run still going are the
// same fact, so they share the clock.
const NF_GATE_RUNNING = "\u{F52E}";  // nf-oct-workflow: a gate is running (guide section 5.3)
const NF_GATE_WAITING = "\u{F097F}"; // nf-md-lock_clock

/**
 * The whole glyph set, and the substitute used when the terminal has no
 * Nerd Font. Every glyph the bar can emit is a row here, per Principle X:
 * one written inline in a render function is one `CLAUDE_STATUSLINE_ASCII=1`
 * cannot replace, and a fallback that swaps some icons and not others
 * leaves boxes on the line while claiming to have removed them.
 *
 * The substitutes are plain Unicode and emoji, which need no special font.
 * They are wider than what they stand in for, and that is the trade: a
 * terminal without the font gets a readable bar rather than a narrow one.
 *
 * Every codepoint in the `nerd` column must also be listed in
 * `scripts/extract-glyphs.py`, or it renders in the terminal and vanishes
 * from the generated previews.
 */
export const GLYPHS = {
  nerd: {
    branch: NF_BRANCH,
    commit: NF_COMMIT,
    pr: NF_PR,
    calendar: NF_CALENDAR,
    modified: NF_MODIFIED,
    added: NF_ADDED,
    push: NF_PUSH,
    pull: NF_PULL,
    dir: NF_DIR,
    home: NF_HOME,
    repo: NF_REPO,
    worktree: NF_WORKTREE,
    removed: NF_REMOVED,
    untracked: "?",
    reset: NF_RESET,
    trackEmptyStart: "\u{EE00}",
    trackEmptyMid: "\u{EE01}",
    trackEmptyEnd: "\u{EE02}",
    trackFullStart: "\u{EE03}",
    trackFullMid: "\u{EE04}",
    trackFullEnd: "\u{EE05}",
    bandCritical: "\u{F40C}",
    bandWarn: "",
    prDraft: NF_PR_DRAFT,
    prMerged: NF_PR_MERGED,
    prClosed: NF_PR_CLOSED,
    reviewApproved: NF_REVIEW_APPROVED,
    reviewComments: NF_REVIEW_COMMENTS,
    reviewRequested: NF_REVIEW_REQUESTED,
    effortLow: NF_EFFORT_LOW,
    effortMedium: NF_EFFORT_MEDIUM,
    effortHigh: NF_EFFORT_HIGH,
    from: NF_FROM,
    conflict: NF_ALERT,
    ciPass: NF_CHECK,
    ciFail: NF_X,
    ciSkipped: NF_CI_SKIPPED,
    ciRunning: NF_RUNNING,
    todo: NF_TASKLIST,
    working: NF_WORKING,
    workingFrame0: "\u{EE06}", // the spinner, one frame a redraw (specs/048)
    workingFrame1: "\u{EE07}",
    workingFrame2: "\u{EE09}",
    workingFrame3: "\u{EE0A}",
    idle: NF_IDLE,
    sleeping: "\u{F04B2}",
    yourTurn: "\u{F476}",
    clean: "\u{F4A4}",
    unavailable: "\u{F00E8}",
    skills: NF_SKILLS,
    model: NF_MODEL,
    effort: NF_EFFORT,
    context: NF_CONTEXT,
    timer: NF_TIMER,
    duration: NF_STOPWATCH,
    burn: NF_BURN,
    rtk: NF_RUST,
    spend: NF_WALLET,
    account: NF_ACCOUNT,
    help: NF_HELP,
    mcp: NF_FROM,
    cacheWarm: NF_HOURGLASS_FULL,
    cacheWarmHalf: NF_HOURGLASS_HALF,
    cacheWarmLow: NF_HOURGLASS_EMPTY,
    cacheCold: NF_SNOWFLAKE,
    updateReady: NF_DOWNLOAD,
    updateBlocked: "\u{F01DA}",   // nf-md-download: the update cannot go in
    updateDone: NF_UPDATED,
    vim: NF_VIM,
    fast: NF_SPEEDOMETER,
    premium: NF_COPILOT,
    allowAll: NF_SHIELD_OFF,
    gateRunning: NF_GATE_RUNNING,
    gateWaiting: NF_GATE_WAITING,
  },
  /**
   * The emoji tier, for a terminal that draws pictures and has no Nerd Font.
   *
   * Every entry is one codepoint with `Emoji_Presentation=Yes`, so Unicode
   * draws it as a picture, two columns wide, without a variation selector.
   * The look-alikes that draw as text on some terminals (a lightning bolt, a
   * hot beverage, a warning sign, a keyboard) are not here, and a test reads
   * the committed Unicode data to keep it that way (specs/043-emoji-tier).
   */
  emoji: {
    branch: "\u{1F33F}",         // 🌿
    commit: "\u{1F4CD}",         // 📍
    pr: "\u{1F500}",             // 🔀
    calendar: "\u{1F4CA}",       // 📊 the 7-day window; calendars are text-presentation
    modified: "\u{1F4DD}",       // 📝
    added: "\u2795",             // ➕
    push: "\u{1F53C}",           // 🔼
    pull: "\u{1F53D}",           // 🔽
    dir: "\u{1F4C2}",            // 📂
    home: "\u{1F3E0}",           // 🏠
    repo: "\u{1F4E6}",           // 📦
    worktree: "\u{1F333}",       // 🌳
    removed: "\u2796",           // ➖
    untracked: "\u2754",         // ❔
    reset: "\u{1F504}",          // 🔄
    trackEmptyStart: "\u2B1C",    // ⬜ the track is drawn from the plain set in this tier
    trackEmptyMid: "\u2B1C",
    trackEmptyEnd: "\u2B1C",
    trackFullStart: "\u{1F7E9}",  // 🟩
    trackFullMid: "\u{1F7E9}",
    trackFullEnd: "\u{1F7E9}",
    bandCritical: "\u{1F534}",    // 🔴
    bandWarn: "\u{1F7E1}",        // 🟡
    prDraft: "\u{1F6A7}",        // 🚧
    prMerged: "\u{1F7E3}",       // 🟣
    prClosed: "\u{1F6AB}",       // 🚫
    reviewApproved: "\u2705",    // ✅
    reviewComments: "\u{1F4AC}", // 💬
    reviewRequested: "\u{1F440}", // 👀
    effortLow: "\u{1F3AF}",      // 🎯
    effortMedium: "\u{1F3AF}",
    effortHigh: "\u{1F3AF}",
    from: "\u{1F519}",           // 🔙
    conflict: "\u{1F4A5}",       // 💥
    ciPass: "\u2705",            // ✅
    ciFail: "\u274C",            // ❌
    ciSkipped: "\u23E9",         // ⏩
    ciRunning: "\u{1F504}",      // 🔄
    todo: "\u{1F4CB}",           // 📋
    working: "\u{1F528}",        // 🔨
    workingFrame0: "\u{1F528}",  // the emoji tier does not animate
    workingFrame1: "\u{1F528}",
    workingFrame2: "\u{1F528}",
    workingFrame3: "\u{1F528}",
    idle: "\u{1F4A4}",           // 💤
    sleeping: "\u{1F4A4}",
    yourTurn: "\u{1F514}",       // 🔔
    clean: "\u2705",             // ✅
    unavailable: "\u{1F6AB}",    // 🚫
    skills: "\u{1F9E9}",         // 🧩
    model: "\u{1F916}",          // 🤖
    effort: "\u{1F3AF}",         // 🎯
    context: "\u{1F9E0}",        // 🧠
    timer: "\u23F3",             // ⏳ the 5-hour window, time that runs out
    duration: "\u{1F550}",       // 🕐 time elapsed
    burn: "\u{1F525}",           // 🔥
    rtk: "\u{1FA99}",            // 🪙 savings
    spend: "\u{1F4B0}",          // 💰
    account: "\u{1F464}",        // 👤
    help: "\u2753",              // ❓
    mcp: "\u{1F50C}",            // 🔌
    cacheWarm: "\u23F3",         // ⏳
    cacheWarmHalf: "\u23F3",
    cacheWarmLow: "\u231B",      // ⌛
    cacheCold: "\u{1F9CA}",      // 🧊
    updateReady: "\u{1F195}",     // 🆕
    updateBlocked: "\u23EC",      // ⏬
    updateDone: "\u{1F680}",      // 🚀
    vim: "\u{1F524}",            // 🔤
    fast: "\u{1F407}",           // 🐇
    premium: "\u{1F48E}",        // 💎
    allowAll: "\u{1F513}",       // 🔓
    gateRunning: "\u{1F6A6}",    // 🚦
    gateWaiting: "\u{1F512}",    // 🔒
  },
  /**
   * The set for a terminal with no Nerd Font.
   *
   * Every one of these was an emoji until 2026-09-12, which was wrong twice
   * over. An emoji is two columns wide where the glyph it stands in for is
   * one, so the substitute set drew a different bar from the real one rather
   * than the same bar in plainer clothes. And the bar had already had its
   * emoji taken off it at the owner's request; this table was simply missed.
   *
   * Nerd Font glyphs are not the answer here, tempting as it is: this table
   * exists precisely because the font is absent, so filling it with private
   * use area codepoints would leave the same empty boxes it is meant to
   * avoid. These are Geometric Shapes, Arrows and Miscellaneous Technical —
   * present in ordinary system fonts, and one column wide.
   *
   * Every codepoint below is East Asian Narrow by the Unicode table itself,
   * so a terminal configured for East Asian text draws the same widths as one
   * that is not. Checking them with `displayWidth` was not enough: it only
   * knows the Ambiguous characters someone listed, and five of these passed
   * while being Ambiguous until 2026-10-06 (specs/032-audit-fixes, whose
   * plain-glyph-evidence.png shows each replacement rendered). `U+25CB` (the
   * obvious hollow circle for idle) is Ambiguous and was rejected for that
   * reason in favour of the dotted `U+25CC`, which also reads better: a
   * broken outline for an agent that is not doing anything.
   */
  plain: {
    branch: "\u2387",     // ⎇ the conventional plain-text branch mark
    // `U+25C6` until 2026-09-12: it is East Asian Ambiguous, so this set
    // measured a different width under `CLAUDE_STATUSLINE_AMBIGUOUS_WIDE` than
    // without it. Every glyph here is Narrow, so the substitute bar is one
    // width on every terminal.
    commit: "\u25AA",     // ▪
    pr: "\u21C4",         // ⇄ two directions, which is what a pull request is
    calendar: "\u25F0",   // ◰ a page with one cell marked. Was ▤, Ambiguous
    modified: "\u25C9",   // ◉
    added: "+",
    // The plain arrows were `U+2191`/`U+2193`/`U+2190`, all three East Asian
    // Ambiguous. The doubled forms are Narrow and read the same.
    push: "\u21D1",        // ⇑
    pull: "\u21D3",        // ⇓
    dir: "\u2302",       // ⌂
    home: "\u2302",      // ⌂
    repo: "\u22A1",      // ⊡ a boxed dot
    worktree: "\u2387",  // ⎇ the branch sign, as for a branch
    removed: "-",
    untracked: "?",
    reset: "\u21BB",     // ↻
    trackEmptyStart: ".",
    trackEmptyMid: ".",
    trackEmptyEnd: ".",
    trackFullStart: "|",
    trackFullMid: "|",
    trackFullEnd: "|",
    bandCritical: "!",
    bandWarn: "",
    prDraft: "\u21C4",   // ⇄ every state of a pull request is the exchange arrows
    prMerged: "\u21C4",
    prClosed: "\u21C4",
    reviewApproved: "\u2713", // ✓
    reviewComments: "\u2709", // ✉
    reviewRequested: "\u229B", // ⊛
    effortLow: "\u21AF", // ↯ the plain set has one effort mark for every level
    effortMedium: "\u21AF",
    effortHigh: "\u21AF",
    from: "\u21D0",        // ⇐
    conflict: "\u2716",   // ✖
    ciPass: "\u2713",     // ✓
    ciFail: "\u2717",     // ✗
    ciSkipped: "-",        // a skipped or cancelled run
    ciRunning: "\u229A",  // ⊚
    todo: "\u25B8",       // ▸
    // Filled against broken: the same distinction the Nerd set draws with a
    // hammer and a coffee cup, and the one CircleCI's own columnar glyph set
    // makes with a filled and a hollow circle.
    working: "\u29BF",    // ⦿ was ◎, Ambiguous
    workingFrame0: "|",   // the plain spinner, ASCII, one column
    workingFrame1: "/",
    workingFrame2: "-",
    workingFrame3: "\\",
    idle: "\u25CC",       // ◌
    sleeping: "\u25CC",
    yourTurn: "!",
    clean: "\u2713",     // ✓
    unavailable: "!",
    skills: "\u2756",     // ❖ was ◈, Ambiguous
    model: "\u25CA",      // ◊ was ◇, Ambiguous
    effort: "\u21AF",     // ↯
    context: "\u229E",    // ⊞ a grid, as ▦ was before it; that one is Ambiguous
    timer: "\u25F7",      // ◷
    duration: "\u25D4",   // ◔
    // Not `U+25B4`: that is the gauge's own critical band mark, and one glyph
    // cannot mean both "this is the burn rate" and "this level is critical".
    burn: "\u21E1",       // ⇡
    rtk: "\u25BE",        // ▾ a reduction, which is what a saving is
    // ASCII, East Asian Narrow, in every font, and used nowhere else on the bar.
    spend: "$",
    account: "@",
    help: "?",
    mcp: "~",
    // Both East Asian Narrow. `U+2744` has an emoji form, but its default
    // presentation is text and the bar never sends the selector that asks
    // for the other one.
    cacheWarm: "\u29D7",  // ⧗ an hourglass: still reusable
    cacheWarmHalf: "\u29D7",
    cacheWarmLow: "\u29D7",
    cacheCold: "\u2744",  // ❄
    // Both East Asian Narrow, and not the doubled arrows push and pull use.
    updateReady: "\u2913", // ⤓
    updateBlocked: "\u21E9", // ⇩
    updateDone: "\u2912",  // ⤒
    vim: "\u2328",        // ⌨
    fast: "\u21F6",       // ⇶ three arrows
    premium: "\u2726",    // ✦
    allowAll: "\u2298",   // ⊘
    gateRunning: "\u27F3", // ⟳
    gateWaiting: "\u29D6", // ⧖
  },
};

async function readStdinAsync() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

export async function render({ asciiArrows = false, flavor = "mocha", strict = false } = {}) {
  const raw = await readStdinAsync();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
    // A host that asked for the data contract is told, where the bar a person
    // reads draws what it can (specs/056-runs-output-contract, decision 7).
    if (strict) throw Object.assign(new Error("the status payload is not a JSON object"), { code: "bad-payload" });
  }
  if (strict && (!raw.trim() || payload === null || typeof payload !== "object" || Array.isArray(payload))) {
    throw Object.assign(new Error("the status payload is not a JSON object"), { code: "bad-payload" });
  }

  if (process.env.CLAUDE_STATUSLINE_DEBUG === "1" && canWrite()) {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");
      const dir = stateRoot();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "debug-last-payload.json"), raw || "{}");
    } catch {
      // debug-only, never let this affect the real render
    }
  }

  return renderPayload(payload, { asciiArrows, flavor });
}

/**
 * Reads every source once and returns a reading per segment.
 *
 * Separated from rendering so that "what did the sources say, how old is
 * it, and how long did it take" is answerable without producing a line.
 * The diagnostic reports exactly this, which is what stops it describing
 * behaviour the renderer does not have.
 */
/**
 * How many skills the line shows, and how many it looks for.
 *
 * It asks for more than it shows so it can say how many were left out. A
 * line that shows three of five without saying so claims those three are
 * all of them (FR-013).
 */
const SKILLS_SHOWN = 5;
const SKILLS_PROBED = 12;

function skillsReading(timed, probe, payload, scanned, scannedTrueCount) {
  // The session id lets the hook's event file be found. Without one, or
  // without the hook, the transcript answers instead and the line is the
  // same, only slower to react. `scanned` is what the activity pass already
  // found on that same walk, so the fallback costs no second read.
  const all = timed("transcript", () =>
    probe.getActiveSkills(payload?.transcript_path, SKILLS_PROBED, {
      sessionId: payload?.session_id,
      scanned,
    })
  );
  const directlyInvoked = Array.isArray(all.value) ? all.value : [];

  // Running subagents used to be folded into this list (specs/011), because
  // line 2 had nowhere else to say one was running. They have their own chip
  // now, and naming them twice on the same line reads as two facts when it is
  // one. This chip is the skills again, and only the skills.
  const list = directlyInvoked;
  // Not `list.length`: the directly-invoked half is itself already capped at
  // SKILLS_PROBED, so computing "hidden" from its length only ever reported
  // what the scan happened to examine, not what was actually active (FR-002,
  // specs/008-skills-line-completeness).
  const trueCount = probe.getActiveSkillsTrueCount(payload?.transcript_path, {
    sessionId: payload?.session_id,
    scanned,
    scannedTrueCount,
  });
  return {
    ...all,
    value: list.slice(0, SKILLS_SHOWN),
    hiddenCount: Math.max(0, trueCount - SKILLS_SHOWN),
  };
}

export function gather(payload, probe, { now = Date.now(), off = null, copilotSettings = null } = {}) {
  const timed = (source, fn) => {
    const started = Date.now();
    try {
      const value = fn();
      return reading({ value: value ?? null, at: now, source, tookMs: Date.now() - started });
    } catch (err) {
      return missing(source, err?.message || String(err), Date.now() - started);
    }
  };

  const cwd = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  const { fiveHourPct, fiveHourResetsAt, sevenDayPct, sevenDayResetsAt, spendLimitPct, spendLimitResetsAt, spendLimitUsd } =
    getRateLimits(payload);
  const ctxPct = getContextPercent(payload);
  // RTK is needed both for its segment and for the sample history, so read it
  // once and reuse the timed reading.
  // A segment the arrangement or the omit list switched off reads nothing
  // that would start a lookup (specs/058-omit-list, FR-002).
  const rtkReading = off?.has("rtk") ? missing("rtk", "switched off") : timed("rtk", () => probe.getRtkSavings(payload?.workspace?.project_dir || cwd));
  const sampleHistory = pushSample(loadSamples(payload?.session_id), {
    at: now,
    contextPct: payload?.context_window?.used_percentage ?? ctxPct,
    fiveHourPct: payload?.rate_limits?.five_hour?.used_percentage ?? fiveHourPct,
    sevenDayPct: payload?.rate_limits?.seven_day?.used_percentage ?? sevenDayPct,
    rtkPct: rtkReading.value,
  });

  // The statusline's own update check (specs/026-update-check). Starting it
  // is two cache reads and, once a day, a detached process; reading its
  // result is one more read. Neither can fail the redraw.
  try {
    // Hidden by a layout file, the chip still has an update check behind it
    // that applies updates in `auto` mode; only the host's own omit list stops it.
    if (!omittedKeys().includes("update")) probe.maybeStartUpdateCheck?.({ now });
  } catch {
    // a check that cannot start is tried again on the next redraw
  }
  const updateReading = off?.has("update")
    ? missing("cache", "switched off")
    : timed("update", () => probe.getUpdateNotice?.(payload?.session_id ?? null, { now }) ?? null);

  // Which kind of account this is, from the payload when it can say and from
  // the last one seen when it cannot (specs/063-account-kind). Only Claude
  // Code's payload has these limits; the other harnesses decide their own.
  let accountKind = null;
  // The usage credits Claude Code cached for a seat billed by usage
  // (specs/069-usage-credits): read once, used for the kind and the chip.
  // Read under every harness, as the spend limit is, so the composer's
  // fixture can pool the chip; the chip itself stays off under Copilot,
  // OpenCode and Codex, which have no Claude account behind them.
  let usageCredits = null;
  try {
    usageCredits = off?.has("usageCredits") ? null : (probe.getUsageCredits?.({ now }) ?? null);
  } catch {
    usageCredits = null;
  }
  // The windows Claude Code cached for `/usage` (specs/070, FR-002): a
  // subscriber's 5h and 7d before the session's first response, when the
  // payload has none of its own. The payload's figure wins once it arrives.
  // Only a Claude account has this cache behind it.
  const isClaudeHarness = detectHarness(payload) === "claude";
  const cachedWindows = isClaudeHarness && usageCredits?.windows ? usageCredits.windows : null;
  const fiveHourFromCache = !payload?.rate_limits?.five_hour && cachedWindows?.fiveHour ? cachedWindows.fiveHour : null;
  const sevenDayFromCache = !payload?.rate_limits?.seven_day && cachedWindows?.sevenDay ? cachedWindows.sevenDay : null;
  // Who is signed in, and how the credits have moved (specs/071): both are
  // Claude's, so neither is read under another harness.
  let accountIdentity = null;
  let creditsMotion = null;
  // The identity is read under every harness, as the credits are, so the
  // composer's fixture can pool the chip; the chip itself stays off where
  // no Claude account stands behind the bar (`noLimits`).
  try {
    accountIdentity = off?.has("account") ? null : (probe.getAccountIdentity?.() ?? null);
  } catch {
    accountIdentity = null;
  }
  if (isClaudeHarness) {
    try {
      creditsMotion =
        usageCredits?.enabled && usageCredits.pctExact !== null
          ? (probe.creditsTrend?.({ pct: usageCredits.pctExact, fetchedAt: usageCredits.fetchedAt, sessionId: payload?.session_id ?? null, now }) ?? null)
          : null;
    } catch {
      creditsMotion = null;
    }
  }
  if (isClaudeHarness) {
    // A cache that carries a window is a subscriber's, as surely as a payload
    // that does: noted the same way.
    const seen = accountKindOf(payload) ?? (cachedWindows?.fiveHour || cachedWindows?.sevenDay ? "subscriber" : null);
    try {
      if (seen) probe.noteAccountKind?.(seen, { now });
    } catch {
      // a kind that cannot be kept is seen again on the next payload
    }
    try {
      const remembered = probe.getAccountKind?.({ now }) ?? null;
      // A fresh cache for the signed-in account that shows no window and
      // credits enabled is a usage-based seat. It outranks what is
      // remembered, because the payload of such a seat never says anything,
      // and a `subscriber` remembered from another account would otherwise
      // keep `5h — ?` on the line for 30 days.
      // A seat whose credits were ever on is a credits seat while they are
      // off, too: the chip then reads `credits off` (specs/070, FR-005).
      const fromCache =
        !seen && usageCredits && !usageCredits.hasWindows && (usageCredits.enabled || usageCredits.creditsEverEnabled) ? "credits" : null;
      if (fromCache) probe.noteAccountKind?.(fromCache, { now });
      accountKind = seen ?? fromCache ?? remembered;
      // No window, no spend limit, nothing remembered, and a response already
      // received: the account has no window to wait for (specs/068). A
      // remembered kind outranks this, because a subscriber or a gateway
      // account looks the same in the moment its window was dropped.
      if (!accountKind && apiResponded(payload)) {
        accountKind = "none";
        probe.noteAccountKind?.("none", { now });
      }
    } catch {
      accountKind = null;
    }
  }

  const git = timed("git", () => probe.getGitInfo(cwd));
  // Two questions, kept apart. Line 1's own git segments need the snapshot,
  // so they follow `git.value`. Whether this is a repository at all is asked
  // of the file system: `git status` has a 150 ms budget and a 5 s cached
  // fallback, and the load a running gate puts on the machine is exactly what
  // pushes it past both. Deciding "not a repository" from that null switched
  // the gate rows, the pull request and CI off on every idle redraw while the
  // hook was still running. The walk is a few stat calls, and only runs when
  // git had no answer.
  const hasRepo = git.value !== null || (probe.isRepo ?? isRepository)(cwd) === true;
  const hasSnapshot = git.value !== null;
  // A detached HEAD has no branch name to scope a lookup by, and the short
  // commit id is not one: matching it against a stored branch would refuse
  // every cached answer instead of the wrong ones.
  const namedBranch = git.value && !git.value.detached ? git.value.branch : null;

  // One walk over the transcript answers the skills, the todo list and
  // whether anything happened recently. It runs before the skills reading so
  // that reading can use what it found rather than walking the file again.
  const activity = timed("transcript", () =>
    probe.getSessionActivity(payload?.transcript_path, { now, limit: SKILLS_PROBED })
  );
  // Whether anything is running under this session, which is the only thing
  // line 2 asks about subagents now: a running one means "working" even when
  // the top-level transcript has gone quiet (specs/012). Scoped by session id,
  // so a second Claude Code window on another project cannot answer for this
  // one.
  const sessionId = payload?.session_id ?? null;
  const subagent = probe.subagentActivity(now, sessionId);
  // The top-level transcript going quiet doesn't mean nothing is
  // happening: a subagent can be doing the actual work right now (specs/012-
  // subagent-activity-status, FR-001). A running subagent alone is enough
  // to say "working"; with none, this is a no-op and `working` is exactly
  // what the transcript already said (FR-005).
  if (activity.value) {
    activity.value.working = activity.value.working || subagent.length > 0;
  }
  const payloadPr = normalizePr(payload?.pr, "payload");
  // Cleaned once, here, so the text on line 1 and the link built from it are
  // the same identity. Raw, an object owner drew `[object Object]` and a
  // newline in a name added lines to the bar.
  const rawRepo = payload?.workspace?.repo;
  const repoOwner = payloadText(rawRepo?.owner);
  const repoName = payloadText(rawRepo?.name);
  const repoId = repoOwner && repoName ? { host: payloadText(rawRepo?.host), owner: repoOwner, name: repoName } : null;
  const payloadRepoUrl = repoUrlFromPayload(repoId);

  // What Copilot CLI's payload does not carry and its session does
  // (specs/033-copilot-parity). Under Claude Code every one of these is the
  // payload's own field or nothing, exactly as before.
  const harness = detectHarness(payload);
  const isCopilot = harness === "copilot";
  const settings = isCopilot ? (copilotSettings ?? probe.copilotSettings?.() ?? {}) : null;
  const payloadEffort = payloadText(payload?.effort?.level);
  const loggedEffort = isCopilot ? plainText(activity.value?.effort) : null;
  const settingsEffort = isCopilot ? plainText(settings?.effortLevel) : null;
  const effortReading = payloadEffort
    ? reading({ value: payloadEffort, at: now, source: "payload" })
    : loggedEffort
      ? reading({ value: loggedEffort, at: now, source: "transcript" })
      : reading({ value: settingsEffort, at: now, source: settingsEffort ? "settings" : "payload" });
  // `auto` is the router, not a model. The session log says which model it
  // routed to, and that is what Claude Code's bar would name.
  const routedModel =
    isCopilot && String(payloadText(payload?.model?.id) ?? "").toLowerCase() === "auto" ? plainText(activity.value?.resolvedModel) : null;
  // Before Codex's first turn its rollout names no model yet, and the name of
  // another vendor's model family would be wrong there (specs/035-codex-pane).
  const modelName =
    payloadText(payload?.model?.display_name) ?? payloadText(payload?.model?.id) ?? ({ codex: "Codex", opencode: "OpenCode" }[harness] ?? "Claude");

  return {
    cwd,
    dir: reading({ value: getDirLabel(cwd), at: now, source: "payload" }),
    dirUrl: timed("payload", () => probe.getDirUrl(cwd)),
    git,
    // The payload carries both of these, and did all along. Asking git and
    // gh for them cost a subprocess each: 540 ms for `gh pr view` on a warm
    // network, and its whole timeout when it cannot reach GitHub. The probes
    // stay as fallbacks, for a Claude Code too old to send the fields or a
    // pull request it has not found yet.
    remote: hasSnapshot
      ? payloadRepoUrl
        ? reading({ value: payloadRepoUrl, at: now, source: "payload" })
        : timed("git", () => probe.getRemoteUrl(cwd))
      : missing("git", "not a repository"),
    repo: hasSnapshot
      ? reading({ value: repoId, at: now, source: "payload" })
      : missing("payload", "not a repository"),
    // Both `gh` lookups are cached per repository and answer about whichever
    // branch was checked out when they ran, so the branch travels with the
    // question: a pull request or a run from the branch you just left is not
    // an older answer, it is an answer about something else.
    // A pull request lookup that failed, so a dim icon can stand where a blank
    // would read as "no pull request" (specs/048-state-feedback).
    prUnavailable: reading({
      value: hasRepo && !payloadPr ? Boolean(probe.getPrLookupFailed?.(cwd)) : false,
      at: now,
      source: "cache",
    }),
    pr: off?.has("pr")
      ? missing("gh", "switched off")
      : hasRepo
      ? payloadPr
        ? reading({ value: payloadPr, at: now, source: "payload" })
        : timed("gh", () => normalizePr(probe.getPrInfo(cwd, { branch: namedBranch }), "gh"))
      : missing("gh", "not a repository"),
    // The repository's alerts and the branch's standing (specs/074-pr-state),
    // both from caches the detached refresh fills.
    alerts: off?.has("alerts") || !hasRepo
      ? missing("gh", hasRepo ? "switched off" : "not a repository")
      : timed("gh", () => probe.getAlerts?.(cwd, { now }) ?? null),
    branchMeta: !hasRepo
      ? missing("git", "not a repository")
      : timed("git", () => probe.getBranchMeta?.(cwd, { now, branch: namedBranch }) ?? null),
    // The help page, when this copy ships it (specs/078).
    helpPage: reading({ value: safeProbe(() => probe.getHelpPage?.() ?? null), at: now, source: "cache" }),
    // The MCP servers and the session's skill count (specs/075).
    mcp: reading({ value: safeProbe(() => probe.getMcpServers?.(cwd) ?? null), at: now, source: "cache" }),
    skillSessionCount: reading({ value: safeProbe(() => probe.getSkillSessionCount?.(payload?.session_id ?? null) ?? 0) ?? 0, at: now, source: "hook" }),
    skills: skillsReading(timed, probe, payload, activity.value?.skills, activity.value?.skillsTrueCount),
    activity,
    // The running subagents, which only Copilot's reader returns: Claude Code
    // draws its own rows (specs/030-copilot-agent-rows).
    agents: reading({ value: Array.isArray(activity.value?.agents) ? activity.value.agents : null, at: now, source: activity.source }),
    // The git gates running in this repository's worktrees, from the cache
    // the detached refresh fills (specs/031-git-gate-rows). Only in a
    // repository, so a directory without one starts no lookup, and only when
    // the arrangement has the segment on: reading the cache is what starts the
    // refresh, and that refresh is a `ps -A` and an `lsof` every 15 s.
    gates: !hasRepo
      ? missing("cache", "not a repository")
      : off?.has("gates")
        ? missing("cache", "switched off")
        : probe.getGateRuns
          ? timed("cache", () => probe.getGateRuns(cwd, { now }))
          : missing("cache", "no reader"),
    ci: off?.has("ci")
      ? missing("gh", "switched off")
      : hasRepo
        ? timed("gh", () => probe.getCiStatus(cwd, { branch: namedBranch }))
        : missing("gh", "not a repository"),
    model: reading({
      value: routedModel ? `${routedModel} (auto)` : modelName,
      at: now,
      source: routedModel ? "transcript" : "payload",
    }),
    // The routed model alone, so the chip can give up "(auto)" before it
    // gives up anything else.
    modelRouted: reading({ value: routedModel, at: now, source: "transcript" }),
    effort: effortReading,
    outputStyle: reading({ value: payloadText(payload?.output_style?.name), at: now, source: "payload" }),
    // Everything below arrives on stdin. None of it costs a process, and
    // none of it was on the bar before feature 002.
    agent: reading({ value: payloadText(payload?.agent?.name), at: now, source: "payload" }),
    sessionName: reading({ value: payloadText(payload?.session_name), at: now, source: "payload" }),
    projectDir: reading({ value: payloadText(payload?.workspace?.project_dir), at: now, source: "payload" }),
    worktree: reading({
      value: payloadText(payload?.worktree?.name)
        ? { name: payloadText(payload.worktree.name), from: payloadText(payload.worktree.original_branch) }
        : payloadText(payload?.workspace?.git_worktree)
          ? { name: payloadText(payload.workspace.git_worktree), from: null }
          : null,
      at: now,
      source: "payload",
    }),
    tokens: reading({ value: getContextTokens(payload), at: now, source: "payload" }),
    sessionCost: reading({ value: getSessionCost(payload), at: now, source: "payload" }),
    // What the session has spent, summed from the transcript as it is
    // written (specs/073-session-totals): Claude Code's transcript only.
    sessionTotals: reading({
      // Asked under every harness, as the credits are, so the composer's
      // fixture can pool the chips; the reader itself answers null without a
      // transcript path, which only Claude Code's payload carries.
      value: probe.getSessionTotals
        ? (safeProbe(() => probe.getSessionTotals({
            transcriptPath: payload?.transcript_path ?? null,
            sessionId: payload?.session_id ?? null,
            now,
            exceeds200k: payload?.exceeds_200k_tokens === true,
            ownModel: modelFamily(payload?.model?.id ?? payload?.model?.display_name),
          })) ?? null)
        : null,
      at: now,
      source: "transcript",
    }),
    context: reading({ value: ctxPct, at: now, source: "payload" }),
    fiveHour: reading({ value: fiveHourFromCache ? fiveHourFromCache.pct : fiveHourPct, at: now, source: fiveHourFromCache ? "cache" : "payload" }),
    fiveHourReset: reading({ value: fiveHourFromCache ? fiveHourFromCache.resetsAt : fiveHourResetsAt, at: now, source: fiveHourFromCache ? "cache" : "payload" }),
    sevenDay: reading({ value: sevenDayFromCache ? sevenDayFromCache.pct : sevenDayPct, at: now, source: sevenDayFromCache ? "cache" : "payload" }),
    sevenDayReset: reading({ value: sevenDayFromCache ? sevenDayFromCache.resetsAt : sevenDayResetsAt, at: now, source: sevenDayFromCache ? "cache" : "payload" }),
    // When Claude Code last fetched its `/usage` cache, and which windows the
    // bar took from it: what the age mark and the doctor's account line read.
    usageCache: reading({
      value: usageCredits
        ? { fetchedAt: usageCredits.fetchedAt, windowsFromCache: Boolean(fiveHourFromCache || sevenDayFromCache) }
        : null,
      at: now,
      source: "cache",
    }),
    spendLimit: reading({ value: spendLimitPct, at: now, source: "payload" }),
    spendLimitReset: reading({ value: spendLimitResetsAt, at: now, source: "payload" }),
    spendLimitUsd: reading({ value: spendLimitUsd, at: now, source: "payload" }),
    // The figure, on or off: the chip draws the percentage while extra usage
    // is on and `credits off` for a credits seat while it is off
    // (specs/069-usage-credits, specs/070 FR-005).
    usageCredits: reading({ value: usageCredits && usageCredits.pct !== null ? usageCredits : null, at: now, source: "cache" }),
    accountKind: reading({ value: accountKind, at: now, source: "payload" }),
    account: reading({ value: accountIdentity, at: now, source: "cache" }),
    creditsTrend: reading({ value: creditsMotion, at: now, source: "cache" }),
    promptCache: reading({ value: getPromptCache(payload, now), at: now, source: "payload" }),
    update: updateReading,
    // Only present when vim mode is on; a mode that is not text is no mode.
    vim: reading({ value: payloadText(payload?.vim?.mode), at: now, source: "payload" }),
    fastMode: reading({ value: payload?.fast_mode === true ? true : null, at: now, source: "payload" }),
    // Which agent sent this payload, and the two figures only Copilot sends
    // (specs/029-multi-harness).
    harness: reading({ value: detectHarness(payload), at: now, source: "payload" }),
    premiumRequests: reading({
      value: Number.isFinite(payload?.cost?.total_premium_requests) && payload.cost.total_premium_requests > 0 ? payload.cost.total_premium_requests : null,
      at: now,
      source: "payload",
    }),
    allowAll: reading({ value: payload?.allow_all_enabled === true ? true : null, at: now, source: "payload" }),
    // The AI credits Copilot reports, and the session limit its log records
    // (specs/033-copilot-parity). Only once some were used, like the premium
    // requests beside it.
    aiCredits: reading({ value: isCopilot ? aiCreditsOf(payload, activity.value?.sessionLimit) : null, at: now, source: "payload" }),
    // The account's monthly quota, from the cache the detached refresh fills.
    // Never read under Claude Code: reading it is what starts the lookup.
    copilotQuota: isCopilot
      ? off?.has("premiumQuota") && off?.has("chatQuota")
        ? missing("cache", "switched off")
        : probe.getCopilotQuota
        ? timed("cache", () => probe.getCopilotQuota({ now }))
        : missing("cache", "no reader")
      : missing("cache", "Copilot CLI only"),
    // A Codex window with no chip of its own, such as the free plan's 30 days,
    // and the credit balance, both from the rollout (specs/037-codex-windows).
    // Shown whenever the fields are present, like Copilot's own; Claude Code
    // and Copilot send neither, so under them both are absent.
    codexWindow: reading({ value: codexWindowsOf(payload), at: now, source: "payload" }),
    codexCredits: reading({ value: codexCreditsOf(payload), at: now, source: "payload" }),
    rtk: rtkReading,
    samples: reading({ value: sampleHistory, at: now, source: "samples" }),
  };
}

/**
 * A payload field that is supposed to be text, or nothing.
 *
 * Claude Code sends well-typed payloads, so this is not about what it does
 * send — it is about what reaches the bar when something upstream changes
 * shape. A field that arrives as an object interpolates as the literal
 * `[object Object]`, and a boolean as `true`: both render as confident,
 * meaningless text in a place a reader trusts. That has happened once here
 * already, when a refresh wrapped a numeric value in a branch object and the
 * bar spent a day showing `[object Object]` for the rtk savings.
 *
 * Control characters go with it, through `plainText`: a newline in a value
 * decided how many lines the bar had, and a raw escape in one was a command
 * the terminal ran.
 *
 * Anything that is not a string becomes null so the caller's fallback runs,
 * which is how an unknown field is meant to be handled everywhere else on
 * the bar. Numbers included: a model named `42` is a payload defect, and
 * `Claude` is a better answer than `42`.
 */
function payloadText(value) {
  return plainText(value);
}

/**
 * Copilot CLI's AI credits for this session, or null before any were used
 * (specs/033-copilot-parity). The figure is Copilot's own `formatted` string,
 * so it reads the way Copilot's footer prints it; nano-AIU over 1e9 is the
 * unit the session limit is set in, and only used for the share of it.
 */
/**
 * A reset as a day and a time in this computer's zone: `14:30` today,
 * `tmrw 14:30`, else `nov 20 14:30`. The date is spelled with its month, as
 * specs/047 asks, and keeps its time because a monthly cap is planned
 * around a date and an hour (specs/071, FR-009).
 */
export function resetDayAndTime(resetsAtSeconds, now = Date.now()) {
  const near = resetMomentLabel(resetsAtSeconds, new Date(now));
  if (near === null) return null;
  if (!/^[a-z]{3} \d/.test(near) || /^tmrw /.test(near)) return near;
  const d = new Date(resetsAtSeconds * 1000);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${months[d.getMonth()]} ${d.getDate()} ${hhmm}`;
}

/** An age in the shortest unit that is not zero: `2d`, `5h`, `20m` (specs/074). */
export function ageLabel(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** `+++`, `++`, `+` from a model's name, or null for a name the table does not know (specs/071). */
export function modelTierOf(name) {
  const n = String(name ?? "").toLowerCase();
  if (/opus|fable|mythos/.test(n)) return "+++";
  if (/sonnet/.test(n)) return "++";
  if (/haiku/.test(n)) return "+";
  return null;
}

function aiCreditsOf(payload, limit) {
  const nano = payload?.ai_used?.total_nano_aiu;
  if (typeof nano !== "number" || !Number.isFinite(nano) || nano <= 0) return null;
  const used = nano / 1e9;
  const formatted = plainText(payload?.ai_used?.formatted) ?? used.toFixed(2);
  const max = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null;
  return { formatted, used, max, pct: max === null ? null : Math.round((used / max) * 100) };
}

/** A credit count the way a person writes one: `20`, `12.5`. */
function creditCount(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/**
 * Renders a payload that's already parsed. `sources` exists so the preview
 * generator can supply fixed git/PR/skill/rtk values instead of probing the
 * real machine — previews must be reproducible, and they'd otherwise show
 * whatever branch and usage happened to be live when they were generated.
 * Runtime always uses the real probes (the defaults below).
 */
export function renderPayload(
  payload,
  {
    asciiArrows = false,
    flavor = "mocha",
    sources = {},
    trackChanges: tracking = true,
    now = Date.now(),
    // Both default to what the terminal reports: `COLUMNS` and `LINES` under
    // Claude Code, `/dev/tty` under Copilot, which sets neither
    // (specs/033-copilot-parity). A caller that passes them is a test or a
    // preview, where the point is a fixed size.
    maxWidth = null,
    maxHeight = null,
    // A test or a preview passes its own; a real redraw finds the person's
    // file for itself.
    layout = null,
    // A fixed sample history, for a caller that has no session state to read
    // one from. A real redraw leaves this alone and uses its own.
    samples = null,
    // See `renderReadings`: false leaves out the rows after the bar.
    trailingRows = true,
  } = {}
) {
  const probe = {
    getGitInfo,
    isRepo: isRepository,
    getPrInfo,
    getPrLookupFailed,
    getRemoteUrl,
    getActiveSkills,
    getActiveSkillsTrueCount,
    subagentActivity,
    getSessionActivity,
    getCiStatus,
    getRtkSavings,
    getDirUrl: (cwd) => getOpenTabUrl(cwd) || getDirUrl(cwd),
    maybeStartUpdateCheck,
    getUpdateNotice,
    getGateRuns: readGateRuns,
    // Copilot CLI only (specs/033-copilot-parity): its terminal, its settings
    // file and its account's monthly quota. None of them is asked for under
    // Claude Code.
    readTty: readTtySize,
    copilotSettings: loadCopilotSettings,
    getCopilotQuota,
    getAccountKind,
    noteAccountKind,
    // The usage credits Claude Code cached for a seat billed by usage
    // (specs/069-usage-credits): one local file read, never a fetch.
    getUsageCredits: readUsageCredits,
    // The repository's alerts and the branch's standing (specs/074).
    getAlerts,
    getBranchMeta,
    // The session's totals from its transcript (specs/073).
    getSessionTotals,
    // The help page beside the code, when this copy has it (specs/078).
    getHelpPage: () => (existsSync(HELP_PAGE) ? HELP_PAGE : null),
    // The MCP servers configured here, and how many distinct skills the
    // session has used (specs/075).
    getMcpServers: (cwd) => countMcpServers(cwd),
    getSkillSessionCount: (sessionId) => (sessionId ? readSkillEventsTrueCount(sessionId, { windowMs: Number.POSITIVE_INFINITY }) : 0),
    // Who is signed in, and the credits' own history (specs/071).
    getAccountIdentity: readAccountIdentity,
    creditsTrend,
    ...sources,
  };

  const cwd = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  const found = layout ?? resolveLayout(cwd);
  const harness = detectHarness(payload);
  // Read once: the padding sizes the bar and the effort level is a fallback.
  const copilotSettings = harness === "copilot" ? (probe.copilotSettings?.() ?? {}) : null;
  const size =
    maxWidth === null || maxHeight === null
      ? terminalFor(harness, { readTty: probe.readTty, settings: copilotSettings })
      : null;
  // What the host said about the window and what the terminal says, side by
  // side, so the rule that picks the width can be checked against a real
  // session (specs/079, FR-010). Debug only, and never allowed to fail a redraw.
  if (process.env.CLAUDE_STATUSLINE_DEBUG === "1" && canWrite()) {
    try {
      let tty = null;
      try {
        tty = (probe.readTty ?? readTtySize)();
      } catch {
        tty = null;
      }
      const dir = stateRoot();
      mkdirSync(dir, { recursive: true });
      const record = {
        at: new Date(now).toISOString(),
        harness,
        COLUMNS: process.env.COLUMNS ?? null,
        LINES: process.env.LINES ?? null,
        TERM_PROGRAM: process.env.TERM_PROGRAM ?? null,
        tty,
        chosen: (({ columns, rows, source }) => ({ columns, rows: Number.isFinite(rows) ? rows : "all", source }))(
          size ?? { columns: maxWidth, rows: maxHeight, source: "caller" }
        ),
      };
      writeFileSync(path.join(dir, "debug-last-env.json"), JSON.stringify(record, null, 2) + "\n");
    } catch {
      // debug-only
    }
  }

  // What the arrangement switched off, so gather can skip a source whose
  // only reader is a segment nobody will see.
  const off = new Set(
    resolveArrangement(SEGMENTS, found.arrangement, found.origin).placements.filter((p) => p.on === false).map((p) => p.key)
  );
  const readings = gather(payload, harnessProbes(probe, harness, payload), { now, off, copilotSettings });
  return renderReadings(readings, payload, {
    asciiArrows,
    flavor,
    tracking,
    now,
    maxWidth: maxWidth ?? size.columns,
    maxHeight: maxHeight ?? size.rows,
    arrangement: found.arrangement,
    arrangementOrigin: found.origin,
    samples,
    trailingRows,
  });
}

/** Turns readings into the lines. Split out so the diagnostic can reuse `gather`. */
export function renderReadings(
  readings,
  payload,
  {
    asciiArrows = false,
    flavor = "mocha",
    tracking = true,
    now = Date.now(),
    // The real terminal, when Claude Code tells us what it is. The old
    // constant survives as the fallback for versions that do not.
    maxWidth = terminalWidth(),
    maxHeight = terminalHeight(),
    // The diagnostic asks for the lines with their line numbers attached, so
    // it can say "line 3" rather than "the second thing printed". With line 2
    // absent those are different lines, and the diagnostic exists to explain
    // the layout rather than to renumber it.
    asRows = false,
    // Every segment this session would draw, before any of them are arranged
    // into rows or dropped for width. The composer page is built from this:
    // it rearranges real segments rather than approximating them, so a bar it
    // shows cannot differ from the bar the terminal draws.
    asPool = false,
    // A sample history to compute the burn rate and the projection from,
    // instead of the one on disk. Only a generator passes this; a real
    // redraw has its own history and must not be told a different one.
    samples: sampleOverride = null,
    // The person's own bar: which segments are on, in what order, on which
    // line, against which edge. Nothing means the registry, unchanged.
    arrangement = null,
    // Where that arrangement came from, carried through for the diagnostic.
    arrangementOrigin = "default",
    // The rows that follow the bar: Copilot's subagents and the git gates. A
    // caller that composes only the bar's own segments, as the composer page
    // does, leaves them out; an arrangement can move a segment, not a row.
    trailingRows = true,
  } = {}
) {
  // The segment key decides the maximum age; the reading name says where
  // to look. They differ for the git snapshot, which three segments share.
  const shows = (key, name = key) => isRenderable(key, readings[name], now);

  const git = shows("branch", "git") ? readings.git.value : null;
  const pr = shows("pr") ? readings.pr.value : null;
  const remoteUrl = shows("remote") ? readings.remote.value : null;
  const skills = shows("skills") ? readings.skills.value : [];
  const rtkPct = shows("rtk") ? readings.rtk.value : null;
  const modelName = shows("model") ? readings.model.value : "Claude";
  const effort = shows("effort") ? readings.effort.value : null;
  const outputStyle = shows("outputStyle") ? readings.outputStyle.value : null;
  const dirLabel = readings.dir.value;
  const dirUrl = shows("dir", "dirUrl") ? readings.dirUrl.value : null;

  // The usage figures are the one place an absent value keeps its slot:
  // Principle III and FR-010 require `?%` rather than a segment that
  // quietly disappears, so a reader can tell "unknown" from "moved".
  const ctxPct = readings.context.value;
  const fiveHourPct = readings.fiveHour.value;
  const sevenDayPct = readings.sevenDay.value;
  const fiveHourResetsAt = readings.fiveHourReset.value;
  const sevenDayResetsAt = readings.sevenDayReset.value;
  // Absent is the normal state here, so unlike the two windows it gets no
  // `?%`: most accounts have no spend limit at all (Principle III).
  const spendLimitPct = readings.spendLimit?.value ?? null;
  const spendLimitResetsAt = readings.spendLimitReset?.value ?? null;
  const spendUsd = readings.spendLimitUsd?.value ?? null;
  const promptCache = readings.promptCache?.value ?? null;
  const fiveHourResetLabel = formatResetCountdown(fiveHourResetsAt, now) ?? "reset time unknown";
  const sevenDayResetLabel = formatResetCountdown(sevenDayResetsAt, now) ?? "reset time unknown";

  // Only discrete state feeds change tracking — usage percentages tick on
  // almost every render and would leave the line permanently animated.
  // The sample history was already built in `gather` so the diagnostic can
  // report it without duplicating the work; change tracking just persists it.
  const changes = trackChanges(
    payload?.session_id,
    {
      branch: git?.branch ?? null,
      ahead: git && git.ahead !== null ? String(git.ahead) : null,
      behind: git && git.behind !== null ? String(git.behind) : null,
      pr: pr ? `${pr.number}:${pr.state}:${pr.isDraft}` : null,
      ci: readings.ci?.value ? `${readings.ci.value.status}:${readings.ci.value.conclusion}` : null,
      skills: skills.join(","),
      model: modelName,
      effort: effort ?? "",
    },
    {
      enabled: tracking,
      now,
      samples: readings.samples.value,
    }
  );

  // Sampling normally rides the session's own state file. A generated page
  // has no session, so it brings its own history rather than showing a bar
  // with two segments permanently missing.
  const sampleHistory = sampleOverride ?? readings.samples.value;

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const { tier } = iconTier({ asciiArrows });
  const g = { ...GLYPHS[tier] };
  // Three events that deserve a picture even in the Nerd Font tier. Opt-in,
  // and the emoji are the ones the constitution names (Principle X).
  const eventEmoji = tier === "nerd" && process.env.CLAUDE_STATUSLINE_EVENT_EMOJI === "1";
  if (eventEmoji) {
    g.conflict = GLYPHS.emoji.conflict;
    g.updateDone = GLYPHS.emoji.updateDone;
  }
  // Skill names are joined by the thin round separator in the Nerd Font tier,
  // and by a comma where that glyph cannot be drawn (specs/050-catalog-gaps).
  const skillJoin = tier === "nerd" ? " \u{E0B5} " : ", ";
  // The band mark is a coloured circle in the emoji tier, where the rest of
  // the line is already pictures.
  // A figure keeps its width: a percentage is padded to three characters with
  // U+2007 FIGURE SPACE, so the chips after it do not move when it crosses 10
  // or 100 (specs/044-chip-copy). `?` is padded the same, so the chip does not
  // shift when the value arrives.
  const pad3 = (n) => `${"\u2007".repeat(Math.max(0, 3 - String(n).length))}${n}`;
  // The main figure of a chip is bold, and its reset and units recede
  // (specs/044-chip-copy). Three markers that `renderRow` turns into weight
  // and colour; the pool and the width measure see none of them.
  const strong = (s) => `${STRONG}${s}${MARK_OFF}`;
  const quiet = (s) => `${QUIET}${s}${MARK_OFF}`;
  // A reset under ten minutes away on a window that is nearly gone is good
  // news, and is the one countdown drawn in the healthy colour.
  const good = (s) => `${GOOD}${s}${MARK_OFF}`;
  const minutesToReset = (resetsAtSeconds) =>
    typeof resetsAtSeconds === "number" ? (resetsAtSeconds * 1000 - now) / 60_000 : null;
  const figure = (n) => strong(`${pad3(n)}%`);
  // A gauge's own pieces (specs/046-gauges). The track needs a Nerd Font, so
  // the other two tiers draw it from the plain set. The band is a mark before
  // the number in the critical band and a bold number in the warn band, and
  // the emoji tier writes the same band as a coloured circle.
  const trackSet = tier === "nerd" ? GLYPHS.nerd : GLYPHS.plain;
  const gaugeFigure = (pct, band) => {
    if (typeof pct !== "number" || !Number.isFinite(pct)) return quiet(`${"\u2007\u2007"}\u2014`);
    const number = `${pad3(pct)}%`;
    // The critical mark takes the place of the figure space when it is one
    // column wide, so the chip does not move when a figure turns critical.
    if (band === "critical") {
      const padded = pad3(pct);
      const rest = displayWidth(g.bandCritical) === 1 ? padded.replace(/^\u2007/, "") : padded;
      return `${g.bandCritical}${rest}%`;
    }
    if (band === "warn") return `${g.bandWarn}${strong(number)}`;
    return number;
  };
  // How much of a window has gone, from where its reset is: null when the
  // reset is unknown or past, or further out than the window is long.
  const elapsedPct = (resetsAtSeconds, windowMinutes) => {
    if (typeof resetsAtSeconds !== "number" || !Number.isFinite(resetsAtSeconds)) return null;
    const length = windowMinutes * 60_000;
    const remaining = resetsAtSeconds * 1000 - now;
    if (remaining < 0 || remaining > length * 1.02) return null;
    return Math.max(0, Math.min(100, (1 - remaining / length) * 100));
  };
  const paceNote = (pace, pct) =>
    typeof pace === "number" && pace > 5 && !(pct >= 100) ? ` ${quiet(`+${pace}pp`)}` : "";
  /**
   * The text and shorter forms of a gauge chip: icon, label, track, figure
   * and the pace, then (when there is one) its reset. The width guard drops
   * the track first, then the reset; the figure is last to go.
   */
  const gaugeChipText = ({ icon, label, pct, band, pace, reset = null, full = "", resetsAt = null }) => {
    const head = ` ${icon} ${label ? `${label} ` : ""}`;
    const fig = `${gaugeFigure(pct, band)}${full}${paceNote(pace, pct)}`;
    const withTrack = `${head}${track(pct, trackSet)} ${fig}`;
    const noTrack = `${head}${fig}`;
    const left = minutesToReset(resetsAt);
    const relief = band === "critical" && left !== null && left > 0 && left < 10;
    const tail = reset ? ` ${(relief ? good : quiet)(`${g.reset} ${reset}`)}` : "";
    const variants = reset ? [`${noTrack}${tail} `, `${noTrack} `] : [`${noTrack} `];
    return { text: `${withTrack}${tail} `, variants };
  };
  // Effort is a level, so its glyph fills with it. A level the table does not
  // name (`xhigh`, `max`, whatever a harness sends) is at least high.
  const effortGlyph = (level) =>
    ({ low: g.effortLow, medium: g.effortMedium, high: g.effortHigh })[String(level).toLowerCase()] ?? g.effortHigh;

  // The rows that follow the bar: Copilot's subagents (specs/030) and the git
  // gates (specs/031). Counted here because the gates fall back to a line 1
  // chip when the bar's three lines and the rows would not fit the window.
  const isCopilot = readings.harness?.value === "copilot";
  const agentList = isCopilot && Array.isArray(readings.agents?.value) ? readings.agents.value : [];
  const gateRuns = shows("gates") && Array.isArray(readings.gates?.value) ? readings.gates.value : [];
  const gateHere = hereOf(gateRuns, readings.cwd);
  const gateRowCount = gateRuns.length ? Math.min(gateRuns.length, GATE_ROW_CAP) + (gateRuns.length > GATE_ROW_CAP ? 1 : 0) : 0;

  // The Powerline arrow needs a Powerline font. Choosing the emoji tier says
  // there may be none, so it takes the plain arrow unless a separator was
  // named: declared rather than assumed, as the plain separator rule asks.
  const opts = { asciiArrows: asciiArrows || (tier === "emoji" && !process.env.CLAUDE_STATUSLINE_SEPARATOR), width: maxWidth };
  const roundStyle = separatorStyle(opts) === "round";
  const widePadding = String(process.env.CLAUDE_STATUSLINE_PADDING ?? "").toLowerCase() === "wide" && separatorStyle(opts) === "arrow";
  // The rows are kept as segment lists until every line exists, because
  // aligning the first column across the bar needs all of them at once.
  // Rendering each line to text as it was built is what left that alignment
  // written but never applied.
  const rows = [];
  // Which of the four each rendered row is. Shedding needs to know, and a
  // line that renders only sometimes made an index-based guess wrong.
  const rendered = [];
  // Every segment built this render, in build order, each recorded once.
  // Filled from `fit` because that is the single point every line's content
  // passes through before anything is dropped.
  const pool = [];
  const pooled = new Set();

  // Where every segment goes: the registry, with the person's own choices
  // over the top of it. With no arrangement this resolves to the registry
  // unchanged, which is what keeps the default bar byte-identical.
  const resolved = resolveArrangement(SEGMENTS, arrangement, arrangementOrigin);
  const placements = new Map(resolved.placements.map((p) => [p.key, p]));

  /**
   * The placement for a built segment. A skill chip has no registry row of
   * its own, so it inherits the one its key is prefixed with.
   */
  const placementFor = (key) => placements.get(key) ?? placements.get(String(key).split(":")[0]);

  /**
   * Attaches each descriptor's placement, so position and priority both come
   * from one resolved answer rather than from the order the code happened to
   * push things in.
   */
  const attach = (seg) => {
    const meta = placementFor(seg.key);
    const registryRow = segment(seg.key) || segment(String(seg.key).split(":")[0]);
    return {
      priority: meta?.priority ?? registryRow?.priority ?? 50,
      order: meta?.order ?? registryRow?.order ?? 999,
      line: meta?.line ?? registryRow?.line ?? 1,
      ...registryRow,
      ...(meta ?? {}),
      ...seg,
    };
  };

  /** Drops the least important segments until the row fits the terminal. */
  const fitRow = (row) => fitToWidth(row, maxWidth);

  /** Records a segment in the pool once, whatever the arrangement does to it. */
  const collect = (segs) => {
    for (const seg of segs) {
      if (pooled.has(seg.key)) continue;
      pooled.add(seg.key);
      const plain = (s) => String(s).replace(/[\u0001-\u0006]/g, "");
      pool.push({
        key: seg.key,
        text: plain(seg.text),
        color: seg.color,
        ...(seg.icon ? { icon: seg.icon } : {}),
        ...(seg.tone ? { tone: seg.tone } : {}),
        ...(seg.alignRight ? { alignRight: true } : {}),
        ...(seg.url ? { url: seg.url } : {}),
        // The composer page fits with the same `fitToWidth`, so a segment's
        // shorter forms travel with it or the page would drop what the
        // terminal only shortens.
        ...(seg.variants ? { variants: seg.variants.map(plain) } : {}),
        ...(seg.iconLast ? { iconLast: true } : {}),
      });
    }
  };

  // Line 1: working directory, then branch, ahead/behind, PR — each name
  // is an OSC 8 hyperlink when a target is known (dir -> file://, branch ->
  // GitHub tree view, PR -> PR page), with no visible URL text.
  const atHome = (() => {
    try {
      return Boolean(readings.cwd) && path.resolve(readings.cwd) === path.resolve(os.homedir());
    } catch {
      return false;
    }
  })();
  const dirGlyph = atHome ? g.home : g.dir;
  const dirSegment = (label) => ({
    key: "dir",
    color: ROLE.neutral,
    text: ` ${dirGlyph} ${label} `,
    // Last step: the icon alone, so the chip never has to disappear (F57).
    variants: [` ${dirGlyph} `],
    iconLast: true,
    url: dirUrl,
  });
  const l1 = [dirSegment(dirLabel)];

  // A17: Claude can move during a session, and then the directory on the bar
  // is not the directory the session started in. Both render only when they
  // differ, because in most sessions they do not.
  const projectDir = shows("projectDir") ? readings.projectDir.value : null;
  if (projectDir && projectDir !== readings.cwd) {
    l1.push({
      key: "projectDir",
      color: ROLE.neutral,
      text: ` ${g.from} ${getDirLabel(projectDir)} `,
      url: pathToFileUrl(projectDir),
    });
  }
  if (git) {
    const detached = git.detached === true || git.branch === "(detached)";
    // The prefix is abbreviated and a long name is cut in the middle, where
    // two branches differ. The link still goes to the full name.
    const prefixes = repoConfig(readings.cwd || process.cwd()).branchPrefixes ?? DEFAULT_BRANCH_PREFIXES;
    const label = detached
      ? git.oid?.slice(0, 7) || "detached"
      : cutMiddle(abbreviateBranch(git.branch, prefixes), BRANCH_COLUMNS);
    // A detached HEAD is a commit, not a branch. Linking it to a tree view
    // and drawing a branch icon beside it would say otherwise.
    // Encoded a path segment at a time: a `#` or a `%` in a branch name is
    // part of the name, and the slashes are the tree view's own.
    const branchUrl =
      !detached && remoteUrl ? `${remoteUrl}/tree/${git.branch.split("/").map(encodeURIComponent).join("/")}` : null;
    // Working on the default branch is a state to see (specs/074, item 39):
    // the chip turns critical and the name takes a mark.
    const meta = readings.branchMeta?.value ?? null;
    const onDefault = !detached && typeof meta?.defaultBranch === "string" && meta.defaultBranch === git.branch;
    l1.push({
      key: "branch",
      color: onDefault ? ROLE.critical : ROLE.identity,
        emphasis: changes.isChanged("branch"),
      text: ` ${detached ? g.commit : g.branch} ${label}${onDefault ? "!" : ""} `,
      variants: [` ${detached ? g.commit : g.branch} `],
      iconLast: true,
      url: branchUrl,
    });
    // Working-tree state and divergence from upstream, right after the
    // branch. Each count is omitted when it's zero, so a clean branch in
    // sync with its upstream adds nothing to the line at all.
    const state = [];
    // File counts are not animated: they change on every save, and
    // Principle X reserves animation for state that changes discretely.
    if (git.changed) state.push(`${WARM}${g.modified} ${git.changed}${MARK_OFF}`);
    // Staged and removed files, from the same status read (specs/050).
    if (git.staged) state.push(`${GOOD}${g.added} ${git.staged}${MARK_OFF}`);
    if (git.removed) state.push(`${g.removed} ${git.removed}`);
    if (git.untracked) state.push(`${g.untracked} ${git.untracked}`);
    // A null ahead/behind means there is no upstream at all, which is not
    // the same as being in sync with one (FR-012).
    if (git.ahead) state.push(`${g.push} ${git.ahead}`);
    if (git.behind) state.push(`${BEHIND}${g.pull} ${git.behind}${MARK_OFF}`);
    if (state.length) {
      l1.push({ key: "worktreeState", color: ROLE.neutral, text: ` ${state.join("  ")} ` });
    } else if (git.changed === 0 && git.untracked === 0 && !git.conflicts && git.ahead !== null && git.behind !== null) {
      // A tree that is clean and in step with its upstream says so, in the
      // one place a failed read draws nothing (specs/048-state-feedback).
      l1.push({ key: "worktreeState", color: ROLE.neutral, icon: ROLE.healthy, text: ` ${g.clean} ` });
    }
    // How old the branch is (specs/074): since its first commit past the
    // default branch, once it is an hour old.
    const branchAgeMs = !detached && shows("branchAge", "branchMeta") && typeof meta?.firstCommitAt === "number" ? now - meta.firstCommitAt * 1000 : 0;
    if (branchAgeMs >= 3_600_000) {
      l1.push({ key: "branchAge", color: ROLE.neutral, text: ` ${g.calendar} ${ageLabel(branchAgeMs)} ` });
    }
    // A2's chosen form: owner and repo as text. It repeats the directory in
    // a repository whose folder is named after it, and says something the
    // directory cannot in one that is not.
    const repo = shows("repo") ? readings.repo.value : null;
    if (repo?.owner && repo.name) {
      //
      // On the directory chip's own background, in a quieter text colour.
      // `surface1` and `surface2` are 1.3:1 to 1.4:1 apart in every palette,
      // an edge nobody can see, so the two read as one block with one
      // label dimmer than the other (specs/040-contrast).
      l1.push({
        key: "repo",
        color: ROLE.neutral,
        text: ` ${g.repo} ${repo.owner}/${repo.name} `,
        quiet: true,
        url: remoteUrl,
      });
    }
    // B10: closes the loop after a push without leaving the terminal. It is
    // a cached value by construction, and disappears rather than going
    // stale, because a green tick ten minutes old is worse than none.
    const ci = shows("ci") ? readings.ci.value : null;
    if (ci) {
      const running = ci.status && ci.status !== "completed";
      const passed = ci.conclusion === "success";
      // A run that was skipped or cancelled did not fail: it says so in its
      // own mark instead of drawing the failure (specs/054).
      const skipped = !running && ["skipped", "cancelled", "neutral"].includes(ci.conclusion);
      const mark = running ? g.ciRunning : passed ? g.ciPass : skipped ? g.ciSkipped : g.ciFail;
      const icon = running ? ROLE.modified : passed ? ROLE.healthy : skipped ? undefined : ROLE.critical;
      // The runs for the branch you are on, not the repository's most recent:
      // scoping the link the same way the segment scopes its answer is what
      // stops a click landing on main's green tick from a branch you never
      // pushed.
      const runs =
        remoteUrl && !detached && git.branch
          ? `${remoteUrl}/actions?query=${encodeURIComponent(`branch:${git.branch}`)}`
          : remoteUrl;
      l1.push({
        key: "ci",
        color: ROLE.neutral,
        icon,
        text: ` ${mark} ${ci.workflow ?? "CI"} `,
        variants: [` ${mark} `],
        emphasis: changes.isChanged("ci"),
        url: runs ?? undefined,
      });
    }
    // The repository's open alerts (specs/074): Dependabot and code scanning.
    const alerts = shows("alerts") ? readings.alerts?.value : null;
    if (alerts?.total > 0) {
      l1.push({ key: "alerts", color: ROLE.attention, text: ` ${g.conflict} alerts ${alerts.total} `, variants: [` ${g.conflict} ${alerts.total} `], url: remoteUrl ? `${remoteUrl}/security` : undefined });
    }
    // What this session changed, which is a different question from what the
    // working tree looks like: the payload counts it, git does not. It sits
    // beside the tree counters because that is where the eye looks for a
    // diff stat.
    const sessionCost = shows("linesChanged", "sessionCost") ? readings.sessionCost.value : null;
    if (sessionCost && (sessionCost.linesAdded !== null || sessionCost.linesRemoved !== null)) {
      l1.push({
        key: "linesChanged",
        color: ROLE.neutral,
        icon: ROLE.healthy,
        text: ` +${sessionCost.linesAdded ?? 0} −${sessionCost.linesRemoved ?? 0} `,
      });
    }
    // B8: an unmerged path stops everything until it is resolved, which is
    // not what an ordinary changed file means.
    if (git.conflicts) {
      l1.push({ key: "conflicts", color: ROLE.critical, text: ` ${g.conflict} ${git.conflicts} ` });
    }
    // A19: which worktree, and what it came from. The branch name alone does
    // not always say, and a worktree is exactly when you need to be sure.
    const worktree = shows("worktree") ? readings.worktree.value : null;
    if (worktree) {
      const from = worktree.from ? ` ${g.from} ${worktree.from}` : "";
      l1.push({ key: "worktree", color: ROLE.neutral, text: ` ${g.worktree} ${worktree.name}${from} ` });
    }
    if (!pr && readings.prUnavailable?.value) {
      // Dim, with no number: the lookup did not run, which is not the same
      // answer as there being nothing to find.
      l1.push({ key: "pr", color: ROLE.neutral, quiet: true, text: ` ${g.pr} ` });
    }
    if (pr) {
      // `changes_requested` is the one review state too long to spell out on
      // a line this tight, and "changes" says it.
      const review = pr.review === "changes_requested" ? "changes" : pr.review;
      const label = pr.kind === "mr" ? "MR" : "PR";
      // The state is drawn, not only worded: a draft, a merged and a closed
      // request each have their own mark, and the review word carries its own
      // beside it. Where the source gave no state the request is open.
      const prGlyph =
        { draft: g.prDraft, merged: g.prMerged, closed: g.prClosed }[pr.prState ?? pr.review] ?? g.pr;
      const reviewGlyph =
        { approved: g.reviewApproved, commented: g.reviewComments, review_required: g.reviewRequested }[pr.review] ?? null;
      const reviewMark = reviewGlyph ? `${reviewGlyph} ` : "";
      // The count of comments, beside its own glyph, where the source has one.
      const commentMark = pr.comments ? ` ${g.reviewComments} ${pr.comments}` : "";
      // Same "show a few, count the rest" shape as the skills chip: a PR
      // with zero labels must render exactly as before this field existed
      // (specs/006, FR-003), so the suffix is only ever added, never a
      // placeholder for the empty case.
      const prLabels = pr.labels ?? [];
      const shownLabels = prLabels.slice(0, 3);
      const hiddenLabels = Math.max(0, prLabels.length - shownLabels.length);
      const labelText = shownLabels.length
        ? ` ${shownLabels.join(", ")}${hiddenLabels > 0 ? ` +${hiddenLabels}` : ""}`
        : "";
      l1.push({
        key: "pr",
        color: String(pr.state).toUpperCase() === "MERGED" ? ROLE.merged : ROLE.open,
        emphasis: changes.isChanged("pr"),
        text: ` ${prGlyph} ${label} #${pr.number}${review ? ` ${reviewMark}${review}` : ""}${commentMark}${labelText} `,
        variants: [` ${prGlyph} #${pr.number}${reviewGlyph ? ` ${reviewGlyph}` : review ? ` ${review}` : ""} `],
        url: pr.url,
      });
      // What decides the next step (specs/074-pr-state), each its own chip
      // so the width guard drops them one at a time: the merge state, the
      // checks, the reviewers awaited and the threads open, the size and age.
      const open = !["merged", "closed", "draft"].includes(pr.prState ?? "");
      const mergeWord = { BLOCKED: ["blocked", ROLE.critical], DIRTY: ["conflicts", ROLE.critical], BEHIND: ["behind", ROLE.attention], CLEAN: ["mergeable", ROLE.healthy], HAS_HOOKS: ["mergeable", ROLE.healthy], UNSTABLE: ["mergeable", ROLE.attention] }[pr.mergeState ?? ""];
      if (open && mergeWord && shows("prMerge", "pr")) {
        const auto = pr.autoMerge ? " \u00b7 automerge" : "";
        l1.push({ key: "prMerge", color: mergeWord[1], text: ` ${mergeWord[0]}${auto} `, ...(auto ? { variants: [` ${mergeWord[0]} `] } : {}) });
      }
      const checks = pr.checks;
      if (checks && shows("prChecks", "pr")) {
        const parts = [checks.ok ? `${g.ciPass}${checks.ok}` : null, checks.failed ? `${g.ciFail}${checks.failed}` : null, checks.running ? `${g.ciRunning}${checks.running}` : null].filter(Boolean);
        const bare = ` ${parts.join(" ")} `;
        const name = checks.failed && checks.failedName ? ` ${parts.join(" ")} \u00b7 ${cutMiddle(checks.failedName, 24)} ` : null;
        l1.push({ key: "prChecks", color: ROLE.neutral, icon: checks.failed ? ROLE.critical : checks.running ? ROLE.modified : ROLE.healthy, text: name ?? bare, ...(name ? { variants: [bare] } : {}) });
      }
      const awaiting = pr.awaiting > 0 ? `${pr.awaiting} awaiting` : null;
      const threads = pr.threads > 0 ? `${pr.threads} threads` : null;
      if (open && (awaiting || threads) && shows("prReview", "pr")) {
        l1.push({ key: "prReview", color: ROLE.open, text: ` ${g.account} ${[awaiting, threads].filter(Boolean).join(" \u00b7 ")} ` });
      }
      if (typeof pr.additions === "number" && typeof pr.deletions === "number" && shows("prSize", "pr")) {
        const age = pr.createdAt ? ageLabel(now - Date.parse(pr.createdAt)) : null;
        const size = `+${pr.additions} \u2212${pr.deletions}`;
        const files = typeof pr.changedFiles === "number" ? ` \u00b7 ${pr.changedFiles}f` : "";
        l1.push({ key: "prSize", color: ROLE.neutral, text: ` ${size}${files}${age ? ` \u00b7 ${age}` : ""} `, variants: [` ${size} `] });
      }
    }
  }
  // The statusline's own update state, in or out of a repository: it is about
  // the install, not the directory (specs/026-update-check). One colour, since
  // the channel is identity; the icon and the words say which state it is.
  const update = shows("update") ? readings.update?.value : null;
  if (update?.text) {
    // Only a waiting update is the new box: blocked and failed are the
    // download mark, so a failed install never reads as good news (specs/054).
    const icon =
      update.state === "updated" ? g.updateDone : update.state === "ready" ? g.updateReady : g.updateBlocked;
    // At the right edge of the line, and the first chip to go. Its words are
    // the first thing it gives up, which leaves the icon: the state is the
    // glyph, and the sentence is for a line with room (specs/045).
    // The icon alone (specs/048): the sentence is in `doctor`, which prints
    // what the check found, and the bar's line 1 is not the place for it.
    l1.push({ key: "update", color: ROLE.neutral, alignRight: true, text: ` ${icon} ` });
  }
  // The git gates running in this repository (specs/031-git-gate-rows): a
  // count here, and a row each after the bar when the window has room.
  if (gateRuns.length) {
    const chip = gateChip(gateRuns, { now, here: gateHere, glyphs: g });
    if (chip) l1.push({ key: "gates", ...chip });
  }
  // What every line is built from, before the arrangement decides where any
  // of it goes. Content and placement are two questions, and keeping them
  // apart is what lets a segment move to another line without its builder
  // knowing anything about it.
  const content = [...l1];

  // F7 and F6, on the line that already describes what the session is doing.
  // Both come from the transcript pass that already runs for the skills.
  const activity = shows("activity") ? readings.activity.value : null;
  function pushLine2Extras(row) {
    if (activity?.todos) {
      const { done, total, current } = activity.todos;
      const label = current ? `${current} (${done}/${total})` : `${done}/${total}`;
      row.push({ key: "todo", color: ROLE.cold, text: ` ${g.todo} ${label} ` });
    }
    // The editor's vim mode, beside what the session is doing. Absent unless
    // vim mode is on (specs/027-bar-polish).
    // The MCP servers configured for this session (specs/075).
    const mcp = shows("mcp") ? readings.mcp?.value : null;
    if (mcp?.count > 0) row.push({ key: "mcp", color: ROLE.neutral, text: ` ${g.mcp} mcp ${strong(String(mcp.count))} `, variants: [` ${g.mcp} ${mcp.count} `] });
    const vimMode = shows("vim") ? readings.vim?.value : null;
    if (vimMode) row.push({ key: "vim", color: ROLE.neutral, text: ` ${g.vim} ${vimMode} `, variants: [` ${g.vim} `] });
    if (activity?.awaiting) {
      // The session is waiting for a person: a question or a plan, answered
      // by nobody yet. It replaces the working chip, which the same recent
      // entry would otherwise keep lit.
      row.push({ key: "activity", color: ROLE.attention, text: ` ${g.yourTurn} your turn ` });
    } else if (activity) {
      // The spinner advances on the session's own render counter, never on the
      // clock, and the quiet clock turns idle into sleeping after five minutes.
      const frames = [g.workingFrame0, g.workingFrame1, g.workingFrame2, g.workingFrame3];
      const asleep = !activity.working && typeof activity.idleMs === "number" && activity.idleMs >= 5 * 60_000;
      const mark = activity.working ? frames[((changes.frame ?? 0) % 4 + 4) % 4] : asleep ? g.sleeping : g.idle;
      // How many background jobs the session is waiting on, said whenever
      // there are any: "working" alone would not tell a quiet session
      // waiting on a gate from one producing output.
      const bg = (activity.background?.shells ?? 0) + (activity.background?.agents ?? 0);
      const waiting = activity.working && bg > 0 ? ` · ${bg} bg` : "";
      row.push({
        key: "activity",
        color: ROLE.neutral,
        ...(activity.working ? { icon: ROLE.healthy } : {}),
        text: activity.working ? ` ${mark} working${waiting} ` : asleep ? ` ${mark} sleeping ` : ` ${mark} idle `,
        variants: [` ${mark} `],
      });
    }
    // The permission mode the session runs in (specs/075): a state to see,
    // in the attention role for plan and auto, critical for bypass.
    const mode = activity?.permissionMode ?? null;
    const modeWord = { plan: ["plan", ROLE.attention], auto: ["auto", ROLE.attention], acceptEdits: ["accept edits", ROLE.neutral], bypassPermissions: ["bypass", ROLE.critical], dontAsk: ["dontask", ROLE.attention] }[mode ?? ""];
    if (modeWord && shows("permissionMode", "activity")) {
      row.push({ key: "permissionMode", color: modeWord[1], text: ` ${g.allowAll} ${modeWord[0]} ` });
    }
    // The tool calls so far (specs/073-session-totals): what the turns are
    // spending their tokens on, after what the session is doing.
    const totals = shows("toolCalls", "sessionTotals") ? readings.sessionTotals?.value : null;
    if (totals && totals.toolCalls > 0) {
      row.push({ key: "toolCalls", color: ROLE.neutral, text: ` ${g.working} tools ${strong(String(totals.toolCalls))} ` });
    }
  }

  // Line 2: active skills, one chip per skill, distinct colors, no bullets.
  // When more are active than the line shows, the count of the rest is
  // stated rather than left silent: "these three" and "three of five" are
  // different claims, and only one of them is true (FR-013).
  if (skills.length) {
    // D7's chosen form: one chip carrying the list, not one chip per skill.
    // A chip per skill spent a separator and two spaces on each name, so
    // three of them gave up a third of the line to padding. As one list they
    // read as one fact, which is what they are: what is shaping the work
    // right now.
    const hidden = readings.skills.hiddenCount ?? 0;
    // The most recent skill is index 0 (getActiveSkills's own contract:
    // newest first). The in-progress feature id takes the parenthetical
    // when a speckit-* skill is active and one is recorded; the SDD step
    // label is the fallback when no feature id is available (specs/009,
    // research.md); neither is shown for a non-speckit skill.
    const sddStep = sddStepFor(skills[0]);
    const featureId = sddStep ? inProgressFeatureId(readings.cwd) : null;
    const skillsSuffix = featureId ?? sddStep;
    // Each listed skill as its newest run tells it (specs/075): running, in
    // emphasis with its duration; the newest finished one with its outcome.
    const runs = Array.isArray(activity?.skillRuns) ? activity.skillRuns : [];
    const newestFinished = runs.find((r) => r.finished) ?? null;
    const named = skills.map((name) => {
      const run = runs.find((r) => r.skill === name) ?? null;
      if (run && !run.finished) {
        const age = typeof run.startedAt === "number" ? ageLabel(now - run.startedAt) : null;
        return `${strong(name)}${age && age !== "0m" ? ` ${age}` : ""}`;
      }
      if (run && run === newestFinished) return `${run.error ? "\u2717" : "\u2713"} ${name}`;
      return name;
    });
    const sessionCount = readings.skillSessionCount?.value ?? 0;
    const usedTail = sessionCount > skills.length + hidden ? ` \u00b7 ${sessionCount} used` : "";
    const l2 = [
      {
        key: "skills",
        color: ROLE.skills,
        emphasis: changes.isChanged("skills"),
        text: ` ${g.skills} ${named.join(skillJoin)}${hidden > 0 ? ` +${hidden}` : ""}${skillsSuffix ? ` (${skillsSuffix})` : ""}${usedTail} `,
        // The newest skill with how many more there are, then the icon (F57).
        iconLast: true,
        variants: [
          ...(usedTail ? [` ${g.skills} ${named.join(skillJoin)}${hidden > 0 ? ` +${hidden}` : ""}${skillsSuffix ? ` (${skillsSuffix})` : ""} `] : []),
          ...(skills.length + hidden > 1 || skillsSuffix
            ? [` ${g.skills} ${skills[0]}${skills.length + hidden > 1 ? ` +${skills.length + hidden - 1}` : ""} `]
            : []),
          ` ${g.skills} `,
        ],
      },
    ];
    pushLine2Extras(l2);
    content.push(...l2);
  } else {
    const l2 = [];
    pushLine2Extras(l2);
    content.push(...l2);
  }

  // Line 3: what is running, and what it is running out of.
  //
  // Model and effort were a line of their own until 2026-09-07. They never
  // filled one, and what is being spent reads in the same glance as what is
  // spending it. Composed from the registry: which segments belong on this
  // line, and in what order, is a property of the table rather than of this
  // function. What each one says is still built here, because that is
  // content, not layout.
  const sevenDayMoment = resetMomentLabel(sevenDayResetsAt, new Date(now));
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  // Bounded the way the countdown is: a reset past any window it could
  // describe is a unit mismatch, and naming a day for it would state a wrong
  // date with confidence. It falls through to `?` instead.
  const farOutMoment =
    typeof sevenDayResetsAt === "number" &&
    sevenDayResetsAt * 1000 - now > ONE_DAY_MS &&
    formatResetCountdown(sevenDayResetsAt, now) !== null
      ? sevenDayMoment
      : null;

  // The spend limit's reset follows the 7-day rule, with the longer bound a
  // monthly period needs.
  const spendBound = { maxMs: MAX_PLAUSIBLE_SPEND_PERIOD_MS };
  const spendFarOut =
    typeof spendLimitResetsAt === "number" &&
    spendLimitResetsAt * 1000 - now > ONE_DAY_MS &&
    formatResetCountdown(spendLimitResetsAt, now, spendBound) !== null
      ? resetMomentLabel(spendLimitResetsAt, new Date(now))
      : null;

  // The length of the spend period, for pace. A month is the calendar month
  // that ends at the reset (counted in UTC), since months differ by up to
  // three days.
  const spendPeriodMinutes = (() => {
    const period = spendUsd?.period;
    if (period === "daily") return 1440;
    if (period === "weekly") return 10080;
    // The gateway resets caps on UTC calendar boundaries (daily at 00:00,
    // weekly on Monday, monthly on the 1st). A payload without `period` is a
    // month only when the reset is further off than a week can be; nearer
    // than that it could be any of the three, and a guessed length would
    // put the pace marker on the wrong scale, so there is none.
    if (typeof spendLimitResetsAt !== "number") return null;
    if (period === "monthly" || spendLimitResetsAt * 1000 - now > 7 * 86_400_000 * 1.02) return monthPeriodMinutes(spendLimitResetsAt);
    return null;
  })();
  // Whole dollars from 100 up, cents below it.
  const usd = (v) => `$${v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}`;

  // A window at its limit says so in a word. The payload keeps sending the
  // same 100 until the reset, so without it a figure that cannot move reads
  // as a statusline that stopped updating (specs/023-extra-usage-limit). The
  // word sits outside the reset text so shedding the reset never removes it:
  // it is the part that explains why the number is not changing.
  const fullMark = (pct) => (typeof pct === "number" && pct >= 100 ? " full" : "");

  // Copilot CLI reports no rate limits at all, so their chips are absent there
  // rather than `?%`, which would claim an unknown figure for a limit that does
  // not exist (Principle III, specs/029-multi-harness).
  // OpenCode reports no usage windows either (specs/038-opencode).
  const noLimits = ["copilot", "opencode"].includes(readings.harness?.value) && !payload?.rate_limits;
  // `CLAUDE_STATUSLINE_AMOUNTS=hide` (or `amounts` in `.statusline.json`):
  // no money and no balance on the bar, in any harness (specs/070, FR-003).
  // A bar is shared on screens and in screenshots; a percentage says how
  // much is left without saying of what.
  const hideAmounts = String(process.env.CLAUDE_STATUSLINE_AMOUNTS ?? "").toLowerCase() === "hide";
  // The line's grammar (specs/072): the icon says what and the number how
  // much, so the chips that repeated their icon in words lost the word.
  // `CLAUDE_STATUSLINE_LABELS=on` brings the words back.
  const labelsOn = String(process.env.CLAUDE_STATUSLINE_LABELS ?? "").toLowerCase() === "on";

  // The age of a figure taken from Claude Code's `/usage` cache: past six
  // hours the chip loses its band, past twelve it says how old it is
  // (specs/070, FR-004). `withAge` puts the mark on a finished chip; the mark
  // is the first thing width sheds, since the variants do not carry it.
  const cacheMark = (fetchedAt) => cacheAgeMark(fetchedAt, now);
  const withAge = (chip, mark) =>
    chip && mark?.label ? { ...chip, text: `${chip.text.replace(/ $/, "")} ${quiet(`· ${mark.label}`)} ` } : chip;
  const cachedWindowMark = (key) => (readings[key]?.source === "cache" ? cacheMark(readings.usageCache?.value?.fetchedAt) : null);
  // Codex reports the windows its plan has, by length. One the plan does not
  // have, such as the 5-hour window on the free plan, is absent rather than
  // `?%`, for the same reason (specs/035-codex-pane).
  const isCodex = readings.harness?.value === "codex";
  // `CLAUDE_STATUSLINE_RESET=clock`: every window's reset as a moment in the
  // computer's zone instead of a countdown (specs/076, FR-004).
  const clockResets = String(process.env.CLAUDE_STATUSLINE_RESET ?? "").toLowerCase() === "clock";
  // Where a Claude window can be looked at in full (specs/076, FR-006).
  const windowUrl = isCodex ? USAGE_PAGES.codex : USAGE_PAGES.claude;
  // The cache hit ratio draws wherever the credits chip does (specs/071);
  // decided once, since the prompt cache state chip yields to it.
  const cacheHitRatio =
    !noLimits && !isCodex && readings.usageCredits?.value?.enabled && typeof readings.promptCache?.value?.hitRatio === "number"
      ? readings.promptCache.value.hitRatio
      : null;
  // The prompt cache's state as a glyph: the snowflake when cold, an
  // hourglass that empties by thirds of the cache's own TTL while a warm
  // cache closes, the full hourglass otherwise.
  const cacheStateGlyph = () => {
    const pc = readings.promptCache?.value ?? null;
    if (!pc || pc.state === "cold") return g.cacheCold;
    if (!pc.closing) return g.cacheWarm;
    const ttlS = pc.ttl === "1h" ? 3600 : 300;
    const left = pc.secondsLeft / ttlS;
    return left > 2 / 3 ? g.cacheWarm : left > 1 / 3 ? g.cacheWarmHalf : g.cacheWarmLow;
  };
  // A budget account (Claude Enterprise behind a gateway with a spend limit)
  // is metered in dollars over a day, week or month and has no 5-hour or
  // 7-day window. The payload then carries `spend_limit` and neither window,
  // so their chips are absent rather than `?%` (specs/062-budget-account).
  // The kind is remembered, because the gateway drops `spend_limit` once its
  // reset passes and the chips would otherwise turn back into `5h — ?`.
  const budgetOnly =
    (spendLimitPct !== null || readings.accountKind?.value === "budget") &&
    !payload?.rate_limits?.five_hour &&
    !payload?.rate_limits?.seven_day;
  // An account with no window at all (specs/068-no-window-account): Console
  // API key, Bedrock, Vertex, Foundry, a seat without an individual allowance.
  // A seat billed by usage (specs/069-usage-credits) has no window either:
  // its allowance is the monthly credit cap the `usageCredits` chip draws.
  const noWindows =
    ["none", "credits"].includes(readings.accountKind?.value) && !payload?.rate_limits?.five_hour && !payload?.rate_limits?.seven_day;
  const noFiveHour = noLimits || budgetOnly || noWindows || (isCodex && !payload?.rate_limits?.five_hour);
  const noSevenDay = noLimits || budgetOnly || noWindows || (isCodex && !payload?.rate_limits?.seven_day);

  // Copilot CLI's monthly quota, one chip per allowance the plan meters
  // (specs/033-copilot-parity). Labelled `month` the way the windows are
  // labelled `5h` and `7d`, with the date the month resets: it is the only
  // window Copilot has, and calling it anything shorter would invent one.
  const copilotQuota = shows("premiumQuota", "copilotQuota") ? readings.copilotQuota?.value : null;
  const quotaChip = (name) => {
    const q = copilotQuota?.quotas?.[name];
    if (!q) return null;
    const full = q.full || q.usedPct >= 100 ? " full" : "";
    const date = formatQuotaDate(copilotQuota.resetDate);
    const band = bandFor(q.usedPct)?.name ?? null;
    return {
      ...gaugeChip(q.usedPct, band),
      ...gaugeChipText({ icon: g.calendar, label: `month ${name}`, pct: q.usedPct, band, reset: date || null, full }),
    };
  };

  const line3Content = {
    // Whose credits these are (specs/071, FR-007): the signed-in Claude
    // account's organisation and the kind of account, or the address with
    // `CLAUDE_STATUSLINE_ACCOUNT=email`; `off` draws nothing. Under Codex
    // the plan the rollout names; nothing is read under Copilot or OpenCode.
    account: () => {
      const mode = String(process.env.CLAUDE_STATUSLINE_ACCOUNT ?? "org").toLowerCase();
      if (mode === "off") return null;
      const harness = readings.harness?.value;
      if (harness === "codex") {
        const plan = plainText(payload?.codex?.plan_type);
        return plan ? { color: ROLE.identity, text: ` ${g.account} codex ${plan.slice(0, 24)} ` } : null;
      }
      if (noLimits || harness === "opencode") return null;
      const id = shows("account") ? readings.account?.value : null;
      // A probe's text goes through the same sanitiser as the file's.
      // One word for whose account it is: `personal` for a Pro or Max seat or
      // the address's own organisation, otherwise `business`. The organisation's
      // name is only written in `email` mode.
      const personal = id && (["claude_pro", "claude_max"].includes(id.orgType) || (id.org && id.email && id.org.toLowerCase() === `${id.email}'s organization`.toLowerCase()));
      const who = plainText(!id ? null : mode === "email" ? (id.email ?? id.org) : personal ? "personal" : "business");
      // `tier`: the seat's tier beside the organisation (specs/076, FR-005).
      const tier = mode === "tier" && id?.seatTier ? plainText(String(id.seatTier).replace(/^enterprise_/, "").replace(/_/g, " ")) : null;
      if (!who) return null;
      const kind = readings.accountKind?.value;
      // The credits chip beside it already says `credits` (specs/072).
      const implied = !labelsOn && kind === "credits" && readings.usageCredits?.value?.enabled === true;
      const word = tier ?? (implied ? null : ({ subscriber: "subscriber", budget: "budget", credits: "credits", none: "api" }[kind] ?? null));
      return {
        color: ROLE.identity,
        text: ` ${g.account} ${who}${word ? ` \u00b7 ${word}` : ""} `,
        variants: word ? [` ${g.account} ${who} `] : [],
      };
    },
    model: () => {
      // Under Copilot's auto router the chip names the model that answered,
      // and "(auto)" is the first thing it gives up for width.
      const routed = shows("model", "modelRouted") ? readings.modelRouted.value : null;
      // `CLAUDE_STATUSLINE_MODEL_TIER=1`: a price-tier mark from the model's
      // name (specs/071, FR-006). A table in the plugin, not a payload fact,
      // so it is opt-in and the bare name is the first width step.
      const tier = process.env.CLAUDE_STATUSLINE_MODEL_TIER === "1" ? modelTierOf(modelName) : null;
      return {
        color: ROLE.identity,
        emphasis: changes.isChanged("model"),
        text: tier ? ` ${g.model} ${modelName} ${tier} ` : ` ${g.model} ${modelName} `,
        // No icon-only form: a model glyph alone names nothing, so the chip
        // goes whole when the line runs out of room (specs/054).
        ...(tier || routed ? { variants: [...(tier ? [` ${g.model} ${modelName} `] : []), ...(routed ? [` ${g.model} ${routed} `] : [])] } : {}),
      };
    },
    premiumQuota: () => quotaChip("premium"),
    chatQuota: () => quotaChip("chat"),
    // Copilot CLI's AI credits. The ramp colour has a level to show only once
    // a session limit is set; until then it keeps its own.
    aiCredits: () => {
      const c = shows("aiCredits") ? readings.aiCredits?.value : null;
      if (!c) return null;
      // Copilot's figure is a bare number today; anything with words in it is
      // drawn as sent rather than given a second unit.
      const bare = /^[\d.,]+$/.test(c.formatted);
      const amount = bare ? `${c.formatted} AIC` : c.formatted;
      if (c.pct === null) return hideAmounts ? null : { color: ROLE.money, text: ` ${g.spend} ${amount} `, url: USAGE_PAGES.copilot };
      const band = bandFor(c.pct)?.name ?? null;
      const level = `${gaugeFigure(c.pct, band)}${fullMark(c.pct)}`;
      // Amounts hidden: the share of the session's limit, and not the count.
      if (hideAmounts) return { ...gaugeChip(c.pct, band), text: ` ${g.spend} AIC ${level} `, variants: [], url: USAGE_PAGES.copilot };
      const against = bare ? `${c.formatted}/${creditCount(c.max)} AIC` : `${c.formatted} of ${creditCount(c.max)}`;
      return {
        ...gaugeChip(c.pct, band),
        text: ` ${g.spend} ${against} · ${level} `,
        variants: [` ${g.spend} ${amount} · ${level} `],
        url: USAGE_PAGES.copilot,
      };
    },
    effort: () =>
      effort
        ? { color: ROLE.identity, text: ` ${effortGlyph(effort)} ${effort} `, variants: [` ${effortGlyph(effort)} `], iconLast: true }
        : null,
    // Fast mode spends faster, so it sits with the model and effort that say
    // what is spending. Drawn only when on (specs/027-bar-polish).
    fastMode: () => (shows("fastMode") && readings.fastMode?.value ? { color: ROLE.neutral, text: ` ${g.fast} fast ` } : null),
    // The three ramped segments. Colour says which band the level is in, and
    // the bar's own characters say it again, because colour may not be the
    // only carrier (E6). An unknown level keeps the segment's own colour and
    // draws an empty track: `?%` is the honest answer, and a bar that
    // vanished would make the line's width jump.
    // The bar was ten to sixteen columns for something the number says in
    // three, on the line that is already the widest. It is gone; the band it
    // carried is now a one-character mark, so the meaning still survives
    // without colour (item E6, and Section 508).
    // The context figure carries its level in colour only. The band mark it
    // used to carry was removed on 2026-08-26 at the owner's request, so
    // this is the one ramped segment where colour is the sole carrier. The
    // 5-hour and 7-day figures beside it still mark their band, and they
    // are the ones with a consequence you cannot undo.
    context: () => {
      // Past 200k input tokens the long-context price applies, which a seat
      // billed by usage pays for (specs/071, FR-001): critical, and the mark
      // stays on every width step.
      const over200k = readings.tokens?.value?.exceeds200k === true;
      const { band: ownBand } = contextBand(ctxPct, repoConfig(readings.cwd || process.cwd()).contextBands);
      const band = over200k ? "critical" : ownBand;
      // With the time already spent above the threshold once it is a minute
      // (specs/073): the mark stays, the time is the first thing width sheds.
      const overMs = readings.sessionTotals?.value?.over200kMs ?? 0;
      const overTime = overMs >= 60_000 ? ` \u00b7 ${formatDuration(overMs)}` : "";
      const mark200k = (chip) =>
        over200k
          ? {
              ...chip,
              text: `${chip.text.replace(/ $/, "")} \u00b7 200k+${overTime} `,
              variants: [
                ...(overTime ? [`${chip.text.replace(/ $/, "")} \u00b7 200k+ `] : []),
                ...(chip.variants ?? []).map((v) => `${v.replace(/ $/, "")} \u00b7 200k+ `),
              ],
            }
          : chip;
      const built = gaugeChipText({ icon: g.context, label: "", pct: ctxPct, band });
      // The last eight context readings, when asked for and when there are that
      // many: whether it is climbing or flat (specs/050-catalog-gaps).
      const spark = process.env.CLAUDE_STATUSLINE_SPARKLINE === "1" ? sparkline(sampleHistory, "contextPct", 8) : null;
      if (spark) {
        const fig = gaugeFigure(ctxPct, band);
        const longer = ` ${g.context} ${track(ctxPct, trackSet)} ${fig} ${quiet(spark)} `;
        return mark200k({
          ...gaugeChip(ctxPct, band),
          text: longer,
          variants: [built.text, ...built.variants, ` ${g.context} ${fig} `],
        });
      }
      // The word is the next thing to go after the track.
      const bare = ` ${g.context} ${gaugeFigure(ctxPct, band)} `;
      // With no word to give up the figure-only form is the one already there.
      const steps = [...built.variants, bare].filter((v, i, all) => all.indexOf(v) === i);
      return mark200k({ ...gaugeChip(ctxPct, band), text: built.text, variants: steps });
    },
    // Each window says how much of it is gone and when it comes back, in one
    // chip. Until 2026-09-06 the two resets shared a segment two places away
    // reading `2h09m / 3d`, which asked the reader to know that the left half
    // belonged to the figure three chips back and the right half to the one
    // between them — and the slash read as a fraction beside `1h04m`, which
    // really is one thing over another. One subject, one chip.
    fiveHour: () => {
      if (noFiveHour) return null;
      // `?` rather than nothing when the payload carried no reset: with the
      // countdown simply absent, a reader cannot tell "the harness did not
      // say" from "a narrow terminal shed it", and the first is a fact about
      // the data (Principle III). It reads in the same vocabulary as the `?%`
      // beside it, and it is shed under width like any other reset text: the
      // chip's one variant is itself without the countdown, which the width
      // guard reaches before it drops anything essential (specs/027).
      const resets = (clockResets ? resetMomentLabel(fiveHourResetsAt, new Date(now)) : shortCountdown(fiveHourResetsAt, now)) ?? "?";
      const mark = cachedWindowMark("fiveHour");
      const { band, pace } = mark?.dim ? { band: null, pace: null } : paceBand(fiveHourPct, elapsedPct(fiveHourResetsAt, 300));
      // A plan with extra usage on keeps working past its windows (specs/076, FR-003).
      const extra = readings.usageCredits?.value?.enabled && readings.usageCredits.value.hasWindows ? " +extra" : "";
      const chip = gaugeChipText({ icon: g.timer, label: "5h", pct: fiveHourPct, band, pace, reset: resets, full: `${fullMark(fiveHourPct)}${extra}`, resetsAt: fiveHourResetsAt });
      return withAge({ ...gaugeChip(mark?.dim ? null : fiveHourPct, band), ...chip, url: windowUrl }, mark);
    },
    sevenDay: () => {
      if (noSevenDay) return null;
      // Near and far are told differently, and that is the rule rather than an
      // inconsistency: a window resetting in hours is something you wait out,
      // so it counts down; one resetting on Thursday is a date you plan
      // around, so it names the day. C4 chose the weekday for the far case on
      // the reasoning that a countdown three days long is noise; the near case
      // used to be covered by the merged segment, and now lives here.
      const moment = (clockResets ? resetMomentLabel(sevenDayResetsAt, new Date(now)) : farOutMoment ?? shortCountdown(sevenDayResetsAt, now)) ?? "?";
      const mark = cachedWindowMark("sevenDay");
      const { band, pace } = mark?.dim ? { band: null, pace: null } : paceBand(sevenDayPct, elapsedPct(sevenDayResetsAt, 10080));
      return withAge({
        ...gaugeChip(mark?.dim ? null : sevenDayPct, band),
        ...gaugeChipText({ icon: g.calendar, label: "7d", pct: sevenDayPct, band, pace, reset: moment, full: fullMark(sevenDayPct), resetsAt: sevenDayResetsAt }),
        url: windowUrl,
      }, mark);
    },
    // How fast the week is going (specs/076, FR-001): the same rule as the
    // 5-hour burn rate, scaled to a day.
    sevenDayRate: () => {
      if (noSevenDay || sevenDayPct === null) return null;
      const rate = ratePerHour(sampleHistory, "sevenDayPct");
      if (rate === null || rate <= 0) return null;
      const perDay = rate * 24;
      return { color: ROLE.neutral, text: ` ${g.burn} +${perDay.toFixed(perDay < 10 ? 1 : 0)}%/d ` };
    },
    // The per-model weeks the cache carries (specs/076, FR-002), in the band
    // of the one furthest along.
    weeklyModels: () => {
      if (noLimits || isCodex) return null;
      const list = shows("weeklyModels", "usageCredits") ? readings.usageCredits?.value?.windows?.perModel : null;
      if (!Array.isArray(list) || !list.length) return null;
      const top = Math.max(...list.map((w) => w.pct));
      const band = bandFor(top)?.name ?? null;
      const text = ` ${g.calendar} ${list.map((w) => `${w.model} ${w.pct}%`).join(" \u00b7 ")} `;
      return { ...gaugeChip(top, band), text, variants: [` ${g.calendar} ${list[0].model} ${list[0].pct}% `], url: windowUrl };
    },
    // The allowance a gateway reports once an administrator sets a spend
    // limit. It is drawn as reported, past 100% included, because that is how
    // the payload says the limit has been exceeded; capping it would hide the
    // one figure still moving. Its reset is shed with the 7-day one.
    // A Codex window that is neither 5 hours nor 7 days, under the label its
    // length gives it (specs/037-codex-windows). It follows the 7-day rule for
    // its reset: a date beyond a day, a countdown inside one, and `?` past the
    // window's own length, which is a timestamp in the wrong unit.
    codexWindow: () => {
      const w = shows("codexWindow") ? readings.codexWindow?.value?.[0] : null;
      if (!w) return null;
      const pct = Math.round(w.used_percentage);
      const bound = { maxMs: w.window_minutes * 60_000 + ONE_DAY_MS };
      const at = typeof w.resets_at === "number" ? w.resets_at : null;
      const counts = formatResetCountdown(at, now, bound) !== null;
      const moment = !counts ? "?" : clockResets || at * 1000 - now > ONE_DAY_MS ? resetMomentLabel(at, new Date(now)) : shortCountdown(at, now, bound) ?? "?";
      const { band, pace } = paceBand(pct, elapsedPct(at, w.window_minutes));
      return {
        ...gaugeChip(pct, band),
        ...gaugeChipText({ icon: g.calendar, label: w.label, pct, band, pace, reset: moment, full: fullMark(pct), resetsAt: at }),
        url: USAGE_PAGES.codex,
      };
    },
    // Codex's credit balance, drawn as Codex writes it.
    codexCredits: () => {
      const c = shows("codexCredits") && !hideAmounts ? readings.codexCredits?.value : null;
      return c ? { color: ROLE.money, text: ` ${g.spend} credits ${c.balance} `, url: USAGE_PAGES.codex } : null;
    },
    // The usage credits of a seat billed by usage (specs/069-usage-credits),
    // as Claude Code cached them for its own `/usage` screen: the used and
    // the limit as sent, the percentage in the usage bands, `full` once the
    // cap is reached. Percentages only, never the money: a bar is shared on
    // screens and in screenshots, and a seat's cap is its own business. The
    // day and the week follow when the cache carries them.
    // No reset and no pace: the cache carries neither, and
    // the bar invents nothing (Principle III). Drawn whenever the signed-in
    // account has a fresh figure with extra usage on: for a seat billed by
    // usage it is the only allowance, and beside a subscriber's windows it
    // is what carries work once one of them is full.
    usageCredits: () => {
      if (noLimits || isCodex) return null;
      // The wallet is the word (specs/072), unless the words are asked for.
      const creditsLabel = labelsOn ? "credits" : "";
      const c = shows("usageCredits") ? readings.usageCredits?.value : null;
      // Remembered as a credits seat, but the cache is stale or gone: the
      // figure is unknown, not absent, as `spend —` is for a budget account.
      if (!c) {
        if (readings.accountKind?.value !== "credits") return null;
        const unknown = gaugeChipText({ icon: g.spend, label: creditsLabel, pct: null, band: null, pace: null });
        return { ...gaugeChip(null, null), ...unknown, url: USAGE_PAGES.claude };
      }
      // Extra usage off: a credits seat says so, since the cap is the one
      // thing it is metered by; any other account has nothing to say.
      if (!c.enabled) {
        if (readings.accountKind?.value !== "credits") return null;
        return { ...gaugeChip(null, null), text: ` ${g.spend} ${labelsOn ? "credits off" : "off"} `, variants: [], url: USAGE_PAGES.claude };
      }
      const mark = cacheMark(c.fetchedAt);
      // The cache's own word for the spend outranks the rounded percentage:
      // `critical` is the critical band, `warning` at least the warn band
      // (specs/070, FR-006). A figure gone dim with age has no band at all.
      const own = bandFor(c.pct)?.name ?? null;
      const band = mark?.dim ? null : c.severity === "critical" ? "critical" : c.severity === "warning" && own !== "critical" ? "warn" : own;
      const full = c.reached ? " full" : "";
      const month = gaugeChipText({ icon: g.spend, label: creditsLabel, pct: c.pct, band, pace: null, full });
      // When the cap comes back (specs/071, FR-009): the cache's own reset
      // when it carries one, else the first of next month at this
      // computer's midnight, marked `~` as the estimate it is, unless
      // `CLAUDE_STATUSLINE_CREDITS_RESET=off`. Day and time, in the
      // computer's own zone, since a month is planned around a date.
      const estimateOff = String(process.env.CLAUDE_STATUSLINE_CREDITS_RESET ?? "").toLowerCase() === "off";
      const resetAt = typeof c.resetsAt === "number" ? c.resetsAt : estimateOff ? null : monthResetAt(now);
      const resetLabel = resetAt === null ? null : `${typeof c.resetsAt === "number" ? "" : "~"}${resetDayAndTime(resetAt, now)}`;
      const resetBit = resetLabel ? ` ${quiet(`${g.reset} ${resetLabel}`)}` : "";
      // After the month: the day and the week when cached, then what moves
      // the figure (specs/071): the measured rate, this session's rise, and
      // on request the session's estimated share of the cap. Each is a tenth
      // of a point at least, or it is not drawn.
      const motion = readings.creditsTrend?.value ?? null;
      const tenth = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0.05 ? v.toFixed(1) : null);
      const rate = tenth(motion?.ratePerHour);
      const rise = tenth(motion?.sessionDelta);
      const costUsd = payload?.cost?.total_cost_usd;
      const share = process.env.CLAUDE_STATUSLINE_SESSION_SHARE === "1" && typeof c.shareOfCap === "function" ? c.shareOfCap(costUsd) : null;
      const periods = [
        c.daily !== null ? `day ${c.daily}%` : null,
        c.weekly !== null ? `week ${c.weekly}%` : null,
        rate ? `+${rate}%/h` : null,
        rise ? `+${rise}% session` : null,
        share !== null ? `session ${share < 0.05 ? "<0.1" : share.toFixed(1)}%` : null,
      ].filter(Boolean);
      // The figure, then what moves it, then when it comes back. Width takes
      // the motion first, then the reset, then the track.
      const trimmed = month.text.replace(/ $/, "");
      const tail = periods.length ? ` \u00b7 ${periods.join(" \u00b7 ")}` : "";
      const text = `${trimmed}${tail}${resetBit} `;
      const variants = [...(tail && resetBit ? [`${trimmed}${resetBit} `] : []), ...(tail || resetBit ? [month.text] : []), ...month.variants];
      return withAge({ ...gaugeChip(mark?.dim ? null : c.pct, band), text, variants, url: USAGE_PAGES.claude }, mark);
    },
    spendLimit: () => {
      if (noLimits) return null;
      // A budget account whose spend limit is not in this payload: the figure
      // is unknown, not absent (Principle III).
      if (spendLimitPct === null) {
        if (!budgetOnly) return null;
        const unknown = gaugeChipText({ icon: g.spend, label: "spend", pct: null, band: null, pace: null });
        return { ...gaugeChip(null, null), ...unknown };
      }
      const moment = (clockResets ? resetMomentLabel(spendLimitResetsAt, new Date(now)) : spendFarOut ?? shortCountdown(spendLimitResetsAt, now, spendBound)) ?? "?";
      const { band, pace } = spendUsd && spendPeriodMinutes
        ? paceBand(spendLimitPct, elapsedPct(spendLimitResetsAt, spendPeriodMinutes))
        : { band: bandFor(spendLimitPct)?.name ?? null, pace: null };
      const base = { icon: g.spend, pct: spendLimitPct, band, pace, reset: moment, full: spendUsd ? fullMark(spendLimitPct) : "", resetsAt: spendLimitResetsAt };
      const plain = gaugeChipText({ ...base, label: "spend" });
      if (!spendUsd || hideAmounts) return { ...gaugeChip(spendLimitPct, band), ...plain };
      // With the dollars the payload sends: `spend $314/$500`. The track and
      // the reset go first, then the amounts, and the percentage stays.
      const money = gaugeChipText({ ...base, label: `spend ${usd(spendUsd.used)}/${usd(spendUsd.limit)}` });
      return { ...gaugeChip(spendLimitPct, band), text: money.text, variants: [...money.variants, plain.variants[plain.variants.length - 1]] };
    },
    // What is left of a budget, spread over what is left of its period, next
    // to what has been spent per day so far (specs/062-budget-account). Both
    // are arithmetic on the payload's own dollars and reset, not a figure
    // the bar makes up. Absent without the dollars.
    spendPace: () => {
      if (noLimits || hideAmounts || !spendUsd || spendLimitPct === null || !spendPeriodMinutes) return null;
      const p = budgetPace(spendUsd, spendLimitResetsAt, now, spendPeriodMinutes);
      if (!p) return null;
      if (p.over !== undefined) {
        return { color: ROLE.critical, text: p.over > 0 ? ` ${g.spend} over by ${usd(p.over)} ` : ` ${g.spend} limit reached ` };
      }
      const unit = spendUsd.period === "daily" ? "h" : "d";
      const left = `${usd(p.allowance)}/${unit} left`;
      const text = p.avg === null ? ` ${g.spend} ${left} ` : ` ${g.spend} ${left} \u00b7 avg ${usd(p.avg)}/${unit} `;
      return {
        ...gaugeChip(p.projectedPct, bandFor(p.projectedPct)?.name ?? null),
        color: p.projectedPct >= 100 ? ROLE.critical : p.projectedPct >= 85 ? ROLE.attention : ROLE.money,
        text,
        variants: [` ${g.spend} ${left} `],
      };
    },
    // The prompt cache, drawn only when its state changes what you do next:
    // cold, or warm inside its closing window. A warm cache with time to
    // spare, or a provider that reports no caching, draws nothing at all. A
    // cold chip carries shorter `variants`: when the width guard reaches it,
    // the cause comes off, then the token count, and only then the chip.
    // The help page (specs/078): the last chip on line 3, at its right end,
    // and always drawn (pinned). An https link to the page on GitHub Pages
    // (src/helpLink.js): a terminal opens it in the browser.
    help: () => {
      const page = shows("help", "helpPage") ? readings.helpPage?.value : null;
      return page ? { color: ROLE.neutral, alignRight: true, text: ` ${g.help} `, url: HELP_URL } : null;
    },
    // The prompt cache's hit ratio, standing, for a seat billed by usage
    // (specs/071, FR-004): the largest cost it controls. Bands inverted,
    // since a low ratio is the bad one.
    cacheHit: () => {
      // Wherever the credits chip draws: a seat billed by usage, or a plan
      // with extra usage on, which pays the same way past its windows.
      if (cacheHitRatio === null) return null;
      const pct = Math.round(cacheHitRatio * 100);
      const band = pct >= 70 ? "ok" : pct >= 40 ? "warn" : "critical";
      // One chip for the cache (specs/072): the icon carries the state the
      // prompt cache chip used to draw on its own, cold, closing or warm.
      const icon = labelsOn ? g.cacheWarm : cacheStateGlyph();
      return { ...gaugeChip(pct, band), ...gaugeChipText({ icon, label: labelsOn ? "cache" : "", pct, band, pace: null }) };
    },
    promptCache: () => {
      if (!promptCache?.observed) return null;
      // Beside the hit ratio chip, whose icon carries the state (specs/072),
      // this chip keeps only what that one does not: the minutes a closing
      // cache has left, the tokens a cold one writes again. Its bare forms.
      const besideRatio = !labelsOn && cacheHitRatio !== null;
      if (promptCache.state === "warm") {
        if (!promptCache.closing) return null;
        const glyph = cacheStateGlyph();
        const minutes = cacheMinutesLeft(promptCache.secondsLeft);
        if (besideRatio) return { color: ROLE.neutral, icon: ROLE.attention, text: ` ${glyph} ${minutes} ` };
        return {
          color: ROLE.neutral,
          icon: ROLE.attention,
          text: ` ${glyph} cache warm \u00b7 ${minutes} `,
          variants: [` ${glyph} ${minutes} `],
        };
      }
      const tokens = promptCache.recacheTokens !== null ? abbreviate(promptCache.recacheTokens) : null;
      if (besideRatio) return tokens ? { color: ROLE.cold, text: ` ${g.cacheCold} ${tokens} ` } : null;
      const chip = (...parts) => ` ${g.cacheCold} cache cold${parts.filter(Boolean).map((t) => ` \u00b7 ${t}`).join("")} `;
      const text = chip(tokens, promptCache.cause);
      const bare = tokens ? ` ${g.cacheCold} ${tokens} ` : ` ${g.cacheCold} `;
      const variants = [chip(tokens), chip(), bare].filter((v, i, all) => v !== text && all.indexOf(v) === i);
      return { color: ROLE.cold, text, ...(variants.length ? { variants } : {}) };
    },
    // C5 asked for this figure to render only once it had moved five points,
    // on the reasoning that a number repeating itself every redraw is a
    // number nobody reads. That reasoning does not survive what the number
    // is: `rtk gain` reports an average over thousands of commands,
    // and such an average does not move five points. The segment showed
    // itself on a session's first redraw and was never seen again.
    //
    // So it renders whenever there is a value. Its width is already governed
    // by its priority, the lowest on the bar, which makes it the first thing
    // a narrow line drops — the same outcome the throttle was reaching for,
    // decided by the terminal rather than by a threshold the figure cannot
    // cross.
    rtk: () => {
      if (rtkPct === null) return null;
      // The icon is the word (specs/072): `󱙹 81%`, the former short form.
      if (!labelsOn) return { color: ROLE.money, text: ` ${g.rtk} ${strong(`${rtkPct}%`)} ` };
      return { color: ROLE.money, text: ` ${g.rtk} rtk ${strong(`${rtkPct}%`)} ${quiet("saved")} `, variants: [` ${g.rtk} ${strong(`${rtkPct}%`)} `] };
    },

    // B1: a percentage says where you are; a rate says whether you get there
    // before the window resets, which is the decision you actually make.
    burnRate: () => {
      if (noLimits) return null;
      const rate = ratePerHour(sampleHistory, "fiveHourPct");
      if (rate === null || rate <= 0) return null;
      const icon = eventEmoji && bandFor(fiveHourPct)?.name === "critical" ? GLYPHS.emoji.burn : g.burn;
      const perHour = `${rate.toFixed(rate < 10 ? 1 : 0)}%/h`;
      // One chip for one fact: how fast the window is going and when that
      // runs it out. The moment is only drawn when the window would be full
      // before it resets, which is the only case that changes what you do.
      let runsOut = "";
      const at = typeof fiveHourPct === "number" && fiveHourPct >= 100 ? null : projectFull(sampleHistory, "fiveHourPct", now);
      if (at !== null && !(typeof fiveHourResetsAt === "number" && at >= fiveHourResetsAt * 1000)) {
        const d = new Date(at);
        runsOut = ` ${quiet(`full ~${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)}`;
      }
      // Eight samples of the 5-hour figure, when asked for and when there are
      // that many. Part of the long form only.
      const samples = process.env.CLAUDE_STATUSLINE_SPARKLINE === "1" ? sparkline(sampleHistory, "fiveHourPct", 8) : null;
      const short = ` ${icon} ${perHour}${runsOut} `;
      return {
        color: ROLE.neutral,
        text: samples ? ` ${icon} ${perHour} ${samples}${runsOut} ` : short,
        ...(samples ? { variants: [short] } : {}),
      };
    },
    // B2, merged into the burn rate chip above by specs/046-gauges: the
    // sentence says "full ~13:05" beside the rate, and only when the window
    // would run out before it resets, which is the only case where it changes
    // what you do. It has no key of its own any more.
    // A4, A5, A6: what the session has spent, in time and in lines.
    // Copilot's premium requests this session, and whether every tool now runs
    // without asking. Neither exists in Claude Code's payload.
    premiumRequests: () => {
      const n = shows("premiumRequests") ? readings.premiumRequests?.value : null;
      return n ? { color: ROLE.neutral, text: ` ${g.premium} ${n} premium ` } : null;
    },
    allowAll: () => (shows("allowAll") && readings.allowAll?.value ? { color: ROLE.attention, text: ` ${g.allowAll} ${strong("allow all")} ` } : null),
    // What the session has spent (specs/073): every token the transcript
    // recorded, then what moves it, shed right to left for width.
    sessionTokens: () => {
      const t = shows("sessionTokens", "sessionTotals") ? readings.sessionTotals?.value : null;
      if (!t || !(t.total > 0)) return null;
      const head = ` \u03a3 ${strong(abbreviate(t.total))}`;
      const tails = [
        t.perMinute !== null && t.perMinute >= 1 ? `\u2191${abbreviate(Math.round(t.perMinute))}/min` : null,
        t.agentTokens > 0 ? `agents ${abbreviate(t.agentTokens)}` : null,
        t.mix ? `${modelFamily(t.mix.model)} ${t.mix.pct}%` : null,
      ].filter(Boolean);
      const forms = [];
      for (let i = tails.length; i >= 0; i--) forms.push(`${head}${tails.slice(0, i).map((x) => ` \u00b7 ${x}`).join("")} `);
      return { color: ROLE.money, text: forms[0], variants: forms.slice(1) };
    },
    duration: () => {
      const c = shows("sessionCost") ? readings.sessionCost.value : null;
      // Not before half an hour: a session two minutes old is not news.
      const label = (c?.durationMs ?? 0) >= 30 * 60_000 ? formatDuration(c.durationMs) : null;
      return label ? { color: ROLE.neutral, text: ` ${g.duration} ${strong(label)} ` } : null;
    },
  };

  const buildLine3 = () =>
    byLine(3)
      .map((s) => {
        const built = line3Content[s.key]?.();
        return built ? { key: s.key, ...built } : null;
      })
      .filter(Boolean);

  // The 120-column limit is a promise the constitution makes. Lower
  // priorities are dropped first; before anything essential goes, the
  // essential chips give up their reset text, the 7-day one first, then the
  // 5-hour countdown, through their `variants` in `fitToWidth`
  // (specs/027-bar-polish). That used to be a four-step ladder here, which
  // never ran: `fitToWidth` always made a row fit, so the ladder's own "does
  // it fit" check passed before its first step.
  /**
   * Puts every built segment on the line the arrangement gives it, in the
   * order it gives it, and drops what will not fit.
   *
   * Content is built once; placement is applied here. A
   * segment that has been switched off never reaches a row, whatever its
   * priority, and a segment moved to another line arrives there with its
   * own priority, so what a narrow terminal sheds is still a decision taken
   * in the registry.
   */
  // The directory label's own trim step: shortened from the left, because
  // the end of a path identifies it and the start rarely does. It runs before
  // the row is fitted, not after: fitting always returns a row that fits, so a
  // trim that waited for an overflow never ran, and the path kept its full
  // length while the pull request, the CI result and finally the directory
  // itself were shed around it. Nothing else on that line should go to make
  // room for the start of a path.
  //
  // Down to a floor, so the label stays recognisable; what still overflows
  // after that is shed by priority like anything else. Columns, not
  // characters: an emoji or a CJK name occupies two columns per character,
  // and counting them as one cut too little to fit.
  const MIN_DIR_COLUMNS = 12;
  const trimDir = (row, floor) => {
    const at = row.findIndex((seg) => seg.key === "dir");
    if (at === -1) return row;
    const over = rowWidth(row) - maxWidth;
    if (over <= 0) return row;
    const shortened = trimFromLeft(dirLabel, Math.max(floor, displayWidth(dirLabel) - over));
    if (shortened === null) return row;
    const out = [...row];
    out[at] = { ...row[at], text: dirSegment(shortened).text };
    return out;
  };

  /**
   * Red is the loudest thing on the bar, so it is used once. Among gauges in
   * the critical band the highest percentage keeps the red background, the
   * first in line order on a tie. The others stay critical in the text: red
   * on the neutral fill, with the band mark they already carry. Run on every
   * built segment before shedding, so a gauge that is shed cannot pass the
   * red to another by being absent.
   */
  const leaveOneRed = (segs) => {
    const order = new Map(SEGMENTS.map((s) => [s.key, s.line * 1000 + s.order]));
    const critical = segs
      .filter((s) => s.band === "critical" && typeof s.pct === "number")
      .sort((a, b) => b.pct - a.pct || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
    for (const seg of critical.slice(1)) {
      seg.color = ROLE.neutral;
      seg.tone = ROLE.critical;
    }
  };

  const sleeping =
    Boolean(activity) && !activity.awaiting && !activity.working && typeof activity.idleMs === "number" && activity.idleMs >= 5 * 60_000;
  const assemble = () => {
    const built = [...content, ...buildLine3()];
    leaveOneRed(built);
    collect(built);
    const byLineNumber = new Map([1, 2, 3, 4].map((n) => [n, []]));
    for (const seg of built) {
      const placed = attach(seg);
      if (placementFor(seg.key)?.on === false) continue;
      // The pill style adds two caps to every chip, which the fit has to know.
      if (roundStyle) placed.extra = 1;
      // The wide padding adds one column to every chip after the first.
      if (widePadding && !roundStyle) placed.extra = 1;
      // A sleeping session recedes: line 2 is drawn in the quiet colour.
      // A chip that has its own fill goes neutral too: a quiet text colour on a
      // flamingo fill would change nothing a reader could see.
      if (sleeping && placed.line === 2) {
        placed.color = ROLE.neutral;
        placed.quiet = true;
      }
      byLineNumber.get(placed.line)?.push(placed);
    }
    const out = [];
    const lines = [];
    for (const line of [1, 2, 3, 4]) {
      // The sort is stable, so segments sharing an order keep the sequence
      // they were built in, and the skill chips keep theirs.
      const row = byLineNumber.get(line).sort((a, b) => a.order - b.order);
      if (!row.length) continue;
      // Past the floor only when the directory is all that is left and it
      // still does not fit: a cut label beats a wrapped line.
      const fitted = fitRow(trimDir(row, MIN_DIR_COLUMNS));
      out.push(fitted.length === 1 ? trimDir(fitted, 0) : fitted);
      lines.push(line);
    }
    return { rows: out, lines };
  };

  const assembled = assemble();


  rows.push(...assembled.rows);
  rendered.push(...assembled.lines);

  // The pool is complete once every line has been built, and it is the
  // whole answer for a caller that asked for it: what follows is layout,
  // which is exactly what such a caller intends to decide for itself.
  if (asPool) return pool;

  // Which lines the window has room for. Everything comes back the moment
  // the rows do: shedding answers the terminal, it is not a mode the bar
  // gets stuck in.
  const keep = linesToRender(maxHeight, rendered);
  const surviving = rows
    .map((row, i) => ({ line: rendered[i], row }))
    .filter((entry) => keep.includes(entry.line));
  // Padding the first segment of each line to a common width lines the
  // boundaries up down the bar. It yields to the width limit, line by line,
  // inside `alignColumns`.
  const aligned = alignColumns(surviving.map((entry) => entry.row), maxWidth);
  // `CLAUDE_STATUSLINE_BLOCK=1`: every line is padded to the widest one with
  // spaces on `mantle`, so the right edge is a block and not a ragged one.
  const block = process.env.CLAUDE_STATUSLINE_BLOCK === "1" && colourEnabled();
  // `CLAUDE_STATUSLINE_HAIRLINE=1`: an overline (SGR 53) across line 1, which
  // is a rule above the bar without being a fourth line. A terminal that does
  // not draw it ignores it. It is not a colour, so it stays with `NO_COLOR`
  // only where there is no other escape to add: it is skipped there.
  const hairline = process.env.CLAUDE_STATUSLINE_HAIRLINE === "1" && colourEnabled();
  const texts = surviving.map((entry, i) => {
    const text = renderRow(palette, aligned[i], opts);
    // Every reset in the row clears the overline too, so it is set again after each.
    return hairline && entry.line === 1 ? `\x1b[53m${text.replace(/\x1b\[0m/g, "\x1b[0m\x1b[53m")}\x1b[0m` : text;
  });
  const widest = block ? Math.max(0, ...texts.map((text) => displayWidth(text))) : 0;
  const drawn = surviving.map((entry, i) => {
    let text = texts[i];
    if (block) {
      const pad = widest - displayWidth(text);
      if (pad > 0) text += `${bgSeq(palette.mantle)}${" ".repeat(pad)}\x1b[0m`;
    }
    return { line: entry.line, text };
  });
  if (asRows) return drawn;
  // Under Copilot, which has no subagent row setting, the rows follow the
  // bar's lines in the same output. They are not lines of the bar: they never
  // count toward the three, and the per-line view above never sees them
  // (Principle II, specs/030-copilot-agent-rows).
  if (!trailingRows) return drawn.map((entry) => entry.text).join("\n");
  const agentRows = isCopilot ? harnessAgentRows(agentList, { columns: maxWidth, palette, now, cap: AGENT_ROW_CAP, asciiArrows }) : [];
  // The gates, in Claude Code and Copilot alike, unless the arrangement
  // switched them off. They are the first thing a short window gives up,
  // before any of the bar's own lines; the line 1 chip still counts them.
  const gateRowsFit = gateRowCount > 0 && drawn.length + agentRows.length + gateRowCount <= maxHeight;
  const gateLines =
    gateRowsFit && placementFor("gates")?.on !== false
      ? gateRows(gateRuns, { columns: maxWidth, palette, now, here: gateHere, glyphs: g, cap: GATE_ROW_CAP })
      : [];
  return [...drawn.map((entry) => entry.text), ...agentRows, ...gateLines].join("\n");
}

/**
 * The worktree this session is in, among the ones running a gate: the run
 * whose worktree path contains the session's directory, longest first.
 */
export function hereOf(runs, cwd, { platform = process.platform } = {}) {
  if (!cwd || !runs.length) return null;
  // Both sides are compared resolved and in one spelling. git prints a
  // worktree's real path while the payload's cwd can come through a symlink
  // (macOS's /tmp is /private/tmp), and on Windows git writes `C:/x` where the
  // payload writes `C:\x`, with the drive letter in either case. Returned as
  // the run stored it, because the rows match on that.
  const p = platform === "win32" ? path.win32 : path.posix;
  const key = (s) => {
    let resolved;
    try {
      resolved = realpathSync(s);
    } catch {
      resolved = s;
    }
    resolved = p.resolve(resolved);
    return platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  const here = key(cwd);
  const inside = (root) => here === root || here.startsWith(root.endsWith(p.sep) ? root : root + p.sep);
  const hits = runs
    .map((r) => r?.path)
    .filter((q) => typeof q === "string" && q)
    .map((q) => ({ q, root: key(q) }))
    .filter(({ root }) => inside(root));
  return hits.sort((a, b) => b.root.length - a.root.length)[0]?.q ?? null;
}

/**
 * A label cut from the left to fit `columns`, with a leading ellipsis, or
 * null when it already fits or cannot usefully be cut.
 *
 * Measured in columns rather than characters, so a name written in emoji or
 * CJK loses the right amount rather than half of it.
 */
function trimFromLeft(label, columns) {
  const target = Math.max(3, columns);
  if (displayWidth(label) <= target) return null;
  // The ellipsis is Ambiguous, so it is two columns where Ambiguous is drawn
  // wide; reserving a fixed one let a cut label overflow by a column there.
  const tail = displayWidth("…/");
  const chars = [...label];
  let kept = [];
  let width = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    const next = width + displayWidth(chars[i]);
    if (next > target - tail) break;
    kept.unshift(chars[i]);
    width = next;
  }
  // The cut is said in the quiet colour (E49): what is left is the name.
  return kept.length ? `${QUIET}…/${MARK_OFF}${kept.join("")}` : null;
}
