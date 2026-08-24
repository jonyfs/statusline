import { execSync } from "node:child_process";

/**
 * Reads token-savings stats from the `rtk` CLI (Rust Token Killer,
 * see ~/.claude/RTK.md) if it's installed. Returns null when rtk is
 * absent, unauthenticated, or its output doesn't parse — the caller
 * omits the segment entirely rather than showing a broken value.
 */
export function getRtkSavings(cwd) {
  try {
    const out = execSync("rtk gain --format json", {
      cwd,
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const data = JSON.parse(out);
    const pct = data?.summary?.avg_savings_pct;
    if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
    return Math.round(pct);
  } catch {
    return null;
  }
}
