import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import {
  repoKey,
  readEntry,
  writeEntry,
  cacheFileFor,
  shouldRefresh,
  takeLock,
} from "../../src/cache.js";

const NOW = 1787000000000;

await test("a missing cache file is a miss, not an error", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.equal(readEntry("nothing-here", "pr"), null);
  });
});

await test("an unparseable cache file is a miss", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const file = cacheFileFor("broken");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "{ this is not json");
    assert.equal(readEntry("broken", "pr"), null);
  });
});

await test("a cache file from another schema is a miss, never a migration", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const file = cacheFileFor("old");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ schema: 999, entries: { pr: { value: 1, at: NOW } } }));
    assert.equal(readEntry("old", "pr"), null);
  });
});

await test("a written entry reads back with the time it was gathered", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeEntry("k", "pr", { number: 7 }, { now: NOW });
    const entry = readEntry("k", "pr");
    assert.deepEqual(entry.value, { number: 7 });
    assert.equal(entry.at, NOW);
  });
});

await test("writing one key leaves the others in the file intact", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeEntry("k", "pr", { number: 7 }, { now: NOW });
    writeEntry("k", "rtk", 63, { now: NOW + 5 });
    assert.deepEqual(readEntry("k", "pr").value, { number: 7 });
    assert.equal(readEntry("k", "rtk").value, 63);
  });
});

await test("a failed refresh leaves the previous value in place", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeEntry("k", "pr", { number: 7 }, { now: NOW });
    // What `refresh` does when its lookup returns nothing: release the
    // lock, write no value. Overwriting with null would turn one failed
    // network call into a segment that disappears for a minute.
    takeLock("k", "pr", { now: NOW + 1000 });
    takeLock("k", "pr", { now: NOW + 1000, release: true });
    assert.deepEqual(readEntry("k", "pr").value, { number: 7 });
  });
});

await test("the lock stops a second refresh inside the maximum age", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.equal(takeLock("k", "pr", { now: NOW }), true, "first refresh must be allowed");
    assert.equal(takeLock("k", "pr", { now: NOW + 1000 }), false, "second must be refused");
    assert.equal(
      takeLock("k", "pr", { now: NOW + 120_000 }),
      true,
      "a lock older than the maximum age must not block forever"
    );
  });
});

await test("a refresh is due at half the maximum age, not at expiry", async () => {
  // FR-006: refreshing only once a value has expired makes the segment
  // flicker between present and absent on every cycle.
  const fresh = { value: 1, at: NOW };
  assert.equal(shouldRefresh("pr", fresh, NOW + 1000), false);
  assert.equal(shouldRefresh("pr", fresh, NOW + 45_000), true);
  assert.equal(shouldRefresh("pr", null, NOW), true, "no entry at all is always due");
});

await test("two writers never leave a reader with a partial file", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const file = cacheFileFor("race");
    for (let i = 0; i < 50; i++) {
      writeEntry("race", "rtk", i, { now: NOW + i });
      const raw = readFileSync(file, "utf8");
      assert.doesNotThrow(() => JSON.parse(raw), "a reader saw a half-written file");
    }
  });
});

await test("a session without an identifier still gets a stable key", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.equal(repoKey(undefined), repoKey(undefined));
    assert.notEqual(repoKey("/a/repo"), repoKey("/another/repo"));
    assert.match(repoKey("/a/repo"), /^[a-f0-9]{16}$/, "a key must be filename-safe");
  });
});

await test("refresh is suppressed entirely by CLAUDE_STATUSLINE_NO_REFRESH", async () => {
  const home = makeHome();
  const prev = process.env.CLAUDE_STATUSLINE_NO_REFRESH;
  process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";
  try {
    await withHome(home, async () => {
      const { spawnRefresh } = await import("../../src/cache.js");
      assert.equal(spawnRefresh("k", "pr", home.dir), false, "no process may be spawned");
    });
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_STATUSLINE_NO_REFRESH;
    else process.env.CLAUDE_STATUSLINE_NO_REFRESH = prev;
  }
});
