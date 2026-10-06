import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
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
import { runRefresh } from "../../src/refresh.js";
import { MAX_AGE_MS } from "../../src/freshness.js";

const CACHE_URL = new URL("../../src/cache.js", import.meta.url).href;

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
    const file = cacheFileFor("broken", "pr");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "{ this is not json");
    assert.equal(readEntry("broken", "pr"), null);
  });
});

await test("a cache file from another schema is a miss, never a migration", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const file = cacheFileFor("old", "pr");
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
    const file = cacheFileFor("race", "rtk");
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

await test("a failed refresh backs off instead of letting the next redraw start another", async () => {
  // Releasing the lock on failure meant an unauthenticated `gh` or a missing
  // `rtk` was asked again on every redraw: one node process and one lookup
  // every few seconds, each failing the same way.
  const home = makeHome();
  await withHome(home, async () => {
    writeEntry("k", "pr", { number: 7 }, { now: Date.now() });
    assert.equal(takeLock("k", "pr", { now: Date.now() }), true, "the redraw takes the lock to spawn");
    await runRefresh("pr", "k", home.dir, { probes: { pr: () => ({ state: "failed", value: null }) } });

    const after = Date.now();
    assert.equal(takeLock("k", "pr", { now: after + 1000 }), false, "a redraw right after a failure must not retry");
    // The back-off is shorter than the value's life, so a lookup that failed
    // once is tried again before the good value it left in place expires.
    assert.equal(
      takeLock("k", "pr", { now: after + MAX_AGE_MS.pr / 2 }),
      true,
      "the back-off must end before the cached value expires"
    );
    assert.deepEqual(readEntry("k", "pr").value, { number: 7 }, "the previous good value stays");
  });
});

await test("a lookup that answers releases the lock at once", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    assert.equal(takeLock("k", "pr", { now: Date.now() }), true);
    await runRefresh("pr", "k", home.dir, { probes: { pr: () => ({ state: "found", value: { number: 3 } }) } });
    assert.equal(takeLock("k", "pr", { now: Date.now() }), true);
  });
});

/** Runs `body` in a separate node process against the same HOME. */
function child(home, body) {
  const script = `import * as cache from ${JSON.stringify(CACHE_URL)};\n${body}`;
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, HOME: home.dir, USERPROFILE: home.dir },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let err = "";
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err || `exit ${code}`))));
  });
}

await test("concurrent writers in separate processes never lose each other's entries", async () => {
  // One shared file per repository, read, changed and renamed back, let the
  // last writer erase whatever another process wrote in between: the PR
  // refresh, the CI refresh and the redraw all write to the same key.
  const home = makeHome();
  const writers = [0, 1, 2, 3].map((id) =>
    child(home, `for (let i = 0; i < 150; i++) cache.writeEntry("shared", "n${id}", i, { now: 1000 + i });`)
  );
  await Promise.all(writers);
  await withHome(home, () => {
    for (const id of [0, 1, 2, 3]) {
      assert.equal(readEntry("shared", `n${id}`)?.value, 149, `writer ${id}'s last entry was lost`);
    }
  });
});

await test("a released lock is not brought back by another process's write", async () => {
  // A writer that loaded the file while the lock was held saved it back after
  // the release, so the lock came back and blocked every refresh until it
  // expired a minute later.
  // Nobody but the locker takes this lock, so every take after its own
  // release must succeed. A refusal means a writer put the lock back.
  const home = makeHome();
  const spin = "const spin = (ms) => { const end = Date.now() + ms; while (Date.now() < end); };";
  const locker = child(
    home,
    `${spin}
    let back = 0;
    for (let i = 0; i < 200; i++) {
      if (!cache.takeLock("shared", "pr", { now: Date.now() })) back++;
      spin(1);
      cache.takeLock("shared", "pr", { release: true });
      spin(1);
    }
    if (back) { process.stderr.write(back + " released locks came back"); process.exit(1); }`
  );
  const writers = [0, 1, 2].map((id) =>
    child(
      home,
      `const end = Date.now() + 700; let i = 0; while (Date.now() < end) cache.writeEntry("shared", "w${id}", i++, { now: Date.now() });`
    )
  );
  await Promise.all([locker, ...writers]);
});
