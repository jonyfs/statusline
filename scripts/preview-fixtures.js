/**
 * Fixed scenarios the previews are generated from. Every payload field
 * below matches the real shape Claude Code sends on the statusLine
 * command's stdin (captured from a live session), and the `sources`
 * values stand in for the real git/gh/transcript/rtk probes so previews
 * stay reproducible instead of showing whichever branch happened to be
 * checked out when they were generated.
 */

// Fixed instant so countdown labels don't churn on every regeneration.
// 2026-08-24T12:00:00Z.
export const FIXED_NOW = 1787572800;

const basePayload = {
  session_id: "preview",
  model: { display_name: "Sonnet 5" },
  effort: { level: "high" },
  cwd: "/Users/dev/projects/statusline",
  workspace: { current_dir: "/Users/dev/projects/statusline" },
  context_window: { used_percentage: 26 },
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: FIXED_NOW + 7740 },
    seven_day: { used_percentage: 77, resets_at: FIXED_NOW + 24540 },
  },
};

const noSources = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getActiveSkills: () => [],
  getRtkSavings: () => null,
  getDirUrl: () => null,
};

export const SCENARIOS = [
  {
    file: "full.svg",
    title: "Everything available — GitHub repo with an open PR, skills active, rtk installed",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "feature/preview-images", ahead: 2, behind: 0, dirtyCount: 4 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getPrInfo: () => ({ number: 128, state: "OPEN", isDraft: false, url: "https://github.com/jonyfs/statusline/pull/128" }),
      getActiveSkills: () => ["code-review", "dataviz", "artifact-design"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "no-pr.svg",
    title: "On a branch with no open pull request — the PR segment is omitted, not faked",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", ahead: 0, behind: 0, dirtyCount: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "no-git.svg",
    title: "Outside a git repository — line 1 keeps the directory and drops the rest",
    payload: basePayload,
    sources: {
      ...noSources,
      getActiveSkills: () => ["dataviz"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "minimal.svg",
    title: "No git, no skills, no rtk — the skills line disappears entirely, leaving three lines",
    payload: basePayload,
    sources: noSources,
  },
  {
    file: "missing-fields.svg",
    title: "Older Claude Code with no rate-limit fields — unknown values show ?%, never a guess",
    payload: {
      session_id: "preview",
      model: { display_name: "Sonnet 5" },
      effort: { level: "high" },
      cwd: "/Users/dev/projects/statusline",
      workspace: { current_dir: "/Users/dev/projects/statusline" },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", ahead: 0, behind: 0, dirtyCount: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
    },
  },
  {
    file: "behind-upstream.svg",
    title: "Branch both ahead of and behind its upstream, with a draft pull request",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "fix/reset-countdown", ahead: 3, behind: 7, dirtyCount: 1 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getPrInfo: () => ({ number: 131, state: "OPEN", isDraft: true, url: "https://github.com/jonyfs/statusline/pull/131" }),
      getActiveSkills: () => ["code-review", "dataviz"],
      getRtkSavings: () => 74,
    },
  },
  {
    file: "near-limit.svg",
    title: "Close to the weekly rate limit, with a nearly full context window",
    payload: {
      ...basePayload,
      context_window: { used_percentage: 91 },
      rate_limits: {
        five_hour: { used_percentage: 88, resets_at: FIXED_NOW + 1320 },
        seven_day: { used_percentage: 96, resets_at: FIXED_NOW + 9300 },
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", ahead: 0, behind: 0, dirtyCount: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review", "dataviz", "artifact-design"],
      getRtkSavings: () => 81,
    },
  },
];

export const FLAVOR_SCENARIO = {
  payload: SCENARIOS[0].payload,
  sources: SCENARIOS[0].sources,
};
