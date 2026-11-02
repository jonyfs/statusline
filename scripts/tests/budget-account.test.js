import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getRateLimits, budgetPace } from "../../src/tokens.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

// specs/062-budget-account. An account metered in dollars over a day, week or
// month has `rate_limits.spend_limit` and neither the 5-hour nor the 7-day
// window.

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const SEC = Math.floor(NOW / 1000);
const DAY = 86400;
const WIDE = { maxWidth: 600, maxHeight: 40 };

const budget = (spend, extra = {}) =>
  fullPayload({ now: NOW, rate_limits: { spend_limit: spend, ...extra } });
const render = (payload) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, ...WIDE }));

// The period ends on 23 Nov, so it began on 23 Oct: 31 days, 11 gone, 20 left.
const monthly = { used_percentage: 40, resets_at: SEC + 20 * DAY, used_usd: 200, limit_usd: 500, period: "monthly" };

await test("the dollars and the period are read, and only as a complete set", () => {
  assert.deepEqual(getRateLimits(budget(monthly)).spendLimitUsd, { used: 200, limit: 500, period: "monthly" });
  assert.equal(getRateLimits(budget({ ...monthly, limit_usd: undefined })).spendLimitUsd, null);
  assert.equal(getRateLimits(budget({ ...monthly, used_usd: -1 })).spendLimitUsd, null);
  assert.equal(getRateLimits(budget({ ...monthly, limit_usd: 0 })).spendLimitUsd, null);
  assert.equal(getRateLimits(budget({ ...monthly, period: "yearly" })).spendLimitUsd.period, null);
});

await test("the daily allowance is what is left over what is left of the period", () => {
  const p = budgetPace({ used: 200, limit: 500, period: "monthly" }, SEC + 20 * DAY, NOW, 30 * 1440);
  assert.equal(p.allowance, 15); // $300 over 20 days
  assert.equal(p.avg, 20); // $200 over 10 days
  assert.equal(Math.round(p.projectedPct), 120); // $20/day for 30 days against $500
});

await test("a daily limit paces per hour, and the last day is not divided below one", () => {
  const h = budgetPace({ used: 10, limit: 34, period: "daily" }, SEC + 12 * 3600, NOW, 1440);
  assert.equal(h.allowance, 2); // $24 over 12 hours
  const last = budgetPace({ used: 100, limit: 130, period: "monthly" }, SEC + 6 * 3600, NOW, 30 * 1440);
  assert.equal(last.allowance, 30);
});

await test("a limit used up, a reset that has passed and a reset out of range give no pace", () => {
  assert.deepEqual(budgetPace({ used: 520, limit: 500, period: "monthly" }, SEC + DAY, NOW, 43200), { over: 20 });
  assert.equal(budgetPace({ used: 1, limit: 500, period: "monthly" }, SEC - 1, NOW, 43200), null);
  assert.equal(budgetPace({ used: 1, limit: 500, period: "monthly" }, SEC + 90 * DAY, NOW, 43200), null);
  assert.equal(budgetPace({ used: 1, limit: 500, period: "monthly" }, null, NOW, 43200), null);
});

await test("a budget account draws the dollars and the pace, and no 5h or 7d placeholder", () => {
  const out = render(budget(monthly));
  assert.match(out, /spend \$200\/\$500/);
  assert.match(out, /40%/);
  assert.match(out, /\$15\/d left · avg \$18\.2\/d/);
  assert.doesNotMatch(out, /\b5h\b/);
  assert.doesNotMatch(out, /\b7d\b/);
});

await test("a limit that is exceeded says by how much", () => {
  const out = render(budget({ ...monthly, used_percentage: 104, used_usd: 520 }));
  assert.match(out, /over by \$20/);
});

await test("percentage only: the chip is what it was and there is no pace chip", () => {
  const out = render(budget({ used_percentage: 40, resets_at: SEC + 20 * DAY }));
  assert.match(out, /spend\s+\S*\s*40%/);
  assert.doesNotMatch(out, /\$|left ·|\/d/);
});

await test("a subscriber with windows and a spend limit keeps both windows", () => {
  const out = render(
    budget(monthly, {
      five_hour: { used_percentage: 20, resets_at: SEC + 3600 },
      seven_day: { used_percentage: 40, resets_at: SEC + 3 * DAY },
    })
  );
  assert.match(out, /\b5h\b/);
  assert.match(out, /\b7d\b/);
  assert.match(out, /spend \$200\/\$500/);
});

