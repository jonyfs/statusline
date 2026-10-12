import { WIDE } from "./data/wide.js";
import { chipColours, contrastRatio, lightenOklch, toOklch } from "./contrast.js";

export const PALETTES = {
  mocha: {
    crust: "#11111b", mantle: "#181825", base: "#1e1e2e",
    surface1: "#45475a", surface2: "#585b70", text: "#cdd6f4",
    red: "#f38ba8", peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
    sapphire: "#74c7ec", blue: "#89b4fa", lavender: "#b4befe", mauve: "#cba6f7",
    flamingo: "#f2cdcd", teal: "#94e2d5", pink: "#f5c2e7",
  },
  frappe: {
    crust: "#232634", mantle: "#292c3c", base: "#303446",
    surface1: "#51576d", surface2: "#626880", text: "#c6d0f5",
    red: "#e78284", peach: "#ef9f76", yellow: "#e5c890", green: "#a6d189",
    sapphire: "#85c1dc", blue: "#8caaee", lavender: "#babbf1", mauve: "#ca9ee6",
    flamingo: "#eebebe", teal: "#81c8be", pink: "#f4b8e4",
  },
  macchiato: {
    crust: "#181926", mantle: "#1e2030", base: "#24273a",
    surface1: "#494d64", surface2: "#5b6078", text: "#cad3f5",
    red: "#ed8796", peach: "#f5a97f", yellow: "#eed49f", green: "#a6da95",
    sapphire: "#7dc4e4", blue: "#8aadf4", lavender: "#b7bdf8", mauve: "#c6a0f6",
    flamingo: "#f0c6c6", teal: "#8bd5ca", pink: "#f5bde6",
  },
  latte: {
    crust: "#dce0e8", mantle: "#e6e9ef", base: "#eff1f5",
    surface1: "#bcc0cc", surface2: "#acb0be", text: "#4c4f69",
    red: "#d20f39", peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b",
    sapphire: "#209fb5", blue: "#1e66f5", lavender: "#7287fd", mauve: "#8839ef",
    flamingo: "#dd7878", teal: "#179299", pink: "#ea76cb",
  },

  // Two palettes from outside Catppuccin, allowed by the v4.0.0 amendment to
  // Principle I. People theme their whole terminal, and a bar that clashes
  // with the rest of it is a bar they turn off. Neither is the default:
  // Catppuccin Mocha is still what this looks like when nobody has chosen.
  //
  // Every token the Catppuccin flavors define is defined here too, so no
  // segment can reference a colour that exists in one theme and not another.
  nord: {
    crust: "#2e3440", mantle: "#3b4252", base: "#434c5e",
    surface1: "#4c566a", surface2: "#616e88", text: "#eceff4",
    red: "#bf616a", peach: "#d08770", yellow: "#ebcb8b", green: "#a3be8c",
    sapphire: "#88c0d0", blue: "#5e81ac", lavender: "#81a1c1", mauve: "#b48ead",
    flamingo: "#d8dee9", teal: "#8fbcbb", pink: "#cbb0c7",
  },
  gruvbox: {
    crust: "#1d2021", mantle: "#282828", base: "#32302f",
    surface1: "#504945", surface2: "#665c54", text: "#ebdbb2",
    red: "#fb4934", peach: "#fe8019", yellow: "#fabd2f", green: "#b8bb26",
    sapphire: "#8ec07c", blue: "#83a598", lavender: "#bdae93", mauve: "#b16286",
    flamingo: "#d5c4a1", teal: "#689d6a", pink: "#d3869b",
  },
};

const POWERLINE_ARROW = "";
const POWERLINE_THIN = "\u{E0B1}";
const ASCII_ARROW = "▸";

/**
 * Which separator to draw.
 *
 * Powerline is the default and the design. A thin separator is a declared
 * fallback for a terminal that can reach the private use area but renders
 * the solid arrow badly, which the v4.0.0 amendment to Principle I allows
 * as long as it is asked for rather than assumed.
 */
