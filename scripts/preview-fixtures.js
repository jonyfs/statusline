/**
 * Fixed scenarios the previews are generated from. Every payload field
 * below matches the real shape Claude Code sends on the statusLine
 * command's stdin (captured from a live session), and the `sources`
 * values stand in for the real git/gh/transcript/rtk probes so previews
 * stay reproducible instead of showing whichever branch happened to be
 * checked out when they were generated.
 */

import { readFileSync } from "node:fs";
import { foldRollout, rolloutPayload, rolloutActivity } from "../src/codexRollout.js";

// Fixed instant so countdown labels don't churn on every regeneration.
// 2026-08-24T12:00:00Z.
export const FIXED_NOW = 1787572800;

/**
 * A real Codex CLI rollout (0.122, Plus plan, stripped of every prompt and
 * answer: scripts/tests/fixtures/codex-rollout-preview.jsonl), moved in time
 * so it ends 30 seconds before FIXED_NOW. Every instant in it moves by the
 * same amount, so the resets and the session length read as they did when the
 * session ran. Then it goes through the same adapter the `codex-pane` command
 * uses (specs/035-codex-pane).
 */
function codexPreviewState() {
  const text = readFileSync(new URL("./tests/fixtures/codex-rollout-preview.jsonl", import.meta.url), "utf8");
  const records = text.trim().split("\n").map((l) => JSON.parse(l));
  const lastAt = Date.parse(records[records.length - 1].timestamp) / 1000;
  const shift = FIXED_NOW - 30 - lastAt;
  const iso = (s) => new Date(Date.parse(s) + shift * 1000).toISOString();
  const secs = (o, key) => {
    if (o && typeof o[key] === "number") o[key] = Math.round(o[key] + shift);
  };
  for (const r of records) {
    r.timestamp = iso(r.timestamp);
    const p = r.payload ?? {};
    if (r.type === "session_meta") p.timestamp = iso(p.timestamp);
    secs(p, "started_at");
    secs(p, "completed_at");
    secs(p.rate_limits?.primary, "resets_at");
    secs(p.rate_limits?.secondary, "resets_at");
  }
  return foldRollout(records.map((r) => JSON.stringify(r)).join("\n"));
}
const codexState = codexPreviewState();

const basePayload = {
  session_id: "preview",
  model: { display_name: "Sonnet 5" },
  effort: { level: "high" },
  cwd: "/Users/dev/projects/statusline",
  workspace: { current_dir: "/Users/dev/projects/statusline" },
  context_window: { used_percentage: 26 },
  rate_limits: {
    // The 5-hour window resets within the day; the 7-day one lands on a
    // later date, which is what makes the weekday appear in its segment.
    five_hour: { used_percentage: 20, resets_at: FIXED_NOW + 7740 },
    seven_day: { used_percentage: 77, resets_at: FIXED_NOW + 3 * 86400 + 21600 },
  },
};

/**
 * Every probe the renderer can reach, stubbed.
 *
 * Principle VIII: a preview must not read the machine that generated it. A
 * probe missing from this list falls through to the real one, which is how
 * preview generation started spawning background refreshes on a CI runner.
 */
const noSources = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getCiStatus: () => null,
  getActiveSkills: () => [],
  getActiveSkillsTrueCount: () => 0,
  subagentActivity: () => [],
  getSessionActivity: () => null,
  getRtkSavings: () => null,
  getDirUrl: () => null,
  // A preview never starts a real update check, and shows a notice only when
  // a case asks for one.
  maybeStartUpdateCheck: () => false,
  getUpdateNotice: () => null,
  // No git gate runs unless a case shows them (specs/031-git-gate-rows).
  getGateRuns: () => null,
  // Whether the directory is a repository is the git snapshot's to say here,
  // never the machine generating the preview.
  isRepo: () => false,
  // Copilot CLI's terminal, settings and monthly quota, never the machine's
  // (specs/033-copilot-parity).
  readTty: () => null,
  copilotSettings: () => ({}),
  getCopilotQuota: () => null,
};

