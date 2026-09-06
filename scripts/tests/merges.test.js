import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { shortCountdown } from "../../src/tokens.js";
import { gitSources, fullPayload, emptySources } from "./fixtures/sources.js";
import { G, re } from "./glyphs.js";

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
    .find((l) => l.includes(G.model));

  assert.match(line3, re`${G.effort} high`);
  assert.doesNotMatch(line3, /explanatory/);
  assert.ok(line3.indexOf("Sonnet 5") < line3.indexOf("high"), "the model still comes first");
});

// C4 -----------------------------------------------------------------------

await test("the 7-day window counts down inside a day and names the day beyond one", () => {
  const soon = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(3600) },
        seven_day: { used_percentage: 20, resets_at: secs(6 * 3600) },
      },
    })
  );
  assert.match(soon, /7d 20% · 6h/, "inside a day it is something you wait out");

  const later = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(3600) },
        seven_day: { used_percentage: 20, resets_at: secs(3 * 86400) },
      },
    })
  );
  assert.match(later, /7d 20% · \w{3} \d{2}:\d{2}/, "days out it is a date you plan around");
});

// C6 -----------------------------------------------------------------------

await test("each window carries its own reset, on its own chip", () => {
  const out = render(
    fullPayload({
      rate_limits: {
        five_hour: { used_percentage: 10, resets_at: secs(5400) },
        seven_day: { used_percentage: 20, resets_at: secs(3 * 86400) },
      },
    })
  );
  // The 5-hour level and the 5-hour reset are one chip, and so are the
  // 7-day pair. Until 2026-09-06 both resets shared a third segment reading
  // `1h30m / 3d`, which asked the reader to know which half belonged to
  // which figure, and read as a fraction beside the session duration.
  assert.match(out, /5h 10% · 1h30m/);
  assert.match(out, /7d 20% · /);
  assert.doesNotMatch(out, /1h30m \/ /, "the merged countdown is gone");
  assert.equal((out.match(/resets in/g) || []).length, 0, "the words stay off the line");
});

await test("a window with no reset in the payload says so rather than going quiet", () => {
  // Not the same claim as a reset shed for width: one is a fact about the
  // data, the other about the terminal (Principle III).
  const out = render(
    fullPayload({ rate_limits: { five_hour: { used_percentage: 10 }, seven_day: { used_percentage: 20 } } })
  );
  assert.match(out, /5h 10% · \?/);
  assert.match(out, /7d 20% · \?/);
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
  assert.match(out, re`${G.dir} statusline`);
  assert.match(out, /jonyfs\/statusline/);
});
