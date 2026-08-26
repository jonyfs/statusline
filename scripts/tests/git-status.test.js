import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "../test-harness.js";
import { parsePorcelainV2, probeGitInfo, getDirLabel } from "../../src/git.js";
import { SOURCE_BUDGET_MS } from "../../src/freshness.js";
import {
  repoWithoutUpstream,
  repoWithUpstream,
  repoDetachedHead,
  repoDirty,
  repoWithSubmodule,
  repoLinkedWorktree,
} from "./fixtures/repo.js";

const snapshotOf = (dir) => probeGitInfo(dir, 10_000);

await test("a branch with an upstream reports its divergence", () => {
  const dir = repoWithUpstream({ ahead: 2, behind: 3 });
  const git = snapshotOf(dir);
  assert.equal(git.branch, "main");
  assert.equal(git.upstream, "origin/main");
  assert.equal(git.ahead, 2);
  assert.equal(git.behind, 3);
});

await test("no upstream is not the same as being in sync", () => {
  // The old implementation ran `git rev-list @{u}...HEAD`, read its
  // failure as zero, and rendered a branch with no upstream exactly like
  // one that was up to date (FR-012).
  const git = snapshotOf(repoWithoutUpstream());
  assert.equal(git.branch, "main");
  assert.equal(git.upstream, null);
  assert.equal(git.ahead, null, "ahead must be null, not 0");
  assert.equal(git.behind, null, "behind must be null, not 0");
});

await test("a detached HEAD is reported as a commit, not a branch", () => {
  const git = snapshotOf(repoDetachedHead());
  assert.equal(git.detached, true);
  assert.match(git.oid, /^[0-9a-f]{40}$/);
  assert.equal(git.branch, git.oid.slice(0, 7));
});

await test("tracked changes and untracked files are counted separately", () => {
  const git = snapshotOf(repoDirty({ changed: 3, untracked: 2 }));
  assert.equal(git.changed, 3);
  // Two requested plus the one with spaces in its name that the fixture
  // always adds, which is the case `-z` exists for.
  assert.equal(git.untracked, 3);
});

await test("a renamed file counts once, not twice", () => {
  // Porcelain v2 emits the original path as a second NUL-separated field
  // after a `2 ` record. Counting records naively doubles every rename.
  const dir = repoDirty({ changed: 1, untracked: 0 });
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", "before rename"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["mv", "tracked-0.txt", "renamed.txt"], { cwd: dir, stdio: "ignore" });
  const git = snapshotOf(dir);
  assert.equal(git.changed, 1, "one rename is one change");
});

await test("a submodule's own modification is one entry in the parent", () => {
  // research.md flagged this as unconfirmed rather than assumed.
  const git = snapshotOf(repoWithSubmodule());
  assert.equal(git.changed, 1, "the submodule shows as a single changed entry");
  assert.equal(git.untracked, 0);
});

await test("a linked worktree reports its own branch", () => {
  const { worktree } = repoLinkedWorktree();
  const git = snapshotOf(worktree);
  assert.equal(git.branch, "side");
});

await test("a directory that is not a repository yields nothing, not a guess", () => {
  assert.equal(parsePorcelainV2(null), null);
  assert.equal(parsePorcelainV2(""), null);
});

await test("an ordinary repository answers inside the git budget", () => {
  const dir = repoDirty({ changed: 5, untracked: 5 });
  const started = Date.now();
  probeGitInfo(dir, SOURCE_BUDGET_MS.git);
  const took = Date.now() - started;
  assert.ok(took <= SOURCE_BUDGET_MS.git * 2, `git took ${took} ms in an ordinary repository`);
});

await test("the directory label names the root rather than nothing", () => {
  // `path.basename("/")` is an empty string, which rendered as a folder
  // icon beside a gap.
  assert.notEqual(getDirLabel("/"), "");
  assert.ok(getDirLabel("/").length > 0);
  assert.equal(getDirLabel("/Users/someone/project"), "project");
  assert.equal(getDirLabel("/Users/someone/project/"), "project");
});