export const SCENARIOS = [
  {
    file: "full.svg",
    title: "Everything available — GitHub repo with an open PR, skills active, rtk installed",
    payload: {
      ...basePayload,
      // Both of these come from Claude Code's own payload rather than from a
      // subprocess, which is what feature 002 changed.
      workspace: {
        ...basePayload.workspace,
        repo: { host: "github.com", owner: "jonyfs", name: "statusline" },
      },
      pr: {
        number: 128,
        url: "https://github.com/jonyfs/statusline/pull/128",
        review_state: "approved",
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "feature/preview-images", upstream: "origin/feature/preview-images", ahead: 2, behind: 0, changed: 4, untracked: 1 }),
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
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "gate-rows.svg",
    title: "Git gates running in three worktrees of the repository: a count on line 1, a row each after the bar, one waiting for another run's lock",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "harness/gate-cache", upstream: "origin/harness/gate-cache", ahead: 1, behind: 0, changed: 3, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
      getGateRuns: () => [
        { pid: 1, hook: "pre-commit", worktree: "statusline", path: "/Users/dev/projects/statusline", branch: "harness/gate-cache", step: "gates.sh \u203a review-cycle.test.sh", startedAt: FIXED_NOW * 1000 - 184000, state: "running" },
        { pid: 2, hook: "pre-push", worktree: "statusline-docs", path: "/Users/dev/projects/statusline-docs", branch: "docs/readme-tour", step: "npm run lint \u00b7 npm run typecheck \u00b7 npm test", startedAt: FIXED_NOW * 1000 - 72000, state: "running" },
        { pid: 3, hook: "pre-commit", worktree: "statusline", path: "/Users/dev/projects/statusline", branch: "harness/gate-cache", step: null, startedAt: FIXED_NOW * 1000 - 12000, state: "waiting" },
      ],
    },
  },
  {
    file: "copilot.svg",
    title: "Under GitHub Copilot CLI: the model Auto routed to, its effort, the account's monthly quota and the session's AI credits",
    // The shape Copilot CLI 1.0.91 sends (specs/033-copilot-parity): no rate
    // limits, no effort, `auto` for the model, and its own two fields.
    payload: {
      session_id: "preview-copilot",
      cwd: "/Users/dev/projects/statusline",
      model: { id: "auto", display_name: "Auto", auto_tier: null, pending_auto_tier: null },
      workspace: { current_dir: "/Users/dev/projects/statusline" },
      version: "1.0.91",
      cost: { total_duration_ms: 1000 * 60 * 23, total_lines_added: 42, total_lines_removed: 7, total_premium_requests: 0 },
      context_window: { used_percentage: 18, current_context_used_percentage: 18, displayed_context_limit: 200000 },
      ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64" },
      allow_all_enabled: false,
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "feat/copilot-parity", upstream: "origin/feat/copilot-parity", ahead: 1, behind: 0, changed: 3, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      // What Copilot's session log and session.db answer: the effort and the
      // routed model from the log, the todos from the database.
      getSessionActivity: () => ({
        skills: ["code-review"],
        skillsTrueCount: 1,
        todos: { done: 2, total: 5, current: "Read the session database" },
        working: true,
        effort: "medium",
        resolvedModel: "gpt-6-luna",
        sessionLimit: null,
        agents: [],
      }),
      getRtkSavings: () => 81,
      getCopilotQuota: () => ({
        resetDate: "2026-09-01",
        quotas: {
          premium: { usedPct: 24, entitlement: 300, unlimited: false, full: false },
          chat: { usedPct: 3, entitlement: 200, unlimited: false, full: false },
        },
      }),
    },
  },
  {
    file: "codex-pane.svg",
    title: "In a 3-line pane under OpenAI Codex CLI: a real Codex rollout through the adapter, drawn by the same renderer",
    // The pane's size: three rows, as `statusline codex` opens it.
    height: 3,
    payload: rolloutPayload(codexState, { now: FIXED_NOW * 1000 }),
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "feat/codex-pane", upstream: "origin/feat/codex-pane", ahead: 2, behind: 0, changed: 4, untracked: 1 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getSessionActivity: () => rolloutActivity(codexState),
      getRtkSavings: () => 74,
    },
  },
  {
    file: "multi-agent.svg",
    title: "Four subagents running in parallel — line 2 names three with the tier and age the tick reported, and counts the fourth",
    payload: {
      ...basePayload,
      workspace: {
        ...basePayload.workspace,
        repo: { host: "github.com", owner: "jonyfs", name: "statusline" },
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 2, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["speckit-implement", "humanizer"],
      getActiveSkillsTrueCount: () => 2,
      getSessionActivity: () => ({ skills: ["speckit-implement", "humanizer"], skillsTrueCount: 2, todos: null, working: true }),
      subagentActivity: () => ["explore", "code-review", "pr-review", "docs"],
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
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
    },
  },
  {
    file: "git-state.svg",
    title: "All four working-tree counters at once: modified, untracked, to push, to pull",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({
        branch: "feature/git-state",
        upstream: "origin/feature/git-state",
        ahead: 2,
        behind: 5,
        changed: 3,
        untracked: 7,
      }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "git-clean.svg",
    title: "The same branch clean and in sync: every counter is omitted, not shown as zero",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({
        branch: "feature/git-state",
        upstream: "origin/feature/git-state",
        ahead: 0,
        behind: 0,
        changed: 0,
        untracked: 0,
      }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "behind-upstream.svg",
    title: "Branch both ahead of and behind its upstream, with a draft pull request",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "fix/reset-countdown", upstream: "origin/fix/reset-countdown", ahead: 3, behind: 7, changed: 1, untracked: 0 }),
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
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review", "dataviz", "artifact-design"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "limit-lifted.svg",
    title: "The 5-hour window used up, and an administrator's spend limit being spent behind a Claude gateway",
    payload: {
      ...basePayload,
      context_window: { used_percentage: 44 },
      rate_limits: {
        five_hour: { used_percentage: 100, resets_at: FIXED_NOW + 5040 },
        seven_day: { used_percentage: 71, resets_at: FIXED_NOW + 3 * 86400 + 21600 },
        spend_limit: { used_percentage: 23, resets_at: FIXED_NOW + 12 * 86400 },
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "prompt-cache-cold.svg",
    title: "Back from a break: the prompt cache went cold, what the next request writes again, and why",
    payload: {
      ...basePayload,
      context_window: { used_percentage: 58 },
      prompt_cache: {
        warm: false,
        caching_observed: true,
        ttl: "5m",
        expires_at: null,
        recache_tokens_if_cold: 184000,
        last_miss_cause: { causes: ["tools_changed"] },
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getRtkSavings: () => 81,
    },
  },
  {
    file: "update-ready.svg",
    title: "The daily check found improvements and fixes upstream, in notify",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getRtkSavings: () => 81,
      getUpdateNotice: () => ({ state: "ready", text: "update ready \u00b7 1 feature, 2 fixes" }),
    },
  },
  {
    file: "no-upstream.svg",
    title: "A branch with no upstream — no ahead/behind counters at all, which is not the same as being in sync",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({
        branch: "local-only-work",
        upstream: null,
        ahead: null,
        behind: null,
        changed: 2,
        untracked: 1,
      }),
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "detached-head.svg",
    title: "Detached HEAD — the commit id behind a commit icon, with no branch link",
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({
        branch: "9f21c04",
        detached: true,
        oid: "9f21c04b8e5d2a17c3f6",
        upstream: null,
        ahead: null,
        behind: null,
        changed: 0,
        untracked: 0,
      }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getRtkSavings: () => 81,
    },
  },
  {
    file: "skills-truncated.svg",
    title: "More skills active than the line shows — the rest are counted rather than hidden",
    payload: { ...basePayload, output_style: { name: "explanatory" } },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review", "dataviz", "artifact-design", "humanizer", "mermaid"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "narrow.svg",
    title: "Eighty columns — the priority table decides what survives",
    width: 80,
    payload: {
      ...basePayload,
      context_window: { used_percentage: 38, total_input_tokens: 15500, total_output_tokens: 1200, context_window_size: 200000 },
      cost: { total_duration_ms: 3840000, total_api_duration_ms: 1320000, total_lines_added: 156, total_lines_removed: 23 },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "feature/preview-images", upstream: "origin/feature/preview-images", ahead: 2, behind: 0, changed: 4, untracked: 1, conflicts: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
      getRtkSavings: () => 81,
    },
  },
  {
    file: "short-window.svg",
    title: "A window with room for two rows — lines are shed, never wrapped",
    height: 2,
    payload: basePayload,
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0, conflicts: 0 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
      getActiveSkills: () => ["code-review"],
    },
  },
  {
    file: "near-compaction.svg",
    title: "Close to the context limit — the ramp changes the bar's shape, not only its colour",
    payload: {
      ...basePayload,
      context_window: { used_percentage: 92, total_input_tokens: 184000, total_output_tokens: 2000, context_window_size: 200000 },
      rate_limits: {
        five_hour: { used_percentage: 88, resets_at: FIXED_NOW + 1320 },
        seven_day: { used_percentage: 96, resets_at: FIXED_NOW + 9300 },
      },
    },
    sources: {
      ...noSources,
      getGitInfo: () => ({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, changed: 0, untracked: 0, conflicts: 2 }),
      getRemoteUrl: () => "https://github.com/jonyfs/statusline",
    },
  },
];

export const EXTRA_FLAVORS = ["nord", "gruvbox"];

export const FLAVOR_SCENARIO = {
  payload: SCENARIOS[0].payload,
  sources: SCENARIOS[0].sources,
};

/**
 * A tick of subagent rows, for the illustration in the README.
 *
 * Three agents rather than two, because the row's sparse columns only show
 * their cost when at least one row fills them and the others do not — which
 * is the whole point of the order and cannot be seen with a single agent.
 * Start times are offsets from the frozen clock so the ages do not drift.
 */
export const TASK_ROWS_SCENARIO = {
  file: "agent-rows.svg",
  title: "Three subagents, aligned against each other",
  columns: 200,
  skills: [
    ["b", ["humanizer"]],
    ["c", ["code-review", "humanizer"]],
  ],
  tasks: [
    {
      id: "a",
      name: "local_agent",
      description: "Close the nine findings on PR 67",
      label: "Staging all fixer changes for commit",
      model: "claude-sonnet-5",
      effort: "high",
      status: "running",
      startTime: FIXED_NOW * 1000 - 3_840_000,
      tokenCount: 271_273,
      contextWindowSize: 1_000_000,
    },
    {
      id: "b",
      name: "local_agent",
      description: "Resolve the conflict and the three on PR 68",
      label: "Restoring review-debt.sh from backup",
      model: "claude-sonnet-5",
      effort: "high",
      status: "running",
      startTime: FIXED_NOW * 1000 - 2_820_000,
      tokenCount: 181_390,
      contextWindowSize: 1_000_000,
    },
    {
      id: "c",
      name: "pr-shepherd",
      description: "Review gate 39 of the contract",
      label: "Reading docs/governance/gate-39.md",
      model: "claude-opus-5",
      effort: "xhigh",
      status: "queued",
      startTime: FIXED_NOW * 1000 - 60_000,
      tokenCount: 9_120,
      contextWindowSize: 1_000_000,
    },
  ],
};
