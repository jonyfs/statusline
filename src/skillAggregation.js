/**
 * Aggregates, deduplicates, and formats skills from multiple sources:
 * directly-invoked skills and agent-based skills. Produces grouped display
 * format for the skills line (e.g., "Agente-A: skill1, skill2; Agente-B: skill3").
 *
 * Deduplication: Same skill invoked by multiple agents shows once.
 * Grouping: Skills are grouped by agent name for clarity.
 * Overflow: Handled by caller (arrangement.js); this module produces honest count.
 */

/**
 * Aggregates direct skills and agent skills into a single deduplicated set,
 * organized by agent label (name or id) or as "direct" (for top-level).
 *
 * @param {string[]} directSkills - Array of skill names from top-level session
 * @param {Array} activeAgents - Array of {id, name, skills, status} from stdin payload
 * @returns {Object} { skillsByAgent: Map<agentLabel, Set<string>>, allSkills: Set<string>, agentLabels: Map }
 */
export function aggregateSkills(directSkills = [], activeAgents = []) {
  const skillsByAgent = new Map();
  const allSkills = new Set();
  const agentLabels = new Map(); // Maps ID to display label

  // Add direct skills under "direct" agent
  if (Array.isArray(directSkills) && directSkills.length > 0) {
    const directSet = new Set(
      directSkills.filter((s) => typeof s === "string" && s.length > 0)
    );
    if (directSet.size > 0) {
      skillsByAgent.set("direct", directSet);
      directSet.forEach((s) => allSkills.add(s));
    }
  }

  // Add agent skills grouped by agent, use display label
  if (Array.isArray(activeAgents)) {
    for (const agent of activeAgents) {
      if (!agent || typeof agent.id !== "string" || !Array.isArray(agent.skills)) continue;
      // Include agents with status "running" or missing status (payload may not include status).
      // Only skip agents with explicit terminal statuses (finished, completed, failed, error).
      if (agent.status && ["finished", "completed", "failed", "error"].includes(agent.status)) continue;

      const agentSkillSet = new Set(
        agent.skills.filter((s) => typeof s === "string" && s.length > 0)
      );
      if (agentSkillSet.size > 0) {
        // Use agent name if available, otherwise use ID. Format: "Agente-A" or "Agent-explorer"
        const displayLabel = agent.name ? `Agente-${agent.name}` : `Agente-${agent.id}`;
        skillsByAgent.set(agent.id, agentSkillSet);
        agentLabels.set(agent.id, displayLabel);
        agentSkillSet.forEach((s) => allSkills.add(s));
      }
    }
  }

  return { skillsByAgent, allSkills, agentLabels };
}

/**
 * Formats aggregated skills for display: groups by agent, separated by semicolon.
 * Example: "Agente-A: skill1, skill2; Agente-B: skill3"
 *
 * @param {Map<string, Set>} skillsByAgent - Map from aggregateSkills() result
 * @param {Map<string, string>} agentLabels - Maps agent ID to display label
 * @returns {string} Formatted string or empty string if no skills
 */
export function formatForDisplay(skillsByAgent, agentLabels = new Map()) {
  if (!skillsByAgent || skillsByAgent.size === 0) return "";

  const groups = [];
  // Process "direct" first if present (top-level session skills come first)
  if (skillsByAgent.has("direct")) {
    const skills = Array.from(skillsByAgent.get("direct")).sort();
    groups.push(skills.join(", "));
  }

  // Then agent skills in insertion order
  for (const [agentId, skills] of skillsByAgent) {
    if (agentId === "direct") continue;
    const skillList = Array.from(skills).sort();
    const displayLabel = agentLabels.get(agentId) || agentId;
    groups.push(`${displayLabel}: ${skillList.join(", ")}`);
  }

  return groups.join("; ");
}

/**
 * Gets total count of distinct skills across all agents and direct skills.
 *
 * @param {Set<string>} allSkills - Set from aggregateSkills() result
 * @returns {number} Count of distinct skill names
 */
export function getTotalSkillCount(allSkills) {
  return allSkills ? allSkills.size : 0;
}

/**
 * Gets skills for overflow calculation (how many skills beyond those displayed).
 * Caller provides limit (e.g., 3 skills can be shown); this returns count of remaining.
 *
 * @param {Set<string>} allSkills - Set from aggregateSkills() result
 * @param {number} displayLimit - How many skills can be shown on line
 * @returns {number} Count of skills not shown (0 if all fit)
 */
export function getHiddenSkillCount(allSkills, displayLimit) {
  const total = getTotalSkillCount(allSkills);
  return Math.max(0, total - displayLimit);
}
