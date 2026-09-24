/**
 * The scaffold has to describe the repository it sits in.
 *
 * Principle VIII already makes a README image that disagrees with the renderer
 * a build failure. These cases apply the same rule to the development
 * scaffold: the pointer that says which feature is current, and the front
 * matter in which each spec says what it is.
 *
 * Everything here reads files. No subprocess, no network, and deliberately no
 * git history: CI checks out shallow by default, so a history-dependent case
 * would skip in every CI run and pass only on a developer's full clone, which
 * is a guard rail that does not guard.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const specsDir = path.join(repoRoot, "specs");
const featureJson = path.join(repoRoot, ".specify", "feature.json");
const claudeMd = path.join(repoRoot, "CLAUDE.md");

const TRACKS = new Set(["quick", "full"]);
const STATUSES = new Set(["active", "done", "abandoned"]);

/** The artifacts each track promises, beyond spec.md which every track needs. */
const REQUIRED_BY_TRACK = { quick: [], full: ["plan.md", "tasks.md"] };

const specDirs = () =>
  readdirSync(specsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

/**
 * Reads the declaration the same way `read_spec_declaration` in common.sh
 * does, and for the same reason: the block counts only when its opening `---`
 * is the first line. Existing specs use `---` to separate user stories, and
 * one of those must never be read as a declaration.
 */
function readDeclaration(specFile) {
  if (!existsSync(specFile)) return { track: "", status: "" };
  const lines = readFileSync(specFile, "utf8").split(/\r?\n/);
  if (lines[0] !== "---") return { track: "", status: "" };

  const end = lines.indexOf("---", 1);
  if (end === -1) return { track: "", status: "" };

  const field = (name) => {
    const hit = lines
      .slice(1, end)
      .map((l) => l.match(new RegExp(`^\\s*${name}:\\s*(\\S+)`)))
      .find(Boolean);
    return hit ? hit[1] : "";
  };
  return { track: field("track"), status: field("status") };
}

/** The `specs/<name>` segment of any path that contains one. */
const featureOf = (text) => {
  const hit = String(text).match(/specs[/\\]([^/\\"\s]+)/);
  return hit ? hit[1] : "";
};

const pointedFeature = () => featureOf(JSON.parse(readFileSync(featureJson, "utf8")).feature_directory);

await test("the pointer names a directory that exists", () => {
  const name = pointedFeature();
  assert.notEqual(name, "", `.specify/feature.json names no directory under specs/`);
  assert.ok(
    existsSync(path.join(specsDir, name)),
    `.specify/feature.json names specs/${name}, which does not exist`
  );
});

await test("every spec declares a track and a status", () => {
  for (const name of specDirs()) {
    const { track, status } = readDeclaration(path.join(specsDir, name, "spec.md"));
    assert.ok(
      TRACKS.has(track),
      `specs/${name}/spec.md declares no valid track (got ${JSON.stringify(track)}, expected quick|full)`
    );
    assert.ok(
      STATUSES.has(status),
      `specs/${name}/spec.md declares no valid status (got ${JSON.stringify(status)}, expected active|done|abandoned)`
    );
  }
});

await test("a declaration is only read from the top of the file", () => {
  // A spec whose body contains `---` as a separator between user stories must
  // not be mistaken for a declared spec. 019 has two such separators.
  const body = "# Feature\n\nsome prose\n\n---\n\ntrack: full\nstatus: done\n";
  // Written outside specs/ so a crash mid-case cannot leave a directory the
  // other cases would then walk.
  const tmp = path.join(repoRoot, ".scaffold-probe.md");
  try {
    writeFileSync(tmp, body, "utf8");
    const { track, status } = readDeclaration(tmp);
    assert.equal(track, "", "a `---` in the body must not start a declaration");
    assert.equal(status, "", "a `---` in the body must not start a declaration");
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
});

await test("a finished feature has what its track promises", () => {
  for (const name of specDirs()) {
    const dir = path.join(specsDir, name);
    const { track, status } = readDeclaration(path.join(dir, "spec.md"));
    if (status !== "done") continue;
    for (const file of REQUIRED_BY_TRACK[track] ?? []) {
      assert.ok(
        existsSync(path.join(dir, file)),
        `specs/${name} declares track ${track} and status done, but ${file} is missing`
      );
    }
    // Extra artifacts are never a failure: a quick feature that later gained a
    // plan is still a quick feature that kept its promise.
  }
});

await test("only the pointed feature is in progress", () => {
  const active = specDirs().filter(
    (name) => readDeclaration(path.join(specsDir, name, "spec.md")).status === "active"
  );
  const pointed = pointedFeature();
  assert.ok(
    active.length <= 1,
    `more than one feature is active: ${active.join(", ")}. A feature left active never has to show its artifacts`
  );
  if (active.length === 1) {
    assert.equal(
      active[0],
      pointed,
      `specs/${active[0]} is active but the pointer names specs/${pointed}`
    );
  }
});

await test("both pointers name the same feature", () => {
  const block = readFileSync(claudeMd, "utf8").match(
    /<!-- SPECKIT START -->([\s\S]*?)<!-- SPECKIT END -->/
  );
  assert.ok(block, "CLAUDE.md has no <!-- SPECKIT START --> block");

  const named = featureOf(block[1]);
  const pointed = pointedFeature();
  // Compared on the feature directory, not the full path: the block names a
  // plan while feature.json names a directory, and a quick feature has no plan
  // path to name at all.
  assert.equal(
    named,
    pointed,
    `CLAUDE.md names specs/${named} while .specify/feature.json names specs/${pointed}`
  );
});
