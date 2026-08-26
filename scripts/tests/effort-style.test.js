import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { emptySources } from "./fixtures/sources.js";

const line3 = (payload) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false }))
    .split("\n")
    .find((l) => l.includes("🤖"));

await test("effort renders behind the lightning icon when the payload carries a level", () => {
  assert.match(line3({ model: { display_name: "M" }, effort: { level: "high" } }), /⚡ high/);
});

await test("an output style is never shown behind the effort icon", () => {
  // The old fallback put `output_style.name` in the effort slot whenever
  // `effort.level` was missing, so "explanatory" was rendered as though it
  // were an effort level (FR-021).
  const rendered = line3({ model: { display_name: "M" }, output_style: { name: "explanatory" } });
  assert.doesNotMatch(rendered, /⚡ explanatory/);
  assert.doesNotMatch(rendered, /⚡/, "with no effort level there is no effort segment");
});

await test("an output style gets its own segment and its own icon", () => {
  assert.match(line3({ model: { display_name: "M" }, output_style: { name: "explanatory" } }), /🎨 explanatory/);
});

await test("both render side by side when both are set", () => {
  const rendered = line3({
    model: { display_name: "M" },
    effort: { level: "xhigh" },
    output_style: { name: "learning" },
  });
  assert.match(rendered, /⚡ xhigh/);
  assert.match(rendered, /🎨 learning/);
  assert.ok(rendered.indexOf("xhigh") < rendered.indexOf("learning"), "effort comes first");
});

await test("the default output style is not worth a segment", () => {
  assert.doesNotMatch(line3({ model: { display_name: "M" }, output_style: { name: "default" } }), /🎨/);
});

await test("line 3 is never empty: the model always has a name", () => {
  assert.match(line3({}), /🤖 Claude/);
});
