import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getRateLimits } from "../../src/tokens.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

// The `rate_limits` object printed in Claude Code's statusline documentation
// (code.claude.com/docs/en/statusline), copied as it is, with the three
// windows. The clock is fixed before the earliest `resets_at`, so the windows
// are all still open and the test gives the same result on any day.
const DOC_RATE_LIMITS = {
  five_hour: { used_percentage: 23.5, resets_at: 1738425600 },
  seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
  spend_limit: { used_percentage: 62.8, resets_at: 1740787200, used_usd: 314.12, limit_usd: 500, period: "monthly" },
};
const NOW = Date.parse("2025-02-01T12:00:00.000Z");
const WIDE = { maxWidth: 600, maxHeight: 40 };

await test("the documented rate_limits payload is read field by field", () => {
  const r = getRateLimits(fullPayload({ now: NOW, rate_limits: DOC_RATE_LIMITS }));
  assert.equal(r.fiveHourPct, 24);
  assert.equal(r.fiveHourResetsAt, 1738425600);
  assert.equal(r.sevenDayPct, 41);
  assert.equal(r.sevenDayResetsAt, 1738857600);
  assert.equal(r.spendLimitPct, 63);
  assert.equal(r.spendLimitResetsAt, 1740787200);
  assert.deepEqual(r.spendLimitUsd, { used: 314.12, limit: 500, period: "monthly" });
});

await test("the documented payload draws the windows and the spend limit together", () => {
  const out = stripAnsi(
    renderPayload(fullPayload({ now: NOW, rate_limits: DOC_RATE_LIMITS }), {
      sources: emptySources,
      trackChanges: false,
      now: NOW,
      ...WIDE,
    }),
  );
  assert.match(out, /\b5h\b/);
  assert.match(out, /\b7d\b/);
  assert.match(out, /spend \$314\/\$500/); // whole dollars once past $100
  assert.match(out, /63%/);
});

await test("the documented payload without its dollar fields still gives the percentage", () => {
  const { used_usd, limit_usd, period, ...percentOnly } = DOC_RATE_LIMITS.spend_limit;
  const r = getRateLimits(fullPayload({ now: NOW, rate_limits: { spend_limit: percentOnly } }));
  assert.equal(r.spendLimitPct, 63);
  assert.equal(r.spendLimitUsd, null);
});
