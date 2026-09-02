import { readFileSync } from "node:fs";

const GLYPHS = JSON.parse(
  readFileSync(new URL("./glyphs.json", import.meta.url), "utf8")
);

// Nerd Font private-use codepoints are drawn as extracted outlines rather
// than text, because no viewer (GitHub included) has a Nerd Font installed.
// Emoji are left as <text>: they're normal Unicode and every platform's
// system emoji font renders them, in color.
const NF_CODEPOINTS = new Set(
  Object.keys(GLYPHS.glyphs).map((hex) => parseInt(hex, 16))
);

/**
 * Private use: where every Nerd Font glyph lives. Three ranges, not one.
 * The Octicons sit in the Basic Multilingual Plane's area, but the Material
 * Design set is mapped into supplementary plane 15, and a check that stopped
 * at U+F8FF let those through to be written out as text — which is a viewer
 * with no Nerd Font seeing tofu, the exact failure this guard exists for.
 */
const isPrivateUse = (cp) =>
  (cp >= 0xe000 && cp <= 0xf8ff) ||
  (cp >= 0xf0000 && cp <= 0xffffd) ||
  (cp >= 0x100000 && cp <= 0x10fffd);

const CELL_W = 9.8;
const CELL_H = 22;
const FONT_SIZE = 16;
const BASELINE = 16;
const PAD_X = 10;
const PAD_Y = 10;
const ROW_GAP = 3;

/** Emoji and other wide glyphs occupy two terminal cells. */
function charWidth(cp) {
  if (
    (cp >= 0x1f300 && cp <= 0x1faff) || // pictographs, symbols, extended
    (cp >= 0x2600 && cp <= 0x27bf) ||   // misc symbols + dingbats
    (cp >= 0x1f000 && cp <= 0x1f2ff)
  ) {
    return 2;
  }
  return 1;
}

/**
 * Parses truecolor SGR sequences and OSC 8 hyperlinks into styled runs.
 * Anything else is passed through as literal text.
 */
