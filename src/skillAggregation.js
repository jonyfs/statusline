/**
 * Aggregates, deduplicates, and formats skills from multiple sources:
 * directly-invoked skills and agent-based skills. Produces grouped display
 * format for the skills line (e.g., "A: skill1, skill2; B: skill3").
 *
 * Deduplication: Same skill invoked by multiple agents shows once.
 * Grouping: Skills are grouped by agent ID for clarity.
 * Overflow: Handled by caller (arrangement.js); this module produces honest count.
 */

/**
 * Aggregates direct skills and agent skills into a single deduplicated set,
 * organized by agent identifier (for agent skills) or as "direct" (for top-level).
 *
 * @param {string[]} directSkills - Array of skill names from top-level session
 * @param {Array} activeAgents - Array of {id, name, skills, status} from stdin payload
 * @returns {Object} { skillsByAgent: Map<agentId, Set<string>>, allSkills: Set<string> }
 */
export function aggregateSkills(directSkills = [], activeAgents = []) {
  const skillsByAgent = new Map();
  const allSkills = new Set();

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

  // Add agent skills grouped by agent ID
  if (Array.isArray(activeAgents)) {
    for (const agent of activeAgents) {
      if (!agent || typeof agent.id !== "string" || !Array.isArray(agent.skills)) continue;
      if (agent.status !== "running") continue; // Only running agents

      const agentSkillSet = new Set(
        agent.skills.filter((s) => typeof s === "string" && s.length > 0)
      );
      if (agentSkillSet.size > 0) {
        skillsByAgent.set(agent.id, agentSkillSet);
        agentSkillSet.forEach((s) => allSkills.add(s));
      }
    }
  }

  return { skillsByAgent, allSkills };
}

/**
 * Formats aggregated skills for display: groups by agent, separated by semicolon.
 * Example: "A: skill1, skill2; B: skill3" or "A: skill1; B: skill2"
 *
 * @param {Map<string, Set>} skillsByAgent - Map from aggregateSkills() result
 * @returns {string} Formatted string or empty string if no skills
 */
export function formatForDisplay(skillsByAgent) {
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
    groups.push(`${agentId}: ${skillList.join(", ")}`);
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
