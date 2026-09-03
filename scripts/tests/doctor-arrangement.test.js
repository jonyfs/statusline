/**
 * What the diagnostic says about an arrangement.
 *
 * Every row in the contract's error table is here, because each of them is a
 * case where the bar deliberately does nothing visible: an ignored entry
 * looks exactly like an entry that was never written, and the diagnostic is
 * the only place the difference exists.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { test } from "../test-harness.js";
import { buildReport, formatReport } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-25T12:00:00.000Z");

/** A report built with one arrangement pointed at by the environment. */
function reportWith(arrangement, { raw = null } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "statusline-doctor-"));
  const file = path.join(dir, "layout.json");
  writeFileSync(file, raw ?? JSON.stringify(arrangement));
  const before = process.env.CLAUDE_STATUSLINE_LAYOUT;
  process.env.CLAUDE_STATUSLINE_LAYOUT = file;
  try {
    const report = buildReport(fullPayload({ cwd: dir }), {
      now: NOW,
      live: false,
      probe: { ...emptySources, getDirUrl: () => null },
    });
    return { report, text: formatReport(report), file };
  } finally {
    if (before === undefined) delete process.env.CLAUDE_STATUSLINE_LAYOUT;
    else process.env.CLAUDE_STATUSLINE_LAYOUT = before;
    rmSync(dir, { recursive: true, force: true });
  }
}

await test("with no arrangement the diagnostic says so", () => {
  const before = process.env.CLAUDE_STATUSLINE_LAYOUT;
  delete process.env.CLAUDE_STATUSLINE_LAYOUT;
  try {
    const report = buildReport(fullPayload({ cwd: "/tmp" }), {
      now: NOW,
      live: false,
      probe: { ...emptySources, getDirUrl: () => null },
    });
    assert.equal(report.arrangement.origin, "default");
    assert.deepEqual(report.arrangement.ignored, []);
    assert.match(formatReport(report), /arrangement: default/);
  } finally {
    if (before !== undefined) process.env.CLAUDE_STATUSLINE_LAYOUT = before;
  }
});

await test("an arrangement in force is named, with where it came from", () => {
  const { report, text, file } = reportWith({ version: 1, name: "mine", segments: {} });
  assert.equal(report.arrangement.origin, "env");
  assert.equal(report.arrangement.name, "mine");
  assert.match(text, /arrangement: "mine" from env/);
  assert.ok(text.includes(file), "the file it came from is not named");
});

await test("a file that will not parse falls back and gives the reason", () => {
  const { report, text } = reportWith(null, { raw: "not json at all" });
  assert.equal(report.arrangement.origin, "default");
  assert.ok(report.arrangement.error, "no reason was recorded");
  assert.match(text, /arrangement: default \(nothing usable at /);
});

await test("an unknown version is named and the file is dropped whole", () => {
  const { report, text } = reportWith({ version: 7, segments: { rtk: { on: false } } });
  assert.equal(report.arrangement.origin, "default");
  assert.ok(report.arrangement.ignored.some((i) => i.what === "version" && i.value === 7));
  assert.match(text, /ignored version: unknown arrangement version/);
  assert.ok(report.segments.find((s) => s.key === "rtk").on, "an entry from a dropped file was applied");
});

await test("an unknown segment key is named", () => {
  const { report, text } = reportWith({ version: 1, segments: { notASegment: { on: false } } });
  assert.ok(report.arrangement.ignored.some((i) => i.key === "notASegment"));
  assert.match(text, /ignored segment on notASegment: no such segment/);
});

await test("a line outside the four is named, and the rest of the entry applies", () => {
  const { report, text } = reportWith({ version: 1, segments: { rtk: { line: 9, on: false } } });
  assert.match(text, /ignored line on rtk: not a line the bar has/);
  const rtk = report.segments.find((s) => s.key === "rtk");
  assert.equal(rtk.line, 4, "the bad line was applied");
  assert.equal(rtk.on, false, "the good switch beside it was dropped");
});

await test("a non-numeric order is named", () => {
  const { text } = reportWith({ version: 1, segments: { rtk: { order: "first" } } });
  assert.match(text, /ignored order on rtk: not a number/);
});

await test("a switched-off segment says so rather than blaming its source", () => {
  const { report } = reportWith({ version: 1, segments: { model: { on: false } } });
  const model = report.segments.find((s) => s.key === "model");
  assert.equal(model.rendered, false);
  assert.equal(model.reason, "switched off by the arrangement");
});

await test("a moved segment reports the line it is actually on", () => {
  const { report, text } = reportWith({ version: 1, segments: { skills: { line: 3, order: 5 } } });
  const skills = report.segments.find((s) => s.key === "skills");
  assert.equal(skills.line, 3, "the diagnostic reported the registry's line");
  assert.equal(skills.order, 5);
  assert.equal(skills.arranged, true, "the move was not marked");
  assert.match(text, /skills\s+3\*/, "the moved line is not marked in the table");
});
