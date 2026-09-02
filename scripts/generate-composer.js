#!/usr/bin/env node
/**
 * Builds the page the bar is arranged on.
 *
 *   node scripts/generate-composer.js
 *
 * Writes one self-contained HTML file into the feature directory. No server,
 * no network, no font: the Nerd Font glyphs are drawn from the same extracted
 * outlines the committed previews use, so the page shows a reader with no
 * Nerd Font exactly what the substitute set looks like.
 *
 * The page does not approximate the bar. It is handed the renderer's own
 * modules and the real segment values for one fixed session, and composes
 * with `resolveArrangement`, `fitToWidth`, `alignColumns` and `renderRow` —
 * the same four calls the terminal makes. A design it shows is therefore a
 * design the renderer can draw, which is the whole reason for building a page
 * rather than a mockup.
 */

// Pinned before any Date is constructed, for the same reason the preview
// generator pins it: clock faces and reset labels derive from local time, so
// without this the page differs between a machine in UTC-3 and a CI runner.
process.env.TZ = "UTC";

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gather, renderReadings } from "../src/render.js";
import { PALETTES } from "../src/theme.js";
import { SEGMENTS } from "../src/segments.js";
import { PAYLOAD, SOURCES, FIXED_NOW, SAMPLES } from "./composer-fixture.js";
import { PRESETS } from "./composer-presets.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "specs", "004-statusline-redesign-research", "composer.html");

/** The widths the page offers. 80 is the one that decides what a design costs. */
const WIDTHS = [80, 120, 160];

/**
 * Inlines one of the renderer's modules into the page.
 *
 * The modules import only each other and export only functions, so dropping
 * both keywords and concatenating them in dependency order produces one
 * script with the same behaviour. Nothing is rewritten beyond that: the page
 * runs the same statements the terminal runs.
 */
function inlineModule(relPath, { drop = [] } = {}) {
  let source = readFileSync(path.join(ROOT, relPath), "utf8");
  for (const chunk of drop) {
    if (!source.includes(chunk)) throw new Error(`${relPath}: nothing to drop matching ${chunk.slice(0, 40)}`);
    source = source.replace(chunk, "");
  }
  const lines = source.split("\n").filter((line) => !/^import\s/.test(line));
  const body = lines.join("\n").replace(/^export (function|const|class) /gm, "$1 ");
  if (/\bimport\s|\bexport\s|node:/.test(body)) {
    throw new Error(`${relPath}: an import, an export or a node builtin survived inlining`);
  }
  return body;
}

/** One session's segments, in both glyph modes. */
function buildPools() {
  const now = FIXED_NOW * 1000;
  const readings = gather(PAYLOAD, { ...SOURCES }, { now });
  const common = { flavor: "mocha", tracking: false, now, samples: SAMPLES, maxWidth: 400, maxHeight: 40, asPool: true };
  return {
    nerd: renderReadings(readings, PAYLOAD, { ...common, asciiArrows: false }),
    plain: renderReadings(readings, PAYLOAD, { ...common, asciiArrows: true }),
  };
}

const escapeScript = (json) => JSON.stringify(json).replace(/</g, "\\u003c");

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pools = buildPools();
const glyphs = JSON.parse(readFileSync(path.join(ROOT, "src", "preview", "glyphs.json"), "utf8"));

// Registry rows the page needs. Priority and colour travel so the page can
// explain what a narrow terminal will do, not so it can change them.
const registry = SEGMENTS.map(({ key, line, order, align, priority, colour, source }) => ({
  key, line, order, align, priority, colour, source,
}));

const pooledKeys = new Set(pools.nerd.map((s) => s.key));
const missingContent = registry.filter((r) => !pooledKeys.has(r.key)).map((r) => r.key);

const modules = [
  inlineModule("src/theme.js"),
  inlineModule("src/layout.js"),
  inlineModule("src/arrangement.js"),
  inlineModule("src/preview/ansiToSvg.js", {
    drop: [
      `/**
 * The extracted outlines this module draws with, read from disk.
 *
 * Kept behind a function rather than run at import time, because the drawing
 * itself has no need of a filesystem and a page that inlines this module has
 * no filesystem to offer it. The default converter below still loads the
 * file, so every existing caller is unaffected.
 */
export function loadGlyphs() {
  return JSON.parse(readFileSync(new URL("./glyphs.json", import.meta.url), "utf8"));
}`,
      `/** The converter every existing caller uses, over the committed outlines. */
export const ansiToSvg = createAnsiToSvg(loadGlyphs());`,
    ],
  }),
].join("\n\n");