function parseAnsi(line) {
  const runs = [];
  let fg = null;
  let bg = null;
  let url = null;
  let buf = "";

  const flush = () => {
    if (buf) {
      runs.push({ text: buf, fg, bg, url });
      buf = "";
    }
  };

  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    if (ch === "\x1b" && line[i + 1] === "[") {
      const end = line.indexOf("m", i);
      if (end === -1) break;
      flush();
      const parts = line.slice(i + 2, end).split(";");
      if (parts[0] === "0") {
        fg = null;
        bg = null;
      } else if (parts[0] === "38" && parts[1] === "2") {
        fg = `rgb(${parts[2]},${parts[3]},${parts[4]})`;
      } else if (parts[0] === "48" && parts[1] === "2") {
        bg = `rgb(${parts[2]},${parts[3]},${parts[4]})`;
      }
      i = end + 1;
      continue;
    }

    if (ch === "\x1b" && line[i + 1] === "]" && line.slice(i + 2, i + 4) === "8;") {
      const end = line.indexOf("\x07", i);
      if (end === -1) break;
      flush();
      const target = line.slice(i + 4, end);
      url = target || null;
      i = end + 1;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
  return runs;
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A private-use codepoint with no embedded outline cannot be drawn, and it
 * must not be written out as text either: Principle VIII requires these SVGs
 * to render for a viewer with no Nerd Font, and a raw private-use character
 * shows them tofu. That is what happened to the commit icon on a detached
 * HEAD, which shipped in a preview as an invisible character.
 */
function missingGlyphMessage(hex) {
  return (
    `No outline for U+${hex} in src/preview/glyphs.json. Add it to the ` +
    "CODEPOINTS map in scripts/extract-glyphs.py and regenerate, or the " +
    "preview ships a character most viewers cannot render."
  );
}

/**
 * Renders one Nerd Font glyph as a scaled path. Font outlines are
 * y-up from the baseline, SVG is y-down, hence the negative y scale.
 */
function glyphPath(cp, x, baselineY, fill) {
  const hex = cp.toString(16).toUpperCase().padStart(4, "0");
  const g = GLYPHS.glyphs[hex];
  if (!g) throw new Error(missingGlyphMessage(hex));
  const scale = FONT_SIZE / GLYPHS.unitsPerEm;
  return (
    `<path d="${g.path}" fill="${fill}" ` +
    `transform="translate(${x.toFixed(2)} ${baselineY.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})"/>`
  );
}

/**
 * Converts the statusline's real ANSI output into a standalone SVG that
 * renders identically for viewers with no Nerd Font and no terminal.
 */
export function ansiToSvg(ansi, { title = "", background = "#1e1e2e" } = {}) {
  const lines = ansi.split("\n").filter((l) => l.length > 0);

  let maxCells = 0;
  const parsed = lines.map((line) => {
    const runs = parseAnsi(line);
    let cells = 0;
    for (const run of runs) {
      for (const ch of run.text) cells += charWidth(ch.codePointAt(0));
    }
    maxCells = Math.max(maxCells, cells);
    return runs;
  });

  const titleH = title ? 26 : 0;
  const width = Math.ceil(maxCells * CELL_W + PAD_X * 2);
  const height = Math.ceil(
    lines.length * (CELL_H + ROW_GAP) - ROW_GAP + PAD_Y * 2 + titleH
  );

  const body = [];
  body.push(
    `<rect width="${width}" height="${height}" rx="8" fill="${background}"/>`
  );

  if (title) {
    body.push(
      `<text x="${PAD_X}" y="18" font-family="-apple-system,Segoe UI,system-ui,sans-serif" ` +
        `font-size="12" fill="#9399b2">${escapeXml(title)}</text>`
    );
  }

  parsed.forEach((runs, rowIdx) => {
    const rowTop = PAD_Y + titleH + rowIdx * (CELL_H + ROW_GAP);
    const baseline = rowTop + BASELINE;
    let cellX = 0;

    for (const run of runs) {
      const chars = [...run.text];
      const runCells = chars.reduce(
        (n, ch) => n + charWidth(ch.codePointAt(0)),
        0
      );

      if (run.bg) {
        body.push(
          `<rect x="${(PAD_X + cellX * CELL_W).toFixed(2)}" y="${rowTop}" ` +
            `width="${(runCells * CELL_W).toFixed(2)}" height="${CELL_H}" fill="${run.bg}"/>`
        );
      }

      // Each character is placed at the centre of its own cell span rather
      // than letting a run of text flow. Viewers substitute different
      // monospace fonts (Menlo, Consolas, ...) whose advance widths don't
      // match this grid, and letting text flow makes that mismatch
      // accumulate until later segments drift off the canvas.
      let localX = cellX;
      for (const ch of chars) {
        const cp = ch.codePointAt(0);
        const w = NF_CODEPOINTS.has(cp) ? 1 : charWidth(cp);
        const fill = run.fg || "#cdd6f4";

        if (NF_CODEPOINTS.has(cp)) {
          body.push(glyphPath(cp, PAD_X + localX * CELL_W, baseline, fill));
        } else if (isPrivateUse(cp)) {
          throw new Error(missingGlyphMessage(cp.toString(16).toUpperCase().padStart(4, "0")));
        } else if (ch.trim()) {
          const centre = PAD_X + (localX + w / 2) * CELL_W;
          body.push(
            `<text x="${centre.toFixed(2)}" y="${baseline}" text-anchor="middle" ` +
              `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" ` +
              `font-size="${FONT_SIZE}" fill="${fill}">${escapeXml(ch)}</text>`
          );
        }
        localX += w;
      }
      cellX = localX;
    }
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title || "statusline preview")}">\n` +
    body.join("\n") +
    `\n</svg>\n`
  );
}
