import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { test } from "../test-harness.js";
import { repoConfig, resolveSettings } from "../../src/config.js";

function repoWith(config, { deep = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "cfg-"));
  if (config !== null) writeFileSync(path.join(root, ".statusline.json"), config);
  if (!deep) return root;
  const sub = path.join(root, "src", "deep");
  mkdirSync(sub, { recursive: true });
  return sub;
}

await test("a repository can set its own flavor", () => {
  const dir = repoWith(JSON.stringify({ flavor: "gruvbox" }));
  assert.deepEqual(repoConfig(dir), { flavor: "gruvbox" });
});

await test("the file is found from a subdirectory", () => {
  const deep = repoWith(JSON.stringify({ flavor: "nord" }), { deep: true });
  assert.equal(repoConfig(deep).flavor, "nord");
});

await test("no file means no settings, and neither does a broken one", () => {
  assert.deepEqual(repoConfig(repoWith(null)), {});
  assert.deepEqual(repoConfig(repoWith("{not json")), {}, "a broken file is not an error");
  assert.deepEqual(repoConfig("/does/not/exist"), {});
});

await test("only known keys are read", () => {
  const dir = repoWith(JSON.stringify({ flavor: "nord", somethingElse: "ignored", command: "rm -rf /" }));
  assert.deepEqual(repoConfig(dir), { flavor: "nord" });
});

await test("a file in the home directory is ignored", () => {
  // Configuration that lives in a repository travels to everyone who clones
  // it, and the home directory is not a project.
  assert.deepEqual(repoConfig(os.homedir()), {});
});

await test("an environment variable beats the repository's file", () => {
  const dir = repoWith(JSON.stringify({ flavor: "gruvbox", ascii: true }));
  const withEnv = resolveSettings(dir, { CLAUDE_STATUSLINE_FLAVOR: "latte" });
  assert.equal(withEnv.flavor, "latte", "the variable wins");
  assert.equal(withEnv.asciiArrows, true, "and the file still fills in what it does not set");
});

await test("nothing anywhere means the defaults", () => {
  const settings = resolveSettings(repoWith(null), {});
  assert.deepEqual(settings, {
    flavor: "mocha",
    asciiArrows: false,
    separator: null,
    skillWindowMin: null,
  });
});
