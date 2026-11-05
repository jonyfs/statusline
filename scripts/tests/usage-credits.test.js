import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { readUsageCredits } from "../../src/usageCredits.js";
import { getAccountKind, noteAccountKind } from "../../src/accountKind.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/069-usage-credits. A Claude Enterprise seat billed by usage has no
// window; its allowance is the monthly credit cap Claude Code keeps in
// `~/.claude.json` under `cachedUsageUtilization`.

const NOW = Date.parse("2026-11-05T12:00:00.000Z");
const HOUR = 3600 * 1000;
const ACCOUNT = "092a2857-0000-4000-8000-000000000001";

const utilization = (over = {}) => ({
  five_hour: null,
  seven_day: null,
  extra_usage: {
    is_enabled: true,
    monthly_limit: 210000,
    used_credits: 20798,
    utilization: 9.903809523809525,
    currency: "USD",
    decimal_places: 2,
    disabled_reason: null,
    user_disabled: false,
    spend_limit_reached: false,
    ...over,
  },
});

const claudeJson = ({ fetchedAtMs = NOW - HOUR, accountUuid = ACCOUNT, signedIn = ACCOUNT, util = utilization() } = {}) => ({
  oauthAccount: { accountUuid: signedIn, organizationType: "claude_enterprise" },
  cachedUsageUtilization: { fetchedAtMs, accountUuid, utilization: util },
});

const writeClaudeJson = (home, body) => writeFileSync(path.join(home.dir, ".claude.json"), JSON.stringify(body));

// A payload from a seat with no windows: a response has happened, there is
// no `rate_limits` at all.
const answered = (over = {}) => {
  const { rate_limits, ...rest } = fullPayload({ now: NOW });
  return { ...rest, cost: { total_cost_usd: 1.2, total_api_duration_ms: 4200 }, ...over };
};

const sources = (credits, kind = null) => ({
  ...emptySources,
  getUsageCredits: () => credits,
  getAccountKind: () => kind,
  noteAccountKind: () => {},
});
const render = (payload, src, width = 200) =>
  stripAnsi(renderPayload(payload, { sources: src, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 }));

const CREDITS = {
  pct: 10, pctExact: 9.903809523809525, daily: null, weekly: null, enabled: true, reached: false, hasWindows: false, fetchedAt: NOW - HOUR,
  // specs/070 widened the reader: the disabled reason, the cache's own word
  // for the spend, whether credits were ever on, and the cached windows.
  disabledReason: null, severity: null, creditsEverEnabled: false, windows: { fiveHour: null, sevenDay: null },
  // specs/071 FR-009: the cap's reset when the cache's limits carry one.
  resetsAt: null,
};

await test("the reader takes the percentage Claude Code cached, and never the money", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeClaudeJson(home, claudeJson());
    const { shareOfCap, ...rest } = readUsageCredits({ now: NOW });
    assert.deepEqual(rest, CREDITS);
    assert.equal(typeof shareOfCap, "function", "the cap is asked, never read (specs/071)");
    assert.equal(JSON.stringify(readUsageCredits({ now: NOW })).includes("2100"), false);
  });
});

await test("the day and the week are read when the cache carries them", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeClaudeJson(home, claudeJson({ util: utilization({ daily: { utilization: 3.4 }, weekly: { utilization: 8.6 } }) }));
    const r = readUsageCredits({ now: NOW });
    assert.equal(r.daily, 3);
    assert.equal(r.weekly, 9);
    writeClaudeJson(home, claudeJson({ util: utilization({ daily: { limit: 5 } }) }));
    assert.equal(readUsageCredits({ now: NOW }).daily, null);
  });
});

await test("the reader answers null without the file, the block, or the signed-in account", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.equal(readUsageCredits({ now: NOW }), null);
    writeClaudeJson(home, { oauthAccount: { accountUuid: ACCOUNT } });
    assert.equal(readUsageCredits({ now: NOW }), null);
    writeClaudeJson(home, claudeJson({ signedIn: "someone-else" }));
    assert.equal(readUsageCredits({ now: NOW }), null);
    writeFileSync(path.join(home.dir, ".claude.json"), "{not json");
    assert.equal(readUsageCredits({ now: NOW }), null);
  });
});

await test("a figure older than a day is as if absent", async () => {
  const home = makeHome();
  await withHome(home, () => {
    writeClaudeJson(home, claudeJson({ fetchedAtMs: NOW - 25 * HOUR }));
    assert.equal(readUsageCredits({ now: NOW }), null);
    writeClaudeJson(home, claudeJson({ fetchedAtMs: NOW - 23 * HOUR }));
    assert.equal(readUsageCredits({ now: NOW })?.pct, 10);
  });
});

await test("a subscriber's cache says it has windows, and credits off is reported as off", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const util = utilization({ is_enabled: false });
    util.five_hour = { utilization: 20, resets_at: "2026-11-05T13:00:00Z" };
    writeClaudeJson(home, claudeJson({ util }));
    const r = readUsageCredits({ now: NOW });
    assert.equal(r.hasWindows, true);
    assert.equal(r.enabled, false);
  });
});

