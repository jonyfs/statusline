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
import { probeGitInfo, probePrResult, probeCiResult } from "./git.js";
import { probeRtkSavings } from "./rtk.js";
import { REFRESH_BUDGET_MS } from "./freshness.js";

/**
 * Each probe answers with a state as well as a value.
 *
 * `found` and `none` are both answers and both get written: "this branch has
 * no pull request" is worth storing, because storing it is what clears the
 * one the previous branch left in the cache. `failed` is not an answer, and
 * writing it would let an unreachable network look like a closed pull
 * request.
 */
const PROBES = {
  // The git probe also records what it cost, which is what tells the next
  // redraw whether this repository can be asked directly or has to be read
  // from cache.
  git: (cwd, key) => {
    const started = Date.now();
    const snapshot = probeGitInfo(cwd, REFRESH_BUDGET_MS.git);
    writeEntry(key, "gitCost", Date.now() - started, { now: Date.now() });
    return snapshot === null ? { state: "failed", value: null } : { state: "found", value: snapshot };
  },
  pr: (cwd) => probePrResult(cwd, REFRESH_BUDGET_MS.gh),
  rtk: (cwd) => {
    const pct = probeRtkSavings(cwd, REFRESH_BUDGET_MS.rtk);
    return pct === null ? { state: "failed", value: null } : { state: "found", value: pct };
  },
  ci: (cwd) => probeCiResult(cwd, REFRESH_BUDGET_MS.gh),
};

export async function runRefresh(name, key, cwd, { now = Date.now(), probes = PROBES } = {}) {
  const probe = probes[name];
  if (!probe || !key) {
    // An unknown key is not worth an error message nobody will see: this
    // process has no terminal attached.
    return false;
  }

  let result = { state: "failed", value: null };
  try {
    result = probe(cwd, key) ?? result;
  } catch {
    result = { state: "failed", value: null };
  }

  if (result.state === "found" || result.state === "none") {
    writeEntry(key, name, result.value ?? null, { now: Date.now() });
  }
  takeLock(key, name, { now, release: true });
  return result.state === "found";
}
