import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getRateLimits, formatResetCountdown } from "../../src/tokens.js";
import { buildReport, explainSegments } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G, PLAIN, re } from "./glyphs.js";

// specs/023-extra-usage-limit. The payload's spend limit, which Claude Code
// sends behind a Claude gateway, and the word that says a window is used up.

const NOW = Date.parse("2026-09-28T12:00:00.000Z");
const SEC = Math.floor(NOW / 1000);
const WIDE = { maxWidth: 600, maxHeight: 40 };

const payloadWith = (limits) =>
  fullPayload({
    now: NOW,
    rate_limits: {
      five_hour: { used_percentage: 20, resets_at: SEC + 3600 },
      seven_day: { used_percentage: 40, resets_at: SEC + 3 * 86400 },
      ...limits,
    },
  });

const render = (payload, opts = {}) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, ...WIDE, ...opts }));

const line3 = (text) => text.split("\n").find((l) => l.includes(" 5h ")) ?? "";

// Story 1 -----------------------------------------------------------------

await test("a spend limit in the payload renders as its own chip with its reset", () => {
  const out = render(payloadWith({ spend_limit: { used_percentage: 12, resets_at: SEC + 5 * 3600 } }));
  assert.match(out, re`${G.spend} spend 12% · 5h00m`);
});

await test("the spend figure follows the payload from one redraw to the next", () => {
  const first = render(payloadWith({ spend_limit: { used_percentage: 12, resets_at: SEC + 3600 } }));
  const second = render(payloadWith({ spend_limit: { used_percentage: 30, resets_at: SEC + 3600 } }));
  assert.match(first, /spend 12%/);
  assert.match(second, /spend 30%/);
});

await test("a spend limit past 100% is shown as reported, in the critical band", () => {
  const out = render(payloadWith({ spend_limit: { used_percentage: 115.2, resets_at: SEC + 3600 } }));
  assert.match(out, /spend 115%\u25B4/);
});

await test("a spend limit without a reset says ? for the reset", () => {
  const out = render(payloadWith({ spend_limit: { used_percentage: 30 } }));
  assert.match(out, /spend 30% · \?/);
});

await test("a spend reset beyond a day names the day, as the 7-day chip does", () => {
  const out = render(payloadWith({ spend_limit: { used_percentage: 30, resets_at: SEC + 3 * 86400 } }));
  assert.doesNotMatch(out, /spend 30% · \?/);
  assert.match(out, /spend 30% · \S+ \d\d:\d\d/);
});

await test("a monthly spend period is plausible; one past 32 days is not", () => {
  assert.notEqual(formatResetCountdown(SEC + 31 * 86400, NOW, { maxMs: 32 * 86400000 }), null);
  assert.equal(formatResetCountdown(SEC + 33 * 86400, NOW, { maxMs: 32 * 86400000 }), null);
  const far = render(payloadWith({ spend_limit: { used_percentage: 30, resets_at: SEC + 40 * 86400 } }));
  assert.match(far, /spend 30% · \?/);
  const month = render(payloadWith({ spend_limit: { used_percentage: 30, resets_at: SEC + 31 * 86400 } }));
  assert.doesNotMatch(month, /spend 30% · \?/);
});

await test("a missing or unusable spend entry draws no chip at all", () => {
  for (const spend of [undefined, { used_percentage: -3 }, { used_percentage: Number.NaN }, { used_percentage: "12" }, {}]) {
    const limits = spend === undefined ? {} : { spend_limit: spend };
    assert.doesNotMatch(render(payloadWith(limits)), /spend/, JSON.stringify(spend));
  }
});

await test("the reader returns the spend figure rounded, and null when unusable", () => {
  assert.deepEqual(
    [getRateLimits({ rate_limits: { spend_limit: { used_percentage: 12.6, resets_at: 5 } } }).spendLimitPct,
     getRateLimits({ rate_limits: { spend_limit: { used_percentage: 12.6, resets_at: 5 } } }).spendLimitResetsAt],
    [13, 5]
  );
  assert.equal(getRateLimits({ rate_limits: { spend_limit: { used_percentage: -1 } } }).spendLimitPct, null);
  assert.equal(getRateLimits({}).spendLimitPct, null);
});

