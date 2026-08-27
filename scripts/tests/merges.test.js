import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { shortCountdown } from "../../src/tokens.js";
import { gitSources, fullPayload, emptySources } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const secs = (offset) => Math.floor(NOW / 1000) + offset;
const WIDE = { maxWidth: 400, maxHeight: 40 };

const render = (payload, sources = gitSources(), extra = {}) =>
  stripAnsi(renderPayload(payload, { sources, trackChanges: false, now: NOW, ...WIDE, ...extra }));

// C3 -----------------------------------------------------------------------
//
// C3 merged effort with the output style. On 2026-08-26 the output style
// came off the bar entirely, so line 3 is the model and the effort.

await test("line 3 carries the model and the effort, and stops there", () => {
  const line3 = render(
    fullPayload({ effort: { level: "high" }, output_style: { name: "explanatory" } })
  )
    .split("\n")
    .find((l) => l.includes("🤖"));

  assert.match(line3, /⚡ high/);
  assert.doesNotMatch(line3, /explanatory/);
  assert.ok(line3.indexOf("Sonnet 5") < line3.indexOf("high"), "the model still comes first");
});

// C4 -----------------------------------------------------------------------

await test("the weekday appears only when the reset is more than a day out", () => {
  const soon = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(3600) },
        seven_day: { used_percentage: 20, resets_at: secs(6 * 3600) },
      },
    })
  );
  assert.match(soon, /7d 20%/);
  assert.doesNotMatch(soon, /7d 20% ·/, "inside a day, the countdown says it all");

  const later = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(3600) },
        seven_day: { used_percentage: 20, resets_at: secs(3 * 86400) },
      },
    })
  );
  assert.match(later, /7d 20% · /, "days out, the weekday earns its place");
});

// C6 -----------------------------------------------------------------------

await test("both countdowns share one segment", () => {
  const out = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(5400) },
        seven_day: { used_percentage: 20, resets_at: secs(3 * 86400) },
      },
    })
  );
  assert.match(out, /1h30m \/ 3d/);
  assert.equal((out.match(/resets in/g) || []).length, 0, "the words are gone with the second segment");
});

await test("the clock face is the sooner of the two windows", () => {
  // Whichever resets first is the one about to matter, so it owns the face.
  const fiveFirst = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(3600) },
        seven_day: { used_percentage: 20, resets_at: secs(5 * 86400) },
      },
    })
  );
  const sevenFirst = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(4 * 86400) },
        seven_day: { used_percentage: 20, resets_at: secs(3600) },
      },
    })
  );
  const faceOf = (line) => line.match(/[🕐-🕧]/u)?.[0];
  assert.ok(faceOf(fiveFirst));
  assert.ok(faceOf(sevenFirst));
});

await test("an unknown reset says so rather than showing a bare clock", () => {
  assert.match(render({}, emptySources), /reset unknown/);
});

await test("shortCountdown drops the words and keeps the number", () => {
  assert.equal(shortCountdown(secs(5400), NOW), "1h30m");
  assert.equal(shortCountdown(secs(3 * 86400), NOW), "3d");
  assert.equal(shortCountdown(secs(-30), NOW), "now");
  assert.equal(shortCountdown(secs(-7200), NOW), null, "long past is unknown, not zero");
  assert.equal(shortCountdown(undefined, NOW), null);
});

// C5 -----------------------------------------------------------------------

await test("the savings figure renders whenever there is one", () => {
  // C5 asked for it to wait until it had moved five points. `rtk gain`
  // reports a lifetime average over thousands of commands, which does not
  // move five points, so the segment appeared on a session's first redraw
  // and never again. Its priority is the lowest on the bar, so a narrow line
  // still drops it first — the terminal decides, not a threshold the figure
  // cannot cross.
  const session = `merge-test-${process.pid}`;
  const payload = fullPayload({ session_id: session });
  const withRtk = (pct) => ({ ...gitSources(), getRtkSavings: () => pct });

  const first = stripAnsi(renderPayload(payload, { sources: withRtk(80), now: NOW, ...WIDE }));
  assert.match(first, /rtk 80% saved/);

  const again = stripAnsi(
    renderPayload(payload, { sources: withRtk(80), now: NOW + 6000, ...WIDE })
  );
  assert.match(again, /rtk 80% saved/, "an unchanged figure is still the figure");

  const narrow = stripAnsi(
    renderPayload(payload, { sources: withRtk(80), now: NOW + 12000, maxWidth: 60, maxHeight: 40 })
  );
  assert.doesNotMatch(narrow, /rtk/, "a narrow line drops it by priority");
});

// C7 -----------------------------------------------------------------------

await test("the directory stays even when it repeats the repository name", () => {
  // C7's chosen form. The directory is the first thing on the bar and the
  // thing people navigate by; making it conditional would make the bar's
  // shape change under them.
  const out = render(
    fullPayload({
      cwd: "/Users/dev/statusline",
      workspace: {
        current_dir: "/Users/dev/statusline",
        repo: { host: "github.com", owner: "jonyfs", name: "statusline" },
      },
    })
  );
  assert.match(out, /📁 statusline/);
  assert.match(out, /jonyfs\/statusline/);
});
