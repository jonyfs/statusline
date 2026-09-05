/**
 * Unit tests for skillAggregation.js module
 * Tests: aggregation, deduplication, grouping, formatting, edge cases
 */

import { strict as assert } from "node:assert";
import {
  aggregateSkills,
  formatForDisplay,
  getTotalSkillCount,
  getHiddenSkillCount,
} from "../src/skillAggregation.js";

// Test: Basic aggregation with direct skills only
{
  const result = aggregateSkills(["skill-a", "skill-b"], []);
  assert.equal(result.allSkills.size, 2, "Should have 2 skills");
  assert(result.skillsByAgent.has("direct"), "Should have direct skills group");
  assert.equal(result.skillsByAgent.get("direct").size, 2, "Direct group should have 2 skills");
  console.log("✓ Basic aggregation (direct skills only)");
}

// Test: Basic aggregation with agent skills only
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["skill-x"], status: "running" },
    { id: "B", name: "Agent B", skills: ["skill-y"], status: "running" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 2, "Should have 2 skills");
  assert(result.skillsByAgent.has("A"), "Should have Agent A");
  assert(result.skillsByAgent.has("B"), "Should have Agent B");
  console.log("✓ Basic aggregation (agent skills only)");
}

// Test: Aggregation with both direct and agent skills
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["skill-x", "skill-y"], status: "running" },
  ];
  const result = aggregateSkills(["skill-a", "skill-b"], agents);
  assert.equal(result.allSkills.size, 4, "Should have 4 distinct skills");
  assert.equal(result.skillsByAgent.size, 2, "Should have 2 groups (direct + A)");
  console.log("✓ Aggregation (mixed direct and agent skills)");
}

// Test: Deduplication - same skill by multiple agents
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["code-review"], status: "running" },
    { id: "B", name: "Agent B", skills: ["code-review", "test-runner"], status: "running" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 2, "Should deduplicate to 2 distinct skills");
  console.log("✓ Deduplication (same skill by multiple agents)");
}

// Test: Deduplication - same skill in direct and agent
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["code-review"], status: "running" },
  ];
  const result = aggregateSkills(["code-review", "spell-check"], agents);
  assert.equal(result.allSkills.size, 2, "Should deduplicate to 2 distinct skills");
  console.log("✓ Deduplication (direct and agent share skill)");
}

// Test: Formatting - display text generation
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["skill1", "skill2"], status: "running" },
    { id: "B", name: "Agent B", skills: ["skill3"], status: "running" },
  ];
  const { skillsByAgent } = aggregateSkills([], agents);
  const display = formatForDisplay(skillsByAgent);
  assert(display.includes("A:"), "Should include Agent A label");
  assert(display.includes("B:"), "Should include Agent B label");
  assert(display.includes("skill1"), "Should include skill1");
  assert(display.includes("skill2"), "Should include skill2");
  assert(display.includes("skill3"), "Should include skill3");
  console.log("✓ Formatting (display text with agent grouping)");
}

// Test: Formatting - direct skills appear first
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["agent-skill"], status: "running" },
  ];
  const { skillsByAgent } = aggregateSkills(["direct-skill"], agents);
  const display = formatForDisplay(skillsByAgent);
  const directIdx = display.indexOf("direct-skill");
  const agentIdx = display.indexOf("agent-skill");
  assert(directIdx < agentIdx, "Direct skills should appear before agent skills");
  console.log("✓ Formatting (direct skills appear first)");
}

// Test: Empty inputs
{
  const result = aggregateSkills([], []);
  assert.equal(result.allSkills.size, 0, "Should handle empty inputs");
  assert.equal(result.skillsByAgent.size, 0, "Should have no groups");
  const display = formatForDisplay(result.skillsByAgent);
  assert.equal(display, "", "Should return empty string");
  console.log("✓ Edge case (empty inputs)");
}

// Test: Null/undefined inputs
{
  const result = aggregateSkills(null, null);
  assert.equal(result.allSkills.size, 0, "Should handle null inputs gracefully");
  console.log("✓ Edge case (null inputs)");
}

// Test: Inactive agents filtered out
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["skill-a"], status: "running" },
    { id: "B", name: "Agent B", skills: ["skill-b"], status: "finished" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 1, "Should filter out finished agents");
  assert(result.skillsByAgent.has("A"), "Should have running Agent A");
  assert(!result.skillsByAgent.has("B"), "Should not have finished Agent B");
  console.log("✓ Edge case (inactive agents filtered)");
}

// Test: Empty skill arrays
{
  const agents = [
    { id: "A", name: "Agent A", skills: [], status: "running" },
    { id: "B", name: "Agent B", skills: ["skill-x"], status: "running" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 1, "Should skip agent with empty skills");
  assert(!result.skillsByAgent.has("A"), "Should not create group for empty agent");
  assert(result.skillsByAgent.has("B"), "Should include agent with skills");
  console.log("✓ Edge case (empty skill arrays)");
}

// Test: Malformed agent objects
{
  const agents = [
    { id: "A", skills: ["skill-a"], status: "running" }, // Missing name (OK)
    { name: "Agent B", skills: ["skill-b"], status: "running" }, // Missing id (skip)
    { id: "C", name: "Agent C", skills: null, status: "running" }, // null skills (skip)
    { id: "D", name: "Agent D", skills: "not-array", status: "running" }, // Non-array skills (skip)
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 1, "Should only include Agent A");
  assert(result.skillsByAgent.has("A"), "Should have Agent A");
  console.log("✓ Edge case (malformed agent objects)");
}

// Test: Skill name filtering (empty strings, non-strings)
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["skill-a", "", null, 123, "skill-b"], status: "running" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 2, "Should filter invalid skill names");
  assert(result.allSkills.has("skill-a"), "Should include valid skill-a");
  assert(result.allSkills.has("skill-b"), "Should include valid skill-b");
  console.log("✓ Edge case (skill name filtering)");
}

// Test: getTotalSkillCount
{
  const agents = [
    { id: "A", name: "Agent A", skills: ["s1", "s2"], status: "running" },
    { id: "B", name: "Agent B", skills: ["s3"], status: "running" },
  ];
  const { allSkills } = aggregateSkills([], agents);
  const count = getTotalSkillCount(allSkills);
  assert.equal(count, 3, "Should return correct count");
  console.log("✓ getTotalSkillCount");
}

// Test: getHiddenSkillCount
{
  const agents = [
    { id: "A", skills: ["s1", "s2", "s3", "s4", "s5"], status: "running" },
  ];
  const { allSkills } = aggregateSkills([], agents);
  const hidden = getHiddenSkillCount(allSkills, 3);
  assert.equal(hidden, 2, "Should calculate hidden count correctly");
  console.log("✓ getHiddenSkillCount");
}

// Test: getHiddenSkillCount with empty allSkills
{
  const hidden = getHiddenSkillCount(null, 3);
  assert.equal(hidden, 0, "Should return 0 for null allSkills");
  console.log("✓ getHiddenSkillCount (null allSkills)");
}

// Test: Multiple agents with overlapping skills
{
  const agents = [
    { id: "A", skills: ["code-review", "debugging"], status: "running" },
    { id: "B", skills: ["code-review", "testing"], status: "running" },
    { id: "C", skills: ["debugging", "testing"], status: "running" },
  ];
  const result = aggregateSkills([], agents);
  assert.equal(result.allSkills.size, 3, "Should deduplicate overlapping skills");
  assert.equal(result.skillsByAgent.size, 3, "Should have 3 agent groups");
  console.log("✓ Multiple agents with overlapping skills");
}

console.log("\n✓ All tests passed");