await test("without a spend entry or an exhausted window, line 3 is unchanged", () => {
  // SC-005: the chip and the word add nothing when they have nothing to say.
  const out = line3(render(payloadWith({})));
  assert.doesNotMatch(out, /spend|full/);
  assert.match(out, re`${G.timer} 5h 20% · 1h00m`);
});

await test("plain mode draws the spend chip with its substitute", () => {
  const out = render(payloadWith({ spend_limit: { used_percentage: 12, resets_at: SEC + 3600 } }), { asciiArrows: true });
  assert.equal(PLAIN.spend, "$");
  assert.match(out, /\$ spend 12%/);
});

// Story 2 -----------------------------------------------------------------

await test("an exhausted 5-hour window says full before its countdown", () => {
  const out = render(payloadWith({ five_hour: { used_percentage: 100, resets_at: SEC + 7200 } }));
  assert.match(out, re`${G.timer} 5h 100%\u25B4 full · 2h00m`);
});

await test("an exhausted 7-day window says full before its day", () => {
  const out = render(payloadWith({ seven_day: { used_percentage: 100, resets_at: SEC + 3 * 86400 } }));
  assert.match(out, re`${G.calendar} 7d 100%\u25B4 full · `);
});

await test("99% is a high reading, not a full one; 99.6% rounds to full", () => {
  assert.doesNotMatch(render(payloadWith({ five_hour: { used_percentage: 99, resets_at: SEC + 60 } })), /full/);
  assert.match(render(payloadWith({ five_hour: { used_percentage: 99.6, resets_at: SEC + 60 } })), /5h 100%\u25B4 full/);
});

await test("full survives when a narrow line sheds the reset text", () => {
  const payload = payloadWith({
    five_hour: { used_percentage: 100, resets_at: SEC + 7200 },
    seven_day: { used_percentage: 100, resets_at: SEC + 3 * 86400 },
  });
  const narrow = render(payload, { maxWidth: 70 });
  assert.match(narrow, /5h 100%\u25B4 full/);
});

await test("a full window gets no run-out forecast beside it", () => {
  // The projection used to answer "now" at 100%, printing a forecast of a
  // limit the chip next to it already says was reached.
  // Five samples over eight minutes, the least the rate will speak from.
  const samples = [80, 85, 90, 95, 100].map((fiveHourPct, i) => ({ at: NOW - (4 - i) * 2 * 60000, fiveHourPct }));
  const payload = payloadWith({ five_hour: { used_percentage: 100, resets_at: SEC + 7200 } });
  const out = render(payload, { samples });
  assert.match(out, /5h 100%\u25B4 full/);
  assert.match(out, /%\/h/, "the history is enough for a rate, so a projection would have been drawn");
  assert.doesNotMatch(out, /5h limit ~/);
});

await test("an exhausted window with no spend entry invents no figure for it", () => {
  const out = render(payloadWith({ five_hour: { used_percentage: 100, resets_at: SEC + 7200 } }));
  assert.doesNotMatch(out, /spend/);
});

// Story 3 -----------------------------------------------------------------

await test("the diagnostic reports the spend limit when the payload carries it", () => {
  const report = buildReport(payloadWith({ spend_limit: { used_percentage: 12, resets_at: SEC + 3 * 86400 } }), {
    now: NOW,
    live: false,
    probe: emptySources,
  });
  const row = report.segments.find((s) => s.key === "spendLimit");
  assert.ok(row, "spendLimit row missing");
  assert.equal(row.rendered, true);
  assert.match(row.value, /^12% · resets in 3d/);
});

await test("the diagnostic explains an absent spend limit instead of calling it a failure", () => {
  const report = buildReport(payloadWith({}), { now: NOW, live: false, probe: emptySources });
  const row = report.segments.find((s) => s.key === "spendLimit");
  assert.equal(row.rendered, false);
  assert.match(row.reason, /only behind a Claude gateway with spend limits/);
});

await test("doctor --explain describes the spend limit", () => {
  assert.match(explainSegments(), /spendLimit\s+\S/);
  assert.doesNotMatch(explainSegments(), /spendLimit\s+\(undescribed\)/);
});
