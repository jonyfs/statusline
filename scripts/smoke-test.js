#!/usr/bin/env node
/**
 * Cross-platform smoke test. Run on Linux, macOS and Windows:
 *
 *   npm test
 *
 * Verifies the renderer produces output and degrades cleanly, that path
 * and URL handling is correct for the host platform, and that install
 * builds a command the host shell can actually execute. Deliberately
 * does NOT touch ~/.claude/settings.json — it only inspects the pieces
 * install would write.
 */

import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { renderPayload } from "../src/render.js";
import { pathToFileUrl, buildOpenTabScript } from "../src/openTerminalTab.js";
import { PALETTES } from "../src/theme.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}

const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

const emptySources = {
  getGitInfo: () => null,
  getPrInfo: () => null,
  getRemoteUrl: () => null,
  getActiveSkills: () => [],
  getRtkSavings: () => null,
  getDirUrl: () => null,
};

console.log(`\nstatusline smoke test — ${process.platform} / node ${process.version}\n`);

test("renders with a fully populated payload", () => {
  const out = renderPayload(
    {
      model: { display_name: "Sonnet 5" },
      effort: { level: "high" },
      cwd: process.cwd(),
      context_window: { used_percentage: 26 },
      rate_limits: {
        five_hour: { used_percentage: 20, resets_at: Math.floor(Date.now() / 1000) + 3600 },
        seven_day: { used_percentage: 77, resets_at: Math.floor(Date.now() / 1000) + 86400 },
      },
    },
    { sources: emptySources }
  );
  const plain = stripAnsi(out);
  assert.match(plain, /Sonnet 5/);
  assert.match(plain, /Context 26%/);
  assert.match(plain, /5h 20%/);
  assert.match(plain, /7d 77%/);
});

test("degrades to ?% instead of inventing numbers", () => {
  const plain = stripAnsi(renderPayload({}, { sources: emptySources }));
  assert.match(plain, /Context \?%/);
  assert.match(plain, /5h \?%/);
  assert.doesNotMatch(plain, /NaN|undefined|null/);
});

test("survives a completely empty payload", () => {
  const out = renderPayload({}, { sources: emptySources });
  assert.ok(out.length > 0);
  assert.doesNotMatch(out, /undefined|NaN/);
});

test("omits the skills line when no skills are active", () => {
  const lines = renderPayload({}, { sources: emptySources }).split("\n");
  assert.equal(lines.length, 3, `expected 3 lines without skills, got ${lines.length}`);
});

test("includes the skills line when skills are active", () => {
  const lines = renderPayload(
    {},
    { sources: { ...emptySources, getActiveSkills: () => ["a", "b"] } }
  ).split("\n");
  assert.equal(lines.length, 4);
});

test("every Catppuccin flavor renders", () => {
  for (const flavor of Object.keys(PALETTES)) {
    const out = renderPayload({}, { flavor, sources: emptySources });
    assert.ok(out.length > 0, `${flavor} produced no output`);
  }
});

test("file URLs are valid on this platform", () => {
  const url = pathToFileUrl(path.join(os.tmpdir(), "some dir", "file.txt"));
  assert.ok(url.startsWith("file:///"), `expected file:/// prefix, got ${url}`);
  assert.doesNotMatch(url, /\\/, "backslashes must be converted to forward slashes");
  assert.doesNotMatch(url, / /, "spaces must be percent-encoded");
  // Must survive a round-trip through the platform's URL parser.
  assert.doesNotThrow(() => new URL(url));
});

test("open-tab script is macOS-only", () => {
  assert.equal(buildOpenTabScript("/tmp/x", "iTerm.app", "linux"), null);
  assert.equal(buildOpenTabScript("/tmp/x", "Apple_Terminal", "win32"), null);
  assert.equal(buildOpenTabScript("/tmp/x", "ghostty", "darwin"), null);
});

test("install command quotes paths containing spaces", async () => {
  const { buildCommandForTest } = await import("../src/install.js");
  const cmd = buildCommandForTest(
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Users\\John Smith\\cli.js"
  );
  assert.match(cmd, /^"C:\\Program Files\\nodejs\\node\.exe" "C:\\Users\\John Smith\\cli\.js" render$/);
});

test("renderer does not shell out with interpolated user data", async () => {
  // Command strings must stay constant; anything derived from the payload
  // has to travel as an option (cwd), never spliced into a shell string,
  // or a crafted directory name becomes command injection.
  const { readFileSync } = await import("node:fs");
  for (const file of ["src/git.js", "src/rtk.js"]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const shellCalls = src.match(/(?:execSync|exec)\(\s*[`"'][^`"']*/g) || [];
    for (const call of shellCalls) {
      assert.doesNotMatch(call, /\$\{/, `${file}: interpolation inside a shell command`);
    }
  }
});

test("clock-face icon matches the real reset hour", async () => {
  const { clockFaceFor } = await import("../src/timeIcons.js");
  const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);
  assert.equal(clockFaceFor(at("2026-08-24T15:00:00")), "🕒");
  assert.equal(clockFaceFor(at("2026-08-24T15:30:00")), "🕞");
  assert.equal(clockFaceFor(at("2026-08-24T00:00:00")), "🕛");
  assert.equal(clockFaceFor(undefined), null);
});

test("expiry label names the real day, not a fake one", async () => {
  const { resetMomentLabel } = await import("../src/timeIcons.js");
  const now = new Date("2026-08-24T14:20:00");
  const at = (iso) => Math.floor(new Date(iso).getTime() / 1000);
  assert.equal(resetMomentLabel(at("2026-08-24T15:00:00"), now), "15:00");
  assert.equal(resetMomentLabel(at("2026-08-25T09:00:00"), now), "tomorrow 09:00");
  assert.equal(resetMomentLabel(at("2026-08-27T18:30:00"), now), "Thu 18:30");
});

test("change tracking animates on change and decays after the window", async () => {
  const { trackChanges } = await import("../src/changeTracker.js");
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

test("change tracking can be disabled for reproducible output", async () => {
  const { trackChanges } = await import("../src/changeTracker.js");
  const off = trackChanges("whatever", { branch: "x" }, { enabled: false });
  assert.equal(off.isChanged("branch"), false);
  assert.equal(off.iconFor("branch", "STATIC"), "STATIC");
});

test("preview generation pins UTC so output is timezone-independent", async () => {
  // Clock faces and reset labels come from LOCAL time, so previews
  // generated in one timezone and regenerated in another would disagree
  // and fail CI's staleness check on a diff that reflects geography.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./generate-previews.js", import.meta.url), "utf8");
  assert.match(src, /process\.env\.TZ\s*=\s*"UTC"/, "generator must pin TZ=UTC");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
