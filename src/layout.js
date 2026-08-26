/**
 * Fitting the bar to the terminal it is actually in.
 *
 * Two facts drive this module. Claude Code sets `COLUMNS` and `LINES` before
 * running the command, so the real dimensions are knowable rather than
 * assumed at 120 columns and four rows. And with thirty-four segments
 * competing for those columns, most redraws cannot show everything, so
 * something is always being dropped.
 *
 * The only question is whether that choice was made on purpose. Source order
 * made it by accident: the last segment added was the first one lost,
 * regardless of what it said. Here it is made by the priority in the
 * registry, the way iTerm2's status bar has done it for years.
 *
 * Position and presence stay separate. Priority decides whether a segment
 * appears; its order decides where. A segment therefore never slides
 * sideways because a neighbour disappeared, and the eye can learn where
 * things are.
 */

import { displayWidth } from "./theme.js";

/** What to assume when Claude Code is too old to set `COLUMNS`. */
export const DEFAULT_WIDTH = 120;

/** A Powerline separator occupies one column between segments. */
const SEPARATOR_COLUMNS = 1;

function positiveInt(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** The terminal's width, or 120 when it cannot be known. */
export function terminalWidth() {
  return positiveInt(process.env.COLUMNS) ?? DEFAULT_WIDTH;
}

/**
 * The terminal's height, or `Infinity` when it cannot be known.
 *
 * Unlimited is the safe unknown here: it means "render everything", which is
 * what this project did before it could read the value at all.
 */
export function terminalHeight() {
  return positiveInt(process.env.LINES) ?? Infinity;
}

/** What a row of segments costs in columns, separators included. */
export function rowWidth(row) {
  if (!row.length) return 0;
  const content = row.reduce((total, s) => total + displayWidth(s.text), 0);
  return content + row.length * SEPARATOR_COLUMNS;
}

/**
 * Drops the least important segments until the row fits.
 *
 * Returns the survivors in their original order, so the line's shape is
 * stable even as its contents come and go. The highest-priority segment is
 * always kept: a bar with one thing on it that overflows by a column beats a
 * bar with nothing on it.
 */
export function fitToWidth(row, width = terminalWidth()) {
  if (rowWidth(row) <= width) return row;

  const byPriority = [...row].sort((a, b) => a.priority - b.priority);
  const dropped = new Set();

  for (const candidate of byPriority) {
    if (dropped.size === row.length - 1) break;
    dropped.add(candidate.key);
    const kept = row.filter((s) => !dropped.has(s.key));
    if (rowWidth(kept) <= width) return kept;
  }

  const survivor = [...row].sort((a, b) => b.priority - a.priority)[0];
  return [survivor];
}

/**
 * Splits a row into its left group and its right group.
 *
 * Right-aligned segments are drawn from the far edge inward, so volatile
 * numbers land in the same place on every redraw instead of sliding as the
 * segments before them change width.
 */
export function splitByAlignment(row) {
  return {
    left: row.filter((s) => s.align !== "right"),
    right: row.filter((s) => s.align === "right"),
  };
}

/**
 * How much padding sits between the left and right groups.
 *
 * Zero when they would touch or overlap, in which case the two groups simply
 * run together and the width limit does the rest.
 */
export function gapBetween(left, right, width = terminalWidth()) {
  const used = rowWidth(left) + rowWidth(right);
  return Math.max(0, width - used);
}

/**
 * Pads the first segment of every line to a common width, so the boundaries
 * line up down the bar and four lines read as one small table.
 *
 * Alignment yields to the width limit. The two can disagree, and only one of
 * them has a consequence: a padded line that overflows wraps, and a wrapped
 * bar costs a whole terminal row to save a few columns of tidiness.
 */
export function alignColumns(lines, width = terminalWidth()) {
  const firsts = lines.map((line) => line[0]).filter(Boolean);
  if (firsts.length < 2) return lines;

  const target = Math.max(...firsts.map((s) => displayWidth(s.text)));

  return lines.map((line) => {
    if (!line.length) return line;
    const first = line[0];
    const padding = target - displayWidth(first.text);
    if (padding <= 0) return line;
    if (rowWidth(line) + padding > width) return line;
    return [{ ...first, text: first.text + " ".repeat(padding) }, ...line.slice(1)];
  });
}

/**
 * Which lines render, given the rows available.
 *
 * The order was chosen by the owner on 2026-08-26: skills go first, then the
 * model, then the place. Line 4 is the last one standing, because it is the
 * only line carrying a limit whose consequence you cannot undo. Line 1
 * outlives line 3 because where you are and which branch you are on decide
 * whether an edit is safe.
 *
 * Everything comes back the moment the rows do. Shedding is a response to
 * the window, not a mode the bar gets stuck in.
 */
const SHED_ORDER = [2, 3, 1];

export function linesToRender(available = terminalHeight(), present = [1, 2, 3, 4]) {
  let keep = [...present];
  for (const line of SHED_ORDER) {
    if (keep.length <= available) break;
    keep = keep.filter((n) => n !== line);
  }
  return keep;
}
