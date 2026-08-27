import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { PALETTES } from "../../src/theme.js";
import { emptySources, gitSources, fullPayload } from "./fixtures/sources.js";
import { makeHome, withHome } from "./fixtures/home.js";

await test("renders with a fully populated payload", () => {
  const out = renderPayload(fullPayload({ cwd: process.cwd() }), { sources: emptySources });
  const plain = stripAnsi(out);
  assert.match(plain, /Sonnet 5/);
  assert.match(plain, /Context [░█▓▒]* ?26%/);
  assert.match(plain, /5h 20%/);
  assert.match(plain, /7d 77%/);
});

await test("degrades to ?% instead of inventing numbers", () => {
  const plain = stripAnsi(renderPayload({}, { sources: emptySources }));
  assert.match(plain, /Context [░█▓▒]* ?\?%/);
  assert.match(plain, /5h \?%/);
  assert.doesNotMatch(plain, /NaN|undefined|null/);
});

await test("survives a completely empty payload", () => {
  const out = renderPayload({}, { sources: emptySources });
  assert.ok(out.length > 0);
  assert.doesNotMatch(out, /undefined|NaN/);
});

await test("omits the skills line when no skills are active", () => {
  const lines = renderPayload({}, { sources: emptySources }).split("\n");
  assert.equal(lines.length, 3, `expected 3 lines without skills, got ${lines.length}`);
});

await test("includes the skills line when skills are active", () => {
  const lines = renderPayload(
    {},
    { sources: { ...emptySources, getActiveSkills: () => ["a", "b"] } }
  ).split("\n");
  assert.equal(lines.length, 4);
});

await test("every Catppuccin flavor renders", () => {
  for (const flavor of Object.keys(PALETTES)) {
    const out = renderPayload({}, { flavor, sources: emptySources });
    assert.ok(out.length > 0, `${flavor} produced no output`);
  }
});

await test("working-tree state renders after the branch", () => {
  // Tracking off: with it on, a changed ahead/behind swaps the static
  // icon for an animation frame, which is correct behaviour but makes
  // the exact-layout assertion below meaningless.
  const line1 = (over) =>
    stripAnsi(renderPayload({}, { sources: gitSources(over), trackChanges: false })).split("\n")[0];

  const MODIFIED = "\u{F459}", ADDED = "\u{F457}", PUSH = "\u{F40A}", PULL = "\u{F409}";

  const clean = line1({});
  for (const g of [MODIFIED, ADDED, PUSH, PULL]) {
    assert.ok(!clean.includes(g), "a clean, in-sync branch adds nothing");
  }
  assert.ok(line1({ changed: 3 }).includes(`${MODIFIED} 3`));
  assert.ok(line1({ untracked: 2 }).includes(`${ADDED} 2`));
  assert.ok(line1({ ahead: 1 }).includes(`${PUSH} 1`));
  assert.ok(line1({ behind: 4 }).includes(`${PULL} 4`));

  // Order matters: the state cluster belongs immediately after the branch.
  const full = line1({ changed: 1, untracked: 2, ahead: 3, behind: 4 });
  const expected = `${MODIFIED} 1  ${ADDED} 2  ${PUSH} 3  ${PULL} 4`;
  assert.ok(full.includes(expected), `unexpected layout: ${JSON.stringify(full)}`);
  assert.ok(full.indexOf("main") < full.indexOf(expected), "state must follow the branch");
});

await test("ASCII mode emits no private-use codepoints at all", () => {
  // The flag promises "no Nerd Font required". Swapping only the
  // separator while leaving Octicons behind would keep that promise in
  // name and break it on screen: every one renders as an empty box.
  const out = renderPayload(fullPayload(), {
    asciiArrows: true,
    trackChanges: false,
    sources: {
      ...gitSources({ ahead: 1, behind: 2, changed: 3, untracked: 4 }),
      getRemoteUrl: () => "https://github.com/x/y",
      getPrInfo: () => ({ number: 9, state: "OPEN", isDraft: false, url: "https://x/y/pull/9" }),
      getActiveSkills: () => ["a"],
      getRtkSavings: () => 50,
    },
  });
  const pua = [...stripAnsi(out)].filter((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xe000 && cp <= 0xf8ff;
  });
  assert.equal(
    pua.length,
    0,
    `ASCII mode leaked ${pua.length} private-use glyph(s): ` +
      pua.map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(" ")
  );
});

// The throttled savings figure ---------------------------------------------

await test("the savings figure is only remembered once it has actually been drawn", async () => {
  // It renders when it has moved five points since the last one shown. A
  // narrow terminal drops it by priority, and recording it as shown there
  // meant the reader never saw the figure at all: the next redraw compared
  // against a value that was never on screen and stayed silent.
  // In a throwaway HOME: what a segment last showed lives in the per-session
  // state file, and a case that wrote to the real one would pass or fail by
  // what an earlier run left behind.
  const home = makeHome();
  await withHome(home, () => {
    const payload = fullPayload({ session_id: "rtk-throttle-case", cwd: process.cwd() });
    const sources = { ...emptySources, getRtkSavings: () => 63 };
    const narrow = stripAnsi(
      renderPayload(payload, { sources, now: Date.now(), maxWidth: 46, maxHeight: 40 })
    );
    assert.doesNotMatch(narrow, /rtk/, "there is no room for it on a 46-column line");

    const wide = stripAnsi(
      renderPayload(payload, { sources, now: Date.now(), maxWidth: 400, maxHeight: 40 })
    );
    assert.match(wide, /rtk 63% saved/, "the wide redraw is the first time it is shown");

    const again = stripAnsi(
      renderPayload(payload, { sources, now: Date.now(), maxWidth: 400, maxHeight: 40 })
    );
    assert.doesNotMatch(again, /rtk/, "and now it holds until it moves five points");
  });
});

// Column alignment ---------------------------------------------------------

await test("the first segment of each line is padded to a common width", () => {
  const lines = stripAnsi(
    renderPayload(fullPayload({ cwd: process.cwd() }), {
      sources: gitSources(),
      trackChanges: false,
      maxWidth: 400,
      maxHeight: 40,
    })
  ).split("\n");

  // Each line's first segment ends at the same column, so the boundaries
  // line up down the bar instead of each line starting its own table.
  // Written as an escape: a pasted private-use literal has vanished from a
  // file in this repository before, leaving an empty string that matches
  // everything and a test that passes without checking anything.
  const SEPARATOR = "\u{E0B0}";
  const firstBoundary = (line) => line.indexOf(SEPARATOR, 1);
  const boundaries = lines.map(firstBoundary).filter((i) => i > 0);
  assert.ok(boundaries.length >= 2, "more than one line has a boundary to align");
  assert.equal(new Set(boundaries).size, 1, `boundaries land at ${boundaries.join(", ")}`);
});