export function separatorFor({ asciiArrows = false, style = process.env.CLAUDE_STATUSLINE_SEPARATOR } = {}) {
  if (asciiArrows) return ASCII_ARROW;
  if (style === "thin") return POWERLINE_THIN;
  // The solid arrow is a shape cut out of two backgrounds, and with `NO_COLOR`
  // there are no backgrounds: it becomes a row of filled triangles between
  // chips that no longer have edges. The thin one is a line, which is what a
  // divider without colour has to be.
  if (!colourEnabled()) return POWERLINE_THIN;
  return POWERLINE_ARROW;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Whether this render may emit colour at all.
 *
 * `NO_COLOR` is a cross-tool convention rather than this project's invention:
 * set to anything non-empty, it means the person has asked every program on
 * the machine not to colourise, and a bar that ignores it is one they cannot
 * turn off without uninstalling it. Read per call rather than cached, so a
 * test or a preview can set it around one render.
 *
 * Colour is not the only carrier of anything the bar says — Principle X
 * requires a band mark beside the ramped figures for exactly this reason —
 * so a colourless bar loses emphasis, never information. The powerline
 * separators go with it: drawn without the two colours they sit between,
 * they are a row of solid triangles saying nothing.
 */
export function colourEnabled() {
  const raw = process.env.NO_COLOR;
  return raw === undefined || raw === "";
}

/**
 * How many colours this terminal draws: `"truecolor"` or `"256"`.
 *
 * `COLORTERM=truecolor` or `24bit` is the terminal saying so. Any other set
 * value means it did not, and Apple Terminal, which draws 256 colours and
 * sets nothing, is named by `TERM_PROGRAM`. An unset `COLORTERM` anywhere
 * else keeps 24-bit: Windows Terminal and several SSH setups draw truecolor
 * and do not set it, so an absent variable is not evidence of less.
 * Read per call, like `NO_COLOR`.
 */
export function colourDepth(env = process.env) {
  const term = (env.COLORTERM || "").toLowerCase();
  if (term === "truecolor" || term === "24bit") return "truecolor";
  if (term) return "256";
  return env.TERM_PROGRAM === "Apple_Terminal" ? "256" : "truecolor";
}

const CUBE = [0, 95, 135, 175, 215, 255];
let table256 = null;

/** Indices 16 to 255 as hex, the six-level cube and the grey ramp. Never 0 to 15: themes remap those. */
function palette256() {
  if (table256) return table256;
  table256 = [];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        const hex = `#${[CUBE[r], CUBE[g], CUBE[b]].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        table256.push({ index: 16 + 36 * r + 6 * g + b, hex, lab: labOf(hex) });
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const v = 8 + 10 * i;
    const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
    table256.push({ index: 232 + i, hex, lab: labOf(hex) });
  }
  return table256;
}

function labOf(hex) {
  const { L, C, h } = toOklch(hex);
  const rad = (h * Math.PI) / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

const nearestCache = new Map();

/** The 256-colour entry nearest to `hex` by OKLab distance. */
function nearest256(hex) {
  const hit = nearestCache.get(hex);
  if (hit) return hit;
  const lab = labOf(hex);
  let pick = null;
  let top = Infinity;
  for (const entry of palette256()) {
    const d = (entry.lab[0] - lab[0]) ** 2 + (entry.lab[1] - lab[1]) ** 2 + (entry.lab[2] - lab[2]) ** 2;
    if (d < top) {
      top = d;
      pick = entry;
    }
  }
  nearestCache.set(hex, pick);
  return pick;
}

/** The hex a 256-colour index stands for, for reading a rendered bar back. */
export function colour256Hex(index) {
  return palette256().find((e) => e.index === index)?.hex ?? null;
}

/** The colour as this terminal will draw it, as hex. Truecolor is the colour itself. */
export function drawnColour(hex, depth = colourDepth()) {
  return depth === "256" ? nearest256(hex).hex : hex;
}

/** The SGR sequence for a foreground (38) or background (48) colour. */
function sgr(kind, hex) {
  if (!colourEnabled()) return "";
  if (colourDepth() === "256") return `\x1b[${kind};5;${nearest256(hex).index}m`;
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[${kind};2;${r};${g};${b}m`;
}

export const fgSeq = (hex) => sgr(38, hex);
export const bgSeq = (hex) => sgr(48, hex);
const fg = fgSeq;
const bg = bgSeq;

const RESET_SEQ = "\x1b[0m";

/** The reset, or nothing when there is no colour to reset. */
function reset() {
  return colourEnabled() ? RESET_SEQ : "";
}

/**
 * OSC 8 terminal hyperlink: wraps text so it's clickable in terminals that
 * support it (iTerm2, Windows Terminal, kitty, WezTerm, ...), without ever
 * printing the URL itself. Terminals without support just show the text.
 */
function hyperlink(url, text) {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/**
 * Terminals known to draw SGR `4:4`, the dotted underline, from what they
 * put in the environment. A table in one place: an unknown terminal gets no
 * underline at all rather than the plain one an old parser would fall back to.
 */
const STYLED_UNDERLINE = [
  (env) => Boolean(env.KITTY_WINDOW_ID) || env.TERM === "xterm-kitty",
  (env) => env.TERM_PROGRAM === "WezTerm" || Boolean(env.WEZTERM_EXECUTABLE),
  (env) => env.TERM_PROGRAM === "iTerm.app",
  (env) => Boolean(env.WT_SESSION),
  (env) => env.TERM_PROGRAM === "ghostty" || env.TERM === "xterm-ghostty",
  (env) => Number(env.VTE_VERSION) >= 5000,
];

export function styledUnderline(env = process.env) {
  return STYLED_UNDERLINE.some((test) => test(env));
}

/**
 * Linked text: an OSC 8 hyperlink, with a dotted underline where the
 * terminal draws one, so a name that can be clicked looks like it can.
 * Not a colour, so `NO_COLOR` keeps it.
 */
export function link(url, text) {
  const linked = hyperlink(url, text);
  return styledUnderline() ? `\x1b[4:4m${linked}\x1b[24m` : linked;
}

/**
 * Renders one Powerline row from an ordered list of {color, text, url?}
 * segments. color is a palette hex string; the segment's foreground
 * auto-selects crust (dark) or text (light) for contrast, matching the
 * reference starship.toml convention of light-text-on-solid-background.
 * An optional `url` makes the segment's text a clickable OSC 8 hyperlink.
 */

/**
 * A lighter version of a colour, for marking a segment that just changed.
 *
 * Colour is preattentive: a brighter block is noticed before it is read,
 * where a swapped glyph has to be recognised, and it does not require the
 * reader to have seen the previous frame. The segment keeps its own hue, so
 * it still says which segment it is.
 */
export function lighten(hex, ratio = 0.45) {
  return lightenOklch(hex, ratio);
}

/** A palette colour by name, or a literal hex when one is handed in. */
export function resolveColour(palette, colour) {
  if (typeof colour === "string" && colour.startsWith("#")) return colour;
  return palette[colour];
}

/**
 * The text colour and the background a chip of this colour is drawn with.
 *
 * At 256 colours the contrast is worked out on the colours the terminal will
 * actually draw, so the 4.5:1 floor holds there too.
 */
function chipOf(palette, colour) {
  const wanted = resolveColour(palette, colour);
  if (colourDepth() !== "256") return chipColours(palette, wanted);
  const drawn = chipColours(quantised(palette), drawnColour(wanted, "256"), (hex) => drawnColour(hex, "256"));
  return { fg: drawn.fg, bg: drawn.bg };
}

const quantisedPalettes = new WeakMap();

function quantised(palette) {
  let q = quantisedPalettes.get(palette);
  if (!q) {
    q = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, drawnColour(v, "256")]));
    quantisedPalettes.set(palette, q);
  }
  return q;
}

