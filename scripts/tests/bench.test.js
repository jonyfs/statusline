import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";

const BENCH = fileURLToPath(new URL("../bench.js", import.meta.url));

await test("the benchmark reports a distribution and a per-source breakdown", () => {
  // FR-018: the budget has to be re-measurable without editing any code,
  // or it stops being checked and quietly stops being true.
  const r = spawnSync(process.execPath, [BENCH, "--runs", "5"], { encoding: "utf8" });
  assert.equal(r.status, 0, `benchmark exited ${r.status}: ${r.stderr}`);
  assert.match(r.stdout, /p50\s+[\d.]+ ms/);
  assert.match(r.stdout, /p95\s+[\d.]+ ms\s+\(budget 300 ms\)/);
  assert.match(r.stdout, /max\s+[\d.]+ ms/);
  assert.match(r.stdout, /per source, one gather:/);
  assert.match(r.stdout, /git\s+\d+ ms\s+\(git, budget 150 ms\)/);
});

await test("the benchmark says plainly whether the budget held", () => {
  const r = spawnSync(process.execPath, [BENCH, "--runs", "3"], { encoding: "utf8" });
  assert.match(r.stdout, /within budget|OVER BUDGET/);
  assert.equal(r.status, 0, "this repository is expected to be within budget");
});
