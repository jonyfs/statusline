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
  { key: "dir", line: 1, order: 10, priority: 96, colour: "identity", source: "payload" },
  { key: "repo", line: 1, order: 15, priority: 45, colour: "identity", source: "payload" },
  { key: "projectDir", line: 1, order: 12, priority: 44, colour: "identity", source: "payload" },
  { key: "branch", line: 1, order: 20, priority: 98, colour: "change", source: "git" },
  { key: "worktree", line: 1, order: 25, priority: 88, colour: "identity", source: "payload" },
  { key: "conflicts", line: 1, order: 28, priority: 87, colour: "identity", source: "git" },
  { key: "worktreeState", line: 1, order: 30, priority: 86, colour: "identity", source: "git" },
  // Not repository state: it is what this session changed, from the
  // payload's own counters rather than from git. It sits here because it
  // reads as a diff stat and belongs beside the other change counts, and it
  // keeps its low priority, so it is the first thing line 1 drops.
  { key: "linesChanged", line: 1, order: 35, priority: 48, colour: "identity", source: "payload" },
  { key: "pr", line: 1, order: 50, priority: 82, colour: "change", source: "gh" },
  { key: "ci", line: 1, order: 60, priority: 56, colour: "identity", source: "gh" },

  // Line 2: what is shaping the work.
  { key: "skills", line: 2, order: 10, priority: 76, colour: "change", source: "transcript" },
  { key: "todo", line: 2, order: 20, priority: 70, colour: "identity", source: "transcript" },
  { key: "activity", line: 2, order: 30, priority: 68, colour: "identity", source: "transcript" },

  // Line 3: what is running, and what it is running out of.
  //
  // Two subjects on one line, merged at the owner's decision of 2026-09-07.
  // They were a line each: "how the model is configured" never filled one, and
  // "what is running out" is read in the same glance as what is spending it.
  // Everything both lines carried is still here — the terminal decides what
  // survives, not this table, and at 120 columns that is the model, the effort,
  // the three levels with their resets, and the savings figure.
  { key: "model", line: 3, order: 10, priority: 92, colour: "change", source: "payload" },
  { key: "effort", line: 3, order: 20, priority: 74, colour: "identity", source: "payload" },
  { key: "context", line: 3, order: 30, priority: 100, colour: "ramp", source: "payload" },
  { key: "fiveHour", line: 3, order: 40, priority: 94, colour: "ramp", source: "payload" },
  { key: "burnRate", line: 3, order: 42, priority: 66, colour: "ramp", source: "samples" },
  { key: "projection", line: 3, order: 44, priority: 64, colour: "identity", source: "samples" },
  { key: "sevenDay", line: 3, order: 50, priority: 90, colour: "ramp", source: "payload" },
  { key: "duration", line: 3, order: 55, priority: 50, colour: "identity", source: "payload" },
  // Raised from 40, the lowest on the bar, at the owner's decision: the
  // savings figure is to survive the merge rather than be the first thing the
  // narrower line gives up. What goes first instead is the session duration,
  // then the projection and the burn rate — all three derived from figures
  // that stay on the line.
  { key: "rtk", line: 3, order: 60, priority: 72, colour: "identity", source: "rtk" },
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

/**
 * One sentence per segment, saying what it shows.
 *
 * A terminal cannot raise a tooltip, so the answer lives where a reader can
 * ask for it: `doctor --explain` prints this list, and the composer page shows
 * a segment's line on hover, which is the one place the gesture works
 * (specs/019-explaining-a-segment, routes A and C).
 *
 * Written to say what the segment shows and why it earns its width, not to
 * restate its label. A reader who can already see `5h 62%` does not need to be
 * told it is the five-hour figure.
 */
export const SEGMENT_ABOUT = {
  dir: "The working directory, shortened from the left so the end that identifies it survives. Opens a terminal tab already changed into it.",
  projectDir: "The project root, shown only when you are somewhere below it.",
  repo: "Owner and repository name. Says what the directory cannot when the folder is not named after the project.",
  branch: "The branch you are on, or the short commit id when the head is detached — those are different claims and get different icons.",
  worktree: "The linked worktree you are in, and what it was created from.",
  conflicts: "Unmerged paths. They used to be folded into the changed-file count, which understated a state that halts everything until it is resolved.",
  worktreeState: "What the working tree holds and how far it has drifted: files changed, files untracked, commits to push, commits to pull. A count is omitted when it is zero.",
  linesChanged: "Lines this session added and removed, counted by Claude Code rather than by git. It sits beside the tree counters because that is where the eye looks for a diff stat.",
  pr: "The open pull request for this branch, its review state and its labels. Scoped to the branch, so one you just left cannot answer for the one you are on.",
  ci: "The last workflow run for this branch. It disappears rather than going stale: a green tick ten minutes old is worse than none.",
  skills: "The skills shaping this session, newest first, dropped once they fall outside the activity window. A skill a subagent invoked belongs to that subagent's row instead.",
  todo: "The current todo and how far the list has got.",
  activity: "Whether the transcript grew in the last ten seconds, or a subagent of this session is running. Nothing emits \"thinking now\", so this is the honest approximation.",
  model: "The model answering, and how much of its context window this session carries.",
  effort: "The reasoning effort it is running at.",
  context: "How full the context window is. The one figure that carries its level in colour alone, at the owner's decision.",
  fiveHour: "The five-hour usage window and when it comes back. It counts down, because inside a day a reset is something you wait out.",
  burnRate: "How fast the five-hour window is being spent, measured across recent samples. A percentage says where you are; a rate says whether you arrive before the reset.",
  projection: "When the five-hour window would run out, shown only when that lands before it resets — which is the only case where it changes what you do.",
  sevenDay: "The seven-day usage window and when it comes back. It names the day, because beyond a day a reset is something you plan around.",
  duration: "Wall-clock time since the session started.",
  rtk: "The share of tokens rtk has saved, a lifetime average across everything it has proxied rather than a figure for this session.",
};
