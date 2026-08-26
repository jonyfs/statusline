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
};

const POWERLINE_ARROW = "";
const ASCII_ARROW = "▸";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

const RESET = "\x1b[0m";

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
export function renderRow(palette, segments, { asciiArrows = false } = {}) {
  const arrow = asciiArrows ? ASCII_ARROW : POWERLINE_ARROW;
  let out = "";
  segments.forEach((seg, i) => {
    const segFg = seg.color === "surface1" || seg.color === "surface2" ? palette.text : palette.crust;
    if (i > 0) {
      const prev = segments[i - 1].color;
      out += `${fg(palette[prev])}${bg(palette[seg.color])}${arrow}`;
    }
    const text = seg.url ? hyperlink(seg.url, seg.text) : seg.text;
    out += `${bg(palette[seg.color])}${fg(segFg)}${text}`;
  });
  const last = segments[segments.length - 1];
  // Reset before the closing cap: without it, the arrow inherits the last
  // segment's own background (still active from the loop above) and its
  // triangle becomes invisible — same-color foreground on same-color
  // background — instead of fading into the terminal's real background.
  out += `${RESET}${fg(palette[last.color])}${arrow}${RESET}`;
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