/**
 * The colour for a chip marked `quiet`, text that is read second: the palette's `text` or
 * `crust` when that still reaches 4.5:1 on the chip, otherwise the chip's
 * own text colour. Dimmed with colour rather than SGR 2, so the contrast
 * stays something the suite can measure.
 */
export function quietText(palette, colour) {
  const { fg: strong, bg } = chipOf(palette, colour);
  for (const token of [palette.text, palette.crust]) {
    const tone = colourDepth() === "256" ? drawnColour(token, "256") : token;
    if (tone !== strong && contrastRatio(tone, bg) >= 4.5) return tone;
  }
  return strong;
}

export function renderRow(palette, segments, { asciiArrows = false } = {}) {
  const arrow = separatorFor({ asciiArrows });
  let out = "";
  segments.forEach((seg, i) => {
    const { fg: chipFg, bg: segBg } = chipOf(palette, seg.color);
    const segFg = seg.quiet ? quietText(palette, seg.color) : chipFg;
    if (i > 0) {
      const prev = chipOf(palette, segments[i - 1].color).bg;
      out += `${fg(prev)}${bg(segBg)}${arrow}`;
    }
    const text = seg.url ? link(seg.url, seg.text) : seg.text;
    out += `${bg(segBg)}${fg(segFg)}${text}`;
  });
  const last = segments[segments.length - 1];
  // Reset before the closing cap: without it, the arrow inherits the last
  // segment's own background (still active from the loop above) and its
  // triangle becomes invisible — same-color foreground on same-color
  // background — instead of fading into the terminal's real background.
  out += `${reset()}${fg(chipOf(palette, last.color).bg)}${arrow}${reset()}`;
  return out;
}

