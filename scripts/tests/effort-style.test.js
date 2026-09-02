import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { emptySources } from "./fixtures/sources.js";
import { G, re } from "./glyphs.js";

const line3 = (payload) =>
  stripAnsi(renderPayload(payload, { sources: emptySources, trackChanges: false }))
    .split("\n")
    .find((l) => l.includes(G.model));

await test("effort renders behind the lightning icon when the payload carries a level", () => {
  assert.match(line3({ model: { display_name: "M" }, effort: { level: "high" } }), re`${G.effort} high`);
});

await test("an output style is never shown behind the effort icon", () => {
  // The old fallback put `output_style.name` in the effort slot whenever
  // `effort.level` was missing, so "explanatory" was rendered as though it
  // were an effort level (FR-021).
  const rendered = line3({ model: { display_name: "M" }, output_style: { name: "explanatory" } });
  assert.doesNotMatch(rendered, re`${G.effort} explanatory`);
  assert.doesNotMatch(rendered, re`${G.effort}`, "with no effort level there is no effort segment");
});

await test("line 3 is the model and the effort, and nothing after them", () => {
  // Narrowed on 2026-08-26. The output style, the agent name and the session
  // name were all here; none changes often enough to hold a slot beside two
  // things that do.
  const rendered = line3({
    model: { display_name: "M" },
    effort: { level: "xhigh" },
    output_style: { name: "learning" },
    agent: { name: "reviewer" },
    session_name: "some-session",
  });
  assert.match(rendered, re`${G.model} M`);
  assert.match(rendered, re`${G.effort} xhigh`);
  assert.doesNotMatch(rendered, /learning|reviewer|some-session/);
});

await test("line 3 is never empty: the model always has a name", () => {
  assert.match(line3({}), re`${G.model} Claude`);
});
