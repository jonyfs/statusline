#!/usr/bin/env node
/**
 * Regenerates docs/previews/*.svg from the real renderer.
 *
 *   npm run previews
 *
 * The images are produced by calling renderPayload() — the same function
 * the installed statusline runs — and converting its actual ANSI output to
 * SVG. They are therefore guaranteed to match what the terminal shows; they
 * are not hand-drawn mockups that can drift from the code.
 */

// Pinned before any Date is constructed. Clock-face icons and reset
// labels are derived from LOCAL time, so without this the same fixture
// renders differently depending on the machine's timezone — previews
// generated in UTC-3 and re-generated on a UTC CI runner disagree, and
// the staleness check fails on a diff that reflects geography rather
// than any code change. Set in JS, not the npm script, because `TZ=UTC
// node ...` is not valid shell on Windows (Principle IX).
process.env.TZ = "UTC";

// Previews must not depend on the terminal that generated them. The renderer
// now reads COLUMNS and LINES, so a preview made in a narrow window would
// commit a narrower bar than one made in a wide one, and CI's staleness
// check would fail on a diff that reflects a window size. Every scenario
// below therefore renders at a fixed size.
const PREVIEW_WIDTH = 120;
const PREVIEW_HEIGHT = 40;

// A preview must not read the machine that generated it, and an arrangement
// is now one of the things the machine can have. Passing the default
// explicitly means a maintainer with their own bar still regenerates the
// images everybody else does.
const NO_ARRANGEMENT = { arrangement: null, origin: "default", path: null, error: null };

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPayload } from "../src/render.js";
import { alignTaskRows } from "../src/taskRows.js";
import { ansiToSvg } from "../src/preview/ansiToSvg.js";
import { PALETTES } from "../src/theme.js";
import { preset } from "./composer-presets.js";
import { SCENARIOS, FLAVOR_SCENARIO, EXTRA_FLAVORS, FIXED_NOW, TASK_ROWS_SCENARIO } from "./preview-fixtures.js";

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "previews"
);

/**
 * Countdown labels are computed from Date.now(), so without freezing it
 * every regeneration would produce a diff purely from elapsed time.
 */