/**
 * How many terminal columns a string occupies.
 *
 * Not the same as its length in code units, and not the same as its length
 * in code points either: an emoji takes two columns, a variation selector
 * or zero-width joiner takes none, and a surrogate pair is one character
 * that `String.length` counts as two. The 120-column limit in Principle II
 * is a limit on columns, so it has to be measured in columns.
 *
 * Nerd Font glyphs sit in the private use area and are drawn single-width
 * in every terminal font that has them, so they count as one.
 */
/**
 * Exactly the East Asian Ambiguous characters this bar can emit.
 *
 * A set rather than ranges, and derived from what the glyph table, the ramp
 * and the separators actually draw rather than from the blocks they sit in.
 * The blocks are mixed: `U+25B4` and `U+25B5` are Narrow while `U+25B2` and
 * `U+25B3` beside them are Ambiguous, so a range covering Geometric Shapes
 * would count the band marks two columns wide when they render one — the very
 * misalignment this exists to prevent.
 *
 * A character here is one column in most terminals and two in a terminal
 * configured for East Asian text. Nothing in the environment reports which,
 * so the reader says.
 */
const AMBIGUOUS = new Set([
  // Drawn today:
  0x00b7, // · middle dot, the separator between a row's columns
  0x2500, // ─ the empty cell of a gauge
  0x2588, 0x2592, 0x2593, // █ ▒ ▓ its fills
  0x2026, // … ellipsis, where a clipped row or label is cut
  // Not drawn today, and listed anyway. These are Ambiguous per Unicode
  // whether or not this bar uses them, and every one of them was on the bar
  // at some point: the arrows and the four circles were the substitute glyph
  // set until 2026-09-12, when it was rebuilt out of Narrow codepoints so it
  // measures one width on every terminal, and the larger triangles were the
  // gauge's band marks until 2026-09-07. A width table that describes more
  // characters than the renderer currently draws costs a lookup and is right
  // the day one of them comes back; one that tracked only current usage would
  // be silently wrong that day instead.
  0x2190, 0x2191, 0x2193, // ← ↑ ↓
  0x25b2, 0x25b3, // ▲ △
  0x25c6, 0x25cb, 0x25cf, 0x25d0, // ◆ ○ ● ◐
]);

/**
 * Whether Ambiguous characters are drawn two columns wide.
 *
 * Off by default, which is right for most terminals. `tmux` calls the same
 * setting `-u`, and every tool that has met this problem has one, because
 * there is no way to ask the terminal.
 */
function ambiguousIsWide() {
  return process.env.CLAUDE_STATUSLINE_AMBIGUOUS_WIDE === "1";
}

/**
 * Whether a code point is drawn two columns wide: East Asian Width W or F, or
 * Emoji_Presentation=Yes. The table is generated from Unicode's own files by
 * scripts/generate-width-table.js. A hand-written list had stopped at the
 * emoji someone had drawn that week and missed ➕ ➖ ❔ 🆕 and the coloured
 * circles beside them.
 */
// Nothing below the first range is wide, which is almost every character a
// row holds. Skipping the search for them keeps the redraw budget.
const WIDE_FIRST = WIDE[0][0];

function isWide(cp) {
  if (cp < WIDE_FIRST) return false;
  let lo = 0;
  let hi = WIDE.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [from, to] = WIDE[mid];
    if (cp < from) hi = mid - 1;
    else if (cp > to) lo = mid + 1;
    else return true;
  }
  return false;
}

export function displayWidth(text) {
  const plain = String(text)
    .replace(/\x1b\[[0-9;:]*m/g, "")
    .replace(/\x1b\]8;;[^\x07]*\x07/g, "");

  const chars = [...plain];
  let width = 0;
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    // Combining marks, variation selectors and joiners draw on top of the
    // character before them rather than beside it.
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x0300 && cp <= 0x036f)) continue;
    if (cp === 0x20e3) continue; // combining enclosing keycap
    // U+FE0F asks for emoji presentation, which is two columns wide
    // whatever the base character would have been on its own. ⏱️ is a
    // stopwatch plus a variation selector, and it is drawn as an emoji.
    const nextCp = chars[i + 1]?.codePointAt(0);
    const forcedEmoji = nextCp === 0xfe0f;
    const wide =
      forcedEmoji ||
      (ambiguousIsWide() && AMBIGUOUS.has(cp)) ||
      isWide(cp);
    width += wide ? 2 : 1;
  }
  return width;
}
