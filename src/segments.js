/**
 * The segment registry: one row per thing the bar can show.
 *
 * Segment definitions used to live inline in the renderer, which was fine
 * for fifteen of them and stops being fine at thirty-four. Three properties
 * in particular need to be readable without reading a render function:
 *
 * - `priority` decides what survives a narrow terminal. With more content
 *   than columns, something is always being dropped; the only question is
 *   whether the choice was made on purpose. Source order made it by
 *   accident, so the last segment added was the first one lost.
 * - `order` decides position, and is deliberately separate from priority.
 *   A segment never moves because a neighbour disappeared, so the eye can
 *   learn where things are.
 * - `colour` says which of the three channels a segment uses, and the tests
 *   enforce that it is only ever one. Principle X, as amended, requires a
 *   colour on the bar to mean one thing wherever it appears.
 *
 * The priority values come from the table in
 * specs/002-statusline-design-review/data-model.md, agreed on 2026-08-26.
 * Changing one changes what a person sees on an 80-column terminal, which
 * is why they live here, in a diff, rather than in a layout pass.
 */

/**
 * Band boundaries, so a new segment can be placed by asking which band it
 * belongs to rather than by picking a number between two others.
 */
export const PRIORITY_BANDS = {
  /** Never dropped. What the session cannot be understood without. */
  essential: 90,
  /** Dropped only when the terminal is genuinely narrow. Actionable state. */
  actionable: 70,
  /** The first to go. Useful, not decisive. */
  useful: 40,
};

/**
 * `colour` channels:
 *   identity — the segment's own palette colour, meaning nothing but itself
 *   ramp     — green, yellow, red by level, on segments that carry a limit
 *   change   — brightens for 30 seconds after the value changed
 */
export const SEGMENTS = [
  // Line 1: where you are, and what state it is in.
  { key: "dir", line: 1, order: 10, align: "left", priority: 96, colour: "identity", source: "payload" },
  { key: "branch", line: 1, order: 20, align: "left", priority: 98, colour: "change", source: "git" },
  { key: "worktreeState", line: 1, order: 30, align: "left", priority: 86, colour: "identity", source: "git" },
  { key: "upstream", line: 1, order: 40, align: "left", priority: 84, colour: "identity", source: "git" },
  { key: "pr", line: 1, order: 50, align: "left", priority: 82, colour: "change", source: "gh" },

  // Line 2: what is shaping the work.
  { key: "skills", line: 2, order: 10, align: "left", priority: 76, colour: "change", source: "transcript" },

  // Line 3: how the model is configured.
  { key: "model", line: 3, order: 10, align: "left", priority: 92, colour: "change", source: "payload" },
  { key: "effort", line: 3, order: 20, align: "left", priority: 74, colour: "identity", source: "payload" },
  { key: "outputStyle", line: 3, order: 30, align: "left", priority: 72, colour: "identity", source: "payload" },

  // Line 4: what is running out.
  { key: "context", line: 4, order: 10, align: "left", priority: 100, colour: "ramp", source: "payload" },
  { key: "fiveHour", line: 4, order: 20, align: "left", priority: 94, colour: "ramp", source: "payload" },
  { key: "fiveHourReset", line: 4, order: 30, align: "right", priority: 80, colour: "identity", source: "payload" },
  { key: "sevenDay", line: 4, order: 40, align: "left", priority: 90, colour: "ramp", source: "payload" },
  { key: "sevenDayReset", line: 4, order: 50, align: "right", priority: 78, colour: "identity", source: "payload" },
  { key: "rtk", line: 4, order: 60, align: "left", priority: 40, colour: "identity", source: "rtk" },
];

const BY_KEY = new Map(SEGMENTS.map((s) => [s.key, s]));

/** One segment by key, or undefined. */
export function segment(key) {
  return BY_KEY.get(key);
}

/** Every segment on a line, in render order. */
export function byLine(line) {
  return SEGMENTS.filter((s) => s.line === line).sort((a, b) => a.order - b.order);
}

/** Every segment, most important first. What the layout fills a line from. */
export function byPriority(rows = SEGMENTS) {
  return [...rows].sort((a, b) => b.priority - a.priority);
}

/** The keys in a colour channel, for the renderer and for the diagnostic. */
export function inChannel(channel) {
  return SEGMENTS.filter((s) => s.colour === channel).map((s) => s.key);
}
