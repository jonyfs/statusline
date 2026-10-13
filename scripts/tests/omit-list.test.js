import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { renderReadings, gather } from "../../src/render.js";
import { resolveLayout, omittedKeys } from "../../src/config.js";
import { resolveArrangement } from "../../src/arrangement.js";
import { SEGMENTS } from "../../src/segments.js";
import { displayWidth } from "../../src/theme.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";
import { pinned } from "./ansi-fixtures.js";

const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;[^;\x07]*;[^\x07\x1b]*(?:\x07|\x1b\\)/g, "");

/** The fixture bar with `omit` applied, as the command would read it. */
function bar(width, omit) {
  return pinned(() => {
    const layout = resolveLayout(process.cwd(), { ...process.env, ...(omit ? { CLAUDE_STATUSLINE_OMIT: omit } : {}) });
    const now = FIXED_NOW * 1000;
    return strip(
      renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, {
        ...RENDER_OPTIONS,
        maxWidth: width,
        maxHeight: 40,
        arrangement: layout.arrangement,
        arrangementOrigin: layout.origin,
      })
    );
  });
}

await test("the list is read as names, without blanks or repeats", () => {
  assert.deepEqual(omittedKeys({ CLAUDE_STATUSLINE_OMIT: " dir, branch ,,dir" }), ["dir", "branch"]);
  assert.deepEqual(omittedKeys({}), []);
  assert.deepEqual(omittedKeys({ CLAUDE_STATUSLINE_OMIT: " , " }), []);
});

await test("an omitted segment is off, and nothing else in the arrangement moves (FR-001, FR-003)", () => {
  const env = { CLAUDE_STATUSLINE_OMIT: "dir,branch" };
  const layout = resolveLayout(process.cwd(), env);
  const resolved = resolveArrangement(SEGMENTS, layout.arrangement, layout.origin);
  const off = resolved.placements.filter((p) => !p.on).map((p) => p.key).sort();
  assert.deepEqual(off, ["branch", "dir"]);
  const plain = resolveArrangement(SEGMENTS, null);
  for (const p of resolved.placements) {
    const was = plain.placements.find((q) => q.key === p.key);
    assert.equal(p.line, was.line);
    assert.equal(p.order, was.order);
  }
});

await test("it wins over an arrangement that says on, and keeps that arrangement's other entries", () => {
  const dir = process.cwd();
  const layoutEnvFile = fileURLToPath(new URL("./fixtures/omit-layout.json", import.meta.url));
  const layout = resolveLayout(dir, { CLAUDE_STATUSLINE_LAYOUT: layoutEnvFile, CLAUDE_STATUSLINE_OMIT: "model" });
  const resolved = resolveArrangement(SEGMENTS, layout.arrangement, layout.origin);
  const by = new Map(resolved.placements.map((p) => [p.key, p]));
  assert.equal(by.get("model").on, false, "omit wins over on: true");
  assert.equal(by.get("effort").line, 2, "the arrangement's own placement stays");
});

const PUA = /[\ue000-\uf8ff\u{f0000}-\u{ffffd}]/gu;
const firstLine = (s) => s.split("\n")[0].replace(PUA, " ").replace(/\s+/g, " ").trim();

await test("the fixture bar loses the omitted chips and keeps every other one (SC-001)", () => {
  const full = firstLine(bar(220));
  const cut = firstLine(bar(220, "dir,branch"));
  assert.ok(full.startsWith("statusline "), `the directory leads the full bar: ${full}`);
  assert.ok(!cut.startsWith("statusline "), `and is gone from the cut one: ${cut}`);
  assert.ok(full.includes("004-statuslin"), "the branch chip is in the full bar");
  assert.ok(!cut.includes("004-statuslin"), "and gone from the cut one");
  for (const kept of ["projects", "jonyfs/statusline", "PR #128", "CI", "2 gates"]) {
    assert.ok(cut.includes(kept), `${kept} stays`);
  }
});

await test("the width goes to the others (SC-002)", () => {
  const omit = "dir,repo,projectDir,branch,worktree,worktreeState";
  // Somewhere the full bar has to drop the pull request chip and the shorter one keeps it.
  let found = null;
  for (let w = 200; w >= 60 && !found; w--) {
    if (!bar(w).includes("PR #128") && bar(w, omit).includes("PR #128")) found = w;
  }
  assert.ok(found, "some width shows the effect");
  for (const line of bar(found, omit).split("\n")) {
    assert.ok(displayWidth(line) <= found, `${found}: ${displayWidth(line)}`);
  }
});

await test("an unknown name is reported by the arrangement and draws the default bar (SC-003)", () => {
  const layout = resolveLayout(process.cwd(), { CLAUDE_STATUSLINE_OMIT: "nope" });
  const resolved = resolveArrangement(SEGMENTS, layout.arrangement, layout.origin);
  assert.ok(resolved.ignored.some((i) => i.key === "nope" && /no such segment/.test(i.reason)));
  assert.equal(bar(120, "nope"), bar(120));
});

await test("without the variable the layout is untouched (FR-005)", () => {
  const none = resolveLayout(process.cwd(), {});
  assert.deepEqual(resolveLayout(process.cwd(), { CLAUDE_STATUSLINE_OMIT: "" }), none);
  assert.deepEqual(resolveLayout(process.cwd(), { CLAUDE_STATUSLINE_OMIT: " , " }), none);
});