const presetCards = PRESETS.map(
  (p) => `      <article class="preset${p.conflicts.length ? " preset--conflict" : ""}" data-preset="${escapeHtml(p.id)}">
        <h3>${escapeHtml(p.label)}</h3>
        <dl>
          <dt>Optimises for</dt><dd>${escapeHtml(p.optimisesFor)}</dd>
          <dt>Gives up</dt><dd>${escapeHtml(p.givesUp)}</dd>
          <dt>For whom</dt><dd>${escapeHtml(p.forWhom)}</dd>
        </dl>
        ${p.conflicts.length ? `<p class="conflict">Requires an amendment: ${escapeHtml(p.conflicts.join("; "))}</p>` : ""}
        <button type="button" data-load="${escapeHtml(p.id)}">Load this</button>
      </article>`
).join("\n");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arrange the statusline</title>
<style>
  :root {
    --base: #1e1e2e; --mantle: #181825; --crust: #11111b;
    --text: #cdd6f4; --subtext: #a6adc8; --surface: #313244;
    --green: #a6e3a1; --peach: #fab387; --red: #f38ba8; --mauve: #cba6f7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 24px 96px;
    background: var(--crust); color: var(--text);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; font-weight: 600; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .09em; color: var(--subtext); margin: 36px 0 12px; font-weight: 600; }
  h3 { font-size: 15px; margin: 0 0 8px; }
  p.lede { color: var(--subtext); margin: 0 0 8px; max-width: 74ch; }
  .bar { background: var(--base); border-radius: 8px; padding: 12px; overflow-x: auto; }
  .bar svg { display: block; }
  .switches { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; margin: 16px 0 8px; }
  .switches fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: 6px; align-items: center; }
  .switches legend { float: left; margin-right: 8px; color: var(--subtext); font-size: 13px; }
  button {
    font: inherit; font-size: 13px; color: var(--text); background: var(--surface);
    border: 1px solid transparent; border-radius: 6px; padding: 4px 10px; cursor: pointer;
  }
  button:hover { border-color: var(--subtext); }
  button[aria-pressed="true"] { background: var(--mauve); color: var(--crust); }
  .presets { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .preset { background: var(--mantle); border: 1px solid var(--surface); border-radius: 8px; padding: 14px; }
  .preset--conflict { border-color: var(--peach); }
  .preset dl { margin: 0 0 10px; font-size: 13px; }
  .preset dt { color: var(--subtext); font-size: 11px; text-transform: uppercase; letter-spacing: .07em; margin-top: 7px; }
  .preset dd { margin: 2px 0 0; }
  .conflict { color: var(--peach); font-size: 13px; margin: 0 0 10px; }
  .lines { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); }
  .line { background: var(--mantle); border: 1px solid var(--surface); border-radius: 8px; padding: 12px; }
  .line h3 { color: var(--subtext); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
  ul.segments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  ul.segments li { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  ul.segments li.is-off { opacity: .45; }
  ul.segments .name { flex: 1 1 auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  ul.segments .unavailable { color: var(--peach); font-size: 11px; }
  ul.segments button { padding: 1px 7px; }
  select { font: inherit; font-size: 12px; background: var(--surface); color: var(--text); border: 1px solid transparent; border-radius: 5px; padding: 2px 4px; }
  .warnings { margin: 14px 0 0; padding: 0; list-style: none; color: var(--peach); font-size: 14px; }
  .warnings li::before { content: "! "; font-weight: 700; }
  textarea {
    width: 100%; min-height: 190px; background: var(--mantle); color: var(--text);
    border: 1px solid var(--surface); border-radius: 8px; padding: 12px;
    font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical;
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--mantle); padding: 1px 5px; border-radius: 4px; }
  footer { margin-top: 40px; color: var(--subtext); font-size: 13px; max-width: 74ch; }
  .note { color: var(--subtext); font-size: 13px; max-width: 78ch; }
</style>
</head>
<body>
<main>
  <h1>Arrange the statusline</h1>
  <p class="lede">Every bar below is drawn by the renderer itself, from one fixed
  session. Switch segments off, move them between lines, reorder them, then copy
  the arrangement out at the bottom.</p>

  <div class="switches">
    <fieldset id="width-switch"><legend>Width</legend></fieldset>
    <fieldset id="glyph-switch"><legend>Glyphs</legend></fieldset>
    <fieldset><legend>Start over</legend><button type="button" id="reset">Back to today</button></fieldset>
  </div>

  <div class="bar" id="canvas"></div>
  <ul class="warnings" id="warnings"></ul>
  <p class="note" id="basis"></p>

  <h2>Starting points</h2>
  <p class="note">A preset replaces what is on the canvas and stays editable from
  there. Any preset that moves a segment to a line whose subject it does not
  belong to needs Principle II amended before it can become the shipped
  default; only the one marked below leaves the four-line shape itself.</p>
  <div class="presets">
${presetCards}
  </div>

  <h2>Segments</h2>
  <div class="lines" id="lines"></div>

  <h2>Take it with you</h2>
  <p class="note">Write this to <code>~/.claude/statusline/layout.json</code> for
  your own bar everywhere, or to the <code>layout</code> key of a repository's
  <code>.statusline.json</code> for one project. The repository file wins.</p>
  <textarea id="handover" readonly spellcheck="false"></textarea>
  <p><button type="button" id="copy">Copy the arrangement</button> <span id="copied" class="note"></span></p>

  <footer id="footnote"></footer>
</main>

<script type="module">
// The renderer's modules were written for a terminal, and two of them read an
// environment variable in a default parameter. A browser has no process, so
// it gets the smallest one that answers.
globalThis.process = globalThis.process ?? { env: {} };

${modules}

const GLYPHS = ${escapeScript(glyphs)};
const POOLS = ${escapeScript(pools)};
const REGISTRY = ${escapeScript(registry)};
const PRESETS = ${escapeScript(PRESETS)};
const WIDTHS = ${escapeScript(WIDTHS)};
const MISSING_CONTENT = ${escapeScript(missingContent)};
const PALETTE = ${escapeScript(PALETTES.mocha)};
const STORAGE_KEY = "statusline-composer-v1";

const draw = createAnsiToSvg(GLYPHS);

const state = {
  arrangement: { version: 1, name: "today", segments: {} },
  basePreset: "today",
  width: 120,
  glyphs: "nerd",
};

/** What the terminal would print for the arrangement on the canvas. */
function composeAnsi(width, glyphMode, arrangement) {
  const pool = POOLS[glyphMode];
  const byKey = new Map(pool.map((s) => [s.key, s]));
  const resolved = resolveArrangement(REGISTRY, arrangement, "page");
  const rows = [];
  const lines = [];
  for (const line of [1, 2, 3, 4]) {
    const row = placementsForLine(resolved, line)
      .map((p) => {
        const built = byKey.get(p.key);
        return built ? { ...p, ...built } : null;
      })
      .filter(Boolean);
    if (!row.length) continue;
    rows.push(fitToWidth(row, width));
    lines.push(line);
  }
  if (!rows.length) return { ansi: "", lines: [], resolved };
  const aligned = alignColumns(rows, width);
  const ansi = aligned
    .map((row) => renderRow(PALETTE, row, { asciiArrows: glyphMode === "plain" }))
    .join("\\n");
  return { ansi, lines, resolved, rows: aligned };
}

function warningsFor(resolved) {
  const out = [];
  if (!activeKeys(resolved).length) {
    out.push("Every segment is switched off. That is a bar with nothing on it, not a design.");
  }
  const narrow = WIDTHS[0];
  for (const line of [1, 2, 3, 4]) {
    const row = placementsForLine(resolved, line)
      .map((p) => POOLS[state.glyphs].find((s) => s.key === p.key))
      .filter(Boolean);
    if (!row.length) continue;
    const widest = Math.max(...row.map((s) => displayWidth(s.text) + 1));
    if (widest > narrow) {
      out.push(\`Line \${line} holds a segment wider than \${narrow} columns, so that line cannot fit the narrowest terminal this page offers.\`);
    }
  }
  for (const entry of resolved.ignored) {
    out.push(\`Ignored \${entry.what}\${entry.key ? " on " + entry.key : ""}: \${entry.reason}.\`);
  }
  return out;
}

function renderCanvas() {
  const { ansi, lines, resolved } = composeAnsi(state.width, state.glyphs, state.arrangement);
  const canvas = document.getElementById("canvas");
  canvas.textContent = "";
  if (ansi) {
    const holder = document.createElement("div");
    holder.innerHTML = draw(ansi, { title: "the arranged bar" });
    canvas.append(holder.firstElementChild);
  } else {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "Nothing is switched on.";
    canvas.append(empty);
  }

  const warnings = document.getElementById("warnings");
  warnings.textContent = "";
  for (const message of warningsFor(resolved)) {
    const li = document.createElement("li");
    li.textContent = message;
    warnings.append(li);
  }

  // The count is what the bar actually draws, not what the arrangement
  // switched on: a registry row with no render function behind it would
  // otherwise be counted as present on a bar it never appears on.
  const drawing = activeKeys(resolved).filter((key) => POOLS[state.glyphs].some((s) => s.key === key));
  document.getElementById("basis").textContent =
    \`\${lines.length} line\${lines.length === 1 ? "" : "s"} at \${state.width} columns, \` +
    \`drawing \${drawing.length} of the \${POOLS[state.glyphs].length} segments this session has. \` +
    \`Started from the \${state.basePreset} arrangement.\`;

  document.getElementById("handover").value = JSON.stringify(state.arrangement, null, 2);
}

/** The entry for a key, created on demand so the file stays as small as it can. */
function entry(key) {
  state.arrangement.segments[key] = state.arrangement.segments[key] ?? {};
  return state.arrangement.segments[key];
}

/** Drops anything that repeats the default, so the file is only differences. */
function tidy() {
  for (const [key, value] of Object.entries(state.arrangement.segments)) {
    const registryRow = REGISTRY.find((r) => r.key === key);
    if (registryRow) {
      if (value.on === true) delete value.on;
      if (value.line === registryRow.line) delete value.line;
      if (value.order === registryRow.order) delete value.order;
      if (value.align === registryRow.align) delete value.align;
    }
    if (!Object.keys(value).length) delete state.arrangement.segments[key];
  }
}

function placementOf(key) {
  const resolved = resolveArrangement(REGISTRY, state.arrangement, "page");
  return resolved.placements.find((p) => p.key === key);
}

function setLine(key, line) {
  entry(key).line = line;
  changed();
}

function setAlign(key, align) {
  const registryRow = REGISTRY.find((r) => r.key === key);
  if (align === registryRow.align) delete entry(key).align;
  else entry(key).align = align;
  changed();
}

function toggle(key) {
  const on = placementOf(key).on;
  if (on) entry(key).on = false;
  else delete entry(key).on;
  changed();
}

/** Moves a segment one place within its line, by rewriting both orders. */
function move(key, direction) {
  const resolved = resolveArrangement(REGISTRY, state.arrangement, "page");
  const line = resolved.placements.find((p) => p.key === key).line;
  const siblings = resolved.placements.filter((p) => p.line === line);
  const index = siblings.findIndex((p) => p.key === key);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return;
  const reordered = siblings.slice();
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);
  reordered.forEach((placement, position) => {
    entry(placement.key).line = line;
    entry(placement.key).order = (position + 1) * 10;
  });
  changed();
}

/**
 * Everything that follows an edit, and the one place the arrangement is
 * named. A preset keeps its own name until something is actually changed,
 * so a copied file says where it came from rather than always saying "mine".
 */
function changed({ edited = true } = {}) {
  tidy();
  if (edited) state.arrangement.name = "mine";
  save();
  renderSegments();
  renderCanvas();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      arrangement: state.arrangement,
      basePreset: state.basePreset,
      width: state.width,
      glyphs: state.glyphs,
    }));
  } catch {
    // A browser with storage switched off still works; it just forgets.
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved?.arrangement?.version === 1) {
      state.arrangement = saved.arrangement;
      state.basePreset = saved.basePreset ?? "custom";
      if (WIDTHS.includes(saved.width)) state.width = saved.width;
      if (saved.glyphs === "plain" || saved.glyphs === "nerd") state.glyphs = saved.glyphs;
    }
  } catch {
    // A stored value that will not parse is a stored value that is gone.
  }
}

function renderSegments() {
  const resolved = resolveArrangement(REGISTRY, state.arrangement, "page");
  const host = document.getElementById("lines");
  host.textContent = "";
  for (const line of [1, 2, 3, 4]) {
    const box = document.createElement("section");
    box.className = "line";
    const heading = document.createElement("h3");
    heading.textContent = "Line " + line;
    box.append(heading);

    const list = document.createElement("ul");
    list.className = "segments";
    const members = resolved.placements.filter((p) => p.line === line);
    for (const placement of members) {
      const li = document.createElement("li");
      if (!placement.on) li.classList.add("is-off");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = placement.on;
      check.id = "seg-" + placement.key;
      check.addEventListener("change", () => toggle(placement.key));

      const label = document.createElement("label");
      label.className = "name";
      label.htmlFor = check.id;
      label.textContent = placement.key;

      li.append(check, label);

      if (MISSING_CONTENT.includes(placement.key)) {
        const note = document.createElement("span");
        note.className = "unavailable";
        note.textContent = "no content";
        note.title = "The registry declares this segment but no render function builds it.";
        li.append(note);
      }

      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "\\u2191";
      up.title = "Earlier on this line";
      up.addEventListener("click", () => move(placement.key, -1));

      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "\\u2193";
      down.title = "Later on this line";
      down.addEventListener("click", () => move(placement.key, 1));

      const lineSelect = document.createElement("select");
      lineSelect.title = "Which line";
      for (const candidate of [1, 2, 3, 4]) {
        const option = document.createElement("option");
        option.value = String(candidate);
        option.textContent = "L" + candidate;
        option.selected = candidate === placement.line;
        lineSelect.append(option);
      }
      lineSelect.addEventListener("change", () => setLine(placement.key, Number(lineSelect.value)));

      const alignSelect = document.createElement("select");
      alignSelect.title = "Which edge";
      for (const candidate of ["left", "right"]) {
        const option = document.createElement("option");
        option.value = candidate;
        option.textContent = candidate === "left" ? "\\u21e4" : "\\u21e5";
        option.selected = candidate === placement.align;
        alignSelect.append(option);
      }
      alignSelect.addEventListener("change", () => setAlign(placement.key, alignSelect.value));

      li.append(up, down, lineSelect, alignSelect);
      list.append(li);
    }
    if (!members.length) {
      const empty = document.createElement("li");
      empty.className = "note";
      empty.textContent = "nothing here";
      list.append(empty);
    }
    box.append(list);
    host.append(box);
  }
}

function buildSwitches() {
  const widthHost = document.getElementById("width-switch");
  for (const width of WIDTHS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = width + " cols";
    button.dataset.width = String(width);
    button.addEventListener("click", () => {
      state.width = width;
      save();
      paintSwitches();
      renderCanvas();
    });
    widthHost.append(button);
  }

  const glyphHost = document.getElementById("glyph-switch");
  for (const [mode, label] of [["nerd", "Nerd Font"], ["plain", "Plain text"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.glyphs = mode;
    button.addEventListener("click", () => {
      state.glyphs = mode;
      save();
      paintSwitches();
      renderCanvas();
    });
    glyphHost.append(button);
  }
}

function paintSwitches() {
  for (const button of document.querySelectorAll("[data-width]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.width) === state.width));
  }
  for (const button of document.querySelectorAll("[data-glyphs]")) {
    button.setAttribute("aria-pressed", String(button.dataset.glyphs === state.glyphs));
  }
}

function loadPreset(id) {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) return;
  state.arrangement = JSON.parse(JSON.stringify(found.arrangement));
  state.basePreset = id;
  changed({ edited: false });
}

for (const button of document.querySelectorAll("[data-load]")) {
  button.addEventListener("click", () => loadPreset(button.dataset.load));
}

document.getElementById("reset").addEventListener("click", () => loadPreset("today"));

document.getElementById("copy").addEventListener("click", async () => {
  const text = document.getElementById("handover").value;
  const said = document.getElementById("copied");
  try {
    await navigator.clipboard.writeText(text);
    said.textContent = "copied";
  } catch {
    const field = document.getElementById("handover");
    field.removeAttribute("readonly");
    field.select();
    said.textContent = "select and copy";
  }
  setTimeout(() => { said.textContent = ""; }, 4000);
});

document.getElementById("footnote").textContent =
  "This page draws with the renderer's own layout, palette and Powerline code, " +
  "over the segment values of one fixed session. What it shows at a given width " +
  "is what the terminal prints at that width, with one exception: when line 4 " +
  "overflows, the terminal drops two countdown labels before it drops a segment, " +
  "and the page does not.";

restore();
buildSwitches();
paintSwitches();
renderSegments();
renderCanvas();
</script>
</body>
</html>
`;

writeFileSync(OUT, page);
console.log(
  `composer: ${path.relative(ROOT, OUT)} — ${PRESETS.length} presets, ` +
    `${pools.nerd.length} segments, ${WIDTHS.join("/")} columns` +
    (missingContent.length ? `, ${missingContent.length} registry row(s) with no content: ${missingContent.join(", ")}` : "")
);
