/**
 * Which arrangement wins, and what happens when one cannot be read.
 *
 * The ranks are the contract's, and the point of testing them against a
 * throwaway HOME is that the answer must not depend on whether the person
 * running the suite happens to have an arrangement of their own.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { test } from "../test-harness.js";
import { resolveLayout } from "../../src/config.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

/**
 * A throwaway home with a repository inside it, so both file locations can
 * be written to without touching the machine running the suite.
 */
function scratch() {
  const home = mkdtempSync(path.join(tmpdir(), "statusline-layout-"));
  const repo = path.join(home, "work", "project");
  mkdirSync(repo, { recursive: true });
  mkdirSync(path.join(home, ".claude", "statusline"), { recursive: true });
  return {
    home,
    repo,
    writeUser: (value) =>
      writeFileSync(path.join(home, ".claude", "statusline", "layout.json"), value),
    writeRepo: (value) => writeFileSync(path.join(repo, ".statusline.json"), value),
    clean: () => rmSync(home, { recursive: true, force: true }),
  };
}

/**
 * `resolveLayout` reads the user file from the real home directory, so a
 * case that needs a throwaway one has to move HOME for the call.
 */
function withHome(home, fn) {
  const realHome = process.env.HOME;
  const realProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    return fn();
  } finally {
    if (realHome === undefined) delete process.env.HOME;
    else process.env.HOME = realHome;
    if (realProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = realProfile;
  }
}

await test("with no file anywhere, the default is in force", () => {
  const s = scratch();
  try {
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.arrangement === null, "an arrangement appeared from nowhere");
    assert(found.origin === "default", `origin was ${found.origin}`);
    assert(found.path === null, "a path was named for a file that does not exist");
  } finally {
    s.clean();
  }
});

await test("the user file is used when it is the only one", () => {
  const s = scratch();
  try {
    s.writeUser(JSON.stringify({ version: 1, name: "mine", segments: { rtk: { on: false } } }));
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.origin === "user", `origin was ${found.origin}`);
    assert(found.arrangement.name === "mine", "the wrong arrangement was read");
  } finally {
    s.clean();
  }
});

await test("the repository's layout key beats the user file", () => {
  const s = scratch();
  try {
    s.writeUser(JSON.stringify({ version: 1, name: "mine", segments: {} }));
    s.writeRepo(JSON.stringify({ flavor: "nord", layout: { version: 1, name: "theirs", segments: {} } }));
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.origin === "repo", `origin was ${found.origin}`);
    assert(found.arrangement.name === "theirs", "the user file won");
  } finally {
    s.clean();
  }
});

await test("the environment variable beats both", () => {
  const s = scratch();
  try {
    s.writeUser(JSON.stringify({ version: 1, name: "mine", segments: {} }));
    s.writeRepo(JSON.stringify({ layout: { version: 1, name: "theirs", segments: {} } }));
    const named = path.join(s.home, "named.json");
    writeFileSync(named, JSON.stringify({ version: 1, name: "asked for", segments: {} }));
    const found = withHome(s.home, () =>
      resolveLayout(s.repo, { CLAUDE_STATUSLINE_LAYOUT: named })
    );
    assert(found.origin === "env", `origin was ${found.origin}`);
    assert(found.arrangement.name === "asked for", "the named file was not read");
  } finally {
    s.clean();
  }
});

await test("the first one found wins whole, rather than merging", () => {
  const s = scratch();
  try {
    s.writeUser(JSON.stringify({ version: 1, segments: { rtk: { on: false }, duration: { on: false } } }));
    s.writeRepo(JSON.stringify({ layout: { version: 1, segments: { context: { line: 1 } } } }));
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.arrangement.segments.rtk === undefined, "the user file bled into the repository's");
    assert(found.arrangement.segments.context !== undefined, "the repository's own entry was lost");
  } finally {
    s.clean();
  }
});

await test("a repository file with no layout key falls through to the user file", () => {
  const s = scratch();
  try {
    s.writeUser(JSON.stringify({ version: 1, name: "mine", segments: {} }));
    s.writeRepo(JSON.stringify({ flavor: "nord" }));
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.origin === "user", `origin was ${found.origin}`);
  } finally {
    s.clean();
  }
});

await test("a file that will not parse means the default, and says why", () => {
  const s = scratch();
  try {
    s.writeUser("not json at all");
    const found = withHome(s.home, () => resolveLayout(s.repo, {}));
    assert(found.arrangement === null, "garbage was treated as an arrangement");
    assert(found.origin === "default", `origin was ${found.origin}`);
    assert(typeof found.error === "string" && found.error.length, "no reason was given");
    assert(found.path?.endsWith("layout.json"), "the file was not named");
  } finally {
    s.clean();
  }
});

await test("an environment variable pointing at nothing does not claim an arrangement", () => {
  const s = scratch();
  try {
    const missing = path.join(s.home, "no-such-file.json");
    const found = withHome(s.home, () => resolveLayout(s.repo, { CLAUDE_STATUSLINE_LAYOUT: missing }));
    assert(found.arrangement === null, "a missing file produced an arrangement");
    assert(found.origin === "default", `origin was ${found.origin}`);
    assert(found.path === missing, "the path that was asked for is not reported");
  } finally {
    s.clean();
  }
});
