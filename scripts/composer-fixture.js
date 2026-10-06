/**
 * The one session the composer page draws from.
 *
 * Every segment the bar can render has to have a value here, because the
 * page's whole job is letting somebody move segments around and see what
 * happens. A segment with nothing to say would be missing from the page for
 * a reason that has nothing to do with the arrangement being built, and the
 * person moving things would learn the wrong lesson from its absence.
 *
 * Fixed for the same reason `scripts/preview-fixtures.js` is fixed: the page
 * is generated output, and regenerating it without a code change must
 * produce no diff. Nothing here reads the machine.
 */

// Pinned, not defaulted. Clock faces and reset labels derive from LOCAL
// time, so this fixture renders a different bar in UTC-3 than it does on a
// CI runner in UTC, and the committed golden output would be a fact about
// whoever generated it. `scripts/generate-previews.js` pins it the same way
// and for the same reason. Nothing renders a real session from this file, so
// there is no caller whose timezone deserves to win.
process.env.TZ = "UTC";

/** 2026-08-24T12:00:00Z, the instant the previews already freeze at. */
export const FIXED_NOW = 1787572800;

const NOW_MS = FIXED_NOW * 1000;

export const PAYLOAD = {
  session_id: "composer",
  model: { display_name: "Opus 5" },
  effort: { level: "high" },
  cwd: "/Users/dev/projects/statusline",
  workspace: {
    current_dir: "/Users/dev/projects/statusline",
    project_dir: "/Users/dev/projects",
    repo: { host: "github.com", owner: "jonyfs", name: "statusline" },
  },
  // A worktree with the branch it was cut from, so both halves of the
  // worktree segment have something to draw.
  worktree: { name: "redesign", original_branch: "main" },
  pr: {
    number: 128,
    url: "https://github.com/jonyfs/statusline/pull/128",
    review_state: "approved",
  },
  context_window: { used_percentage: 46 },
  rate_limits: {
    five_hour: { used_percentage: 62, resets_at: FIXED_NOW + 7740 },
    seven_day: { used_percentage: 77, resets_at: FIXED_NOW + 3 * 86400 + 21600 },
    // A gateway setup, so the composer has the spend limit to arrange too.
    spend_limit: { used_percentage: 34, resets_at: FIXED_NOW + 12 * 86400 },
  },
  // Both modes on, so the composer has their chips to arrange.
  vim: { mode: "NORMAL" },
  fast_mode: true,
  // Copilot CLI's fields, so the composer has their chips to arrange
  // (specs/029-multi-harness). `ai_used` makes this a Copilot payload, which
  // is what draws the credits and the monthly quota (specs/033-copilot-
  // parity); the rate limits above still draw, because they are present.
  allow_all_enabled: true,
  ai_used: { total_nano_aiu: 4_200_000_000, formatted: "4.20" },
  // Cold, so the composer has the prompt-cache chip to arrange. No miss cause:
  // with one, line 3 outgrows the 200 columns the pool is checked at and the
  // session duration drops off the fixture's bar.
  prompt_cache: {
    warm: false,
    caching_observed: true,
    ttl: "5m",
    expires_at: null,
    recache_tokens_if_cold: 184000,
  },
  cost: {
    total_duration_ms: 1000 * 60 * 64,
    total_api_duration_ms: 1000 * 60 * 9,
    total_lines_added: 214,
    total_lines_removed: 87,
    total_premium_requests: 3,
  },
};

/**
 * Every probe stubbed. A probe left out falls through to the real one, which
 * is how a generated page starts describing whoever generated it.
 */
