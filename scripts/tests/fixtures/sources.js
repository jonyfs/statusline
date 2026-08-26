/**
 * Probe stubs for the renderer.
 *
 * Every test that renders passes these, so a case never reads the machine
 * it runs on: the branch, the pull request and the usage figures of
 * whoever runs `npm test` must not decide whether it passes.
 */
export const emptySources = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getActiveSkills: () => [],
  getRtkSavings: () => null,
  getDirUrl: () => null,
};

/** `emptySources` with a git repository present, and any field overridden. */
export const gitSources = (over = {}) => ({
  ...emptySources,
  getGitInfo: () => ({
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    changed: 0,
    untracked: 0,
    ...over,
  }),
});

/** A payload with every usage field present, for cases that need a full line 4. */
export const fullPayload = (over = {}) => ({
  model: { display_name: "Sonnet 5" },
  effort: { level: "high" },
  context_window: { used_percentage: 26 },
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: Math.floor(Date.now() / 1000) + 3600 },
    seven_day: { used_percentage: 77, resets_at: Math.floor(Date.now() / 1000) + 86400 },
  },
  ...over,
});
