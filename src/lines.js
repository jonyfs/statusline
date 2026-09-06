/**
 * Line renderers for the 4-line statusline layout (spec 016).
 *
 * Each line handles specific information:
 * - Line 1: Repository context (folder, remote, branch, status)
 * - Line 2: Skills & activity (agents, skills, working/idle)
 * - Line 3: Harness context (model, effort, feature, tasks)
 * - Line 4: Token usage (duration, RTK, context %, rate limits)
 */

/**
 * Line 1: Repository & Branch Context
 * Shows: folder, remote, branch, divergence, modified/added, conflicts, PR, CI
 */
export function renderLine1(data) {
  const parts = [];

  // Folder
  if (data.dir?.value) {
    parts.push(`📁 ${data.dir.value}`);
  }

  // Remote
  if (data.remote?.value) {
    parts.push(`↙ ${data.remote.value.split('/').pop()}`);
  }

  // Branch & divergence
  if (data.git?.value) {
    const git = data.git.value;
    const branch = git.detached ? `● ${git.commit.slice(0, 7)}` : `⎇ ${git.branch}`;
    parts.push(branch);
    if (git.ahead || git.behind) {
      const div = [];
      if (git.ahead) div.push(`+${git.ahead}`);
      if (git.behind) div.push(`-${git.behind}`);
      parts.push(`⇅ ${div.join(' ')}`);
    }
  }

  // Modified/Added
  if (data.git?.value) {
    const git = data.git.value;
    const status = [];
    if (git.modified) status.push(`${git.modified}M`);
    if (git.added) status.push(`${git.added}A`);
    if (status.length) parts.push(`◆ ${status.join(' ')}`);
  }

  // Conflicts
  if (data.git?.value?.conflict) {
    parts.push(`⚠ unmerged`);
  }

  // PR
  if (data.pr?.value) {
    const pr = data.pr.value;
    const icon = pr.state === "passed" ? "✓" : pr.state === "failed" ? "✗" : "◐";
    parts.push(`PR #${pr.number} ${icon}`);
  }

  // CI
  if (data.ci?.value) {
    const ci = data.ci.value;
    const icon = ci.state === "passed" ? "✓" : ci.state === "failed" ? "✗" : "◐";
    parts.push(`CI ${icon}`);
  }

  return parts.join("  ");
}

/**
 * Line 2: Skills & Activity Status
 * Shows: activity (working/idle), shell count, agent count, agent/skills display
 */
export function renderLine2(data) {
  const parts = [];

  // Activity
  if (data.activity?.value) {
    const working = data.activity.value.working;
    const icon = working ? "🔵" : "○";
    const status = working ? "working" : "idle";
    parts.push(`${icon} ${status}`);
  }

  // Shell & agent count
  if (data.shells !== undefined || data.agentCount !== undefined) {
    const shells = data.shells ? `${data.shells} shells` : "";
    const agents = data.agentCount ? `← ${data.agentCount} agent${data.agentCount > 1 ? "s" : ""}` : "";
    const counts = [shells, agents].filter(Boolean).join(" · ");
    if (counts) parts.push(counts);
  }

  // Skills display
  if (data.skills?.value?.[0]) {
    parts.push(`🧩 ${data.skills.value[0]}`);
    if (data.skills.hiddenCount > 0) {
      parts[parts.length - 1] += ` +${data.skills.hiddenCount}`;
    }
  }

  return parts.join("  ");
}

/**
 * Line 3: Harness & Execution Context
 * Shows: model, effort, feature ID (Spec Kit), task progress
 */
export function renderLine3(data) {
  const parts = [];

  // Model
  if (data.model?.value) {
    let label = data.model.value;
    if (data.context?.value) {
      label += ` (${data.context.value})`;
    }
    parts.push(`🤖 ${label}`);
  }

  // Effort
  if (data.effort?.value) {
    const effort = data.effort.value;
    const icons = { low: "⚡", medium: "⚡⚡", high: "⚡⚡⚡", max: "⚡⚡⚡⚡" };
    const icon = icons[effort] || "⚡";
    parts.push(`${icon.charAt(0)} ${effort}`);
  }

  // Feature (Spec Kit)
  if (data.feature?.value) {
    parts.push(`🎯 ${data.feature.value}`);
  }

  // Task progress
  if (data.taskProgress) {
    const { done, total } = data.taskProgress;
    if (total > 0) {
      parts.push(`📋 ${done}/${total} ✓`);
    }
  }

  return parts.join("  ");
}

/**
 * Line 4: Context & Token Usage
 * Shows: session duration, RTK savings, context usage, rate limits
 */
export function renderLine4(data) {
  const parts = [];

  // Duration
  if (data.duration?.value && data.limit?.value) {
    parts.push(`⏱ ${data.duration.value} / ${data.limit.value}`);
  }

  // RTK savings
  if (data.rtk?.value !== null && data.rtk?.value !== undefined) {
    const savings = typeof data.rtk.value === "number" ? data.rtk.value : 0;
    parts.push(`🔥 ${savings}% (rtk)`);
  }

  // Context & rate limit
  const metrics = [];
  if (data.contextPercent !== undefined) {
    metrics.push(`Context: ${data.contextPercent}%`);
  }
  if (data.ratePercent !== undefined && data.rateReset) {
    metrics.push(`Rate: ${data.ratePercent}% · ${data.rateReset} limit`);
  }
  if (metrics.length) {
    parts.push(`📊 ${metrics.join(" · ")}`);
  }

  return parts.join("  ");
}
