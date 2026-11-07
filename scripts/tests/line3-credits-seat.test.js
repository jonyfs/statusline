import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { readUsageCredits, readAccountIdentity, monthResetAt } from "../../src/usageCredits.js";
import { trendOf } from "../../src/creditsHistory.js";
import { buildReport } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/071-line-3-credits-seat: what burns the credits, and whose they are.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const HOUR = 3600 * 1000;
const ACCOUNT = "092a2857-0000-4000-8000-000000000003";

const claudeJson = () => ({
  oauthAccount: { accountUuid: ACCOUNT, organizationName: "Acme Robotics", emailAddress: "dev@example.com", seatTier: "enterprise_usage_based", organizationType: "claude_enterprise" },
  cachedUsageUtilization: {
    fetchedAtMs: NOW - HOUR, accountUuid: ACCOUNT,
    utilization: { five_hour: null, seven_day: null, extra_usage: { is_enabled: true, monthly_limit: 21000, used_credits: 2079, utilization: 9.9, decimal_places: 2, user_disabled: false, spend_limit_reached: false } },
  },
});

const CREDITS = {
  pct: 10, pctExact: 9.9, shareOfCap: (usd) => (usd / 210) * 100, daily: null, weekly: null, enabled: true, reached: false, hasWindows: false,
  fetchedAt: NOW - HOUR, disabledReason: null, severity: null, creditsEverEnabled: true, windows: { fiveHour: null, sevenDay: null },
};
const answered = (over = {}) => {
  const { rate_limits, ...rest } = fullPayload({ now: NOW });
  return { ...rest, session_id: "s-1", cost: { total_cost_usd: 0.84, total_api_duration_ms: 4200 }, ...over };
};
const sources = (over = {}) => ({
  ...emptySources,
  getUsageCredits: () => CREDITS,
  getAccountKind: () => "credits",
  noteAccountKind: () => {},
  getAccountIdentity: () => ({ org: "Acme Robotics", email: "dev@example.com", seatTier: "enterprise_usage_based", orgType: "claude_enterprise" }),
  creditsTrend: () => ({ ratePerHour: null, sessionDelta: null }),
  ...over,
});
const raw = (payload, src, env = {}, width = 300) => {
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try {
    return renderPayload(payload, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 });
  } finally {
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
};
const render = (...a) => stripAnsi(raw(...a));

// Readers ---------------------------------------------------------------------

await test("the reader keeps the exact figure and the cap, and the identity reader names the account", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(claudeJson()));
    const r = readUsageCredits({ now: NOW });
    assert.equal(r.pctExact, 9.9);
    assert.equal(r.shareOfCap(0.84), 0.4);
    assert.equal(r.shareOfCap(-1), null);
    assert.equal(JSON.stringify(r).includes("210"), false, "the cap never leaves the reader");
    assert.deepEqual(readAccountIdentity(), { org: "Acme Robotics", email: "dev@example.com", seatTier: "enterprise_usage_based", orgType: "claude_enterprise" });
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify({}));
    assert.equal(readAccountIdentity(), null);
  });
});

await test("the trend is measured from distinct fetches, ends on a drop, and remembers the session's start", () => {
  const empty = { ring: [], sessions: {} };
  const t1 = trendOf(empty, { pct: 10.0, fetchedAt: NOW - 2 * HOUR, sessionId: "s-1", now: NOW - 2 * HOUR });
  assert.equal(t1.ratePerHour, null, "one point is no rate");
  assert.equal(t1.sessionDelta, 0);
  const t2 = trendOf(t1.state, { pct: 10.8, fetchedAt: NOW, sessionId: "s-1", now: NOW });
  assert.equal(t2.ratePerHour, 0.4);
  assert.equal(Number(t2.sessionDelta.toFixed(1)), 0.8);
  const same = trendOf(t2.state, { pct: 10.8, fetchedAt: NOW, sessionId: "s-1", now: NOW + 60_000 });
  assert.equal(same.state.ring.length, 2, "the same fetch is not a new point");
  const short = trendOf(empty, { pct: 10.0, fetchedAt: NOW - 10 * 60_000, sessionId: "s-1", now: NOW - 10 * 60_000 });
  assert.equal(trendOf(short.state, { pct: 10.1, fetchedAt: NOW, sessionId: "s-1", now: NOW }).ratePerHour, null, "thirty minutes at least");
  const rolled = trendOf(t2.state, { pct: 0.3, fetchedAt: NOW + HOUR, sessionId: "s-2", now: NOW + HOUR });
  assert.equal(rolled.ratePerHour, null);
  assert.equal(rolled.state.ring.length, 1, "a drop ends the history");
  assert.equal(rolled.sessionDelta, 0);
});

