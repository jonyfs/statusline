import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { bandFor, rampColour } from "../../src/ramp.js";
import { renderPayload } from "../../src/render.js";
import { displayWidth } from "../../src/theme.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

const atLevel = (pct, extra = {}) =>
  stripAnsi(
    renderPayload(
      fullPayload({
        context_window: { used_percentage: pct },
        rate_limits: {
          five_hour: { used_percentage: pct, resets_at: Math.floor(NOW / 1000) + 3600 },
          seven_day: { used_percentage: pct, resets_at: Math.floor(NOW / 1000) + 86400 },
        },
      }),
      { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 400, maxHeight: 40, ...extra }
    )
  )
    .split("\n")
    .pop();

await test("the bands break at 60 and 85, per E4", () => {
  assert.equal(bandFor(0).name, "ok");
  assert.equal(bandFor(59.9).name, "ok");
  assert.equal(bandFor(60).name, "warn");
  assert.equal(bandFor(84.9).name, "warn");
  assert.equal(bandFor(85).name, "critical");
  assert.equal(bandFor(100).name, "critical");
});

await test("an unknown level is not a band", () => {
  // Painting an absent figure green would be an answer the payload never
  // gave. Principle III.
  assert.equal(bandFor(null), null);
  assert.equal(bandFor(undefined), null);
  assert.equal(bandFor(Number.NaN), null);
  assert.equal(rampColour(null, "yellow"), "yellow", "it keeps its own colour instead");
});

await test("each band has its own colour", () => {
  assert.equal(rampColour(10, "x"), "green");
  assert.equal(rampColour(70, "x"), "peach", "attention is peach, yellow is an icon (specs/041)");
  assert.equal(rampColour(95, "x"), "red");
});

await test("the context segment renders a number, and no bar", () => {
  // E1 originally chose a bar beside the number. The bar cost ten to
  // sixteen columns on the widest line for something the number already
  // said in three, so it was dropped on 2026-08-26.
  const line = atLevel(38);
  assert.ok(line.includes("\u{F09D1}"), "the context icon names the chip");
  assert.match(line, /38%/);
  assert.doesNotMatch(line, /[█▓▒░]/, "the bar is gone from the statusline");
});

await test("the ramp reaches the rate limits as well, per E5", () => {
  // Same thresholds on all three, so a glance reads them the same way.
  const safe = atLevel(20);
  const warn = atLevel(70);
  const hot = atLevel(95);
  // The triangles were retired by constitution 8.4.0 (K6): the critical band
  // draws the alert glyph before the number, and the warn band a bold number.
  assert.doesNotMatch(safe, /[\u25b4\u25b5\uF40C]/, "nothing is wrong needs no symbol");
  assert.doesNotMatch(warn, /[\u25b4\u25b5\uF40C]/, "warn is a bold number, not a glyph");
  assert.doesNotMatch(hot, /[\u25b4\u25b5]/, "the triangles are gone");
  assert.equal((hot.match(/\uF40C/g) || []).length, 3, "the alert glyph marks each critical gauge");
});

await test("the band survives without colour, per E6", () => {
  // Section 508: colour may not be the only carrier. The alert glyph marks
  // the critical band, and the track says how full it is (specs/046-gauges).
  const hot = atLevel(95);
  assert.match(hot, /\uF40C/);
});

await test("a bar never renders for a segment the payload left out", () => {
  const line = stripAnsi(
    renderPayload({}, { sources: gitSources(), trackChanges: false, now: NOW, maxWidth: 400 })
  )
    .split("\n")
    .pop();
  assert.match(line, /󰧑\s+(?:[\uEE00-\uEE05]{5}\s+|[|.]{5}\s+)?—/);
  assert.doesNotMatch(line, /[█▓▒]/, "no level, no fill");
});
