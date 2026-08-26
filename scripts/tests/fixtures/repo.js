/**
 * Throwaway git repositories, one per state the statusline has to read.
 *
 * Everything is local: a bare repository stands in for the remote, so a
 * test never reaches the network and `git status` still reports a real
 * upstream. Repositories are created under the OS temp directory.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const QUIET = { stdio: ["ignore", "ignore", "ignore"] };

/** Runs git with arguments, never a shell string, so a path with spaces is safe. */
export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", ...QUIET, stdio: ["ignore", "pipe", "ignore"] });
}

function init(name) {
  const dir = mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  execFileSync("git", ["init", "-q", "-b", "main", "."], { cwd: dir, ...QUIET });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: dir, ...QUIET });
  execFileSync("git", ["config", "user.name", "Statusline Test"], { cwd: dir, ...QUIET });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir, ...QUIET });
  return dir;
}

function commit(dir, message = "initial") {
  execFileSync("git", ["add", "-A"], { cwd: dir, ...QUIET });
  execFileSync("git", ["commit", "-q", "--allow-empty", "-m", message], { cwd: dir, ...QUIET });
}

/** A repository with no remote at all, so porcelain v2 emits no `# branch.ab`. */
export function repoWithoutUpstream() {
  const dir = init("repo-no-upstream");
  writeFileSync(path.join(dir, "README.md"), "no upstream\n");
  commit(dir);
  return dir;
}

/** A repository tracking a local bare "remote", optionally ahead or behind it. */
export function repoWithUpstream({ ahead = 0, behind = 0 } = {}) {
  const remote = mkdtempSync(path.join(os.tmpdir(), "repo-remote-"));
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", "."], { cwd: remote, ...QUIET });

  const dir = init("repo-upstream");
  writeFileSync(path.join(dir, "README.md"), "with upstream\n");
  commit(dir);
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: dir, ...QUIET });
  execFileSync("git", ["push", "-q", "-u", "origin", "main"], { cwd: dir, ...QUIET });

  for (let i = 0; i < behind; i++) {
    // Commit, push, then rewind the local branch: the pushed commits stay
    // on the remote and in the local remote-tracking ref, which is exactly
    // what "behind" means for a statusline that never fetches.
    commit(dir, `remote-${i}`);
    execFileSync("git", ["push", "-q", "origin", "main"], { cwd: dir, ...QUIET });
  }
  if (behind) execFileSync("git", ["reset", "-q", "--hard", `HEAD~${behind}`], { cwd: dir, ...QUIET });

  for (let i = 0; i < ahead; i++) commit(dir, `local-${i}`);
  return dir;
}

/** A repository with HEAD detached at its first commit. */
export function repoDetachedHead() {
  const dir = init("repo-detached");
  writeFileSync(path.join(dir, "README.md"), "detached\n");
  commit(dir);
  commit(dir, "second");
  const first = git(dir, "rev-list", "--max-parents=0", "HEAD").trim();
  execFileSync("git", ["checkout", "-q", first], { cwd: dir, ...QUIET });
  return dir;
}

/** A repository with `changed` tracked modifications and `untracked` new files. */
export function repoDirty({ changed = 3, untracked = 2 } = {}) {
  const dir = init("repo-dirty");
  for (let i = 0; i < changed; i++) writeFileSync(path.join(dir, `tracked-${i}.txt`), "v1\n");
  commit(dir);
  for (let i = 0; i < changed; i++) writeFileSync(path.join(dir, `tracked-${i}.txt`), "v2\n");
  for (let i = 0; i < untracked; i++) writeFileSync(path.join(dir, `new-${i}.txt`), "new\n");
  writeFileSync(path.join(dir, "a file with spaces.txt"), "spaces\n");
  return dir;
}

/**
 * A repository with `count` modified tracked files. SC-001 measures the
 * redraw budget against 5,000 of them, which is where `git status` stops
 * being free.
 */
export function repoManyChanges({ count = 5000 } = {}) {
  const dir = init("repo-many");
  mkdirSync(path.join(dir, "files"));
  for (let i = 0; i < count; i++) writeFileSync(path.join(dir, "files", `f${i}.txt`), "v1\n");
  commit(dir);
  for (let i = 0; i < count; i++) writeFileSync(path.join(dir, "files", `f${i}.txt`), "v2\n");
  return dir;
}

/** A repository containing a submodule, whose state porcelain v2 reports separately. */
export function repoWithSubmodule() {
  const inner = init("repo-submodule-inner");
  writeFileSync(path.join(inner, "inner.txt"), "inner\n");
  commit(inner);

  const dir = init("repo-submodule-outer");
  writeFileSync(path.join(dir, "outer.txt"), "outer\n");
  commit(dir);
  execFileSync(
    "git",
    ["-c", "protocol.file.allow=always", "submodule", "-q", "add", inner, "sub"],
    { cwd: dir, ...QUIET }
  );
  commit(dir, "add submodule");
  writeFileSync(path.join(dir, "sub", "inner.txt"), "changed inside the submodule\n");
  return dir;
}

/** A linked worktree of its own repository, checked out on another branch. */
export function repoLinkedWorktree() {
  const dir = init("repo-worktree");
  writeFileSync(path.join(dir, "README.md"), "worktree\n");
  commit(dir);
  const wt = path.join(path.dirname(dir), `${path.basename(dir)}-linked`);
  execFileSync("git", ["worktree", "add", "-q", "-b", "side", wt], { cwd: dir, ...QUIET });
  return { main: dir, worktree: wt };
}
