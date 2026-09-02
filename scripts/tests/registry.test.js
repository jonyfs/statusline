import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { SEGMENTS, byLine, segment, PRIORITY_BANDS } from "../../src/segments.js";
import { G, re } from "./glyphs.js";

await test("every segment declares the fields the layout needs", () => {
  for (const s of SEGMENTS) {
    assert.equal(typeof s.key, "string", "a segment without a key cannot be reported on");
    assert.ok(s.line >= 1 && s.line <= 4, `${s.key} is on line ${s.line}`);
    assert.equal(typeof s.order, "number", `${s.key} has no position`);
    assert.equal(typeof s.priority, "number", `${s.key} has no priority`);
    assert.ok(["identity", "ramp", "change"].includes(s.colour), `${s.key} has colour ${s.colour}`);
    assert.ok(["left", "right"].includes(s.align), `${s.key} aligns ${s.align}`);
  }
});

await test("keys are unique, and so are priorities", () => {
  // Two segments at the same priority means the tie is broken by array order,
  // which is exactly the accident the priority table exists to remove.
  const keys = SEGMENTS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "duplicate segment key");

  const priorities = SEGMENTS.map((s) => s.priority);
  assert.equal(new Set(priorities).size, priorities.length, "two segments share a priority");
});

await test("no segment carries two colour meanings", () => {
  // Principle X, as amended: a colour on the bar means one thing wherever it
  // appears. A ramped segment that also highlighted on change would be red
  // for "nearly full" and red for "just changed".
  const ramp = SEGMENTS.filter((s) => s.colour === "ramp").map((s) => s.key);
  const change = SEGMENTS.filter((s) => s.colour === "change").map((s) => s.key);
  for (const key of ramp) {
    assert.ok(!change.includes(key), `${key} is in both colour channels`);
  }
});

await test("positions within a line are unique and ordered", () => {
  for (let line = 1; line <= 4; line++) {
    const rows = byLine(line);
    const orders = rows.map((s) => s.order);
    assert.equal(new Set(orders).size, orders.length, `line ${line} has two segments in one position`);
    assert.deepEqual([...orders].sort((a, b) => a - b), orders, `line ${line} is not in order`);
  }
});

await test("the top band is what a narrow terminal keeps", () => {
  // data-model.md, agreed 2026-08-26: these six are what an 80-column
  // terminal shows, and the priority table is how that promise is kept.
  const top = SEGMENTS.filter((s) => s.priority >= PRIORITY_BANDS.essential)
    .sort((a, b) => b.priority - a.priority)
    .map((s) => s.key);
  assert.deepEqual(top, ["context", "branch", "dir", "fiveHour", "model", "sevenDay"]);
});

await test("the bands are ordered and named", () => {
  assert.ok(PRIORITY_BANDS.essential > PRIORITY_BANDS.actionable);
  assert.ok(PRIORITY_BANDS.actionable > PRIORITY_BANDS.useful);
  for (const s of SEGMENTS) {
    assert.ok(s.priority >= PRIORITY_BANDS.useful, `${s.key} sits below the lowest band`);
    assert.ok(s.priority <= 100, `${s.key} is above the scale`);
  }
});

await test("a segment can be looked up by key", () => {
  assert.equal(segment("context").line, 4);
  assert.equal(segment("branch").line, 1);
  assert.equal(segment("nothing-called-this"), undefined);
});

await test("the reset countdown is the right-aligned group", () => {
  // D3's chosen form, after C6 merged the two countdowns into one segment.
  // Everything else is left-aligned, so the volatile numbers land in the
  // same place on every redraw.
  const right = SEGMENTS.filter((s) => s.align === "right").map((s) => s.key);
  assert.deepEqual(right, ["resetMerged"]);
});

await test("the rendered lines follow the registry's order", async () => {
  // T003's whole point: change the table and the bar changes with it. If the
  // renderer still held its own order, this would pass with the table wrong.
  const { renderPayload } = await import("../../src/render.js");
  const { stripAnsi } = await import("../test-harness.js");
  const { fullPayload, gitSources } = await import("./fixtures/sources.js");

  const NOW = Date.parse("2026-08-25T12:00:00.000Z");
  const out = stripAnsi(
    renderPayload(
      fullPayload({
        output_style: { name: "explanatory" },
        rate_limits: {
          five_hour: { used_percentage: 20, resets_at: Math.floor(NOW / 1000) + 3600 },
          seven_day: { used_percentage: 40, resets_at: Math.floor(NOW / 1000) + 2 * 86400 },
        },
      }),
      { sources: { ...gitSources(), getRtkSavings: () => 50 }, trackChanges: false, now: NOW }
    )
  );

  const line3 = out.split("\n").find((l) => l.includes(G.model));
  assert.ok(line3.indexOf("Sonnet 5") < line3.indexOf("high"), "model precedes effort, per order 10 and 20");

  const line4 = out.split("\n").pop();
  const positions = ["Context", "5h", "7d"].map((t) => line4.indexOf(t));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    "line 4 renders in registry order"
  );
});

await test("the colour channels name real segments", async () => {
  const { inChannel } = await import("../../src/segments.js");
  assert.deepEqual(inChannel("ramp"), ["context", "fiveHour", "sevenDay", "burnRate"]);
  assert.deepEqual(inChannel("change"), ["branch", "pr", "skills", "model"]);
});

await test("line 1 renders in the registry's order too", async () => {
  // Lines 3 and 4 composed themselves from the table from the start; lines 1
  // and 2 were still assembled in whatever order the code pushed them. Now
  // every line sorts by the table, so moving a segment is a change to the
  // table rather than to a render function.
  const { renderPayload } = await import("../../src/render.js");
  const { stripAnsi } = await import("../test-harness.js");
  const { fullPayload, gitSources } = await import("./fixtures/sources.js");

  const NOW = Date.parse("2026-08-26T12:00:00.000Z");
  const line1 = stripAnsi(
    renderPayload(
      fullPayload({
        cwd: "/tmp/project",
        workspace: {
          current_dir: "/tmp/project",
          repo: { host: "github.com", owner: "owner", name: "repo" },
        },
        pr: { number: 7, url: "https://x/y/pull/7", review_state: "approved" },
        cost: { total_lines_added: 12, total_lines_removed: 3 },
      }),
      {
        sources: { ...gitSources({ changed: 2, conflicts: 1 }), getCiStatus: () => null },
        trackChanges: false,
        now: NOW,
        maxWidth: 400,
        maxHeight: 40,
      }
    )
  ).split("\n")[0];

  const positions = ["project", "owner/repo", "main", `${G.conflict} 1`, "+12", "PR #7"].map((t) => line1.indexOf(t));
  assert.ok(
    positions.every((p) => p >= 0),
    `something is missing from line 1: ${line1}`
  );
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    `line 1 is out of the registry's order: ${line1}`
  );
});
