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
  getActiveSkillsTrueCount: () => 0,
  subagentActivity: () => [],
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
export const fullPayload = (over = {}) => {
  // Tests pass a fixed `now` to the renderer; resets must be relative to that
  // same instant or they drift across the calendar and eventually read as
  // unknown (a 30-day cap rejects implausibly far resets).
  const baseMs = over.now ?? Date.now();
  const baseSec = Math.floor(baseMs / 1000);
  return {
    model: { display_name: "Sonnet 5" },
    effort: { level: "high" },
    context_window: { used_percentage: 26 },
    rate_limits: {
      five_hour: { used_percentage: 20, resets_at: baseSec + 3600 },
      seven_day: { used_percentage: 77, resets_at: baseSec + 86400 },
    },
    ...over,
  };
};
