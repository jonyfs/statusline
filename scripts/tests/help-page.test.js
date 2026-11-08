import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { test, stripAnsi } from "../test-harness.js";
import { renderPayload, HELP_PAGE } from "../../src/render.js";
import { SEGMENTS } from "../../src/segments.js";
import { emptySources, fullPayload } from "./fixtures/sources.js";

// specs/078-help-page: the page the `?` at the right end of line 3 opens.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HELP = path.join(ROOT, "help");
const LANGS = ["en", "pt-BR", "fr", "es"];

/** The page's own scripts, run as the browser runs them, into one sandbox. */
function loadI18n() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of [...LANGS.map((l) => `locales/${l}.js`), "lang.js"]) vm.runInContext(readFileSync(path.join(HELP, f), "utf8"), sandbox);
  return sandbox.HELP_I18N;
}
const leaves = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

await test("every segment has a title and an explanation in all four languages, and no language has a key the others lack", () => {
  const H = loadI18n();
  assert.deepEqual(Object.keys(H.resources).sort(), [...LANGS].sort());
  const en = new Map(leaves(H.resources.en.translation));
  for (const s of SEGMENTS) {
    assert.ok(typeof H.resources.en.translation.src[s.source] === "string", `no label for the source ${s.source}`);
    for (const lang of LANGS) {
      const seg = H.resources[lang].translation.seg[s.key];
      assert.ok(seg?.t && seg?.b && seg.b.length > 40, `${lang} has no full entry for ${s.key}`);
    }
  }
  for (const lang of LANGS) {
    const keys = leaves(H.resources[lang].translation).map(([k]) => k).sort();
    assert.deepEqual(keys, [...en.keys()].sort(), `${lang} keys differ from English`);
    const segKeys = Object.keys(H.resources[lang].translation.seg).sort();
    assert.deepEqual(segKeys, SEGMENTS.map((s) => s.key).sort(), `${lang} explains a segment the registry does not have`);
  }
});

await test("the language is the query, then the stored choice, then the browser's, and English otherwise", () => {
  const H = loadI18n();
  assert.equal(H.pickLanguage(["fr-CA", "en"], null, null), "fr");
  assert.equal(H.pickLanguage(["pt-PT"], null, null), "pt-BR");
  assert.equal(H.pickLanguage(["pt"], null, null), "pt-BR");
  assert.equal(H.pickLanguage(["es-MX"], null, null), "es");
  assert.equal(H.pickLanguage(["de-DE", "ja"], null, null), "en");
  assert.equal(H.pickLanguage(["de-DE", "es"], null, null), "es", "the first supported of the browser's languages");
  assert.equal(H.pickLanguage(["fr"], "es", null), "es", "a stored choice wins over the browser");
  assert.equal(H.pickLanguage(["fr"], "es", "pt-BR"), "pt-BR", "the query wins over both");
  assert.equal(H.normalize("de-DE"), "de-de", "an unsupported code goes back as a string for the detector to skip");
});

await test("the page reaches for nothing outside its folder and carries no third-party branding", () => {
  const html = readFileSync(path.join(HELP, "index.html"), "utf8");
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0]);
  assert.deepEqual(urls, [], `the page references ${urls.join(", ")}`);
  assert.doesNotMatch(html, /\bfetch\(|@import|<link[^>]+stylesheet/i);
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(!src.includes("//") && existsSync(path.join(HELP, src)), `script ${src} is not a file beside the page`);
  }
  assert.ok(existsSync(path.join(HELP, "vendor", "LICENSE-i18next")) && existsSync(path.join(HELP, "vendor", "LICENSE-i18next-browser-languagedetector")), "the vendored libraries keep their licences");
});

await test("the page regenerates to the same bytes, with a card for every segment", () => {
  const before = readFileSync(path.join(HELP, "index.html"), "utf8");
  const run = spawnSync(process.execPath, [path.join(ROOT, "scripts", "generate-help.js")], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const after = readFileSync(path.join(HELP, "index.html"), "utf8");
  assert.equal(after, before, "help/index.html is stale: run node scripts/generate-help.js");
  for (const s of SEGMENTS) assert.ok(after.includes(`id="seg-${s.key}"`), `no card for ${s.key}`);
  // The English text is in the page before any script runs.
  assert.match(after, /<h3 data-i18n="seg\.context\.t">Context window<\/h3>/);
  assert.doesNotMatch(after, /data-i18n="[^"]+"[^>]*><\/(p|h2|h3|li|span|a)>/, "an element is left empty until a script runs");
});

await test("line 3 ends with the help chip, right-aligned and linked to the page on disk", () => {
  const src = { ...emptySources, getHelpPage: () => HELP_PAGE };
  const out = renderPayload(fullPayload(), { sources: src, trackChanges: false, maxWidth: 160, maxHeight: 40 });
  const line3 = out.split("\n").pop();
  assert.match(line3, /\x1b\]8;;https:\/\/jonyfs\.github\.io\/statusline\/\x07/, "the chip links to the published page, which a terminal opens in the browser");
  // Only the separator that closes the line may follow it.
  assert.match(stripAnsi(line3).trimEnd(), /\u{F059}\s*[\uE0B0-\uE0BF>]?$/u, "the help glyph is the last thing on the line");
  const without = stripAnsi(renderPayload(fullPayload(), { sources: emptySources, trackChanges: false, maxWidth: 160, maxHeight: 40 }));
  assert.doesNotMatch(without, /\u{F059}/u, "a copy without the page draws no chip");
  assert.ok(existsSync(HELP_PAGE), "the page ships beside the code");
});
