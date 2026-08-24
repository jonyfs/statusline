export const PALETTES = {
  mocha: {
    crust: "#11111b", mantle: "#181825", base: "#1e1e2e",
    surface1: "#45475a", surface2: "#585b70", text: "#cdd6f4",
    red: "#f38ba8", peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
    sapphire: "#74c7ec", blue: "#89b4fa", lavender: "#b4befe", mauve: "#cba6f7",
  },
  frappe: {
    crust: "#232634", mantle: "#292c3c", base: "#303446",
    surface1: "#51576d", surface2: "#626880", text: "#c6d0f5",
    red: "#e78284", peach: "#ef9f76", yellow: "#e5c890", green: "#a6d189",
    sapphire: "#85c1dc", blue: "#8caaee", lavender: "#babbf1", mauve: "#ca9ee6",
  },
  macchiato: {
    crust: "#181926", mantle: "#1e2030", base: "#24273a",
    surface1: "#494d64", surface2: "#5b6078", text: "#cad3f5",
    red: "#ed8796", peach: "#f5a97f", yellow: "#eed49f", green: "#a6da95",
    sapphire: "#7dc4e4", blue: "#8aadf4", lavender: "#b7bdf8", mauve: "#c6a0f6",
  },
  latte: {
    crust: "#dce0e8", mantle: "#e6e9ef", base: "#eff1f5",
    surface1: "#bcc0cc", surface2: "#acb0be", text: "#4c4f69",
    red: "#d20f39", peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b",
    sapphire: "#209fb5", blue: "#1e66f5", lavender: "#7287fd", mauve: "#8839ef",
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
