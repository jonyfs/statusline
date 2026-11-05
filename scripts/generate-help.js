#!/usr/bin/env node
/**
 * Builds help/index.html (specs/078-help-page): the page the `?` at the right
 * end of line 3 opens.
 *
 * Generated rather than written by hand, as the composer page is, so it
 * cannot drift from the registry: every segment in `SEGMENTS` gets a card,
 * drawn as the bar draws it (the mocha palette, the powerline arrow, the real
 * Nerd Font glyph as an inline SVG outline). The words live in
 * help/locales/*.js, one file per language, and i18next (vendored in
 * help/vendor) picks the language: the `?lng=` query, then the reader's last
 * choice, then the browser's languages, and English when none of them is
 * one of the four. The page is opened from disk, so it loads nothing from the
 * network and fetches nothing: every script is a relative `<script src>`.
 *
 *   node scripts/generate-help.js
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEGMENTS } from "../src/segments.js";
import { GLYPHS } from "../src/render.js";
import { PALETTES } from "../src/theme.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "help", "index.html");
const TABLE = JSON.parse(readFileSync(path.join(ROOT, "src", "preview", "glyphs.json"), "utf8"));
const P = PALETTES.mocha;
const G = GLYPHS.nerd;

/**
 * What each chip looks like on the bar, as [role, glyph name or null, text].
 * The text is illustrative; the page says so beside it.
 */
const EXAMPLES = {
  dir: [["neutral", "dir", "statusline"]],
  projectDir: [["neutral", "from", "app"]],
  repo: [["neutral", "repo", "owner/project"]],
  branch: [["identity", "branch", "f/help-page"]],
  worktree: [["neutral", "worktree", "review", "from main"]],
  conflicts: [["critical", "conflict", "2"]],
  worktreeState: [["neutral", "modified", "3  ", "push", "1"]],
  branchAge: [["neutral", "calendar", "14d"]],
  linesChanged: [["neutral", "added", "+214 −87"]],
  pr: [["open", "pr", "PR #81", "reviewApproved", "approved"]],
  prMerge: [["critical", null, "blocked · automerge"]],
  prChecks: [["neutral", "ciPass", "5 ", "ciFail", "1 · lint"]],
  prReview: [["open", "account", "2 awaiting · 3 threads"]],
  prSize: [["neutral", null, "+412 −87 · 23f · 2d"]],
  ci: [["neutral", "ciPass", "CI"]],
  alerts: [["attention", "conflict", "alerts 2"]],
  gates: [["attention", "gateRunning", "2 gates"]],
  update: [["neutral", "updateReady", ""]],
  skills: [["skills", "skills", "ship 12m  ✓ review · 7 used"]],
  todo: [["cold", "todo", "3/8"]],
  activity: [["neutral", "workingFrame0", "working · 2 bg"]],
  permissionMode: [["attention", "allowAll", "auto"]],
  toolCalls: [["neutral", "working", "tools 42"]],
  mcp: [["neutral", "mcp", "mcp 4"]],
  vim: [["neutral", "vim", "NORMAL"]],
  account: [["identity", "account", "Acme"]],
  model: [["identity", "model", "Opus 5.5"]],
  effort: [["neutral", "effortHigh", "high"]],
  fastMode: [["neutral", "fast", "fast"]],
  allowAll: [["attention", "allowAll", "allow all"]],
  context: [["critical", "context", "81% · 200k+ · 12m"]],
  fiveHour: [["neutral", "timer", "5h 62% ", "reset", "2h09"]],
  premiumQuota: [["neutral", "premium", "month premium 41% · sep 1"]],
  burnRate: [["neutral", "burn", "35%/h full ~13:05"]],
  codexWindow: [["neutral", "calendar", "30d 15% · sep 13"]],
  sevenDay: [["neutral", "calendar", "7d 77% ", "reset", "thu 18:00"]],
  sevenDayRate: [["neutral", "burn", "+3%/d"]],
  weeklyModels: [["neutral", "calendar", "opus 40% · sonnet 12%"]],
  chatQuota: [["neutral", "premium", "month chat 12% · sep 1"]],
  spendLimit: [["neutral", "spend", "spend 63% ", "reset", "4d"]],
  usageCredits: [["neutral", "spend", "11% · +0.4%/h ", "reset", "~dec 1 00:00"]],
  spendPace: [["money", "spend", "$27.5/d left · avg $8.95/d"]],
  codexCredits: [["money", "spend", "credits 12.5"]],
  promptCache: [["cold", "cacheCold", "184k"]],
  cacheHit: [["neutral", "cacheWarm", "82%"]],
  duration: [["neutral", "duration", "1h04"]],
  sessionTokens: [["money", null, "Σ 1.2M · ↑3.1k/min · agents 420k"]],
  aiCredits: [["neutral", "spend", "4.20/20 AIC · 21%"]],
  premiumRequests: [["neutral", "premium", "3 premium"]],
  rtk: [["money", "rtk", "81%"]],
  help: [["neutral", "help", ""]],
};

