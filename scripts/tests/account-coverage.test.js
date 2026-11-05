import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload, USAGE_PAGES } from "../../src/render.js";
import { readUsageCredits } from "../../src/usageCredits.js";
import { buildReport, formatReport } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/070-account-coverage: the windows Claude Code cached, the amounts
// switch, the age of a cached figure, `credits off`, the spend severity and
// the doctor's account line.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const NOW_S = Math.floor(NOW / 1000);
const HOUR = 3600 * 1000;
const ACCOUNT = "092a2857-0000-4000-8000-000000000002";

const extra = (over = {}) => ({
  is_enabled: true,
  monthly_limit: 210000,
  used_credits: 20798,
  utilization: 9.9,
  currency: "USD",
  decimal_places: 2,
  disabled_reason: null,
  user_disabled: false,
  spend_limit_reached: false,
  credits_ever_enabled: true,
  ...over,
});

const claudeJson = (util, fetchedAtMs = NOW - HOUR) => ({
  oauthAccount: { accountUuid: ACCOUNT },
  cachedUsageUtilization: { fetchedAtMs, accountUuid: ACCOUNT, utilization: util },
});
const writeClaudeJson = (home, body) => writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(body));

const WINDOWS = { fiveHour: { pct: 20, resetsAt: NOW_S + 3600 }, sevenDay: { pct: 77, resetsAt: NOW_S + 86400 } };
const CREDITS = {
  pct: 10, daily: null, weekly: null, enabled: true, reached: false, hasWindows: false,
  fetchedAt: NOW - HOUR, disabledReason: null, severity: null, creditsEverEnabled: true,
  windows: { fiveHour: null, sevenDay: null },
};
const SUBSCRIBER_CACHE = { ...CREDITS, pct: null, enabled: false, hasWindows: true, creditsEverEnabled: false, windows: WINDOWS };

// A subscriber's payload before the first response: no `rate_limits`, no
// API time yet.
const quiet = (over = {}) => {
  const { rate_limits, ...rest } = fullPayload({ now: NOW });
  return { ...rest, cost: { total_cost_usd: 0, total_api_duration_ms: 0 }, ...over };
};
const answered = (over = {}) => quiet({ cost: { total_cost_usd: 1.2, total_api_duration_ms: 4200 }, ...over });

const sources = (credits, kind = null, noted = []) => ({
  ...emptySources,
  getUsageCredits: () => credits,
  getAccountKind: () => kind,
  noteAccountKind: (k) => { noted.push(k); },
});
const raw = (payload, src, width = 200, env = {}) => {
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try {
    return renderPayload(payload, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 });
  } finally {
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
};
const render = (...a) => stripAnsi(raw(...a));
// The colour codes around the credits chip: the icon, the track and the
// figure, without the text, so two chips compare by colour alone.
const chipCodes = (s) => {
  const i = s.indexOf("credits");
  return (s.slice(Math.max(0, i - 60), i + 14).match(/\x1b\[[0-9;]*m/g) ?? []).join("");
};

// FR-001 ----------------------------------------------------------------------

await test("the reader returns the cached windows, the disabled reason and the severity", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeClaudeJson(home, claudeJson({
      five_hour: { utilization: 20.4, resets_at: NOW_S + 3600 },
      seven_day: { utilization: 76.6, resets_at: "2026-11-06T12:00:00Z" },
      extra_usage: extra({ is_enabled: false, disabled_reason: "org_disabled" }),
      spend: { severity: "warning", percent: 10 },
    }));
    const r = readUsageCredits({ now: NOW });
    assert.deepEqual(r.windows, { fiveHour: { pct: 20, resetsAt: NOW_S + 3600 }, sevenDay: { pct: 77, resetsAt: null } });
    assert.equal(r.hasWindows, true);
    assert.equal(r.enabled, false);
    assert.equal(r.disabledReason, "org_disabled");
    assert.equal(r.severity, "warning");
    assert.equal(r.creditsEverEnabled, true);
  });
});

await test("a cache with windows and no extra_usage block still returns the windows", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeClaudeJson(home, claudeJson({ five_hour: { utilization: 5, resets_at: NOW_S + 60 }, seven_day: null }));
    const r = readUsageCredits({ now: NOW });
    assert.equal(r.pct, null);
    assert.equal(r.enabled, false);
    assert.deepEqual(r.windows, { fiveHour: { pct: 5, resetsAt: NOW_S + 60 }, sevenDay: null });
    writeClaudeJson(home, claudeJson({ five_hour: null, seven_day: null }));
    assert.equal(readUsageCredits({ now: NOW }), null, "a cache with nothing to draw is absent");
  });
});

