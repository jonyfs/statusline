/**
 * The starting points the composer page offers.
 *
 * A preset is an arrangement with an argument attached. The three sentences
 * are not decoration: a set of designs where only one has a case made for it
 * is a rigged vote, so every entry says what it optimises for, what it gives
 * up and who it is for, and the page shows all three.
 *
 * `conflicts` names any principle the design breaks. It is empty for every
 * preset that stays inside the constitution, and the page marks the ones
 * where it is not, so a choice is made with its cost in view rather than
 * discovered afterwards.
 */

/**
 * @typedef {object} Preset
 * @property {string} id
 * @property {string} label
 * @property {string} optimisesFor
 * @property {string} givesUp
 * @property {string} forWhom
 * @property {string[]} conflicts
 * @property {object} arrangement  An arrangement, in the file's own shape
 */

/**
 * Turns a list of keys into the `off` half of an arrangement, so a preset
 * that is mostly subtraction reads as the list of what it keeps.
 */
const off = (...keys) => Object.fromEntries(keys.map((k) => [k, { on: false }]));

/** Everything the bar can draw, so a preset can subtract from it. */
const EVERY_KEY = [
  "dir", "projectDir", "repo", "branch", "worktree", "conflicts", "worktreeState",
  "linesChanged", "pr", "ci",
  "skills", "todo", "activity",
  "model", "effort",
  "context", "fiveHour", "burnRate", "projection", "sevenDay", "resetMerged",
  "duration", "rtk",
];

/** Keeps the named keys and switches off everything else. */
const only = (...keep) => off(...EVERY_KEY.filter((k) => !keep.includes(k)));

/** @type {Preset[]} */
export const PRESETS = [
  {
    id: "today",
    label: "Today",
    optimisesFor: "Nothing being lost. Every fact the bar can report has a slot, on the line whose subject it belongs to.",
    givesUp: "Reading in one glance. Twenty-four segments compete for the columns the terminal reports, and on an 80-column window most of them lose.",
    forWhom: "Somebody who wants the whole session state available and is willing to look for the part they need.",
    conflicts: [],
    arrangement: { version: 1, name: "today", segments: {} },
  },
  {
    id: "lean",
    label: "Lean",
    optimisesFor: "Reading the whole bar in one fixation. Ten segments, nothing that repeats what a neighbour already says.",
    givesUp: "The counters and the second-order figures: the working-tree counts, the CI tick, the burn rate, the projection, the session duration and the savings.",
    forWhom: "Somebody who checks the bar between thoughts rather than studying it.",
    conflicts: [],
    arrangement: {
      version: 1,
      name: "lean",
      segments: only(
        "dir", "branch", "pr",
        "skills", "activity",
        "model",
        "context", "fiveHour", "sevenDay", "resetMerged"
      ),
    },
  },
  {
    id: "operational",
    label: "Operational",
    optimisesFor: "What the agent is doing. Skills, the todo and the working state come first; the repository moves below them.",
    givesUp: "Where you are being the first thing you read. The directory and the branch are on the second line.",
    forWhom: "Somebody watching a long agent run more than they are watching a checkout.",
    conflicts: [],
    arrangement: {
      version: 1,
      name: "operational",
      segments: {
        skills: { line: 1, order: 5 },
        todo: { line: 1, order: 6 },
        activity: { line: 1, order: 7 },
        dir: { line: 2, order: 10 },
        branch: { line: 2, order: 20 },
        worktree: { line: 2, order: 25 },
        conflicts: { line: 2, order: 28 },
        worktreeState: { line: 2, order: 30 },
        linesChanged: { line: 2, order: 35 },
        pr: { line: 2, order: 50 },
        ci: { line: 2, order: 60 },
        repo: { on: false },
        projectDir: { on: false },
      },
    },
  },
  {
    id: "peripheral",
    label: "Peripheral",
    optimisesFor: "Registering without being read. Five segments and three colour ramps, so the state lands in the corner of the eye.",
    givesUp: "Almost everything. No pull request, no skills, no counters, no countdown.",
    forWhom: "Somebody with the terminal on a second monitor who wants to notice trouble, not audit a session.",
    conflicts: [],
    arrangement: {
      version: 1,
      name: "peripheral",
      segments: only("branch", "model", "context", "fiveHour", "sevenDay"),
    },
  },
  {
    id: "twoLine",
    label: "Two lines",
    optimisesFor: "Height. The repository and the work share the first line, the limits and the model share the second.",
    givesUp: "The line-per-subject structure. A reader learns two lines by position rather than four by topic.",
    forWhom: "Somebody working in a short window, or with several terminals stacked.",
    conflicts: [],
    arrangement: {
      version: 1,
      name: "twoLine",
      segments: {
        skills: { line: 1, order: 70 },
        activity: { line: 1, order: 72 },
        model: { line: 2, order: 5 },
        projectDir: { on: false },
        repo: { on: false },
        linesChanged: { on: false },
        ci: { on: false },
        todo: { on: false },
        effort: { on: false },
        projection: { on: false },
        duration: { on: false },
        rtk: { on: false },
      },
    },
  },
  {
    id: "oneLine",
    label: "One line",
    optimisesFor: "A single row. Everything the bar keeps is on line 1, and the terminal's width decides the rest by priority.",
    givesUp: "The four-line structure, and with it any guarantee about what survives: on an 80-column window this is the context figure, the branch and little else.",
    forWhom: "Somebody who wants the statusline to cost one terminal row and is content to lose whatever does not fit.",
    conflicts: ["Principle II — the four-line display structure"],
    arrangement: {
      version: 1,
      name: "oneLine",
      segments: {
        skills: { line: 1, order: 70 },
        todo: { line: 1, order: 72 },
        activity: { line: 1, order: 74 },
        model: { line: 1, order: 76 },
        effort: { line: 1, order: 78 },
        context: { line: 1, order: 80 },
        fiveHour: { line: 1, order: 82 },
        sevenDay: { line: 1, order: 84 },
        resetMerged: { line: 1, order: 86 },
        burnRate: { on: false },
        projection: { on: false },
        duration: { on: false },
        rtk: { on: false },
        projectDir: { on: false },
        repo: { on: false },
        linesChanged: { on: false },
        ci: { on: false },
      },
    },
  },
];

/** Every preset, in the order the page shows them. */
export function presets() {
  return PRESETS;
}

/** One preset by id, or undefined. */
export function preset(id) {
  return PRESETS.find((p) => p.id === id);
}