// FR-001 ----------------------------------------------------------------------

await test("a context past 200k tokens says so in the critical band, and keeps saying so when narrow", () => {
  const over = render(answered({ exceeds_200k_tokens: true }), sources());
  assert.match(over, /\d+%\s*·\s*200k\+/);
  assert.doesNotMatch(render(answered({ exceeds_200k_tokens: false }), sources()), /200k/);
  const narrow = render(answered({ exceeds_200k_tokens: true }), sources(), {}, 60);
  assert.match(narrow, /200k\+/);
});

// FR-002, FR-003, FR-005 ------------------------------------------------------

await test("the credits chip carries the measured rate and the session's share of the month", () => {
  const src = sources({ creditsTrend: () => ({ ratePerHour: 0.42, sessionDelta: 1.24 }) });
  const out = render(answered(), src);
  assert.match(out, /\u{F0584}\W+10%\s*·\s*\+0\.4%\/h\s*·\s*\+1\.2% session/u);
  assert.doesNotMatch(out, /session 0\.4%/, "the estimated share is off by default");
  const shared = render(answered(), src, { CLAUDE_STATUSLINE_SESSION_SHARE: "1" });
  assert.match(shared, /session 0\.4%/);
  assert.doesNotMatch(shared, /\$|210|0\.84/);
  const flat = render(answered(), sources({ creditsTrend: () => ({ ratePerHour: 0.01, sessionDelta: 0.02 }) }));
  assert.doesNotMatch(flat, /%\/h|session/, "a change that rounds to nothing is not drawn");
});

// FR-004 ----------------------------------------------------------------------

await test("a credits seat sees its prompt cache hit ratio, a subscriber does not", () => {
  const withCache = answered({ prompt_cache: { warm: true, caching_observed: true, hit_ratio: 0.82, ttl: "5m", expires_at: NOW / 1000 + 290 } });
  assert.match(render(withCache, sources()), /[\u{F078C}\u{F0717}\u{F06AD}\u{F051F}]\W+82%/u);
  const subscriber = sources({ getAccountKind: () => "subscriber", getUsageCredits: () => null });
  assert.doesNotMatch(render({ ...withCache, rate_limits: fullPayload({ now: NOW }).rate_limits }, subscriber), /[\u{F078C}\u{F0717}\u{F06AD}\u{F051F}]\W+82%/u);
  assert.doesNotMatch(render(answered(), sources()), /[\u{F078C}\u{F0717}\u{F06AD}]\W+\d+%/u, "no ratio, no chip");
});

// FR-006 ----------------------------------------------------------------------

await test("the model tier mark is opt-in and comes from the name", () => {
  const opus = answered({ model: { display_name: "Opus 5.5" } });
  assert.doesNotMatch(render(opus, sources()), /Opus 5\.5 \+/);
  assert.match(render(opus, sources(), { CLAUDE_STATUSLINE_MODEL_TIER: "1" }), /Opus 5\.5 \+\+\+/);
  assert.match(render(answered({ model: { display_name: "Sonnet 5.5" } }), sources(), { CLAUDE_STATUSLINE_MODEL_TIER: "1" }), /Sonnet 5\.5 \+\+ /);
  assert.match(render(answered({ model: { display_name: "Haiku 5.5" } }), sources(), { CLAUDE_STATUSLINE_MODEL_TIER: "1" }), /Haiku 5\.5 \+ /);
  assert.match(render(answered({ model: { display_name: "Fable 5.1" } }), sources(), { CLAUDE_STATUSLINE_MODEL_TIER: "1" }), /Fable 5\.1 \+\+\+/);
});

