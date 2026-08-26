/**
 * The detached refresh: one lookup, one cache write, then exit.
 *
 * Nobody is waiting on this process. The redraw that started it has
 * already printed its lines and gone, so the budgets here are generous
 * where the redraw's are tight. What matters instead is that it cannot
 * make things worse: a failed lookup releases the lock and leaves the
 * previous good value untouched, so one unreachable network call does not
 * make a segment disappear for a minute.
 */

import { writeEntry, takeLock } from "./cache.js";
import { probeGitInfo, probePrInfo } from "./git.js";
import { probeRtkSavings } from "./rtk.js";
import { REFRESH_BUDGET_MS } from "./freshness.js";

const PROBES = {
  // The git probe also records what it cost, which is what tells the next
  // redraw whether this repository can be asked directly or has to be read
  // from cache.
  git: (cwd, key) => {
    const started = Date.now();
    const snapshot = probeGitInfo(cwd, REFRESH_BUDGET_MS.git);
    writeEntry(key, "gitCost", Date.now() - started, { now: Date.now() });
    return snapshot;
  },
  pr: (cwd) => probePrInfo(cwd, REFRESH_BUDGET_MS.gh),
  rtk: (cwd) => probeRtkSavings(cwd, REFRESH_BUDGET_MS.rtk),
};

export async function runRefresh(name, key, cwd, { now = Date.now() } = {}) {
  const probe = PROBES[name];
  if (!probe || !key) {
    // An unknown key is not worth an error message nobody will see: this
    // process has no terminal attached.
    return false;
  }

  let value = null;
  try {
    value = probe(cwd, key);
  } catch {
    value = null;
  }

  if (value !== null && value !== undefined) {
    writeEntry(key, name, value, { now: Date.now() });
  }
  takeLock(key, name, { now, release: true });
  return value !== null && value !== undefined;
}
