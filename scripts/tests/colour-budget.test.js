import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { SEGMENTS } from "../../src/segments.js";
import { ROLE, SEGMENT_COLOURS } from "../../src/colourRoles.js";
import { PALETTES, renderRow } from "../../src/theme.js";
import { contrastRatio } from "../../src/contrast.js";
import { gather, renderReadings } from "../../src/render.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const opts = { ...RENDER_OPTIONS, maxWidth: 360, maxHeight: 40 };
const pool = (payload = PAYLOAD) =>
  renderReadings(gather(payload, { ...SOURCES }, { now: FIXED_NOW * 1000 }), payload, { ...opts, asPool: true });
const withPercent = (pct) => ({
  ...PAYLOAD,
  context_window: { used_percentage: pct },
  rate_limits: {
    ...PAYLOAD.rate_limits,
    five_hour: { used_percentage: pct, resets_at: FIXED_NOW + 7740 },
    seven_day: { used_percentage: pct, resets_at: FIXED_NOW + 3 * 86400 },
  },
});

await test("no token is claimed by two roles", () => {
  const tokens = Object.values(ROLE);
  assert.equal(new Set(tokens).size, tokens.length, `tokens: ${tokens.join(" ")}`);
});

await test("every palette defines every token the budget uses", () => {
  for (const [name, palette] of Object.entries(PALETTES)) {
    for (const token of Object.values(ROLE)) assert.ok(palette[token], `${name} lacks ${token}`);
  }
});

await test("every segment key has a role, and only roles that exist", () => {
  for (const { key } of SEGMENTS) {
    const entry = SEGMENT_COLOURS[key];
    assert.ok(entry, `${key} has no colour role`);
    for (const role of [...entry.fill, ...(entry.icon ?? [])]) assert.ok(ROLE[role], `${key} uses unknown role ${role}`);
  }
  for (const key of Object.keys(SEGMENT_COLOURS)) {
    assert.ok(SEGMENTS.some((s) => s.key === key), `${key} is not a segment`);
  }
});

await test("every fill the pool carries is one its segment may take", () => {
  for (const entry of pool()) {
    const allowed = SEGMENT_COLOURS[entry.key].fill.map((r) => ROLE[r]);
    assert.ok(allowed.includes(entry.color), `${entry.key} is ${entry.color}, allowed ${allowed.join(" ")}`);
  }
});

await test("the skill chip is flamingo and the model is lavender", () => {
  const byKey = Object.fromEntries(pool().map((e) => [e.key, e]));
  assert.equal(byKey.skills.color, "flamingo");
  assert.equal(byKey.model.color, "lavender");
  assert.equal(byKey.allowAll.color, "peach");
  assert.equal(byKey.promptCache.color, "sapphire");
  assert.equal(byKey.rtk.color, "teal");
  assert.equal(byKey.conflicts.color, "red");
});

await test("red is for the critical band and conflicts only", () => {
  // The fixture's 7-day window is 77% used with about half of it gone, which
  // is 24 points ahead of pace: critical by feature 046's rule.
  const reds = pool().filter((e) => e.color === "red").map((e) => e.key);
  assert.deepEqual(reds, ["conflicts", "sevenDay"]);
});

await test("a healthy gauge is neutral with a green icon, a warn gauge peach", () => {
  const ok = pool(withPercent(30)).find((e) => e.key === "context");
  assert.equal(ok.color, "surface0");
  assert.equal(ok.icon, "green");
  const warn = pool(withPercent(70)).find((e) => e.key === "context");
  assert.equal(warn.color, "peach");
});

await test("with several critical gauges only the highest has the red background", () => {
  const payload = {
    ...PAYLOAD,
    context_window: { used_percentage: 90 },
    rate_limits: {
      ...PAYLOAD.rate_limits,
      five_hour: { used_percentage: 97, resets_at: FIXED_NOW + 7740 },
      seven_day: { used_percentage: 88, resets_at: FIXED_NOW + 3 * 86400 },
    },
  };
  const gauges = pool(payload).filter((e) => ["context", "fiveHour", "sevenDay"].includes(e.key));
  const red = gauges.filter((e) => e.color === "red").map((e) => e.key);
  assert.deepEqual(red, ["fiveHour"]);
  for (const e of gauges.filter((g) => g.key !== "fiveHour")) {
    assert.equal(e.color, "surface0", e.key);
    assert.equal(e.tone, "red", e.key);
  }
});

await test("a tie for the highest critical percentage goes to the first in line order", () => {
  const gauges = pool(withPercent(95)).filter((e) => ["context", "fiveHour", "sevenDay"].includes(e.key));
  const red = gauges.filter((e) => e.color === "red").map((e) => e.key);
  assert.equal(red.length, 1);
  assert.equal(red[0], "context", "context is the first gauge on the line");
});

await test("an icon on a neutral chip still reaches 4.5:1 in every palette", () => {
  for (const [name, palette] of Object.entries(PALETTES)) {
    // The terminal's own colours are unknown, so there is no ratio to check.
    if (name === "terminal") continue;
    const out = renderRow(palette, [{ color: "surface0", icon: "green", text: " X text " }]);
    const [, r, g, b] = /\x1b\[38;2;(\d+);(\d+);(\d+)mX/.exec(out) ?? [];
    assert.ok(r !== undefined, `${name} drew an icon colour`);
    const icon = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
    assert.ok(contrastRatio(icon, palette.surface0) >= 4.5, `${name} ${icon} on ${palette.surface0}`);
  }
});

await test("a changed segment is bold and underlined and keeps its colour", () => {
  const plain = renderRow(PALETTES.mocha, [{ color: "lavender", text: " main " }]);
  const marked = renderRow(PALETTES.mocha, [{ color: "lavender", text: " main ", emphasis: true }]);
  assert.ok(!plain.includes("\x1b[1m"));
  assert.ok(marked.includes("\x1b[1m") && marked.includes("\x1b[4m"));
  assert.ok(marked.includes("\x1b[22m") && marked.includes("\x1b[24m"));
  assert.equal(marked.replace(/\x1b\[(1|4|22|24)m/g, ""), plain);
});

import { explainSegments } from "../../src/doctor.js";
import { LEGEND } from "../../src/colourRoles.js";

await test("doctor --explain ends with the colour legend, a swatch per role", () => {
  const out = explainSegments();
  const legend = out.slice(out.indexOf("colours"));
  for (const [role, meaning] of LEGEND) {
    assert.ok(legend.includes(ROLE[role]), `${role} token named`);
    assert.ok(legend.includes(meaning), `${role} meaning given`);
  }
  assert.ok(/\x1b\[48;2;\d+;\d+;\d+m/.test(legend), "swatches are drawn in colour");
});

await test("under NO_COLOR the legend has names and meanings and no swatches", () => {
  const before = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    const out = explainSegments();
    assert.ok(out.includes("surface0"));
    assert.ok(!/\x1b\[/.test(out));
  } finally {
    if (before === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = before;
  }
});
