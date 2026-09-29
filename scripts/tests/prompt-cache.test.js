import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { getPromptCache } from "../../src/tokens.js";
import { buildReport, explainSegments } from "../../src/doctor.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { G, PLAIN, re } from "./glyphs.js";

// specs/025-prompt-cache-chip. The payload's prompt_cache block, as Claude
// Code 2.1.283+ builds it, drawn only when there is something to decide.

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const SEC = Math.floor(NOW / 1000);
const WIDE = { maxWidth: 600, maxHeight: 40 };

const warm = (secondsLeft, ttl = "5m", over = {}) => ({
  warm: true,
  caching_observed: true,
  ttl,
  expires_at: SEC + secondsLeft,
  requests: 12,
  misses: 0,
  hit_ratio: 0.91,
  ...over,
});
const cold = (over = {}) => ({
  warm: false,
  caching_observed: true,
  ttl: "5m",
  expires_at: null,
  requests: 12,
  misses: 2,
  hit_ratio: 0.91,
  recache_tokens_if_cold: 184000,
  last_miss_cause: { causes: ["tools_changed"] },
  ...over,
});

const payloadWith = (promptCache) =>
  fullPayload({ now: NOW, ...(promptCache === undefined ? {} : { prompt_cache: promptCache }) });

const render = (payload, opts = {}) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false, now: NOW, ...WIDE, ...opts }));

const line3 = (text) => text.split("\n").find((l) => l.includes(" 5h ")) ?? "";

// Foundational: the reading ---------------------------------------------

await test("no usable block reads as null", () => {
  for (const block of [undefined, null, "warm", {}, { warm: "yes", caching_observed: true }]) {
    assert.equal(getPromptCache({ prompt_cache: block }, NOW), null, JSON.stringify(block));
  }
});

await test("warm with an expiry already passed reads cold", () => {
  assert.equal(getPromptCache({ prompt_cache: warm(-5) }, NOW).state, "cold");
});

await test("only 5m and 1h are TTLs", () => {
  assert.equal(getPromptCache({ prompt_cache: warm(60, "5m") }, NOW).ttl, "5m");
  assert.equal(getPromptCache({ prompt_cache: warm(60, "1h") }, NOW).ttl, "1h");
  assert.equal(getPromptCache({ prompt_cache: warm(60, "10m") }, NOW).ttl, null);
});

await test("the closing window is 120 s on 5m and 600 s on 1h, inclusive", () => {
  const closing = (s, ttl) => getPromptCache({ prompt_cache: warm(s, ttl) }, NOW).closing;
  assert.equal(closing(120, "5m"), true);
  assert.equal(closing(121, "5m"), false);
  assert.equal(closing(600, "1h"), true);
  assert.equal(closing(601, "1h"), false);
});

await test("an expiry more than an hour out, or in milliseconds, is not a countdown", () => {
  assert.equal(getPromptCache({ prompt_cache: warm(3700, "1h") }, NOW).secondsLeft, null);
  assert.equal(getPromptCache({ prompt_cache: warm(0, "5m", { expires_at: NOW + 60000 }) }, NOW).secondsLeft, null);
});

await test("unusable numbers are dropped one field at a time", () => {
  const r = getPromptCache(
    { prompt_cache: cold({ recache_tokens_if_cold: -1, hit_ratio: "0.9", misses: Number.NaN }) },
    NOW
  );
  assert.equal(r.state, "cold");
  assert.equal(r.recacheTokens, null);
  assert.equal(r.hitRatio, null);
  assert.equal(r.misses, null);
});

await test("causes read as fixed phrases, skip what says nothing, and pass unknown codes through", () => {
  const cause = (causes) => getPromptCache({ prompt_cache: cold({ last_miss_cause: { causes } }) }, NOW).cause;
  assert.equal(cause(["tools_changed"]), "tools changed");
  assert.equal(cause(["system_prompt_changed"]), "prompt changed");
  assert.equal(cause(["model_changed"]), "model changed");
  assert.equal(cause(["messages_rewritten"]), "history rewritten");
  assert.equal(cause(["likely_server_side"]), "server side");
  assert.equal(cause(["unknown"]), null);
  assert.equal(cause(["ttl_expired_5m"]), null);
  assert.equal(cause(["ttl_expired_1h"]), null);
  assert.equal(cause(["unknown", "model_changed"]), "model changed");
  assert.equal(cause(["some_new_cause"]), "some_new_cause");
  assert.equal(cause(["bad\x1b[31mcode"]), "bad [31mcode", "control characters never reach the terminal");
  assert.equal(getPromptCache({ prompt_cache: cold({ last_miss_cause: null }) }, NOW).cause, null);
});

// Story 1 ---------------------------------------------------------------

await test("a warm cache with time to spare draws nothing", () => {
  assert.doesNotMatch(render(payloadWith(warm(250))), /cache/);
  assert.doesNotMatch(render(payloadWith(warm(2820, "1h"))), /cache/);
});

