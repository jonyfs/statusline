#!/usr/bin/env node
/**
 * Measures what a redraw costs.
 *
 *   node scripts/bench.js --runs 100
 *   node scripts/bench.js --runs 50 --transcript ~/.claude/projects/x/y.jsonl
 *
 * The 300 ms budget is a claim, and a claim nobody can re-check is a claim
 * that quietly stops being true. This runs the real render against a real
 * payload and reports the distribution, so the number in the pull request
 * is one anybody can reproduce.
 *
 * No background refresh is spawned: the point is to time the redraw, and a
 * detached process would also write to the real cache.
 */

process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";

import { renderPayload, gather } from "../src/render.js";
import { getDirUrl, getGitInfo, getPrInfo, getRemoteUrl } from "../src/git.js";
import { getActiveSkills, getActiveSkillsTrueCount, subagentActivity } from "../src/skills.js";
import { getRtkSavings } from "../src/rtk.js";
import { SOURCE_BUDGET_MS } from "../src/freshness.js";

const BUDGET_MS = 300;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const runs = Number(arg("runs", 100));
const cwd = arg("cwd", process.cwd());
const transcript = arg("transcript", undefined);

const payload = {
  cwd,
  session_id: "bench",
  transcript_path: transcript,
  model: { display_name: "Bench 5" },
  effort: { level: "high" },
  context_window: { used_percentage: 42 },
  rate_limits: {
    five_hour: { used_percentage: 20, resets_at: Math.floor(Date.now() / 1000) + 3600 },
    seven_day: { used_percentage: 60, resets_at: Math.floor(Date.now() / 1000) + 3 * 86400 },
  },
};

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function hrms(fn) {
  const started = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - started) / 1e6;
}

// One warm-up: the first render in a large repository pays for the cache
// every later one reads, and reporting that as a typical redraw would
// overstate the steady-state cost.
renderPayload(payload, { trackChanges: false });

const times = [];
for (let i = 0; i < runs; i++) {
  times.push(hrms(() => renderPayload(payload, { trackChanges: false })));
}

// One more gather, timed per source, so a slow run says which source was
// slow rather than only that it was slow.
const probe = {
  getGitInfo,
  getPrInfo,
  getRemoteUrl,
  getActiveSkills,
  getActiveSkillsTrueCount,
  subagentActivity,
  getRtkSavings,
  getDirUrl,
};
const readings = gather(payload, probe, { now: Date.now() });
const perSource = Object.entries(readings)
  .filter(([, r]) => r && typeof r === "object" && "tookMs" in r)
  .map(([key, r]) => ({ key, source: r.source, tookMs: r.tookMs }))
  .sort((a, b) => b.tookMs - a.tookMs);

const p50 = percentile(times, 50);
const p95 = percentile(times, 95);
const worst = Math.max(...times);

console.log(`\nredraw benchmark — ${runs} runs`);
console.log(`  directory:  ${cwd}`);
console.log(`  transcript: ${transcript || "(none)"}`);
console.log("");
console.log(`  p50   ${p50.toFixed(1)} ms`);
console.log(`  p95   ${p95.toFixed(1)} ms   (budget ${BUDGET_MS} ms)`);
console.log(`  max   ${worst.toFixed(1)} ms`);
console.log("");
console.log("  per source, one gather:");
for (const row of perSource) {
  const budget = SOURCE_BUDGET_MS[row.source];
  const limit = budget ? `, budget ${budget} ms` : "";
  console.log(`    ${row.key.padEnd(14)} ${String(row.tookMs).padStart(4)} ms  (${row.source}${limit})`);
}

const verdict = p95 <= BUDGET_MS;
console.log(`\n  ${verdict ? "within budget" : "OVER BUDGET"}\n`);
process.exit(verdict ? 0 : 1);