function withFrozenClock(fn) {
  const realNow = Date.now;
  Date.now = () => FIXED_NOW * 1000;
  try {
    return fn();
  } finally {
    Date.now = realNow;
  }
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const written = [];

  for (const scenario of SCENARIOS) {
    const ansi = withFrozenClock(() =>
      renderPayload(scenario.payload, {
        sources: scenario.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        // A scenario may pin its own size when the size is the point.
        maxWidth: scenario.width ?? PREVIEW_WIDTH,
        maxHeight: scenario.height ?? PREVIEW_HEIGHT,
      })
    );
    const svg = ansiToSvg(ansi, {
      title: scenario.title,
      background: PALETTES.mocha.base,
    });
    const target = path.join(OUT_DIR, scenario.file);
    writeFileSync(target, svg);
    written.push(scenario.file);
  }

  for (const flavor of ["mocha", "frappe", "macchiato", "latte", ...EXTRA_FLAVORS]) {
    const ansi = withFrozenClock(() =>
      renderPayload(FLAVOR_SCENARIO.payload, {
        flavor,
        sources: FLAVOR_SCENARIO.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        maxWidth: PREVIEW_WIDTH,
        maxHeight: PREVIEW_HEIGHT,
      })
    );
    const svg = ansiToSvg(ansi, {
      title: `Catppuccin ${flavor}`,
      background: PALETTES[flavor].base,
    });
    const file = `flavor-${flavor}.svg`;
    writeFileSync(path.join(OUT_DIR, file), svg);
    written.push(file);
  }

  // The emoji tier (specs/043-emoji-tier): the same bar as flavor-mocha with
  // `CLAUDE_STATUSLINE_ICONS=emoji`, so the two can be read side by side.
  const priorIcons = process.env.CLAUDE_STATUSLINE_ICONS;
  process.env.CLAUDE_STATUSLINE_ICONS = "emoji";
  try {
    const emojiAnsi = withFrozenClock(() =>
      renderPayload(FLAVOR_SCENARIO.payload, {
        sources: FLAVOR_SCENARIO.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        maxWidth: PREVIEW_WIDTH,
        maxHeight: PREVIEW_HEIGHT,
      })
    );
    writeFileSync(
      path.join(OUT_DIR, "emoji-tier.svg"),
      ansiToSvg(emojiAnsi, {
        title: "CLAUDE_STATUSLINE_ICONS=emoji, no Nerd Font required",
        background: PALETTES.mocha.base,
      })
    );
    written.push("emoji-tier.svg");
  } finally {
    if (priorIcons === undefined) delete process.env.CLAUDE_STATUSLINE_ICONS;
    else process.env.CLAUDE_STATUSLINE_ICONS = priorIcons;
  }

  // The pill separator (specs/045-separators-layout), and the compact preset:
  // one line, the five segments a small pane has room for.
  const priorSeparator = process.env.CLAUDE_STATUSLINE_SEPARATOR;
  process.env.CLAUDE_STATUSLINE_SEPARATOR = "round";
  try {
    const roundAnsi = withFrozenClock(() =>
      renderPayload(FLAVOR_SCENARIO.payload, {
        sources: FLAVOR_SCENARIO.sources,
        trackChanges: false,
        layout: NO_ARRANGEMENT,
        maxWidth: PREVIEW_WIDTH,
        maxHeight: PREVIEW_HEIGHT,
      })
    );
    writeFileSync(
      path.join(OUT_DIR, "separator-round.svg"),
      ansiToSvg(roundAnsi, { title: "CLAUDE_STATUSLINE_SEPARATOR=round", background: PALETTES.mocha.base })
    );
    written.push("separator-round.svg");
  } finally {
    if (priorSeparator === undefined) delete process.env.CLAUDE_STATUSLINE_SEPARATOR;
    else process.env.CLAUDE_STATUSLINE_SEPARATOR = priorSeparator;
  }
  const compactAnsi = withFrozenClock(() =>
    renderPayload(FLAVOR_SCENARIO.payload, {
      sources: FLAVOR_SCENARIO.sources,
      trackChanges: false,
      layout: { arrangement: preset("compact").arrangement, origin: "preset", path: null, error: null },
      maxWidth: PREVIEW_WIDTH,
      maxHeight: PREVIEW_HEIGHT,
    })
  );
  writeFileSync(
    path.join(OUT_DIR, "compact.svg"),
    ansiToSvg(compactAnsi, { title: "The compact preset: one line", background: PALETTES.mocha.base })
  );
  written.push("compact.svg");

  const asciiAnsi = withFrozenClock(() =>
    renderPayload(FLAVOR_SCENARIO.payload, {
      asciiArrows: true,
      sources: FLAVOR_SCENARIO.sources,
      trackChanges: false,
      layout: NO_ARRANGEMENT,
      maxWidth: PREVIEW_WIDTH,
      maxHeight: PREVIEW_HEIGHT,
    })
  );
  writeFileSync(
    path.join(OUT_DIR, "ascii-fallback.svg"),
    ansiToSvg(asciiAnsi, {
      title: "CLAUDE_STATUSLINE_ASCII=1 — no Nerd Font required",
      background: PALETTES.mocha.base,
    })
  );
  written.push("ascii-fallback.svg");

  // The subagent rows are drawn by Claude Code, not by `renderPayload`, so
  // they go through the function the installed `task-rows` command calls
  // rather than being typed into the README by hand (Principle VIII).
  const rowsAnsi = withFrozenClock(() =>
    alignTaskRows(TASK_ROWS_SCENARIO.tasks, {
      columns: TASK_ROWS_SCENARIO.columns,
      palette: PALETTES.mocha,
      now: FIXED_NOW * 1000,
      skillsByAgent: new Map(TASK_ROWS_SCENARIO.skills),
    })
      .map((row) => row.content)
      .join("\n")
  );
  writeFileSync(
    path.join(OUT_DIR, TASK_ROWS_SCENARIO.file),
    ansiToSvg(rowsAnsi, { title: TASK_ROWS_SCENARIO.title, background: PALETTES.mocha.base })
  );
  written.push(TASK_ROWS_SCENARIO.file);

  console.log(`Wrote ${written.length} previews to docs/previews/:`);
  for (const f of written) console.log(`  ${f}`);
}

main();