await test("before the first response there is no rate_limits and the windows read ?", () => {
  const out = render(fullPayload({ now: NOW, rate_limits: undefined }));
  assert.match(out, /\b5h\b/);
  assert.doesNotMatch(out, /spend/);
});

await test("a month is counted in UTC: the same payload paces the same in every time zone", async () => {
  const { monthPeriodMinutes } = await import("../../src/tokens.js");
  const at = (iso) => Date.parse(iso) / 1000;
  assert.equal(monthPeriodMinutes(at("2026-11-01T00:00:00Z")), 31 * 1440); // October
  assert.equal(monthPeriodMinutes(at("2026-03-01T00:00:00Z")), 28 * 1440); // February
  assert.equal(monthPeriodMinutes(at("2028-03-01T00:00:00Z")), 29 * 1440); // leap year
  assert.equal(monthPeriodMinutes(at("2026-05-31T00:00:00Z")), 31 * 1440); // from Apr 30 (clamped), not an overflow to May 1
});

// The suite pins TZ=UTC for the whole process, so the zones are tried in
// children that draw the same payload and print the pace chip.
await test("the pace chip reads the same in UTC, Los Angeles, Sao Paulo and Tokyo", () => {
  const code = String.raw`
    import { renderPayload } from ${JSON.stringify(new URL("../../src/render.js", import.meta.url).href)};
    const NOW = Date.parse("2026-10-20T12:00:00Z");
    const p = { model: { display_name: "Opus" }, workspace: { current_dir: "/tmp" }, context_window: { used_percentage: 10 },
      rate_limits: { spend_limit: { used_percentage: 50, resets_at: Date.parse("2026-11-01T00:00:00Z") / 1000, used_usd: 250, limit_usd: 500, period: "monthly" } } };
    const out = renderPayload(p, { trackChanges: false, now: NOW, maxWidth: 300, maxHeight: 20, sources: {} });
    console.log(out.replace(/\x1b\[[0-9;:]*m/g, "").match(/\$[\d.]+\/d left · avg \$[\d.]+\/d/)[0]);`;
  const draw = (tz) =>
    spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, TZ: tz }, encoding: "utf8" }).stdout.trim();
  const utc = draw("UTC");
  assert.match(utc, /avg \$12\.8\/d/);
  for (const tz of ["America/Los_Angeles", "America/Sao_Paulo", "Asia/Tokyo"]) assert.equal(draw(tz), utc, tz);
});

await test("amounts as numeric text and a reset in milliseconds are read as what they mean", () => {
  const texty = getRateLimits(budget({ ...monthly, used_usd: "200.5", limit_usd: " 500 " }));
  assert.deepEqual(texty.spendLimitUsd, { used: 200.5, limit: 500, period: "monthly" });
  assert.equal(getRateLimits(budget({ ...monthly, used_usd: "abc" })).spendLimitUsd, null);
  assert.equal(getRateLimits(budget({ ...monthly, resets_at: (SEC + 20 * DAY) * 1000 })).spendLimitResetsAt, SEC + 20 * DAY);
  assert.equal(getRateLimits(budget(monthly)).spendLimitResetsAt, SEC + 20 * DAY);
});

// The gateway resets caps on UTC calendar boundaries and `period` can be
// absent, so a reset near enough to be a day, a week or a month paces on no
// scale at all rather than on a guessed one.
await test("a payload without the period paces only when the reset can only be a month's", () => {
  const noPeriod = (days) => render(budget({ used_percentage: 40, resets_at: SEC + days * DAY, used_usd: 200, limit_usd: 500 }));
  assert.match(noPeriod(20), /\$[\d.]+\/d left · avg/);
  assert.doesNotMatch(noPeriod(3), /left ·|\/d left/);
  assert.match(noPeriod(3), /spend \$200\/\$500/); // the dollars still show
});

await test("a weekly cap with its period is paced on a week", () => {
  const out = render(budget({ used_percentage: 50, resets_at: SEC + 3 * DAY, used_usd: 250, limit_usd: 500, period: "weekly" }));
  assert.match(out, /\$[\d.]+\/d left · avg \$[\d.]+\/d/);
});
