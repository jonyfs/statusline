/**
 * What a level looks like: its colour, and the shape of its bar.
 *
 * Two rules meet here. Colour is preattentive, so a ramp is read before it
 * is read: you know a bar is red in under a quarter of a second, without
 * looking at the number. And colour may not be the only thing carrying the
 * message, because around one man in twelve cannot separate red from green,
 * and Section 508 requires the information to survive that.
 *
 * So each band changes the bar's characters as well as its colour. A
 * screenshot in greyscale, a colour-blind reader and a terminal with a
 * broken palette all still say which band a value is in.
 *
 * Thresholds are item E4's chosen form, 60 and 85, applied to the rate
 * limits too, as E5 asked.
 */

const BANDS = [
  {
    name: "ok",
    upTo: 60,
    colour: "green",
    /** Solid blocks: nothing to say beyond the length itself. */
    filled: "█",
    empty: "░",
    suffix: "",
  },
  {
    name: "warn",
    upTo: 85,
    colour: "yellow",
    /** A lighter fill, visibly different from solid without colour. */
    filled: "▓",
    empty: "░",
    suffix: "",
  },
  {
    name: "critical",
    upTo: Infinity,
    colour: "red",
    /** Lighter again, and a mark the eye catches even in one colour. */
    filled: "▒",
    empty: "░",
    suffix: "!",
  },
];

/**
 * A one-character mark for a band, for segments that show a number without a
 * bar.
 *
 * The bar used to be what carried the band without relying on colour, which
 * Section 508 requires and item E6 asked for. A number on its own has
 * nothing to carry it, so it gets a mark instead: two columns at most,
 * against the ten to sixteen a bar costs. The safe band gets nothing, since
 * "nothing is wrong" needs no symbol.
 */
export function bandMark(pct) {
  const band = bandFor(pct);
  if (!band || band.name === "ok") return "";
  return band.name === "warn" ? "▴" : "▲";
}

/** The band a percentage falls in. Anything unusable is treated as unknown. */
export function bandFor(pct) {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  return BANDS.find((b) => pct < b.upTo) ?? BANDS[BANDS.length - 1];
}

/**
 * The colour a ramped segment renders in, or the segment's own colour when
 * the value is unknown. An unknown level is not a level, and painting it
 * green would be an answer the payload did not give.
 */
export function rampColour(pct, fallback) {
  return bandFor(pct)?.colour ?? fallback;
}

/**
 * How wide a bar should be, given the terminal.
 *
 * A wider bar resolves smaller differences; a narrower one leaves room for
 * everything else. Item E3's chosen form is to scale with the terminal
 * rather than pick one number for every window.
 */
export function barWidth(columns) {
  if (typeof columns !== "number" || !Number.isFinite(columns)) return 10;
  if (columns < 100) return 8;
  if (columns <= 160) return 10;
  return 16;
}

/**
 * A bar for a percentage: filled cells, then empty ones, then the band's
 * mark when it has one.
 *
 * An unknown percentage produces an empty track rather than a full or an
 * absent one. The number beside it already says `?%`, and a bar that
 * disappeared would make the line's width jump every time the payload
 * skipped a field.
 */
export function bar(pct, columns) {
  const width = barWidth(columns);
  const band = bandFor(pct);
  if (!band) return "░".repeat(width);

  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return band.filled.repeat(filled) + band.empty.repeat(width - filled) + band.suffix;
}
