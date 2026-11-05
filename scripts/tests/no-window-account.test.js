import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { apiResponded, getAccountKind, noteAccountKind } from "../../src/accountKind.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

// specs/068-no-window-account. A Console API key, Bedrock, Vertex, Foundry or a
// seat with no individual allowance gets no `rate_limits` from Claude Code, ever.

const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const DAY = 86400 * 1000;

// A payload from an account with no windows: a response has happened, there is
// no `rate_limits` at all.
const answered = (over = {}) => {
  const { rate_limits, ...rest } = fullPayload({ now: NOW });
  return { ...rest, cost: { total_cost_usd: 1.2, total_api_duration_ms: 4200 }, ...over };
};
const beforeResponse = () => answered({ cost: { total_cost_usd: 0, total_api_duration_ms: 0 } });

const withKind = (kind) => ({ ...emptySources, getAccountKind: () => kind, noteAccountKind: () => {} });
const render = (payload, sources, width = 200) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, maxWidth: width, maxHeight: 40 }));

await test("the response signal is time spent waiting for the API, above zero", () => {
  assert.equal(apiResponded({ cost: { total_api_duration_ms: 1 } }), true);
  assert.equal(apiResponded({ cost: { total_api_duration_ms: 0 } }), false);
  assert.equal(apiResponded({ cost: {} }), false);
  assert.equal(apiResponded({}), false);
  assert.equal(apiResponded(null), false);
});

await test("an account that answered with nothing remembered and no limit draws no 5h or 7d", () => {
  const out = render(answered(), withKind(null));
  assert.doesNotMatch(out, /\b5h\b/);
  assert.doesNotMatch(out, /\b7d\b/);
  assert.match(out, /26%/);
});

await test("at 80 columns the effort level survives, since the placeholders no longer take the room", () => {
  assert.match(render(answered(), withKind(null), 80), /high/);
});

await test("before any response the windows still read ? as they did", () => {
  const out = render(beforeResponse(), withKind(null));
  assert.match(out, /5h/);
  assert.match(out, /7d/);
});

await test("a remembered budget account keeps spend — and is not turned into none", () => {
  const out = render(answered(), withKind("budget"));
  assert.match(out, /spend\W*—/);
  assert.doesNotMatch(out, /\b5h\b/);
});

await test("a remembered subscriber keeps 5h and 7d as ?, since its window was only dropped", () => {
  const out = render(answered(), withKind("subscriber"));
  assert.match(out, /5h/);
  assert.match(out, /7d/);
});

await test("a remembered none hides the chips even before the first response", () => {
  const out = render(beforeResponse(), withKind("none"));
  assert.doesNotMatch(out, /\b5h\b/);
  assert.doesNotMatch(out, /\b7d\b/);
});

await test("a payload with windows wins over a remembered none", () => {
  const out = render(fullPayload({ now: NOW }), withKind("none"));
  assert.match(out, /5h\W+20%/);
  assert.match(out, /7d\W+77%/);
});

await test("none is written to the cache only when nothing else is known, and a later window replaces it", async () => {
  const home = makeHome();
  await withHome(home, () => {
    assert.equal(getAccountKind({ now: NOW }), null);
    renderPayload(answered(), { sources: { ...emptySources, getAccountKind, noteAccountKind }, trackChanges: false, now: NOW, maxWidth: 200, maxHeight: 40 });
    assert.equal(getAccountKind({ now: NOW }), "none");
    renderPayload(fullPayload({ now: NOW }), { sources: { ...emptySources, getAccountKind, noteAccountKind }, trackChanges: false, now: NOW + 1000, maxWidth: 200, maxHeight: 40 });
    assert.equal(getAccountKind({ now: NOW + 2000 }), "subscriber");
  });
});

await test("a remembered budget is not overwritten by a payload that answered with no limit", async () => {
  const home = makeHome();
  await withHome(home, () => {
    noteAccountKind("budget", { now: NOW });
    renderPayload(answered(), { sources: { ...emptySources, getAccountKind, noteAccountKind }, trackChanges: false, now: NOW + DAY / 2, maxWidth: 200, maxHeight: 40 });
    assert.equal(getAccountKind({ now: NOW + DAY / 2 }), "budget");
  });
});

await test("other harnesses are untouched by the new kind", () => {
  const copilot = { ...answered(), session_id: "x", context_window: { current_context_used_percentage: 20, displayed_context_limit: 200000 }, github: {} };
  assert.doesNotThrow(() => render(copilot, withKind(null)));
});
