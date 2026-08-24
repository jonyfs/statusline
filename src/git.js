import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileUrl } from "./openTerminalTab.js";

function run(cmd, cwd, timeout = 1500) {
  try {
    return execSync(cmd, { cwd, timeout, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function getDirLabel(cwd) {
  try {
    return path.basename(cwd || process.cwd());
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

export function getRemoteUrl(cwd) {
  const remote = run("git remote get-url origin", cwd);
  return normalizeRemoteToHttps(remote);
}

export function getGitInfo(cwd) {
  const branch = run("git symbolic-ref --short -q HEAD", cwd) || run("git rev-parse --short HEAD", cwd);
  if (!branch) return null;

  let ahead = 0;
  let behind = 0;
  const counts = run("git rev-list --left-right --count @{u}...HEAD", cwd);
  if (counts) {
    const [b, a] = counts.split(/\s+/).map(Number);
    behind = Number.isFinite(b) ? b : 0;
    ahead = Number.isFinite(a) ? a : 0;
  }

  const dirtyOut = run("git status --porcelain", cwd);
  const dirtyCount = dirtyOut ? dirtyOut.split("\n").filter(Boolean).length : 0;

  return { branch, ahead, behind, dirtyCount };
}

export function getPrInfo(cwd) {
  const json = run("gh pr view --json number,state,isDraft,url", cwd, 2000);
  if (!json) return null;
  try {
    const pr = JSON.parse(json);
    return { number: pr.number, state: pr.state, isDraft: pr.isDraft, url: pr.url };
  } catch {
    return null;
  }
}