await test("a warm cache inside its closing window counts whole minutes down", () => {
  assert.match(render(payloadWith(warm(110))), re`${G.cacheWarm} cache warm · 1m`);
  assert.match(render(payloadWith(warm(40))), /cache warm · <1m/);
  assert.match(render(payloadWith(warm(540, "1h"))), /cache warm · 9m/);
});

await test("a warm cache with no TTL or no expiry draws nothing", () => {
  assert.doesNotMatch(render(payloadWith(warm(60, "10m"))), /cache/);
  assert.doesNotMatch(render(payloadWith(warm(60, "5m", { expires_at: null }))), /cache/);
});

await test("a warm cache whose expiry passed draws as cold", () => {
  assert.match(render(payloadWith(warm(-5))), re`${G.cacheCold} cache cold`);
});

await test("no block, or caching not observed, leaves line 3 exactly as it was", () => {
  const before = line3(render(payloadWith(undefined)));
  assert.doesNotMatch(before, /cache/);
  assert.equal(line3(render(payloadWith(cold({ caching_observed: false })))), before);
  assert.equal(line3(render(payloadWith(warm(60, "5m", { caching_observed: false })))), before);
});

await test("plain mode draws both states with their substitutes", () => {
  assert.equal(PLAIN.cacheWarm, "↻");
  assert.equal(PLAIN.cacheCold, "❄");
  assert.match(render(payloadWith(warm(100)), { asciiArrows: true }), /↻ cache warm · 1m/);
  assert.match(render(payloadWith(cold()), { asciiArrows: true }), /❄ cache cold/);
});

// Story 2 ---------------------------------------------------------------

await test("a cold cache says how much the next request writes again", () => {
  assert.match(render(payloadWith(cold({ last_miss_cause: null }))), /cache cold · 184k(?! ·)/);
});

await test("a cold cache without a re-cache figure shows none", () => {
  assert.match(
    render(payloadWith(cold({ recache_tokens_if_cold: null, last_miss_cause: null }))),
    /cache cold (?!·)/
  );
});

// Story 3 ---------------------------------------------------------------

await test("a cold cache names the cause after the token count", () => {
  assert.match(render(payloadWith(cold())), /cache cold · 184k · tools changed/);
  assert.match(render(payloadWith(cold({ recache_tokens_if_cold: null, last_miss_cause: { causes: ["model_changed"] } }))), /cache cold · model changed/);
  assert.match(render(payloadWith(cold({ last_miss_cause: { causes: ["ttl_expired_5m"] } }))), /cache cold · 184k(?! ·)/);
});

await test("a warm chip never carries an old cause", () => {
  const out = render(payloadWith(warm(100, "5m", { misses: 1, last_miss_cause: { causes: ["tools_changed"] } })));
  assert.match(out, /cache warm · 1m/);
  assert.doesNotMatch(out, /tools changed/);
});

await test("a narrow line sheds the cause first, then the tokens, and keeps the chip", () => {
  const payload = fullPayload({ now: NOW, model: { display_name: "Opus 5" }, prompt_cache: cold() });
  const at = (w) => line3(render(payload, { maxWidth: w }));
  const widths = [];
  for (let w = 160; w >= 60; w -= 2) widths.push([w, at(w)]);
  const firstWithoutCause = widths.find(([, l]) => /cache cold/.test(l) && !/tools changed/.test(l));
  assert.ok(firstWithoutCause, "the cause is never shed while the chip stays");
  assert.match(firstWithoutCause[1], /cache cold · 184k/, "the tokens outlive the cause");
  const withTokensGone = widths.find(([, l]) => /cache cold/.test(l) && !/184k/.test(l));
  assert.ok(withTokensGone, "the tokens are shed before the chip");
  assert.ok(withTokensGone[0] < firstWithoutCause[0]);
});

// Story 4 ---------------------------------------------------------------

const row = (promptCache) =>
  buildReport(payloadWith(promptCache), { now: NOW, live: false, probe: emptySources }).segments.find(
    (s) => s.key === "promptCache"
  );

await test("doctor reports a cold cache in full", () => {
  const r = row(cold());
  assert.equal(r.rendered, true);
  assert.equal(r.value, "cold, 5m, 184k to re-cache, tools changed, 91% hits, 2 misses");
});

await test("doctor explains a warm cache outside its window", () => {
  const r = row(warm(250));
  assert.equal(r.rendered, false);
  assert.match(r.reason, /warm, 5m, 4m left: outside the 2m closing window/);
});

await test("doctor tells caching not reported from a block that is absent", () => {
  assert.match(row(cold({ caching_observed: false })).reason, /caching is not reported by this provider/);
  assert.match(row(undefined).reason, /not in the payload: Claude Code 2\.1\.283\+ sends it after the first response/);
});

await test("doctor --explain describes the cache chip", () => {
  assert.match(explainSegments(), /promptCache\s+\S/);
  assert.doesNotMatch(explainSegments(), /promptCache\s+\(undescribed\)/);
});