// FR-007 ----------------------------------------------------------------------

await test("the account chip names the organisation and the kind, the address on request, nothing when off", () => {
  const out = render(answered(), sources());
  // The credits chip beside it says `credits`, so the word goes (specs/072).
  assert.match(out, /business/);
  assert.doesNotMatch(out, /Acme Robotics/);
  assert.doesNotMatch(out, /business · credits/);
  assert.match(render(answered(), sources(), { CLAUDE_STATUSLINE_LABELS: "on" }), /business · credits/);
  const personal = sources({ getAccountIdentity: () => ({ org: "dev@example.com's Organization", email: "dev@example.com", seatTier: null, orgType: "claude_max" }) });
  assert.match(render(answered(), personal), /personal/);
  assert.doesNotMatch(out, /dev@example\.com/);
  assert.match(render(answered(), sources(), { CLAUDE_STATUSLINE_ACCOUNT: "email" }), /dev@example\.com/);
  assert.doesNotMatch(render(answered(), sources(), { CLAUDE_STATUSLINE_ACCOUNT: "off" }), /Acme|dev@/);
  assert.doesNotMatch(render(answered(), sources({ getAccountIdentity: () => null })), /Acme|credits ·/);
  const codex = { cwd: "/tmp/p", codex: { plan_type: "pro" }, rate_limits: {} };
  assert.match(render(codex, emptySources), /codex pro/);
  const copilot = { ...answered(), ai_used: { total_nano_aiu: 0 } };
  assert.doesNotMatch(render(copilot, sources()), /Acme/);
});

// FR-008 ----------------------------------------------------------------------

await test("the doctor has rows for the account and the cache hit ratio", () => {
  const withCache = answered({ prompt_cache: { warm: true, caching_observed: true, hit_ratio: 0.82, ttl: "5m", expires_at: NOW / 1000 + 290 } });
  const report = buildReport(withCache, { now: NOW, live: false, probe: sources() });
  const by = Object.fromEntries(report.segments.map((s) => [s.key, s]));
  assert.equal(by.account.rendered, true);
  assert.match(by.account.value, /Acme Robotics/);
  assert.equal(by.cacheHit.rendered, true);
  assert.match(by.cacheHit.value, /82%/);
});

// A name is text someone else wrote. Control sequences in it never reach
// the terminal, and a long one never takes the line.
await test("the account's name is sanitised and capped, and so is Codex's plan", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const body = claudeJson();
    body.oauthAccount.organizationName = "Evil\u001b]8;;http://x\u0007Org \u001b[31m" + "x".repeat(60);
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(body));
    const id = readAccountIdentity();
    assert.doesNotMatch(id.org, /[\u0000-\u001f\u007f]/);
    assert.ok(id.org.length <= 40, `capped: ${id.org.length}`);
  });
  const hostile = sources({ getAccountIdentity: () => ({ org: "Acme\u001b[2JRobotics", email: null, seatTier: null, orgType: null }) });
  assert.doesNotMatch(raw(answered(), hostile), /\x1b\[2J/);
  const codex = { cwd: "/tmp/p", codex: { plan_type: "pro\u001b[2J" }, rate_limits: {} };
  assert.doesNotMatch(raw(codex, emptySources), /\x1b\[2J/);
  assert.match(render(codex, emptySources), /codex pro/);
});

// FR-009: when the cap comes back ---------------------------------------------

