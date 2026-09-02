#!/usr/bin/env node
/**
 * Builds the page the animation candidates are chosen from.
 *
 *   node scripts/generate-animation-board.js
 *
 * Writes a single self-contained HTML file to the feature directory. No
 * server, no font, no network: the Nerd Font frames are drawn from the same
 * extracted outlines the SVG previews already use, so the page shows the same
 * thing to a reader who has never installed a Nerd Font. That matters more
 * here than anywhere else, because half of what the page exists to show is the
 * substitute set for exactly those readers.
 *
 * Generated rather than hand-written so it cannot drift: the frames come from
 * src/animations.js, which is also what the renderer reads. A page showing an
 * animation the bar is unable to draw is not possible.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ANIMATIONS } from "./animation-candidates.js";
import { PALETTES } from "../src/theme.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "specs", "003-status-change-animations", "animation-board.html");

const OUTLINES = JSON.parse(readFileSync(path.join(ROOT, "src", "preview", "glyphs.json"), "utf8"));
const MOCHA = PALETTES.mocha;

/** The icon each segment renders when nothing has changed, from the bar's own table. */
const SETTLED = {
  branch: { glyph: "\u{F418}", plain: "\u{1F33F}", label: "main", colour: MOCHA.lavender },
  pr: { glyph: "\u{F407}", plain: "\u{1F500}", label: "PR #7 open", colour: MOCHA.blue },
  skills: { glyph: "\u{F0431}", plain: "\u{1F9E9}", label: "code-review", colour: MOCHA.green },
  model: { glyph: "\u{F06A9}", plain: "\u{1F916}", label: "Opus 5", colour: MOCHA.red },
};

const isPrivateUse = (cp) =>
  (cp >= 0xe000 && cp <= 0xf8ff) ||
  (cp >= 0xf0000 && cp <= 0xffffd) ||
  (cp >= 0x100000 && cp <= 0x10fffd);

const escapeXml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * One frame, as the markup that draws it.
 *
 * A private-use codepoint becomes an inline SVG path from the extracted
 * outlines. Anything else is ordinary Unicode and goes out as text, which is
 * how the Braille spinner renders for a reader with no Nerd Font.
 */
function frameMarkup(ch) {
  const cp = ch.codePointAt(0);
  if (!isPrivateUse(cp)) return `<span class="ch">${escapeXml(ch)}</span>`;

  const hex = cp.toString(16).toUpperCase().padStart(4, "0");
  const g = OUTLINES.glyphs[hex];
  if (!g) {
    throw new Error(
      `No outline for U+${hex}. Add it to scripts/extract-glyphs.py and regenerate ` +
        "src/preview/glyphs.json, or this page draws a gap where a frame should be."
    );
  }
  const upem = OUTLINES.unitsPerEm;
  const top = Math.round(upem * 0.78);
  return (
    `<svg class="ch" viewBox="0 ${-top} ${g.advance} ${upem}" aria-hidden="true">` +
    `<path d="${g.path}" transform="scale(1,-1)"/></svg>`
  );
}

function segmentRow(candidate, mode) {
  const frames = mode === "nerd" ? candidate.nerd : candidate.plain;
  const cells = frames.map((f) => `<span class="frame">${frameMarkup(f)}</span>`).join("");
  return `<div class="frames" data-count="${frames.length}">${cells}</div>`;
}

function settledChip(segmentKey, mode) {
  const s = SETTLED[segmentKey];
  if (!s) return "";
  const icon = mode === "nerd" ? frameMarkup(s.glyph) : `<span class="ch">${escapeXml(s.plain)}</span>`;
  return (
    `<span class="chip" style="background:${s.colour}">${icon}` +
    `<span class="chip-label">${escapeXml(s.label)}</span></span>`
  );
}

/**
 * The chip that plays, with every frame already in the DOM and all but one
 * hidden. Swapping a `hidden` attribute rather than rewriting markup keeps the
 * page free of any string-to-DOM step, which a page built out of SVG paths
 * does not need.
 *
 * The cycle is the frames, then the settled icon twice, then round again: that
 * is what the bar does, and a loop that never settles would show only half of
 * the behaviour being judged.
 */
