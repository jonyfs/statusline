/**
 * The segment pool, and the promise that asking for it changed nothing.
 *
 * The pool is what the composer page is built from, so two things have to
 * hold. Every segment this session draws has to be in it, or the page is
 * missing a lever for a reason the person moving things cannot see. And the
 * ordinary render has to be exactly what it was before the pool existed,
 * because a diagnostic option that quietly changes the bar is worse than no
 * option at all.
 */

import { readFileSync } from "node:fs";

import { test } from "../test-harness.js";
import { gather, renderReadings } from "../../src/render.js";
import { SEGMENTS } from "../../src/segments.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const strip = (s) =>
  s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

const readings = () => gather(PAYLOAD, { ...SOURCES }, { now: FIXED_NOW * 1000 });
const opts = { ...RENDER_OPTIONS, maxWidth: 200, maxHeight: 40 };

await test("the pool holds one entry per segment the fixture draws", () => {
  const pool = renderReadings(readings(), PAYLOAD, { ...opts, asPool: true });
  const keys = pool.map((p) => p.key);
  assert(new Set(keys).size === keys.length, "a segment was pooled twice");

  // The fixture is built to light up everything the renderer can build.
  // `upstream` is a registry row with no content function: the ahead and
  // behind counts are drawn by `worktreeState`, and nothing has drawn an
  // `upstream` segment since. That is drift in the registry rather than a
  // gap in the pool, and this test is where it stays visible.
  const withoutContent = new Set(["upstream"]);
  for (const row of SEGMENTS) {
    if (withoutContent.has(row.key)) continue;
    assert(keys.includes(row.key), `${row.key} is missing from the pool`);
  }
  for (const key of withoutContent) {
    assert(!keys.includes(key), `${key} now has content — take it off the exception list`);
  }
});

await test("every pooled entry carries text and a palette colour", () => {
  for (const entry of renderReadings(readings(), PAYLOAD, { ...opts, asPool: true })) {
    assert(typeof entry.text === "string" && entry.text.length, `${entry.key} has no text`);
    assert(typeof entry.color === "string" && entry.color.length, `${entry.key} has no colour`);
    assert(!/^#/.test(entry.color), `${entry.key} carries a raw hex instead of a token`);
  }
});

await test("the pool's text is the text the bar renders", () => {
  const pool = renderReadings(readings(), PAYLOAD, { ...opts, asPool: true });
  const drawn = strip(renderReadings(readings(), PAYLOAD, opts));
  for (const entry of pool) {
    assert(drawn.includes(entry.text.trim()), `${entry.key}'s text is not on the bar`);
  }
});

await test("the pull request keeps its link in the pool", () => {
  const pool = renderReadings(readings(), PAYLOAD, { ...opts, asPool: true });
  const pr = pool.find((p) => p.key === "pr");
  assert(pr.url === PAYLOAD.pr.url, "the pull request lost its url");
});

await test("asking for the pool does not change the ordinary render", () => {
  const before = renderReadings(readings(), PAYLOAD, opts);
  renderReadings(readings(), PAYLOAD, { ...opts, asPool: true });
  const after = renderReadings(readings(), PAYLOAD, opts);
  assert(before === after, "the bar changed between renders");
  assert(before.split("\n").length === 4, "the fixture no longer draws four lines");
});

await test("the fixture pins its timezone", () => {
  // The failure this guards against passed on a laptop in UTC-3 and failed on
  // every CI runner: clock faces and reset labels come from local time, so
  // the committed golden bar is only a fact if the timezone is one too.
  assert(process.env.TZ === "UTC", `the fixture is rendering in ${process.env.TZ}`);
});

await test("the fixture's bar is the golden one", () => {
  // The expected bar lives beside this file rather than inside it: it is
  // full of private-use glyphs, and a string nobody can read in a diff is a
  // string that gets "fixed" by accident. Regenerate it deliberately when a
  // change is meant to move the bar, and the diff shows what moved.
  const golden = readFileSync(
    new URL("./fixtures/composer-bar.txt", import.meta.url),
    "utf8"
  )
    // CRLF on a Windows checkout, whatever the file was committed as.
    .replace(/\r\n/g, "\n")
    .replace(/\n$/, "");
  assert(strip(renderReadings(readings(), PAYLOAD, opts)) === golden, "the fixture's bar changed");
});

await test("a sample history can be supplied instead of read from disk", () => {
  const withSamples = strip(renderReadings(readings(), PAYLOAD, opts));
  const withoutSamples = strip(
    renderReadings(readings(), PAYLOAD, { ...opts, samples: null })
  );
  assert(/%\/h/.test(withSamples), "the burn rate did not render from the supplied history");
  assert(!/%\/h/.test(withoutSamples), "the burn rate rendered with no history at all");
});