await test("the reader takes a reset from the cache's limits, and the month estimate lands on the 1st at local midnight", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const body = claudeJson();
    body.cachedUsageUtilization.utilization.limits = [
      { kind: "weekly_model", group: "opus", percent: 3, resets_at: "2026-11-07T00:00:00Z", severity: "normal", is_active: true },
      { kind: "extra_usage_monthly", group: "org", percent: 10, resets_at: "2026-12-01T00:00:00Z", severity: "normal", is_active: true },
      { kind: "extra_usage_daily", group: "org", percent: 1, resets_at: "2026-11-06T00:00:00Z", severity: "normal", is_active: false },
    ];
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(body));
    assert.equal(readUsageCredits({ now: NOW }).resetsAt, Date.parse("2026-12-01T00:00:00Z") / 1000, "the active extra-usage limit's reset, not the model window's");
    body.cachedUsageUtilization.utilization.limits = [];
    writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(body));
    assert.equal(readUsageCredits({ now: NOW }).resetsAt, null);
  });
  // The runner pins TZ=UTC, so local midnight is 00:00Z here; on a machine
  // in another zone the same call lands on that zone's midnight.
  assert.equal(monthResetAt(NOW), Date.parse("2026-12-01T00:00:00Z") / 1000);
  assert.equal(monthResetAt(Date.parse("2026-12-31T23:59:00Z")), Date.parse("2027-01-01T00:00:00Z") / 1000);
});

await test("the credits chip says when the cap comes back: estimated with a tilde, from the cache without one, off on request", () => {
  const out = render(answered(), sources());
  assert.match(out, /\u{F0584}\W+10%[^\n]*~dec 1 00:00/u);
  const real = render(answered(), sources({ getUsageCredits: () => ({ ...CREDITS, resetsAt: Date.parse("2026-11-20T14:30:00Z") / 1000 }) }));
  assert.match(real, /\u{F0584}\W+10%[^\n]*[^~]nov 20 14:30/u);
  assert.doesNotMatch(real, /~/);
  const near = render(answered(), sources({ getUsageCredits: () => ({ ...CREDITS, resetsAt: NOW / 1000 + 3600 }) }));
  assert.match(near, /\u{F0584}\W+10%[^\n]*13:00/u);
  const off = render(answered(), sources(), { CLAUDE_STATUSLINE_CREDITS_RESET: "off" });
  assert.doesNotMatch(off, /~dec|dec 1/);
  const trend = render(answered(), sources({ creditsTrend: () => ({ ratePerHour: 0.42, sessionDelta: 1.24 }) }));
  assert.match(trend, /\+1\.2% session[^\n]*~dec 1 00:00/, "the reset reads last, after what moves the figure");
  // Width sheds the motion before the reset, and the reset before the figure.
  const narrow = render(answered(), sources({ creditsTrend: () => ({ ratePerHour: 0.42, sessionDelta: 1.24 }) }), {}, 72);
  assert.match(narrow, /\u{F0584}/u);
  assert.doesNotMatch(narrow, /session/);
});

// specs/072: the words come back on request, and the cache draws as one chip.
await test("CLAUDE_STATUSLINE_LABELS=on brings the words back, and the cache chips merge without it", () => {
  const withCache = answered({ prompt_cache: { warm: false, caching_observed: true, ttl: "5m", expires_at: null, recache_tokens_if_cold: 184000, hit_ratio: 0.82 } });
  const bare = render(withCache, sources({ creditsTrend: () => ({ ratePerHour: 0.42, sessionDelta: 0 }) }));
  assert.match(bare, /\u{F0717}\W+82%/u, "the cold snowflake carries the ratio");
  assert.doesNotMatch(bare, /cache cold|credits\W+10%|rtk/u);
  const worded = render(withCache, sources(), { CLAUDE_STATUSLINE_LABELS: "on" });
  assert.match(worded, /credits\W+10%/u);
  assert.match(worded, /cache cold/);
  assert.match(worded, /cache\W+82%/u);
});