function playingChip(candidate, segmentKey, mode) {
  const s = SETTLED[segmentKey] ?? Object.values(SETTLED)[0];
  const frames = mode === "nerd" ? candidate.nerd : candidate.plain;
  const settledIcon = mode === "nerd" ? s.glyph : s.plain;
  const cycle = [...frames, settledIcon, settledIcon];
  const cells = cycle
    .map((f, i) => `<span class="cel"${i === 0 ? "" : " hidden"}>${frameMarkup(f)}</span>`)
    .join("");
  return (
    `<span class="chip playing" style="background:${s.colour}">` +
    `<span class="slot">${cells}</span>` +
    `<span class="chip-label">${escapeXml(s.label)}</span></span>`
  );
}

function candidateSection(candidate) {
  const primary = candidate.segments[0];
  return `
<section class="candidate" id="c-${candidate.key}">
  <header>
    <h2>${escapeXml(candidate.label)}</h2>
    <p class="describes">${escapeXml(candidate.describes)}</p>
    <p class="meta">
      <span>${candidate.nerd.length} frames</span>
      <span>proposed for ${candidate.segments.map(escapeXml).join(", ")}</span>
    </p>
  </header>

  <div class="row">
    <div class="col">
      <h3>Nerd Font</h3>
      <div class="compare">
        ${playingChip(candidate, primary, "nerd")}
        <span class="versus">vs. today</span>
        ${settledChip(primary, "nerd")}
      </div>
      <h4>every frame</h4>
      ${segmentRow(candidate, "nerd")}
    </div>
    <div class="col">
      <h3>No Nerd Font</h3>
      <div class="compare">
        ${playingChip(candidate, primary, "plain")}
        <span class="versus">vs. today</span>
        ${settledChip(primary, "plain")}
      </div>
      <h4>every frame</h4>
      ${segmentRow(candidate, "plain")}
    </div>
  </div>
</section>`;
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statusline Frame Candidates</title>
<style>
  /*
     One theme on purpose, and the theme is Catppuccin Mocha, because the
     whole question this page asks is how a glyph reads against the ground the
     bar is actually drawn on. Rendering the candidates on a light background
     would answer a question nobody has. Every colour is painted explicitly, so
     the page holds whatever ground it is composited over.
  */
  :root {
    --base: ${MOCHA.base}; --mantle: ${MOCHA.mantle}; --crust: ${MOCHA.crust};
    --text: ${MOCHA.text};
    /*
       Catppuccin Mocha's own subtext0. The bar only needs the tokens it
       paints segments with, so the project's palette stops short of it, but
       running text on this ground needs a step between surface2 and text:
       surface2 lands near 2.6:1 against base, which is not readable.
    */
    --subtext: #a6adc8;
    --surface: ${MOCHA.surface1};
    --accent: ${MOCHA.lavender};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2.5rem 1.5rem 5rem;
    background: var(--base); color: var(--text);
    font: 15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
  .lede { color: var(--subtext); max-width: 46rem; }
  .controls {
    position: sticky; top: 0; z-index: 2;
    display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
    margin: 1.75rem 0; padding: .85rem 1rem;
    background: var(--mantle); border-radius: .6rem;
  }
  .controls strong { font-weight: 600; }
  button {
    font: inherit; cursor: pointer; border: 1px solid transparent;
    padding: .35rem .8rem; border-radius: .4rem;
    background: var(--surface); color: var(--text);
  }
  button[aria-pressed="true"] { background: var(--accent); color: var(--crust); font-weight: 600; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .interval-note { color: var(--subtext); font-size: .9rem; }
  section.candidate {
    background: var(--mantle); border-radius: .6rem;
    padding: 1.25rem 1.4rem 1.5rem; margin-bottom: 1.25rem;
  }
  section.candidate h2 { font-size: 1.15rem; margin: 0; }
  .describes { margin: .2rem 0 .4rem; color: var(--text); }
  .meta { margin: 0; color: var(--subtext); font-size: .88rem; }
  .meta span + span::before { content: " · "; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.5rem; margin-top: 1.1rem; }
  h3 { font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--subtext); margin: 0 0 .6rem; }
  h4 { font-size: .78rem; letter-spacing: .05em; text-transform: uppercase; color: var(--subtext); margin: 1rem 0 .45rem; font-weight: 500; }
  .compare { display: flex; align-items: center; gap: .7rem; flex-wrap: wrap; }
  .compare .chip { flex: 0 0 auto; }
  .versus { color: var(--subtext); font-size: .85rem; }
  .chip {
    display: inline-flex; align-items: center; gap: .45rem;
    padding: .3rem .75rem; border-radius: .3rem;
    color: var(--crust); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 15px; white-space: nowrap;
  }
  .chip-label { font-weight: 500; }
  .slot { display: inline-flex; width: 1.05em; justify-content: center; }
  .cel[hidden] { display: none; }
  .frames { display: flex; gap: .4rem; flex-wrap: wrap; }
  .frame {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2.4rem; height: 2.4rem; border-radius: .35rem;
    background: var(--surface); color: var(--text);
  }
  svg.ch { width: 1.05em; height: 1.05em; fill: currentColor; display: block; }
  .chip svg.ch { fill: var(--crust); }
  span.ch { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  footer { color: var(--subtext); font-size: .9rem; margin-top: 2rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--mantle); padding: .1rem .35rem; border-radius: .25rem; }
</style>
</head>
<body>
<main>
  <h1>Animation candidates</h1>
  <p class="lede">
    Each candidate plays at the rate the terminal actually gives it. A statusline
    is printed once per invocation and is then static text, so a frame advances
    only when Claude Code asks for the bar again: roughly every 5 to 6 seconds
    while work is happening, and every 60 seconds when it is not. The
    thirty-second highlight window is therefore about five frames, or one.
  </p>

  <div class="controls">
    <strong>Interval</strong>
    <button id="busy" aria-pressed="true">Busy · 5.5s</button>
    <button id="idle" aria-pressed="false">Idle · 60s</button>
    <button id="play" aria-pressed="true">Pause</button>
    <span class="interval-note" id="note">
      A thirty-second window fits about 5 frames at this rate.
    </span>
  </div>

${ANIMATIONS.map(candidateSection).join("\n")}

  <footer>
    <p>
      Nerd Font frames are drawn from outlines extracted out of the installed
      font, so this page shows the same thing with or without the font
      installed. Frames outside the private-use area — the Braille spinner — are
      ordinary Unicode and render as text.
    </p>
    <p>
      Generated by <code>scripts/generate-animation-board.js</code> from
      <code>src/animations.js</code>, which is the same table the renderer reads.
    </p>
  </footer>
</main>

<script>
const BUSY_MS = 5500;
const IDLE_MS = 60000;
let current = BUSY_MS;
let timer = null;

const slots = [...document.querySelectorAll(".chip.playing .slot")].map((el) => ({
  cells: [...el.querySelectorAll(".cel")],
  at: 0,
}));

function paint() {
  for (const s of slots) {
    s.cells.forEach((cel, i) => {
      if (i === s.at) cel.removeAttribute("hidden");
      else cel.setAttribute("hidden", "");
    });
  }
}

/** One frame per tick, the way one render advances one frame on the real bar. */
function advance() {
  for (const s of slots) s.at = (s.at + 1) % s.cells.length;
  paint();
}

function useInterval(ms, which) {
  current = ms;
  document.getElementById("busy").setAttribute("aria-pressed", String(which === "busy"));
  document.getElementById("idle").setAttribute("aria-pressed", String(which === "idle"));
  document.getElementById("note").textContent =
    ms === BUSY_MS
      ? "A thirty-second window fits about 5 frames at this rate."
      : "A thirty-second window fits one frame at this rate. This is the idle case.";
  for (const s of slots) s.at = 0;
  paint();
  clearInterval(timer);
  timer = setInterval(advance, ms);
  const p = document.getElementById("play");
  p.textContent = "Pause";
  p.setAttribute("aria-pressed", "true");
}

document.getElementById("busy").addEventListener("click", () => useInterval(BUSY_MS, "busy"));
document.getElementById("idle").addEventListener("click", () => useInterval(IDLE_MS, "idle"));

const play = document.getElementById("play");
play.addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    play.textContent = "Play";
    play.setAttribute("aria-pressed", "false");
  } else {
    timer = setInterval(advance, current);
    play.textContent = "Pause";
    play.setAttribute("aria-pressed", "true");
  }
});

// A page whose whole content is motion cannot honour a reduced-motion
// preference by removing the motion. It honours it by not starting: the still
// strips below each candidate say everything except the timing, and Play is
// one click away.
useInterval(BUSY_MS, "busy");
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) play.click();
</script>
</body>
</html>
`;

writeFileSync(OUT, page);
console.log(`animation board written to ${path.relative(ROOT, OUT)} (${ANIMATIONS.length} candidates)`);