export const SOURCES = {
  getGitInfo: () => ({
    branch: "004-statusline-redesign-research",
    upstream: "origin/004-statusline-redesign-research",
    ahead: 2,
    behind: 1,
    changed: 4,
    untracked: 1,
    conflicts: 1,
    detached: false,
  }),
  getRemoteUrl: () => "https://github.com/jonyfs/statusline",
  getPrInfo: () => ({
    number: 128,
    state: "OPEN",
    isDraft: false,
    url: "https://github.com/jonyfs/statusline/pull/128",
  }),
  getCiStatus: () => ({ status: "completed", conclusion: "success", workflow: "CI" }),
  getActiveSkills: () => ["speckit-implement", "humanizer"],
  getActiveSkillsTrueCount: () => 2,
  subagentActivity: () => ["explore", "code-review"],
  getSessionActivity: () => ({
    skills: ["speckit-implement", "humanizer"],
    todos: { done: 9, total: 24, current: "the composer page" },
    working: true,
    // A Copilot session limit, so the credits chip shows its share of it.
    sessionLimit: 20,
  }),
  getRtkSavings: () => 81,
  getDirUrl: () => null,
  // An update waiting, so the composer has the update chip to arrange; and
  // never a real check from a page generator.
  maybeStartUpdateCheck: () => false,
  getUpdateNotice: () => ({ state: "ready", text: "update ready \u00b7 1 fix" }),
  // Two git gates, one in this worktree, so the composer has the gates chip
  // to arrange (specs/031-git-gate-rows).
  // A paid plan's month, so the composer has both quota chips to arrange,
  // and never a real `gh` call or terminal read from a page generator.
  getCopilotQuota: () => ({
    resetDate: "2026-09-01",
    quotas: {
      premium: { usedPct: 41, entitlement: 300, unlimited: false, full: false },
      chat: { usedPct: 12, entitlement: 200, unlimited: false, full: false },
    },
  }),
  copilotSettings: () => ({}),
  readTty: () => null,
  getGateRuns: () => [
    { pid: 101, hook: "pre-commit", worktree: "statusline", path: "/Users/dev/projects/statusline", branch: "004-statusline-redesign-research", step: "gates.sh \u203a review-cycle.test.sh", startedAt: NOW_MS - 184000, state: "running" },
    { pid: 102, hook: "pre-push", worktree: "statusline-docs", path: "/Users/dev/projects/statusline-docs", branch: "docs/readme", step: "npm test", startedAt: NOW_MS - 48000, state: "running" },
  ],
};

/**
 * A sample history, so the burn rate and the projection have something to
 * compute from. `ratePerHour` refuses a rate below five samples, refuses one
 * spanning more than fifteen minutes, and ends the history at any gap over
 * five, so this is six points two minutes apart. The slope reaches the
 * 5-hour limit before that window resets, which is the only case the
 * projection segment renders in.
 */
export const SAMPLES = [
  { at: NOW_MS - 10 * 60000, fiveHourPct: 56.2, sevenDayPct: 76.5, contextPct: 34, rtkPct: 81 },
  { at: NOW_MS - 8 * 60000, fiveHourPct: 57.4, sevenDayPct: 76.6, contextPct: 37, rtkPct: 81 },
  { at: NOW_MS - 6 * 60000, fiveHourPct: 58.6, sevenDayPct: 76.7, contextPct: 40, rtkPct: 81 },
  { at: NOW_MS - 4 * 60000, fiveHourPct: 59.8, sevenDayPct: 76.8, contextPct: 42, rtkPct: 81 },
  { at: NOW_MS - 2 * 60000, fiveHourPct: 60.9, sevenDayPct: 76.9, contextPct: 44, rtkPct: 81 },
  { at: NOW_MS, fiveHourPct: 62.0, sevenDayPct: 77.0, contextPct: 46, rtkPct: 81 },
];

/** What the page's render calls pass, in one place so the test can reuse it. */
export const RENDER_OPTIONS = {
  flavor: "mocha",
  tracking: false,
  now: NOW_MS,
  samples: SAMPLES,
  // The composer arranges the bar's segments. The rows after it (the git
  // gates this fixture has running) are not part of any arrangement.
  trailingRows: false,
};
