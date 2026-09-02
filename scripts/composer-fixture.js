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
  },
  cost: {
    total_duration_ms: 1000 * 60 * 64,
    total_api_duration_ms: 1000 * 60 * 9,
    total_lines_added: 214,
    total_lines_removed: 87,
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
  getSessionActivity: () => ({
    skills: ["speckit-implement", "humanizer"],
    todos: { done: 9, total: 24, current: "the composer page" },
    working: true,
  }),
  getRtkSavings: () => 81,
  getDirUrl: () => null,
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
};