// FR-002 ----------------------------------------------------------------------

await test("before the first response a subscriber's 5h and 7d come from the cache", () => {
  const noted = [];
  const out = render(quiet(), sources(SUBSCRIBER_CACHE, null, noted));
  assert.match(out, /5h\W+20%/);
  assert.match(out, /7d\W+77%/);
  assert.doesNotMatch(out, /credits/);
  assert.ok(noted.includes("subscriber"), `noted ${JSON.stringify(noted)}`);
});

await test("the payload's own window wins over the cache, and the cache never feeds Codex or Copilot", () => {
  const live = { ...quiet(), rate_limits: { five_hour: { used_percentage: 33, resets_at: NOW_S + 1800 } } };
  const out = render(live, sources(SUBSCRIBER_CACHE));
  assert.match(out, /5h\W+33%/);
  assert.doesNotMatch(out, /20%/);
  const copilot = render({ ...quiet(), ai_used: { total_nano_aiu: 0 } }, sources(SUBSCRIBER_CACHE));
  assert.doesNotMatch(copilot, /\b5h\b|\b7d\b/);
});

// FR-003 ----------------------------------------------------------------------

await test("amounts hide takes the money off the spend chip and drops the pace chip", () => {
  const budget = {
    ...answered(),
    rate_limits: { spend_limit: { used_percentage: 63, resets_at: NOW_S + 4 * 86400, used_usd: 314, limit_usd: 500, period: "weekly" } },
  };
  const shown = render(budget, emptySources, 300);
  assert.match(shown, /\$314\/\$500/);
  assert.match(shown, /left/);
  const hidden = render(budget, emptySources, 300, { CLAUDE_STATUSLINE_AMOUNTS: "hide" });
  assert.doesNotMatch(hidden, /\$/);
  assert.match(hidden, /spend\W+63%/);
  assert.doesNotMatch(hidden, /left|avg/);
});

