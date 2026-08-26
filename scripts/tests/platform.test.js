import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ansiToSvg } from "../../src/preview/ansiToSvg.js";
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

await test("change tracking marks a change in colour and decays after the window", () => {
  // Feature 002 replaced the icon frame sequence with a colour shift, item
  // E10. The icon holds still now; the segment brightens instead.
  const id = `smoke-${process.pid}`;
  const t0 = 1787000000000;
  const palette = { lavender: "#b4befe" };

  trackChanges(id, { branch: "main" }, { now: t0 });
  const onFirstRender = trackChanges(id, { branch: "main" }, { now: t0 + 100 });
  assert.equal(onFirstRender.isChanged("branch"), false, "unchanged value must not highlight");
  assert.equal(onFirstRender.colourFor("branch", "lavender", palette), "lavender");

  const changed = trackChanges(id, { branch: "feature" }, { now: t0 + 1000 });
  assert.equal(changed.isChanged("branch"), true);
  const highlighted = changed.colourFor("branch", "lavender", palette);
  assert.match(highlighted, /^#[0-9a-f]{6}$/, "a changed segment renders a literal colour");
  assert.notEqual(highlighted, "#b4befe", "and a lighter one than it started with");

  const expired = trackChanges(id, { branch: "feature" }, { now: t0 + 40000 });
  assert.equal(expired.isChanged("branch"), false, "highlight must decay");
  assert.equal(expired.colourFor("branch", "lavender", palette), "lavender", "colour must revert");
});

await test("only the four segments in the change channel highlight", () => {
  // Principle X, as amended: each colour channel carries one meaning, so
  // change-highlighting and the ramp must not touch the same segment.
  const id = `channel-${process.pid}`;
  const t0 = 1787000000000;
  const palette = { yellow: "#f9e2af", green: "#a6e3a1" };

  trackChanges(id, { branch: "a", context: "10" }, { now: t0 });
  const changed = trackChanges(id, { branch: "b", context: "90" }, { now: t0 + 1000 });

  assert.notEqual(changed.colourFor("branch", "yellow", palette), "yellow", "branch highlights");
  assert.equal(changed.colourFor("context", "yellow", palette), "yellow", "a ramped segment never does");
  assert.equal(changed.colourFor("effort", "green", palette), "green", "nor does one outside the set");
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

await test("no preview ships a private-use character as text", () => {
  // Principle VIII: these SVGs must render for a viewer with no Nerd Font,
  // GitHub's README renderer included. A Nerd Font codepoint written as text
  // rather than as an embedded outline shows them tofu. The commit icon on a
  // detached HEAD shipped that way once, because the converter fell through
  // to its text branch for any codepoint missing from glyphs.json.
  const dir = fileURLToPath(new URL("../../docs/previews/", import.meta.url));
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
    const svg = readFileSync(path.join(dir, name), "utf8");
    const pua = [...svg].filter((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 0xe000 && cp <= 0xf8ff;
    });
    assert.equal(pua.length, 0, `${name} carries ${pua.length} private-use character(s) as text`);
  }
});

await test("the preview converter refuses a glyph it cannot draw", () => {
  const ESC = String.fromCharCode(27);
  const unknown = String.fromCodePoint(0xf5ff); // in the private use area, not embedded
  assert.throws(
    () => ansiToSvg(`${ESC}[48;2;69;71;90m ${unknown} ${ESC}[0m`),
    /No outline for U\+F5FF/,
    "an un-embedded glyph must fail loudly rather than ship as text"
  );
});

await test("preview generation pins the terminal size as well as the clock", () => {
  // The renderer reads COLUMNS and LINES now. Without pinning them, a preview
  // generated in a narrow window would commit a narrower bar than one
  // generated in a wide one, and CI's staleness check would fail on a diff
  // that reflects a window size rather than a code change.
  const src = readFileSync(new URL("../generate-previews.js", import.meta.url), "utf8");
  assert.match(src, /PREVIEW_WIDTH\s*=\s*\d+/, "generator must pin a width");
  assert.match(src, /PREVIEW_HEIGHT\s*=\s*\d+/, "generator must pin a height");
  assert.match(src, /maxWidth: PREVIEW_WIDTH/, "every scenario must use it");
});

await test("preview fixtures stub every probe the renderer can reach", () => {
  // Principle VIII: a preview must not read the machine that generated it.
  // A probe missing from the stub list falls through to the real one, which
  // is how preview generation started spawning background refreshes on a CI
  // runner and crashed the build.
  const src = readFileSync(new URL("../preview-fixtures.js", import.meta.url), "utf8");
  const renderer = readSource("src/render.js");
  const probes = [...renderer.matchAll(/probe\.(get\w+)\(/g)].map((m) => m[1]);
  assert.ok(probes.length >= 5, "the renderer should have several probes");
  for (const probe of new Set(probes)) {
    assert.match(src, new RegExp(`${probe}:`), `preview fixtures do not stub ${probe}`);
  }
});
