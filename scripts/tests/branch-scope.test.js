import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { makeHome, withHome } from "./fixtures/home.js";
import { writeEntry, repoKey } from "../../src/cache.js";
import { getPrInfo, getCiStatus, normalizeRemoteToHttps } from "../../src/git.js";
import { runRefresh } from "../../src/refresh.js";

/**
 * Both `gh` lookups answer about the branch that was checked out when they
 * ran, and both are cached per repository. Without the branch travelling
 * with the answer, switching branches left the previous branch's pull
 * request and CI run sitting on the line as though they described this one.
 */

const NOW = 1787000000000;
const CWD = "/tmp/some-repo";

await test("a pull request cached under another branch is refused", async () => {
  const home = makeHome();
  await withHome(home, () => {
    process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";
    const key = repoKey(CWD);
    writeEntry(key, "pr", { number: 7, state: "OPEN", url: "u", branch: "main" }, { now: NOW });

    assert.equal(getPrInfo(CWD, { now: NOW, branch: "main" })?.number, 7);
    assert.equal(getPrInfo(CWD, { now: NOW, branch: "feature" }), null);
    // A value stored before branches were recorded still renders: refusing
    // it would blank the segment for everyone with a warm cache.
    writeEntry(key, "pr", { number: 8, state: "OPEN", url: "u" }, { now: NOW });
    assert.equal(getPrInfo(CWD, { now: NOW, branch: "feature" })?.number, 8);
  });
});

await test("a CI run from another branch is refused", async () => {
  const home = makeHome();
  await withHome(home, () => {
    process.env.CLAUDE_STATUSLINE_NO_REFRESH = "1";
    const key = repoKey(CWD);
    writeEntry(key, "ci", { conclusion: "success", status: "completed", workflow: "CI", branch: "main" }, { now: NOW });

    assert.equal(getCiStatus(CWD, { now: NOW, branch: "main" })?.conclusion, "success");
    assert.equal(
      getCiStatus(CWD, { now: NOW, branch: "docs/whatever" }),
      null,
      "a branch that was never pushed must not inherit main's tick"
    );
  });
});

await test("a lookup that found nothing clears the cache; one that failed does not", async () => {
  const home = makeHome();
  await withHome(home, async () => {
    const key = repoKey(CWD);
    writeEntry(key, "pr", { number: 7, state: "OPEN", branch: "main" }, { now: NOW });

    // "This branch has no pull request" is an answer, and storing it is what
    // clears the one the previous branch left behind.
    await runRefresh("pr", key, CWD, { now: NOW, probes: { pr: () => ({ state: "none", value: null }) } });
    assert.equal(getPrInfo(CWD, { now: NOW }), null);

    writeEntry(key, "pr", { number: 9, state: "OPEN", branch: "main" }, { now: NOW });
    // A failed lookup is not an answer. Writing it would make an unreachable
    // network look like a closed pull request.
    await runRefresh("pr", key, CWD, { now: NOW, probes: { pr: () => ({ state: "failed", value: null }) } });
    assert.equal(getPrInfo(CWD, { now: NOW })?.number, 9);
  });
});

await test("credentials in a remote never reach the link", () => {
  assert.equal(
    normalizeRemoteToHttps("https://jony:ghp_secrettoken@github.com/jonyfs/statusline.git"),
    "https://github.com/jonyfs/statusline"
  );
  assert.equal(
    normalizeRemoteToHttps("https://github.com/jonyfs/statusline.git"),
    "https://github.com/jonyfs/statusline"
  );
});