/** The bar at the top of the page: three lines, as a credits seat sees it. */
const SAMPLE = [
  [["neutral", "dir", "statusline"], ["identity", "branch", "f/help-page"], ["open", "pr", "PR #81"], ["critical", null, "blocked"], ["neutral", "ciPass", "CI"]],
  [["skills", "skills", "ship 12m"], ["cold", "todo", "3/8"], ["neutral", "workingFrame0", "working"], ["attention", "allowAll", "auto"], ["neutral", "working", "tools 42"]],
  [["identity", "account", "Acme"], ["identity", "model", "Opus 5.5"], ["neutral", "effortHigh", "high"], ["neutral", "context", "46%"], ["neutral", "spend", "11% · +0.4%/h"], ["neutral", "cacheWarm", "82%"], ["money", "rtk", "81%"], ["neutral", "help", "", "right"]],
];

const LINE_KEYS = { 1: "line1", 2: "line2", 3: "line3" };

const hex = (glyphName) => {
  const ch = G[glyphName];
  if (!ch) return null;
  return ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
};
const used = new Set();
const icon = (glyphName, extra = "") => {
  const h = hex(glyphName);
  if (!h || !TABLE.glyphs[h]) return "";
  used.add(h);
  return `<svg class="g${extra}" aria-hidden="true"><use href="#g${h}"/></svg>`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** One chip: a role, then glyph/text pairs. */
function chip(parts) {
  const [role, ...rest] = parts;
  const right = rest[rest.length - 1] === "right";
  const items = right ? rest.slice(0, -1) : rest;
  let inner = "";
  for (let i = 0; i < items.length; i += 2) {
    const glyph = items[i];
    const text = items[i + 1] ?? "";
    inner += (glyph ? icon(glyph, role === "neutral" ? " ok" : "") : "") + (text ? `<span>${esc(text)}</span>` : "");
  }
  return `<span class="chip ${role}${right ? " right" : ""}">${inner}</span>`;
}

function card(key) {
  const ex = EXAMPLES[key];
  if (!ex) throw new Error(`no example for segment ${key}`);
  return `<article class="seg" id="seg-${key}">
  <div class="demo"><span class="bar">${ex.map(chip).join("")}</span></div>
  <div class="text"><h3 data-i18n="seg.${key}.t"></h3><p data-i18n="seg.${key}.b"></p><code class="key">${key}</code></div>
</article>`;
}

const byLine = (line) => SEGMENTS.filter((s) => s.line === line).sort((a, b) => a.order - b.order).map((s) => s.key);

const sections = [1, 2, 3]
  .map((line) => {
    const k = LINE_KEYS[line];
    return `<section id="${k}"><h2 data-i18n="${k}.title"></h2><p class="intro" data-i18n="${k}.intro"></p>${byLine(line).map(card).join("\n")}</section>`;
  })
  .join("\n");

const states = ["dash", "question", "off", "tilde", "age", "emphasis"].map((k) => `<li data-i18n="states.${k}"></li>`).join("");
const switches = ["LABELS", "AMOUNTS", "ACCOUNT", "RESET", "CREDITS_RESET", "SESSION_SHARE", "MODEL_TIER", "OMIT", "ICONS", "FLAVOR"]
  .map((k) => `<li data-i18n="switches.${k}"></li>`)
  .join("");

const sample = SAMPLE.map((line) => `<div class="bar">${line.map(chip).join("")}</div>`).join("\n");

const symbols = [...used]
  .sort()
  .map((h) => {
    const g = TABLE.glyphs[h];
    return `<symbol id="g${h}" viewBox="0 -1560 ${g.advance} ${TABLE.unitsPerEm}"><path transform="scale(1,-1)" d="${g.path}"/></symbol>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statusline help</title>
<meta name="color-scheme" content="dark">
<style>
/* The bar's own palette (Catppuccin mocha) and its powerline chips. Generated by scripts/generate-help.js. */
:root {
  --crust: ${P.crust}; --mantle: ${P.mantle}; --base: ${P.base}; --surface0: ${P.surface0}; --surface1: ${P.surface1}; --surface2: ${P.surface2};
  --text: ${P.text}; --subtext: #a6adc8; --overlay: #6c7086;
  --red: ${P.red}; --peach: ${P.peach}; --yellow: ${P.yellow}; --green: ${P.green}; --sapphire: ${P.sapphire}; --blue: ${P.blue};
  --lavender: ${P.lavender}; --mauve: ${P.mauve}; --flamingo: ${P.flamingo}; --teal: ${P.teal};
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--base); color: var(--text); font-family: var(--mono); font-size: 14px; line-height: 1.6; padding: 0 max(16px, env(safe-area-inset-left, 0px)) 64px max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 980px; margin: 0 auto; }
header { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 22px 0 12px; border-bottom: 1px solid var(--surface0); }
h1 { font-size: 22px; margin: 0; color: var(--lavender); font-weight: 600; }
.sub { color: var(--subtext); margin: 6px 0 0; max-width: 70ch; }
label.lang { display: flex; gap: 8px; align-items: center; color: var(--subtext); font-size: 13px; }
select { font: inherit; background: var(--mantle); color: var(--text); border: 1px solid var(--surface1); border-radius: 4px; padding: 4px 8px; }
select:focus-visible, a:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.term { background: var(--crust); border: 1px solid var(--surface0); border-radius: 6px; padding: 10px 12px; margin: 20px 0; overflow-x: auto; }
nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
nav a { color: var(--blue); text-decoration: none; font-size: 12px; padding: 2px 8px; background: var(--surface0); border-radius: 3px; }
h2 { font-size: 16px; color: var(--lavender); margin: 34px 0 6px; font-weight: 600; }
h3 { font-size: 14px; margin: 0 0 2px; font-weight: 600; }
p, li { max-width: 78ch; }
.intro { color: var(--subtext); }
ul { padding-left: 1.2em; }
code { background: var(--mantle); border: 1px solid var(--surface0); border-radius: 3px; padding: 0 4px; font-family: var(--mono); font-size: 13px; color: var(--flamingo); }
code.key { display: inline-block; margin-top: 4px; color: var(--overlay); background: none; border: 0; padding: 0; font-size: 11px; }
.bar { display: flex; align-items: stretch; white-space: nowrap; height: 1.8em; margin: 3px 0; }
.chip { display: inline-flex; align-items: center; gap: .45em; padding: 0 .55em 0 .5em; background: var(--c, var(--surface0)); color: var(--fg, var(--crust)); position: relative; }
.chip + .chip { margin-left: .95em; }
.chip::after { content: ""; position: absolute; left: 100%; top: 0; bottom: 0; border-left: .9em solid var(--c, var(--surface0)); border-top: .9em solid transparent; border-bottom: .9em solid transparent; }
.chip.right { margin-left: auto; }
.chip.neutral { --c: var(--surface0); --fg: var(--text); }
.chip.identity { --c: var(--lavender); } .chip.money { --c: var(--teal); } .chip.open { --c: var(--blue); }
.chip.merged { --c: var(--mauve); } .chip.attention { --c: var(--peach); } .chip.critical { --c: var(--red); }
.chip.cold { --c: var(--sapphire); } .chip.skills { --c: var(--flamingo); }
.g { width: 1.05em; height: 1.05em; fill: currentColor; flex: none; }
.chip.neutral .g.ok { fill: var(--green); }
.seg { display: grid; grid-template-columns: minmax(12em, 22em) 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--surface0); }
.seg .demo { min-width: 0; overflow-x: auto; }
.seg .text { min-width: 0; }
.seg p { margin: 0; color: var(--text); }
footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--surface0); color: var(--overlay); font-size: 12px; }
@media (max-width: 720px) { .seg { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols}</svg>
<main>
<header>
  <div><h1 data-i18n="ui.title">Statusline help</h1><p class="sub" data-i18n="ui.subtitle"></p></div>
  <label class="lang"><span data-i18n="ui.language">Language</span>
    <select id="lang"><option value="en">English</option><option value="pt-BR">Português (Brasil)</option><option value="fr">Français</option><option value="es">Español</option></select>
  </label>
</header>
<div class="term">${sample}</div>
<nav aria-label="contents"><a href="#read" data-i18n="read.title"></a><a href="#states" data-i18n="states.title"></a><a href="#line1" data-i18n="line1.title"></a><a href="#line2" data-i18n="line2.title"></a><a href="#line3" data-i18n="line3.title"></a><a href="#rows" data-i18n="rows.title"></a><a href="#switches" data-i18n="switches.title"></a></nav>
<section id="read"><h2 data-i18n="read.title"></h2><p data-i18n="read.p1"></p><p data-i18n="read.p2"></p><p data-i18n="read.p3"></p><p data-i18n="read.p4"></p><p data-i18n="read.p5"></p></section>
<section id="states"><h2 data-i18n="states.title"></h2><ul>${states}</ul></section>
${sections}
<section id="rows"><h2 data-i18n="rows.title"></h2><p data-i18n="rows.agents"></p><p data-i18n="rows.gates"></p></section>
<section id="switches"><h2 data-i18n="switches.title"></h2><p class="intro" data-i18n="switches.intro"></p><ul>${switches}</ul></section>
<footer data-i18n="ui.footer"></footer>
</main>
<script src="vendor/i18next.min.js"></script>
<script src="vendor/i18nextBrowserLanguageDetector.min.js"></script>
<script src="locales/en.js"></script>
<script src="locales/pt-BR.js"></script>
<script src="locales/fr.js"></script>
<script src="locales/es.js"></script>
<script src="lang.js"></script>
<script>
(function () {
  var H = window.HELP_I18N;
  // Text with \`code\` in backticks, built as nodes so no translation is ever parsed as HTML.
  function fill(el, text) {
    el.textContent = "";
    String(text).split("\`").forEach(function (part, i) {
      if (i % 2) { var c = document.createElement("code"); c.textContent = part; el.appendChild(c); }
      else if (part) el.appendChild(document.createTextNode(part));
    });
  }
  function render() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) { fill(el, i18next.t(el.getAttribute("data-i18n"))); });
    document.documentElement.lang = i18next.resolvedLanguage || "en";
    document.title = i18next.t("ui.title");
    document.getElementById("lang").value = i18next.resolvedLanguage || "en";
  }
  i18next.use(i18nextBrowserLanguageDetector).init({
    resources: H.resources,
    supportedLngs: H.SUPPORTED,
    fallbackLng: "en",
    nonExplicitSupportedLngs: false,
    detection: { order: ["querystring", "localStorage", "navigator"], lookupQuerystring: "lng", lookupLocalStorage: "statuslineHelpLng", caches: ["localStorage"], convertDetectedLanguage: H.normalize },
    interpolation: { escapeValue: false },
  }, render);
  document.getElementById("lang").addEventListener("change", function (e) {
    try { localStorage.setItem("statuslineHelpLng", e.target.value); } catch (err) {}
    i18next.changeLanguage(e.target.value, render);
  });
})();
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`wrote ${path.relative(ROOT, OUT)} (${html.length} bytes, ${used.size} glyphs)`);
