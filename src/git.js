import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileUrl } from "./openTerminalTab.js";
import { SOURCE_BUDGET_MS, MAX_AGE_MS } from "./freshness.js";
import { repoKey, readEntry, writeEntry, shouldRefresh, spawnRefresh } from "./cache.js";

/**
 * Runs git with an argument array rather than a shell string.
 *
 * Nothing derived from the payload or the environment is ever interpolated
 * into a command: the working directory travels as `cwd`, and the
 * arguments are constants. A directory named with shell metacharacters
 * would otherwise be command injection, and quoting rules differ per
 * platform (Principle IX).
 */
function runGit(args, cwd, timeout = SOURCE_BUDGET_MS.git) {
  try {
    const text = execFileSync("git", args, {
      cwd,
      timeout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
    return { text, timedOut: false };
  } catch (err) {
    // "git was too slow" and "this is not a repository" are different
    // answers. The first is worth a background refresh and a cached
    // snapshot; the second means there is nothing here to show and never
    // will be, so spawning a process for it would be waste.
    const timedOut = err?.killed === true || err?.code === "ETIMEDOUT" || err?.signal === "SIGTERM";
    return { text: null, timedOut };
  }
}

/** The text, for callers that do not care why it is missing. */
function gitText(args, cwd, timeout) {
  return runGit(args, cwd, timeout).text;
}

export function getDirLabel(cwd) {
  try {
    const dir = cwd || process.cwd();
    const base = path.basename(dir);
    // `path.basename("/")` is an empty string, and so is the basename of a
    // Windows drive root. Rendering that leaves the folder icon sitting
    // beside nothing at all, so the root is named as itself.
    if (base) return base;
    const parsed = path.parse(dir);
    return parsed.root || dir || "?";
  } catch {
    return "?";
  }
}

/**
 * `file://` URL for the working directory. Clicking it (terminals that
 * support OSC 8 hyperlinks) reveals the folder in the system file
 * manager on most terminals — there is no cross-terminal standard for
 * "open a new terminal window at this path" via a plain link.
 */
export function getDirUrl(cwd) {
  return pathToFileUrl(cwd || process.cwd());
}

function normalizeRemoteToHttps(remote) {
  if (!remote) return null;
  // git@host:owner/repo.git
  let m = remote.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (m) return `https://${m[1]}/${m[2]}`;
  // ssh://git@host/owner/repo.git
  m = remote.match(/^ssh:\/\/git@([^/]+)\/(.+?)(\.git)?$/);
  if (m) return `https://${m[1]}/${m[2]}`;
  // https://host/owner/repo.git
  m = remote.match(/^https?:\/\/(.+?)(\.git)?$/);
  if (m) return `https://${m[1]}`;
  return null;
}

/**
 * The origin URL, cached for a day. It is a separate git process from the
 * status call and a repository's origin effectively never changes, so
 * paying for it on every redraw buys nothing.
 */
export function getRemoteUrl(cwd, { now = Date.now() } = {}) {
  const key = repoKey(cwd);
  const entry = readEntry(key, "remote");
  if (entry && now - entry.at <= MAX_AGE_MS.remote) return entry.value;

  const remote = normalizeRemoteToHttps(gitText(["remote", "get-url", "origin"], cwd));
  writeEntry(key, "remote", remote, { now });
  return remote;
}

/**
 * Parses `git status --porcelain=v2 --branch -z`.
 *
 * One call replaces the four this used to make: 31.7 ms against 131.2 ms,
 * measured over 20 runs each. It also answers a question the old approach
 * could not. `git rev-list @{u}...HEAD` fails when there is no upstream,
 * and the failure was being read as "0 ahead, 0 behind", so a branch with
 * no upstream looked exactly like one in sync. Porcelain v2 emits
 * `# branch.ab` only when an upstream exists, so the two are now distinct:
 * `ahead` and `behind` are null rather than 0 (FR-012).
 */
export function parsePorcelainV2(text) {
  if (text === null || text === undefined) return null;
  const records = text.split("\0").filter(Boolean);

  let head = null;
  let oid = null;
  let upstream = null;
  let ahead = null;
  let behind = null;
  let changed = 0;
  let untracked = 0;
  let skipNext = false;

  for (const record of records) {
    if (skipNext) {
      // The path a rename came from, emitted as its own NUL-separated
      // field right after the `2 ` record. It is not a second change.
      skipNext = false;
      continue;
    }
    if (record.startsWith("# branch.oid ")) oid = record.slice(13).trim();
    else if (record.startsWith("# branch.head ")) head = record.slice(14).trim();
    else if (record.startsWith("# branch.upstream ")) upstream = record.slice(18).trim();
    else if (record.startsWith("# branch.ab ")) {
      const m = record.slice(12).trim().match(/^\+(\d+)\s+-(\d+)$/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (record.startsWith("? ")) untracked++;
    else if (record.startsWith("1 ") || record.startsWith("u ")) changed++;
    else if (record.startsWith("2 ")) {
      changed++;
      skipNext = true;
    }
    // `! ` records are ignored files, which the statusline does not count.
  }

  if (!head && !oid) return null;
  const detached = head === "(detached)";
  return {
    branch: detached ? oid?.slice(0, 7) ?? "detached" : head,
    detached,
    oid,
    upstream,
    ahead,
    behind,
    changed,
    untracked,
  };
}

/**
 * The working-tree snapshot.
 *
 * Normally this is a fresh call taking about 30 ms. In a repository big
 * enough that git cannot answer inside its budget (5,000 modified files
 * measured at 812 ms, and no flag combination brings that down), the
 * redraw uses the cached snapshot and starts a detached refresh instead of
 * stalling. The cached snapshot is at most 5 seconds old, which is inside
 * the one-redraw allowance for working-tree state.
 *
 * This deliberately never fetches: the statusline re-renders every few
 * seconds, and hitting the network that often would be hostile to both the
 * user's connection and the remote. So `behind` means "commits you have
 * already fetched but not merged", not "commits that exist on the remote
 * right now".
 */
export function getGitInfo(cwd, { now = Date.now(), budgetMs = SOURCE_BUDGET_MS.git } = {}) {
  const args = ["--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z"];
  const key = repoKey(cwd);

  // What the last attempt cost here. A repository that answers in 30 ms is
  // asked again on every redraw, because a branch switch should show up
  // immediately. One that has already proved it cannot answer inside the
  // budget is not asked at all while a usable snapshot is on hand: paying
  // the whole budget on every redraw, only to abandon the call and read the
  // cache anyway, spends 150 ms to learn nothing.
  //
  // The measurement is refreshed by the detached process, which runs with a
  // generous budget, so a repository that becomes small again returns to
  // the fast path on its own.
  const costEntry = readEntry(key, "gitCost");
  const knownSlow = typeof costEntry?.value === "number" && costEntry.value >= budgetMs;
  if (knownSlow) {
    const cached = readEntry(key, "git");
    if (cached && now - cached.at <= MAX_AGE_MS.git) {
      if (shouldRefresh("git", cached, now)) spawnRefresh(key, "git", cwd, { now });
      return cached.value;
    }
  }

  const started = Date.now();
  const result = runGit(args, cwd, budgetMs);
  const snapshot = parsePorcelainV2(result.text);
  const tookMs = Date.now() - started;
  if (!costEntry || Math.abs(costEntry.value - tookMs) > budgetMs / 4) {
    writeEntry(key, "gitCost", tookMs, { now });
  }

  if (snapshot) {
    // Only write when the snapshot actually moved, or when the stored one
    // is halfway to expiring. Writing on every redraw would put a file
    // write on the fast path for no gain: the value it would store is the
    // one being returned anyway.
    const stored = readEntry(key, "git");
    if (!stored || now - stored.at > MAX_AGE_MS.git / 2 || JSON.stringify(stored.value) !== JSON.stringify(snapshot)) {
      writeEntry(key, "git", snapshot, { now });
    }
    return snapshot;
  }

  // Not a repository: nothing to show, and nothing a background process
  // could find later either.
  if (!result.timedOut) return null;

  // Git was too slow. Use the last snapshot if there is a usable one, and
  // either way start the refresh that will have an answer ready for the
  // next redraw. Without this last spawn, a repository whose very first
  // redraw times out would never get a cache at all, and would pay the
  // whole budget on every redraw for the rest of the session.
  const entry = readEntry(key, "git");
  spawnRefresh(key, "git", cwd, { now });
  if (entry && now - entry.at <= MAX_AGE_MS.git) return entry.value;
  return null;
}

/**
 * Pull request state, read from cache only.
 *
 * `gh pr view` costs 540 ms on a warm network and its whole timeout when
 * the CLI is unauthenticated or the network is unreachable. Neither fits
 * in a 300 ms redraw, so the redraw reads the last known value and starts
 * a detached refresh when it is halfway to expiring. With nothing cached
 * yet, the segment is simply absent until the first refresh lands.
 */
export function getPrInfo(cwd, { now = Date.now() } = {}) {
  const key = repoKey(cwd);
  const entry = readEntry(key, "pr");
  if (shouldRefresh("pr", entry, now)) spawnRefresh(key, "pr", cwd, { now });
  if (!entry || now - entry.at > MAX_AGE_MS.pr) return null;
  return entry.value;
}

/** The live `gh` call, used by the detached refresh and by `doctor`. */
export function probePrInfo(cwd, timeout = 5000) {
  try {
    const out = execFileSync("gh", ["pr", "view", "--json", "number,state,isDraft,url"], {
      cwd,
      timeout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const pr = JSON.parse(out);
    return { number: pr.number, state: pr.state, isDraft: pr.isDraft, url: pr.url };
  } catch {
    return null;
  }
}

/** The live git snapshot, used by the detached refresh and by `doctor`. */
export function probeGitInfo(cwd, timeout) {
  return parsePorcelainV2(
    gitText(["--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z"], cwd, timeout)
  );
}
