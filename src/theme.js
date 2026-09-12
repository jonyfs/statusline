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

function fg(hex) {
  if (!colourEnabled()) return "";
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(hex) {
  if (!colourEnabled()) return "";
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

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
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** A palette colour by name, or a literal hex when one is handed in. */
export function resolveColour(palette, colour) {
  if (typeof colour === "string" && colour.startsWith("#")) return colour;
  return palette[colour];
}

export function renderRow(palette, segments, { asciiArrows = false } = {}) {
  const arrow = separatorFor({ asciiArrows });
  let out = "";
  segments.forEach((seg, i) => {
    const segFg = seg.color === "surface1" || seg.color === "surface2" ? palette.text : palette.crust;
    const segBg = resolveColour(palette, seg.color);
    if (i > 0) {
      const prev = resolveColour(palette, segments[i - 1].color);
      out += `${fg(prev)}${bg(segBg)}${arrow}`;
    }
    const text = seg.url ? hyperlink(seg.url, seg.text) : seg.text;
    out += `${bg(segBg)}${fg(segFg)}${text}`;
  });
  const last = segments[segments.length - 1];
  // Reset before the closing cap: without it, the arrow inherits the last
  // segment's own background (still active from the loop above) and its
  // triangle becomes invisible — same-color foreground on same-color
  // background — instead of fading into the terminal's real background.
  out += `${reset()}${fg(resolveColour(palette, last.color))}${arrow}${reset()}`;
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

export function displayWidth(text) {
  const plain = String(text)
    .replace(/\x1b\[[0-9;]*m/g, "")
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
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1f64f) ||
      (cp >= 0x1f680 && cp <= 0x1f6ff) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff) ||
      (cp >= 0x1fa70 && cp <= 0x1faff) ||
      cp === 0x231a || cp === 0x231b ||
      (cp >= 0x23e9 && cp <= 0x23ec) ||
      cp === 0x23f0 || cp === 0x23f3 ||
      (cp >= 0x25fd && cp <= 0x25fe) ||
      (cp >= 0x2614 && cp <= 0x2615) ||
      (cp >= 0x2648 && cp <= 0x2653) ||
      (cp >= 0x23f1 && cp <= 0x23f3) ||
      (cp >= 0x23f8 && cp <= 0x23fa) ||
      cp === 0x26a1 ||
      (cp >= 0x26aa && cp <= 0x26ab) ||
      cp === 0x2728 || cp === 0x2705 || cp === 0x274c ||
      (cp >= 0x2b1b && cp <= 0x2b1c) ||
      cp === 0x2b50 || cp === 0x2b55;
    width += wide ? 2 : 1;
  }
  return width;
}
