/**
 * The frame sequences proposed for a segment that has just changed.
 *
 * None of them ships. The owner looked at all six on the generated board on
 * 2026-09-01 and adopted none, and the reasoning is recorded in
 * specs/003-status-change-animations/decisions.md. This file lives under
 * scripts/ rather than src/ for that reason: the bar does not load it, and
 * src/ is what ships to anyone who clones the plugin.
 *
 * It is kept so the board can be regenerated and the decision re-examined
 * against the same frames rather than against a description of them.
 *
 * The honest constraint every sequence is designed against: a statusline is
 * printed once per invocation and is then static text. A frame advances only
 * when Claude Code asks for the bar again, which is roughly every 5 to 6
 * seconds during activity and every 60 seconds at the installed refresh
 * interval when idle. The thirty-second highlight window is therefore about
 * five frames, or one. Nothing here is smooth, and a sequence longer than four
 * frames has frames that will rarely be seen.
 *
 * Every codepoint below was checked against the installed FiraCode Nerd Font's
 * cmap and then rendered from that font and looked at, per Principle X. The
 * sheet is committed as specs/003-status-change-animations/glyph-candidates.png,
 * and the sweep rejected four families whose table names lie about their glyph:
 * the whole `dice_1`..`dice_6` range draws unrelated icons, `space_invaders`
 * draws a crossed-out television, `puzzle_outline` at F0BA9 draws a comb, and
 * `robot_excited` and its siblings draw bookmarks.
 */

import { displayWidth } from "../src/theme.js";

// Written as escapes rather than literal private-use characters: pasted
// literals have silently vanished from a file in this repository before,
// leaving empty strings that rendered as a bare gap.
const PIE = ["\u{F0A9E}", "\u{F0AA0}", "\u{F0AA2}", "\u{F0AA5}"];
const PACMAN = ["\u{F0BAF}", "\u{F0765}"];
const PUZZLE = ["\u{F1427}", "\u{F0431}", "\u{F1426}"];
const ROBOT = ["\u{F06A9}", "\u{F167A}"];
const STAR = ["\u{F04D2}", "\u{F04CE}"];

/**
 * The Braille spinner, the one animation a terminal reader already recognises.
 * It is the same in both modes because it needs no special font: every cell in
 * the Braille block is one column wide in any monospace font that has it, which
 * is nearly all of them.
 */
const BRAILLE = ["\u{280B}", "\u{2819}", "\u{2839}", "\u{2838}"];

/**
 * Every candidate, in the order the preview page lists them.
 *
 * `plain` is the no-Nerd-Font substitute and must be the same length as
 * `nerd`. Where a plain character mirrors the Nerd Font glyph closely — an
 * outline star for an outline star — it is used in preference to the Braille
 * spinner, because a substitute that says the same thing is better than one
 * that merely moves.
 */
export const ANIMATIONS = [
  {
    key: "pie",
    label: "Pie fill",
    describes: "a disc filling a quarter at a time",
    nerd: PIE,
    plain: ["\u{25D4}", "\u{25D1}", "\u{25D5}", "\u{25CF}"], // ◔ ◑ ◕ ●
    segments: ["branch", "pr"],
  },
  {
    key: "pacman",
    label: "Pac-Man",
    describes: "a mouth opening and closing",
    nerd: PACMAN,
    plain: ["\u{25D5}", "\u{25CF}"], // ◕ ●
    segments: ["branch"],
  },
  {
    key: "puzzle",
    label: "Puzzle snap",
    describes: "an outline, then a filled piece, then a piece with a tick",
    nerd: PUZZLE,
    plain: ["\u{25AB}", "\u{25AA}", "\u{2713}"], // ▫ ▪ ✓
    segments: ["skills"],
  },
  {
    key: "robot",
    label: "Robot blink",
    describes: "two robot heads that differ enough to read as a blink",
    nerd: ROBOT,
    plain: ["\u{2299}", "\u{229A}"], // ⊙ ⊚
    segments: ["model"],
  },
  {
    key: "twinkle",
    label: "Twinkle",
    describes: "an outline star filling in",
    nerd: STAR,
    plain: ["\u{2606}", "\u{2605}"], // ☆ ★
    segments: ["pr", "skills", "model"],
  },
  {
    key: "spinner",
    label: "Braille spinner",
    describes: "the spinner every CLI already uses, which needs no font at all",
    nerd: BRAILLE,
    plain: BRAILLE,
    segments: ["branch", "pr", "skills", "model"],
  },
];

const BY_KEY = new Map(ANIMATIONS.map((a) => [a.key, a]));

/**
 * Which candidate each segment plays: none of them, decided 2026-09-01.
 *
 * Kept as the shape a future decision would fill rather than deleted, since
 * the rejections in decisions.md are about these six candidates and not about
 * the idea.
 */
export const CHOSEN = {};

/** One candidate by key, or undefined. */
export function animation(key) {
  return BY_KEY.get(key);
}

/** The candidate a segment plays, or undefined when it does not animate. */
export function animationFor(segmentKey) {
  const key = CHOSEN[segmentKey];
  return key ? BY_KEY.get(key) : undefined;
}

/**
 * The glyph to draw for a segment on this render.
 *
 * `frame` is renders-since-change, from the change state; null when the
 * segment is not inside a highlight window. Past the last frame the sequence
 * holds on its final frame rather than looping, so a window longer than the
 * sequence does not start it over.
 *
 * Total by construction: every argument combination returns a string, and
 * nothing here throws. A bar that vanished because a frame index was out of
 * range would have traded the whole statusline for a decoration.
 */
export function frameFor(segmentKey, frame, { ascii = false, settled = "" } = {}) {
  if (!Number.isFinite(frame) || frame < 0) return settled;
  const anim = animationFor(segmentKey);
  if (!anim) return settled;
  const frames = ascii ? anim.plain : anim.nerd;
  if (!frames?.length) return settled;
  return frames[Math.min(Math.floor(frame), frames.length - 1)];
}

/**
 * The display width every frame of a candidate occupies, or null when they
 * disagree.
 *
 * A candidate whose frames are not all one width would shove every segment
 * after it back and forth once per render. The test asserts this is null for
 * nothing; the function exists so the assertion reads as a question about the
 * candidate rather than a loop in a test file.
 */
export function frameWidth(frames) {
  if (!frames?.length) return null;
  const widths = new Set(frames.map((f) => displayWidth(f)));
  return widths.size === 1 ? [...widths][0] : null;
}
