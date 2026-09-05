/**
 * Integration test for multi-agent skills aggregation
 * Tests the full pipeline: skillAggregation + render.js skillsReading integration
 */

import { strict as assert } from "node:assert";
import { getAggregatedSkills } from "../src/skills.js";

// Simulate the skillsReading logic with mock payload
function mockSkillsReading(directlyInvoked, activeAgents) {
  const aggregated = getAggregatedSkills(directlyInvoked, activeAgents, 3);
  return {
    value: [aggregated.displayText],
    totalCount: aggregated.totalCount,
    hiddenCount: aggregated.hiddenCount,
  };
}

// Test 1: Single agent with skills
{
  const directSkills = ["spell-check"];
  const agents = [
    { id: "A", name: "Code Reviewer", skills: ["code-review"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  assert(result.value[0].includes("spell-check"), "Should include direct skill");
  assert(result.value[0].includes("A:"), "Should include agent A");
  assert(result.value[0].includes("code-review"), "Should include agent skill");
  console.log("✓ Test 1: Single agent with skills");
  console.log(`  Display: "${result.value[0]}"`);
}

// Test 2: Multiple agents with different skills
{
  const directSkills = [];
  const agents = [
    { id: "A", name: "Code Reviewer", skills: ["code-review"], status: "running" },
    { id: "B", name: "Test Runner", skills: ["test", "debugging"], status: "running" },
    { id: "C", name: "Docs Gen", skills: ["docs"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  const display = result.value[0];
  assert(display.includes("A:"), "Should include agent A");
  assert(display.includes("B:"), "Should include agent B");
  assert(display.includes("C:"), "Should include agent C");
  assert(display.includes("code-review"), "Should include code-review");
  assert(display.includes("test"), "Should include test");
  assert.equal(result.totalCount, 4, "Should have 4 distinct skills");
  console.log("✓ Test 2: Multiple agents with different skills");
  console.log(`  Display: "${display}"`);
}

// Test 3: Agents with overlapping skills (deduplication)
{
  const directSkills = [];
  const agents = [
    { id: "A", name: "Reviewer A", skills: ["code-review", "design-review"], status: "running" },
    { id: "B", name: "Reviewer B", skills: ["code-review", "security-review"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  assert.equal(result.totalCount, 3, "Should deduplicate to 3 distinct skills");
  console.log("✓ Test 3: Overlapping skills deduplicated");
  console.log(`  Display: "${result.value[0]}"`);
}

// Test 4: Direct skills + agent skills
{
  const directSkills = ["spell-check", "format"];
  const agents = [
    { id: "A", name: "Agent", skills: ["lint", "spell-check"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  const display = result.value[0];
  // Direct skills should appear first, then agent skills
  assert(display.startsWith("spell-check") || display.startsWith("format"), "Direct skills should appear first");
  assert(display.includes("A:"), "Should include agent");
  assert.equal(result.totalCount, 3, "Should deduplicate shared skill");
  console.log("✓ Test 4: Direct + agent skills aggregated");
  console.log(`  Display: "${display}"`);
}

// Test 5: Mixed status agents (only running agents included)
{
  const directSkills = [];
  const agents = [
    { id: "A", name: "Running", skills: ["code-review"], status: "running" },
    { id: "B", name: "Finished", skills: ["test"], status: "finished" },
    { id: "C", name: "Queued", skills: ["docs"], status: "queued" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  const display = result.value[0];
  assert(display.includes("A:"), "Should include running agent A");
  assert(!display.includes("B:"), "Should not include finished agent B");
  assert(!display.includes("C:"), "Should not include queued agent C");
  assert.equal(result.totalCount, 1, "Should only count running agent's skills");
  console.log("✓ Test 5: Mixed status agents (only running included)");
  console.log(`  Display: "${display}"`);
}

// Test 6: Overflow handling (>3 skills for display limit)
{
  const directSkills = ["s1", "s2"];
  const agents = [
    { id: "A", name: "Agent", skills: ["s3", "s4", "s5"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  assert.equal(result.totalCount, 5, "Should have 5 total skills");
  assert.equal(result.hiddenCount, 2, "Should have 2 hidden skills (display limit 3)");
  console.log("✓ Test 6: Overflow handling");
  console.log(`  Total: ${result.totalCount}, Hidden: ${result.hiddenCount}`);
}

// Test 7: Empty inputs
{
  const directSkills = [];
  const agents = [];
  const result = mockSkillsReading(directSkills, agents);
  assert.equal(result.totalCount, 0, "Should handle empty inputs");
  assert.equal(result.value[0], "", "Should return empty display text");
  console.log("✓ Test 7: Empty inputs");
}

// Test 8: No direct skills, agent skills only
{
  const directSkills = [];
  const agents = [
    { id: "A", name: "Agent A", skills: ["code-review", "testing"], status: "running" },
  ];
  const result = mockSkillsReading(directSkills, agents);
  const display = result.value[0];
  assert(display.includes("A:"), "Should include agent A");
  assert(display.includes("code-review"), "Should include code-review");
  assert(display.includes("testing"), "Should include testing");
  assert(display.startsWith("A:"), "Agent label should be first (no direct skills)");
  console.log("✓ Test 8: Agent skills only");
  console.log(`  Display: "${display}"`);
}

console.log("\n✓ All integration tests passed");
