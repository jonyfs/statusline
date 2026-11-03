import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";
import { probeRtkSavings, rtkCacheKey } from "../../src/rtk.js";

// The rtk figure is the project's own: `rtk gain --project`, cached per project directory.

await test("each project directory has its own cache entry", () => {
  assert.notEqual(rtkCacheKey("/a/one"), rtkCacheKey("/a/two"));
  assert.equal(rtkCacheKey("/a/one"), rtkCacheKey("/a/one"));
});

if (process.platform !== "win32") {
  const bin = mkdtempSync(path.join(os.tmpdir(), "fake-rtk-"));
  const fake = (summary) => {
    const file = path.join(bin, "rtk");
    // Answers only when asked for the project; the lifetime figure is a decoy.
    writeFileSync(
      file,
      `#!/bin/sh\ncase "$*" in *--project*) echo '${JSON.stringify({ summary })}';; *) echo '{"summary":{"total_commands":9,"avg_savings_pct":99}}';; esac\n`
    );
    chmodSync(file, 0o755);
  };
  const before = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${before}`;
  try {
    await test("the figure comes from --project, rounded", () => {
      fake({ total_commands: 10, avg_savings_pct: 29.44 });
      assert.equal(probeRtkSavings(os.tmpdir(), 5000), 29);
    });
    await test("a project rtk has never run in shows no figure, not 0%", () => {
      fake({ total_commands: 0, avg_savings_pct: 0 });
      assert.equal(probeRtkSavings(os.tmpdir(), 5000), null);
    });
  } finally {
    process.env.PATH = before;
    rmSync(bin, { recursive: true, force: true });
  }
}