await test("a seat with no window and credits enabled draws the credits chip and no 5h or 7d", () => {
  const out = render(answered(), sources(CREDITS));
  assert.match(out, /\u{F0584}\W+10%/u);
  assert.doesNotMatch(out, /\$|208|2100/);
  assert.doesNotMatch(out, /\b5h\b/);
  assert.doesNotMatch(out, /\b7d\b/);
});

await test("the day and the week follow the month when the cache has them, and go first for width", () => {
  const src = sources({ ...CREDITS, daily: 3, weekly: 9 });
  assert.match(render(answered(), src), /\u{F0584}\W+10% \u00b7 day 3% \u00b7 week 9%/u);
  // At 80 columns the whole chip still fits; narrower, the day and the week
  // go before the chip does.
  const narrow = render(answered(), src, 56);
  assert.match(narrow, /\u{F0584}/u);
  assert.doesNotMatch(narrow, /week/);
});

await test("the cap reached says full", () => {
  const out = render(answered(), sources({ ...CREDITS, pct: 100, reached: true }));
  assert.match(out, /\u{F0584}\W+100%\W*full/u);
});

await test("the credits reading outranks a remembered subscriber whose window never comes", () => {
  const out = render(answered(), sources(CREDITS, "subscriber"));
  assert.match(out, /\u{F0584}\W+10%/u);
  assert.doesNotMatch(out, /\b5h\b/);
});

await test("a subscriber with extra usage on keeps its windows and gains the credits chip", () => {
  const out = render(fullPayload({ now: NOW }), sources({ ...CREDITS, hasWindows: true }));
  assert.match(out, /5h\W+20%/);
  assert.match(out, /7d\W+77%/);
  assert.match(out, /\u{F0584}\W+10%/u);
});

await test("a subscriber with extra usage off draws exactly as before", () => {
  const out = render(fullPayload({ now: NOW }), sources({ ...CREDITS, hasWindows: true, enabled: false }));
  assert.match(out, /5h\W+20%/);
  assert.doesNotMatch(out, /\u{F0584}\W+\d+%/u);
  assert.equal(out, render(fullPayload({ now: NOW }), sources(null)));
});

await test("a gateway spend limit draws as before, and a credits figure beside it when there is one", () => {
  const payload = answered({ rate_limits: { spend_limit: { used_percentage: 40, resets_at: Math.floor(NOW / 1000) + 86400 } } });
  const out = render(payload, sources(CREDITS));
  assert.match(out, /spend\W+40%/);
  assert.match(out, /\u{F0584}\W+10%/u);
  assert.doesNotMatch(out, /\b5h\b/);
  // The wallet is the spend chip's too; no credits figure means no `10%` beside one.
  assert.doesNotMatch(render(payload, sources(null)), /\u{F0584}\W+10%/u);
});

await test("a cache that shows windows does not make a credits account: the remembered subscriber keeps 5h", () => {
  const out = render(answered(), sources({ ...CREDITS, hasWindows: true }, "subscriber"));
  assert.match(out, /5h/);
  assert.match(out, /\u{F0584}\W+10%/u);
});

await test("credits disabled on a seat with no window is not a credits account", () => {
  const out = render(answered(), sources({ ...CREDITS, enabled: false }));
  assert.doesNotMatch(out, /\u{F0584}\W+\d+%/u);
  assert.doesNotMatch(out, /\b5h\b/);
});

await test("a remembered credits kind with a stale reading draws credits — and no windows", () => {
  const out = render(answered(), sources(null, "credits"));
  assert.match(out, /\u{F0584}\W*—/u);
  assert.doesNotMatch(out, /\b5h\b/);
  assert.doesNotMatch(out, /\b7d\b/);
});

await test("with nothing remembered and no reading, none still applies as in specs/068", () => {
  const out = render(answered(), sources(null));
  assert.doesNotMatch(out, /\u{F0584}\W+\d+%/u);
  assert.doesNotMatch(out, /\b5h\b/);
});

await test("the credits kind is remembered, and a later window replaces it", async () => {
  const home = makeHome();
  await withHome(home, () => {
    const live = { ...emptySources, getAccountKind, noteAccountKind, getUsageCredits: () => CREDITS };
    renderPayload(answered(), { sources: live, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });
    assert.equal(getAccountKind({ now: NOW }), "credits");
    renderPayload(fullPayload({ now: NOW }), { sources: live, trackChanges: false, now: NOW + 1000, maxWidth: 200, maxHeight: 40 });
    assert.equal(getAccountKind({ now: NOW + 2000 }), "subscriber");
  });
});

await test("the chip survives a narrow line ahead of the effort level, as the only allowance there is", () => {
  const out = render(answered(), sources(CREDITS), 80);
  assert.match(out, /\u{F0584}\W+\d+%/u);
});

await test("other harnesses are untouched", () => {
  const copilot = { ...answered(), ai_used: 3, session_id: "x", context_window: { current_context_used_percentage: 20, displayed_context_limit: 200000 }, github: {} };
  assert.doesNotMatch(render(copilot, sources(CREDITS)), /\u{F0584}\W+10%/u);
  const codex = { ...answered(), codex: { session: "x" } };
  assert.doesNotMatch(render(codex, sources(CREDITS)), /\u{F0584}\W+10%/u);
});
