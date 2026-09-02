/**
 * The glyphs the assertions look for, taken from the renderer's own table
 * rather than pasted into each test.
 *
 * A test that hard-codes 📁 fails the day the bar adopts a Nerd Font folder,
 * which is a test about the codepoint rather than about the segment. These
 * tests care that the directory segment renders its icon and its label, so
 * they ask the table which icon that is.
 */

import { GLYPHS } from "../../src/render.js";

/** The default mode's glyphs. Tests that exercise ASCII mode use `plain`. */
export const G = GLYPHS.nerd;
export const PLAIN = GLYPHS.plain;

/**
 * A regular expression built from a template literal, so a glyph can be
 * interpolated. Regex literals cannot interpolate, and every glyph here is
 * outside the metacharacter set, so the raw strings go in untouched.
 */
export function re(strings, ...values) {
  return new RegExp(String.raw(strings, ...values), "u");
}
