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
  { key: "repo", line: 1, order: 15, align: "left", priority: 45, colour: "identity", source: "payload" },
  { key: "projectDir", line: 1, order: 12, align: "left", priority: 44, colour: "identity", source: "payload" },
  { key: "branch", line: 1, order: 20, align: "left", priority: 98, colour: "change", source: "git" },
  { key: "worktree", line: 1, order: 25, align: "left", priority: 88, colour: "identity", source: "payload" },
  { key: "conflicts", line: 1, order: 28, align: "left", priority: 87, colour: "identity", source: "git" },
  { key: "worktreeState", line: 1, order: 30, align: "left", priority: 86, colour: "identity", source: "git" },
  // Not repository state: it is what this session changed, from the
  // payload's own counters rather than from git. It sits here because it
  // reads as a diff stat and belongs beside the other change counts, and it
  // keeps its low priority, so it is the first thing line 1 drops.
  { key: "linesChanged", line: 1, order: 35, align: "left", priority: 48, colour: "identity", source: "payload" },
  { key: "upstream", line: 1, order: 40, align: "left", priority: 84, colour: "identity", source: "git" },
  { key: "pr", line: 1, order: 50, align: "left", priority: 82, colour: "change", source: "gh" },
  { key: "ci", line: 1, order: 60, align: "left", priority: 56, colour: "identity", source: "gh" },

  // Line 2: what is shaping the work.
  { key: "skills", line: 2, order: 10, align: "left", priority: 76, colour: "change", source: "transcript" },
  { key: "todo", line: 2, order: 20, align: "left", priority: 70, colour: "identity", source: "transcript" },
  { key: "activity", line: 2, order: 30, align: "left", priority: 68, colour: "identity", source: "transcript" },

  // Line 3: how the model is configured.
  { key: "model", line: 3, order: 10, align: "left", priority: 92, colour: "change", source: "payload" },
  // C3's chosen form: model, then everything else about how it is
  // configured, in one segment. Three separators for one idea was two too
  // many, and they change on the same schedule anyway.
  { key: "effortStyle", line: 3, order: 20, align: "left", priority: 74, colour: "identity", source: "payload" },
  { key: "agent", line: 3, order: 40, align: "left", priority: 71, colour: "identity", source: "payload" },
  { key: "sessionName", line: 3, order: 50, align: "left", priority: 54, colour: "identity", source: "payload" },

  // Line 4: what is running out.
  { key: "context", line: 4, order: 10, align: "left", priority: 100, colour: "ramp", source: "payload" },
  { key: "fiveHour", line: 4, order: 20, align: "left", priority: 94, colour: "ramp", source: "payload" },
  { key: "sevenDay", line: 4, order: 40, align: "left", priority: 90, colour: "ramp", source: "payload" },
  // C6: one segment carrying both countdowns. Two clock faces and two
  // countdowns spent a third of the line saying two things that are read
  // together. The face shown is the sooner of the two, since that is the
  // one about to matter.
  { key: "resetMerged", line: 4, order: 50, align: "right", priority: 80, colour: "identity", source: "payload" },
  { key: "compaction", line: 4, order: 11, align: "left", priority: 78, colour: "identity", source: "payload" },
  { key: "burnRate", line: 4, order: 22, align: "left", priority: 66, colour: "ramp", source: "samples" },
  { key: "projection", line: 4, order: 24, align: "left", priority: 64, colour: "identity", source: "samples" },
  { key: "contextSize", line: 4, order: 14, align: "left", priority: 60, colour: "identity", source: "payload" },
  { key: "exceeds200k", line: 4, order: 16, align: "left", priority: 58, colour: "identity", source: "payload" },
  { key: "duration", line: 4, order: 55, align: "left", priority: 50, colour: "identity", source: "payload" },
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
