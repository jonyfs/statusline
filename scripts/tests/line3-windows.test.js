import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { readUsageCredits } from "../../src/usageCredits.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/076-line-3-windows: the weekly rate, the per-model weeks, extra usage, a clock, the seat, the links.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const NOW_S = Math.floor(NOW / 1000);
const MIN = 60_000;
const ACCOUNT = "092a2857-0000-4000-8000-000000000004";

const raw = (payload, src, env = {}, samples = null, width = 300) => {
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try {
    return renderPayload(payload, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40, ...(samples ? { samples } : {}) });
  } finally {
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
};
const render = (...a) => stripAnsi(raw(...a));
const CREDITS = { pct: 10, pctExact: 9.9, daily: null, weekly: null, enabled: true, reached: false, hasWindows: true, fetchedAt: NOW - MIN, disabledReason: null, severity: null, creditsEverEnabled: true, windows: { fiveHour: null, sevenDay: null, perModel: [] }, resetsAt: null };
const sources = (over = {}) => ({ ...emptySources, getAccountKind: () => "subscriber", noteAccountKind: () => {}, ...over });

await test("the reader lists the per-model weeks the cache carries, and skips the blocks that are not models", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify({
      oauthAccount: { accountUuid: ACCOUNT },
      cachedUsageUtilization: { fetchedAtMs: NOW - MIN, accountUuid: ACCOUNT, utilization: {
        five_hour: { utilization: 20, resets_at: NOW_S + 3600 }, seven_day: { utilization: 70, resets_at: NOW_S + 86400 },
        seven_day_opus: { utilization: 40.4, resets_at: NOW_S + 86400 }, seven_day_sonnet: { utilization: 12, resets_at: NOW_S + 86400 },
        seven_day_oauth_apps: { utilization: 1, resets_at: null }, seven_day_breakdown: null,
      } },
    }));
    assert.deepEqual(readUsageCredits({ now: NOW }).windows.perModel, [{ model: "opus", pct: 40, resetsAt: NOW_S + 86400 }, { model: "sonnet", pct: 12, resetsAt: NOW_S + 86400 }]);
  });
});

await test("the week's rate draws from the sample ring scaled to a day, and only when rising", () => {
  const rising = Array.from({ length: 6 }, (_, i) => ({ at: NOW - (5 - i) * 2 * MIN, fiveHourPct: 20, sevenDayPct: 76 + i * 0.1, contextPct: 26, rtkPct: null }));
  const out = render(fullPayload({ now: NOW }), sources(), {}, rising);
  // 0.5 points over ten minutes is 72 a day.
  assert.match(out, /\+72%\/d/);
  const flat = rising.map((s) => ({ ...s, sevenDayPct: 76 }));
  assert.doesNotMatch(render(fullPayload({ now: NOW }), sources(), {}, flat), /%\/d/);
});

await test("the per-model weeks draw in the band of the highest, and extra usage marks the 5-hour chip", () => {
  const src = sources({ getUsageCredits: () => ({ ...CREDITS, windows: { fiveHour: null, sevenDay: null, perModel: [{ model: "opus", pct: 85, resetsAt: null }, { model: "sonnet", pct: 12, resetsAt: null }] } }) });
  const out = render(fullPayload({ now: NOW }), src);
  assert.match(out, /opus 85% · sonnet 12%/);
  assert.match(out, /5h\W+20%\W*\+extra/);
  const off = render(fullPayload({ now: NOW }), sources({ getUsageCredits: () => ({ ...CREDITS, enabled: false }) }));
  assert.doesNotMatch(off, /\+extra|opus/);
});

await test("CLAUDE_STATUSLINE_RESET=clock draws the resets as moments in the computer's zone", () => {
  const p = fullPayload({ now: NOW });
  const countdown = render(p, sources());
  assert.match(countdown, /5h\W+20%[^\n]*1h00/);
  const clock = render(p, sources(), { CLAUDE_STATUSLINE_RESET: "clock" });
  assert.match(clock, /5h\W+20%[^\n]*13:00/, "an hour from noon, in the zone the runner pins to UTC");
  assert.match(clock, /7d\W+77%[^\n]*tmrw 12:00/);
});

await test("the account chip can name the seat tier, and the window chips link to the usage page", () => {
  const src = sources({ getAccountIdentity: () => ({ org: "Acme Robotics", email: null, seatTier: "enterprise_usage_based", orgType: null }) });
  assert.match(render(fullPayload({ now: NOW }), src, { CLAUDE_STATUSLINE_ACCOUNT: "tier" }), /Acme Robotics · usage based/);
  const out = raw(fullPayload({ now: NOW }), src);
  const i = out.indexOf("5h");
  const before = out.slice(Math.max(0, i - 160), i);
  assert.match(before, /\x1b\]8;;https:\/\/claude\.ai\/settings\/usage\x07/);
});