await test("amounts hide drops the Codex balance and keeps Copilot's credits as a percentage", () => {
  const codex = { cwd: "/tmp/p", codex: {}, rate_limits: { credits: { balance: "12.5" } } };
  assert.match(render(codex, emptySources), /credits 12\.5/);
  assert.doesNotMatch(render(codex, emptySources, 200, { CLAUDE_STATUSLINE_AMOUNTS: "hide" }), /credits/);
  const copilot = { ...quiet(), ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64" } };
  assert.match(render(copilot, emptySources), /0\.64 AIC/);
  assert.doesNotMatch(render(copilot, emptySources, 200, { CLAUDE_STATUSLINE_AMOUNTS: "hide" }), /AIC|0\.64/);
  const limited = { ...emptySources, getSessionActivity: () => ({ working: false, sessionLimit: 2 }) };
  const pct = render(copilot, limited, 200, { CLAUDE_STATUSLINE_AMOUNTS: "hide" });
  assert.match(pct, /AIC\W+32%/);
  assert.doesNotMatch(pct, /0\.64/);
});

// FR-004 ----------------------------------------------------------------------

await test("a cached figure says its age after twelve hours and loses its band after six", () => {
  const chip = (s) => s.match(/[^\n]*credits[^\n]*/)?.[0] ?? "";
  const fresh = raw(answered(), sources(CREDITS));
  assert.doesNotMatch(stripAnsi(chip(fresh)), /·\s*\d+h/);
  const sixPlus = raw(answered(), sources({ ...CREDITS, fetchedAt: NOW - 7 * HOUR }));
  assert.doesNotMatch(stripAnsi(chip(sixPlus)), /·\s*\d+h/);
  assert.notEqual(chipCodes(fresh), chipCodes(sixPlus), "the band goes after six hours");
  const old = render(answered(), sources({ ...CREDITS, fetchedAt: NOW - 13 * HOUR }));
  assert.match(old, /credits\W+10%[^\n]*·\s*13h/);
});

await test("windows from the cache carry the same age mark", () => {
  const out = render(quiet(), sources({ ...SUBSCRIBER_CACHE, fetchedAt: NOW - 14 * HOUR }));
  assert.match(out, /5h\W+20%[^\n]*·\s*14h/);
});

// FR-005 ----------------------------------------------------------------------

await test("a credits seat with extra usage off reads credits off, a subscriber with it off draws nothing", () => {
  const off = { ...CREDITS, enabled: false, disabledReason: "user_disabled" };
  assert.match(render(answered(), sources(off, "credits")), /credits off/);
  assert.match(render(answered(), sources(off, null)), /credits off/, "credits ever enabled and no window is a credits seat");
  assert.doesNotMatch(render(answered(), sources({ ...off, hasWindows: true, windows: WINDOWS }, "subscriber")), /credits/);
});

// FR-006 ----------------------------------------------------------------------

await test("a critical severity from the cache forces the critical band", () => {
  const calm = raw(answered(), sources(CREDITS));
  const forced = raw(answered(), sources({ ...CREDITS, severity: "critical" }));
  const hot = raw(answered(), sources({ ...CREDITS, pct: 97 }));
  assert.equal(chipCodes(forced), chipCodes(hot));
  assert.notEqual(chipCodes(forced), chipCodes(calm));
  const normal = raw(answered(), sources({ ...CREDITS, severity: "normal" }));
  assert.equal(chipCodes(normal), chipCodes(calm));
});

// FR-007 ----------------------------------------------------------------------

await test("the doctor names the account kind and its evidence", () => {
  const report = (payload, src) => buildReport(payload, { now: NOW, live: false, probe: src });
  const subscriber = report(fullPayload({ now: NOW }), sources(null));
  assert.deepEqual(subscriber.account, { kind: "subscriber", evidence: "5h/7d in the payload" });
  assert.match(formatReport(subscriber), /^account: subscriber · 5h\/7d in the payload$/m);
  const cached = report(quiet(), sources(SUBSCRIBER_CACHE));
  assert.equal(cached.account.evidence, "5h/7d from Claude Code's /usage cache, 1h old");
  const credits = report(answered(), sources(CREDITS));
  assert.deepEqual(credits.account, { kind: "credits", evidence: "Claude Code's /usage cache, 1h old, no 5h/7d window" });
  const budget = report({ ...answered(), rate_limits: { spend_limit: { used_percentage: 5, resets_at: NOW_S + 60, used_usd: 1, limit_usd: 20, period: "daily" } } }, sources(null));
  assert.deepEqual(budget.account, { kind: "budget", evidence: "spend_limit in the payload, period daily" });
  const none = report(answered(), sources(null));
  assert.deepEqual(none.account, { kind: "none", evidence: "a response and no rate_limits" });
  const remembered = report(quiet(), sources(null, "budget"));
  assert.deepEqual(remembered.account, { kind: "budget", evidence: "remembered from an earlier session" });
  const unknown = report(quiet(), sources(null));
  assert.deepEqual(unknown.account, { kind: "unknown", evidence: "no response yet" });
  const codex = report({ cwd: "/tmp/p", codex: { plan_type: "pro" }, rate_limits: {} }, sources(null));
  assert.deepEqual(codex.account, { kind: "codex", evidence: "plan pro" });
  const copilot = report({ ...quiet(), ai_used: { total_nano_aiu: 0 } }, sources(null));
  assert.deepEqual(copilot.account, { kind: "copilot", evidence: "quotas via gh" });
});

// FR-009 ----------------------------------------------------------------------

await test("the credit chips open the account's own usage page, and the spend chip stays unlinked", () => {
  const linkOn = (out, word) => {
    const i = out.indexOf(word);
    assert.ok(i >= 0, `${word} is on the bar`);
    const before = out.slice(Math.max(0, i - 120), i);
    const m = [...before.matchAll(/\x1b\]8;;([^\x07]*)\x07/g)].pop();
    return m ? m[1] : null;
  };
  assert.equal(linkOn(raw(answered(), sources(CREDITS)), "credits"), USAGE_PAGES.claude);
  assert.equal(linkOn(raw(answered(), sources({ ...CREDITS, enabled: false }, "credits")), "credits off"), USAGE_PAGES.claude);
  assert.equal(linkOn(raw(answered(), sources(null, "credits")), "credits"), USAGE_PAGES.claude, "credits — links too");
  const codex = { cwd: "/tmp/p", codex: {}, rate_limits: { credits: { balance: "12.5" } } };
  assert.equal(linkOn(raw(codex, emptySources), "credits 12.5"), USAGE_PAGES.codex);
  const copilot = { ...quiet(), ai_used: { total_nano_aiu: 641_049_000, formatted: "0.64" } };
  assert.equal(linkOn(raw(copilot, emptySources), "0.64 AIC"), USAGE_PAGES.copilot);
  const budget = { ...answered(), rate_limits: { spend_limit: { used_percentage: 63, resets_at: NOW_S + 86400 } } };
  assert.equal(linkOn(raw(budget, emptySources, 300), "spend"), null);
});
