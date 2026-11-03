import { execFileSync } from "node:child_process";
import { MAX_AGE_MS, REFRESH_BUDGET_MS } from "./freshness.js";
import { repoKey, readEntry, shouldRefresh, spawnRefresh } from "./cache.js";

/**
 * Token-savings stats from the `rtk` CLI (Rust Token Killer), read from
 * cache only.
 *
 * The figure moves slowly and the process costs more than the redraw can
 * spare, so the redraw reads the last known value and starts a detached
 * refresh when it is halfway to expiring. With `rtk` absent, or its output
 * unparseable, nothing is ever cached and the segment simply never
 * appears, which is what it did before.
 */
/**
 * `rtk gain --project` reports the figure for the directory it runs in and
 * everything below it, so the entry is kept per project directory: one
 * project's savings must not be shown, or cached, under another's.
 */
export const rtkCacheKey = (dir) => repoKey(`rtk:${dir}`);

export function getRtkSavings(dir, { now = Date.now() } = {}) {
  const key = rtkCacheKey(dir);
  const entry = readEntry(key, "rtk");
  if (shouldRefresh("rtk", entry, now)) spawnRefresh(key, "rtk", dir, { now });
  if (!entry || now - entry.at > MAX_AGE_MS.rtk) return null;
  return entry.value;
}

/** The live call, used by the detached refresh and by `doctor`. */
export function probeRtkSavings(cwd, timeout = REFRESH_BUDGET_MS.rtk) {
  try {
    const out = execFileSync("rtk", ["gain", "--project", "--format", "json"], {
      cwd,
      timeout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const summary = JSON.parse(out)?.summary;
    // A project rtk has never run in reports 0 commands and 0%: no history,
    // not a saving of nothing, so the chip stays out.
    if (!(summary?.total_commands > 0)) return null;
    const pct = summary.avg_savings_pct;
    if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
    return Math.round(pct);
  } catch {
    return null;
  }
}
