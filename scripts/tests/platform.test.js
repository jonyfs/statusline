import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { pathToFileUrl, buildOpenTabScript } from "../../src/openTerminalTab.js";
import { buildCommandForTest } from "../../src/install.js";
import { clockFaceFor, resetMomentLabel } from "../../src/timeIcons.js";
import { trackChanges } from "../../src/changeTracker.js";

const readSource = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

await test("file URLs are valid on this platform", () => {
  const url = pathToFileUrl(path.join(os.tmpdir(), "some dir", "file.txt"));
  assert.ok(url.startsWith("file:///"), `expected file:/// prefix, got ${url}`);
  assert.doesNotMatch(url, /\\/, "backslashes must be converted to forward slashes");
  assert.doesNotMatch(url, / /, "spaces must be percent-encoded");
  assert.doesNotThrow(() => new URL(url));
});

await test("open-tab script is macOS-only", () => {
  assert.equal(buildOpenTabScript("/tmp/x", "iTerm.app", "linux"), null);
  assert.equal(buildOpenTabScript("/tmp/x", "Apple_Terminal", "win32"), null);
  assert.equal(buildOpenTabScript("/tmp/x", "ghostty", "darwin"), null);
});

await test("install command quotes paths containing spaces", () => {
  const cmd = buildCommandForTest(
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Users\\John Smith\\cli.js"
  );
  assert.match(cmd, /^"C:\\Program Files\\nodejs\\node\.exe" "C:\\Users\\John Smith\\cli\.js" render$/);
});

await test("renderer does not shell out with interpolated user data", () => {
  // Command strings must stay constant; anything derived from the payload
  // has to travel as an option (cwd), never spliced into a shell string,
  // or a crafted directory name becomes command injection.
  for (const file of ["src/git.js", "src/rtk.js", "src/cache.js"]) {
    let src;
    try {
      src = readSource(file);
    } catch {
      continue; // a module that does not exist yet cannot inject anything
    }
    const shellCalls = src.match(/(?:execSync|exec)\(\s*[`"'][^`"']*/g) || [];
    for (const call of shellCalls) {
      assert.doesNotMatch(call, /\$\{/, `${file}: interpolation inside a shell command`);
    }
  }
});

await test("clock-face icon matches the real reset hour", () => {
  const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);
  assert.equal(clockFaceFor(at("2026-08-24T15:00:00")), "🕒");
  assert.equal(clockFaceFor(at("2026-08-24T15:30:00")), "🕞");
  assert.equal(clockFaceFor(at("2026-08-24T00:00:00")), "🕛");
  assert.equal(clockFaceFor(undefined), null);
});

await test("expiry label names the real day, not a fake one", () => {
  const now = new Date("2026-08-24T14:20:00");
  const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);
  assert.equal(resetMomentLabel(at("2026-08-24T15:00:00"), now), "15:00");
  assert.equal(resetMomentLabel(at("2026-08-25T09:00:00"), now), "tomorrow 09:00");
  assert.equal(resetMomentLabel(at("2026-08-27T18:30:00"), now), "Thu 18:30");
});

await test("change tracking animates on change and decays after the window", () => {
  const id = `smoke-${process.pid}`;
  const t0 = 1787000000000;

  trackChanges(id, { branch: "main" }, { now: t0 });
  const onFirstRender = trackChanges(id, { branch: "main" }, { now: t0 + 100 });
  assert.equal(onFirstRender.isChanged("branch"), false, "unchanged value must not animate");

  const changed = trackChanges(id, { branch: "feature" }, { now: t0 + 1000 });
  assert.equal(changed.isChanged("branch"), true);
  assert.notEqual(changed.iconFor("branch", "STATIC"), "STATIC", "changed icon must differ");

  const expired = trackChanges(id, { branch: "feature" }, { now: t0 + 40000 });
  assert.equal(expired.isChanged("branch"), false, "highlight must decay");
  assert.equal(expired.iconFor("branch", "STATIC"), "STATIC", "icon must revert");
});

await test("change tracking can be disabled for reproducible output", () => {
  const off = trackChanges("whatever", { branch: "x" }, { enabled: false });
  assert.equal(off.isChanged("branch"), false);
  assert.equal(off.iconFor("branch", "STATIC"), "STATIC");
});

await test("preview generation pins UTC so output is timezone-independent", () => {
  // Clock faces and reset labels come from LOCAL time, so previews
  // generated in one timezone and regenerated in another would disagree
  // and fail CI's staleness check on a diff that reflects geography.
  const src = readFileSync(new URL("../generate-previews.js", import.meta.url), "utf8");
  assert.match(src, /process\.env\.TZ\s*=\s*"UTC"/, "generator must pin TZ=UTC");
});

await test("install refuses to record a package-manager cache path", () => {
  // A cache path works until the cache is evicted, then the statusline
  // vanishes with no explanation. Failing at install time is kinder.
  const src = readSource("src/install.js");
  assert.match(src, /_npx/, "install must detect the npx cache directory");
  assert.match(src, /assertNotRunningFromNpxCache\(\);/, "the guard must actually run");
});

await test("tracked changes and untracked files are counted separately", () => {
  // Collapsing them into one number hides which problem you actually have.
  const src = readSource("src/git.js");
  assert.match(src, /untracked/, "untracked count must be returned");
  assert.match(src, /changed/, "tracked-change count must be returned");
});

await test("git status is never fetched from the network", () => {
  // The statusline re-renders every few seconds; fetching on each one
  // would hammer the remote. `behind` is therefore only as fresh as the
  // user's last fetch, which is a documented limitation, not a bug.
  const src = readSource("src/git.js");
  assert.doesNotMatch(src, /git fetch|git pull|git remote update/, "must not hit the network");
});
