#!/usr/bin/env node
/**
 * Renders the preview SVGs to PNG for places that cannot display SVG.
 *
 *   node scripts/generate-article-images.js
 *
 * Medium is the reason this exists: its editor does not render SVG, and
 * its image side-loading wants a raster URL. Committing the PNGs gives
 * them stable raw.githubusercontent addresses that Medium can fetch.
 *
 * These deliberately live in docs/images/ rather than docs/previews/.
 * The previews are checked for staleness in CI, and that check only
 * works because their generation is byte-reproducible. PNG rasterisation
 * is not: it depends on the installed Chrome build and the host's font
 * rendering, so the same SVG produces different bytes on a CI runner
 * than it does here. Keeping them apart stops a cosmetic difference in
 * font hinting from failing an unrelated build.
 *
 * Requires Chrome, which is why it is a separate on-demand script rather
 * than part of `generate-previews.js`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs", "previews");
const OUT = path.join(ROOT, "docs", "images");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findChrome() {
  for (const c of [process.env.CHROME_PATH, ...CHROME_CANDIDATES].filter(Boolean)) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    "No Chrome or Chromium found. Set CHROME_PATH to its executable, or install one."
  );
}

function dimensions(svgPath) {
  const svg = readFileSync(svgPath, "utf8");
  const w = svg.match(/width="(\d+)"/);
  const h = svg.match(/height="(\d+)"/);
  if (!w || !h) throw new Error(`${path.basename(svgPath)} has no width/height`);
  return [Number(w[1]), Number(h[1])];
}

function main() {
  const chrome = findChrome();
  mkdirSync(OUT, { recursive: true });

  const svgs = readdirSync(SRC).filter((f) => f.endsWith(".svg")).sort();
  for (const svg of svgs) {
    const src = path.join(SRC, svg);
    const [w, h] = dimensions(src);
    const target = path.join(OUT, svg.replace(/\.svg$/, ".png"));
    execFileSync(
      chrome,
      [
        "--headless",
        "--disable-gpu",
        // 2x so the line stays legible on a high-density screen, which is
        // where most people will read it.
        "--force-device-scale-factor=2",
        `--screenshot=${target}`,
        `--window-size=${w},${h}`,
        `file://${src}`,
      ],
      { stdio: "ignore" }
    );
    console.log(`  ${path.basename(target)}  ${w * 2}x${h * 2}`);
  }
  console.log(`\n${svgs.length} images written to docs/images/`);
}

main();
