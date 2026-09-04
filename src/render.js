import { PALETTES, renderRow, displayWidth } from "./theme.js";
import {
  getDirLabel,
  getDirUrl,
  getGitInfo,
  getPrInfo,
  getRemoteUrl,
  getCiStatus,
  normalizePr,
  repoUrlFromPayload,
} from "./git.js";
import {
  getActiveSkills,
  getActiveSkillsTrueCount,
  getSessionActivity,
  sddStepFor,
  inProgressFeatureId,
  subagentActivity,
} from "./skills.js";
import {
  getContextPercent,
  getRateLimits,
  formatResetCountdown,
  shortCountdown,
  getContextTokens,
  getSessionCost,
  formatDuration,
  abbreviate,
} from "./tokens.js";
import { getRtkSavings } from "./rtk.js";
import { getOpenTabUrl } from "./openTerminalTab.js";
import { clockFaceFor, resetMomentLabel } from "./timeIcons.js";
import { trackChanges } from "./changeTracker.js";
import { reading, missing, isRenderable } from "./freshness.js";
import { byLine, segment, inChannel, SEGMENTS } from "./segments.js";
import { resolveArrangement } from "./arrangement.js";
import { resolveLayout } from "./config.js";
import { bar, rampColour, bandMark } from "./ramp.js";
import { ratePerHour, projectFull } from "./samples.js";
import { fitToWidth, alignColumns, linesToRender, rowWidth, terminalWidth, terminalHeight } from "./layout.js";

// Nerd Font glyphs, written as escapes rather than literal private-use
// characters: pasted literals silently vanished from this file once
// already, leaving empty strings that rendered as a bare gap. Every
// codepoint here was checked against the installed FiraCode Nerd Font's
// cmap table and then rendered from that font and looked at, because a
// codepoint's name is not evidence of its glyph (Principle X). The proof
// sheet is docs/glyph-evidence.png.
//
// Octicons wherever the segment shows git or GitHub state, so the line
// reads in the vocabulary its audience already knows; Material Design and
// Devicon elsewhere.
const NF_BRANCH = "\u{F418}";    // nf-oct-git_branch (GitHub's branch icon)
const NF_CLOCK = "\u{F43A}";     // nf-oct-clock
const NF_PR = "\u{F407}";        // nf-oct-git_pull_request

// A blank calendar grid, deliberately NOT the 📆 emoji: every emoji font
// draws a fixed date on that glyph (Apple renders "17"), so beside a real
// expiry day it reads as a date that never changes and contradicts the
// text next to it. Unicode has no per-date emoji, so the day is text.
const NF_CALENDAR = "\u{F455}";  // nf-oct-calendar

// GitHub's own diff and sync markers, so the working-tree state reads in
// the vocabulary anyone who uses GitHub already knows. Each glyph was
// rendered and inspected before being adopted: codepoint names in Nerd
// Font tables proved unreliable (F433 "repo_push" draws a down arrow,
// F45D "arrow_up" draws a signpost), so the name is not evidence.
const NF_MODIFIED = "\u{F459}";  // boxed dot, GitHub's "modified" marker
const NF_ADDED = "\u{F457}";     // boxed plus, GitHub's "added" marker
const NF_PUSH = "\u{F40A}";      // cloud up: commits waiting to be pushed
const NF_PULL = "\u{F409}";      // cloud down: commits waiting to be pulled

// A commit, for a detached HEAD. The branch icon would claim the line is
// showing a branch when it is showing a commit id.
const NF_COMMIT = "\u{F417}";    // nf-oct-git_commit

// The rest of line 1's git and GitHub state, in the same Octicon set.
const NF_DIR = "\u{F413}";       // nf-oct-file_directory
const NF_FROM = "\u{F004D}";     // nf-md-arrow_left: what this came from
const NF_ALERT = "\u{F421}";     // nf-oct-alert: unmerged paths
const NF_CHECK = "\u{F42E}";     // nf-oct-check: the run passed
const NF_X = "\u{F467}";         // nf-oct-x: the run failed
const NF_RUNNING = "\u{F0997}";  // nf-md-progress_clock: still going

// Lines 2, 3 and 4. These carried emoji until 2026-09-01, and emoji cost
// two columns each where a private-use glyph costs one: eight of them were
// spending eight columns of a bar whose segments already compete for the
// width COLUMNS reports (Principle I, Glyphs).
const NF_TASKLIST = "\u{F4A0}";  // nf-oct-tasklist. F0BE, listed as
                                 // "checklist", draws the App Store logo
const NF_WORKING = "\u{F0765}";  // nf-md-circle
const NF_IDLE = "\u{F0766}";     // nf-md-circle_outline
const NF_SKILLS = "\u{F0431}";   // nf-md-puzzle
const NF_MODEL = "\u{F06A9}";    // nf-md-robot
const NF_EFFORT = "\u{F0E7}";    // nf-fa-bolt
const NF_CONTEXT = "\u{F035B}";  // nf-md-memory: a context window is memory.
                                 // F09DA, listed as "brain", draws a boxed
                                 // chevron in this build
const NF_TIMER = "\u{F051B}";    // nf-md-timer. F44E, listed as "stopwatch",
                                 // draws three flat bars in this build
const NF_HOURGLASS = "\u{F252}"; // nf-fa-hourglass_half: session duration
const NF_BURN = "\u{F0238}";     // nf-md-fire: how fast the window is going
const NF_RUST = "\u{E7A8}";      // nf-dev-rust: rtk is a Rust binary

/**
 * The whole glyph set, and the substitute used when the terminal has no
 * Nerd Font. Every glyph the bar can emit is a row here, per Principle X:
 * one written inline in a render function is one `CLAUDE_STATUSLINE_ASCII=1`
 * cannot replace, and a fallback that swaps some icons and not others
 * leaves boxes on the line while claiming to have removed them.
 *
 * The substitutes are plain Unicode and emoji, which need no special font.
 * They are wider than what they stand in for, and that is the trade: a
 * terminal without the font gets a readable bar rather than a narrow one.
 *
 * Every codepoint in the `nerd` column must also be listed in
 * `scripts/extract-glyphs.py`, or it renders in the terminal and vanishes
 * from the generated previews.
 */
export const GLYPHS = {
  nerd: {
    branch: NF_BRANCH,
    commit: NF_COMMIT,
    clock: NF_CLOCK,
    pr: NF_PR,
    calendar: NF_CALENDAR,
    modified: NF_MODIFIED,
    added: NF_ADDED,
    push: NF_PUSH,
    pull: NF_PULL,
    dir: NF_DIR,
    from: NF_FROM,
    conflict: NF_ALERT,
    ciPass: NF_CHECK,
    ciFail: NF_X,
    ciRunning: NF_RUNNING,
    todo: NF_TASKLIST,
    working: NF_WORKING,
    idle: NF_IDLE,
    skills: NF_SKILLS,
    model: NF_MODEL,
    effort: NF_EFFORT,
    context: NF_CONTEXT,
    timer: NF_TIMER,
    duration: NF_HOURGLASS,
    burn: NF_BURN,
    rtk: NF_RUST,
  },
  plain: {
    branch: "\u{1F33F}",   // 🌿
    commit: "\u{25C6}",    // ◆
    clock: "\u{23F0}",     // ⏰
    pr: "\u{1F500}",       // 🔀
    calendar: "\u{1F4C5}", // 📅
    modified: "\u{25CF}",  // ●
    added: "+",
    push: "\u{2191}",      // ↑
    pull: "\u{2193}",      // ↓
    dir: "\u{1F4C1}",      // 📁
    from: "\u{2190}",      // ←
    conflict: "\u{2716}",  // ✖
    ciPass: "\u{2713}",    // ✓
    ciFail: "\u{2717}",    // ✗
    ciRunning: "\u{25D0}", // ◐
    todo: "\u{25B8}",      // ▸
    working: "\u{25CF}",   // ●
    idle: "\u{25CB}",      // ○
    skills: "\u{1F9E9}",   // 🧩
    model: "\u{1F916}",    // 🤖
    effort: "\u{26A1}",    // ⚡
    context: "\u{1F9E0}",  // 🧠
    timer: "\u{23F1}\u{FE0F}", // ⏱️
    duration: "\u{23F3}",  // ⏳
    burn: "\u{1F525}",     // 🔥
    rtk: "\u{1F980}",      // 🦀
  },
};

const SKILL_CHIP_COLORS = ["green", "sapphire", "mauve", "peach", "teal", "pink"];

/**
 * Principle II caps a rendered line at 120 columns. Past that a terminal
 * wraps, and one status line silently becomes two.
 *
 * Overridable per render, which is how the trim order is exercised without
 * having to invent content wide enough to overflow a real line.
 */
export const MAX_LINE_WIDTH = 120;

async function readStdinAsync() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

export async function render({ asciiArrows = false, flavor = "mocha" } = {}) {
  const raw = await readStdinAsync();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (process.env.CLAUDE_STATUSLINE_DEBUG === "1") {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const os = await import("node:os");
      const dir = path.join(os.homedir(), ".claude", "statusline");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "debug-last-payload.json"), raw || "{}");
    } catch {
      // debug-only, never let this affect the real render
    }
  }

  return renderPayload(payload, { asciiArrows, flavor });
}

/**
 * Reads every source once and returns a reading per segment.
 *
 * Separated from rendering so that "what did the sources say, how old is
 * it, and how long did it take" is answerable without producing a line.
 * The diagnostic reports exactly this, which is what stops it describing
 * behaviour the renderer does not have.
 */
/**
 * How many skills the line shows, and how many it looks for.
 *
 * It asks for more than it shows so it can say how many were left out. A
 * line that shows three of five without saying so claims those three are
 * all of them (FR-013).
 */
const SKILLS_SHOWN = 5;
const SKILLS_PROBED = 12;

function skillsReading(timed, probe, payload, scanned, scannedTrueCount, subagentLabels) {
  // The session id lets the hook's event file be found. Without one, or
  // without the hook, the transcript answers instead and the line is the
  // same, only slower to react. `scanned` is what the activity pass already
  // found on that same walk, so the fallback costs no second read.
  const all = timed("transcript", () =>
    probe.getActiveSkills(payload?.transcript_path, SKILLS_PROBED, {
      sessionId: payload?.session_id,
      scanned,
    })
  );
  const directlyInvoked = Array.isArray(all.value) ? all.value : [];
  // Running subagent activity (specs/011-multiagent-skills-line, FR-001),
  // merged in and deduplicated the same way directly-invoked skills already
  // are, so the two sources read as one fact rather than two competing
  // lists. An empty/stale snapshot contributes nothing, so this changes
  // nothing when no subagent is running (FR-004).
  const subagent = subagentLabels.filter((label) => !directlyInvoked.includes(label));
  const list = [...directlyInvoked, ...subagent];
  // Not `list.length` alone: the directly-invoked half is itself already
  // capped at SKILLS_PROBED, so computing "hidden" from its length only
  // ever reported what the scan happened to examine, not what was
  // actually active (FR-002, specs/008-skills-line-completeness). The
  // subagent half rides on top of that true count (FR-002, specs/011).
  const trueCount =
    probe.getActiveSkillsTrueCount(payload?.transcript_path, {
      sessionId: payload?.session_id,
      scanned,
      scannedTrueCount,
    }) + subagent.length;
  return {
    ...all,
    value: list.slice(0, SKILLS_SHOWN),
    hiddenCount: Math.max(0, trueCount - SKILLS_SHOWN),
  };
}

export function gather(payload, probe, { now = Date.now() } = {}) {
  const timed = (source, fn) => {
    const started = Date.now();
    try {
      const value = fn();
      return reading({ value: value ?? null, at: now, source, tookMs: Date.now() - started });
    } catch (err) {
      return missing(source, err?.message || String(err), Date.now() - started);
    }
  };

  const cwd = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  const { fiveHourPct, fiveHourResetsAt, sevenDayPct, sevenDayResetsAt } = getRateLimits(payload);

  const git = timed("git", () => probe.getGitInfo(cwd));
  const hasRepo = git.value !== null;
  // A detached HEAD has no branch name to scope a lookup by, and the short
  // commit id is not one: matching it against a stored branch would refuse
  // every cached answer instead of the wrong ones.
  const namedBranch = git.value && !git.value.detached ? git.value.branch : null;

  // One walk over the transcript answers the skills, the todo list and
  // whether anything happened recently. It runs before the skills reading so
  // that reading can use what it found rather than walking the file again.
  const activity = timed("transcript", () =>
    probe.getSessionActivity(payload?.transcript_path, { now, limit: SKILLS_PROBED })
  );
  // Read once, used in two places (the working/idle patch below, and the
  // skills chip): `subagentActivity` is a file read, and the redraw budget
  // does not have room for the same read twice (specs/012, specs/011).
  const subagent = probe.subagentActivity(now);
  // The top-level transcript going quiet doesn't mean nothing is
  // happening: a subagent can be doing the actual work right now (specs/012-
  // subagent-activity-status, FR-001). A running subagent alone is enough
  // to say "working"; with none, this is a no-op and `working` is exactly
  // what the transcript already said (FR-005).
  if (activity.value) {
    activity.value.working = activity.value.working || subagent.length > 0;
  }
  const payloadPr = normalizePr(payload?.pr, "payload");
  const payloadRepoUrl = repoUrlFromPayload(payload?.workspace?.repo);

  return {
    cwd,
    dir: reading({ value: getDirLabel(cwd), at: now, source: "payload" }),
    dirUrl: timed("payload", () => probe.getDirUrl(cwd)),
    git,
    // The payload carries both of these, and did all along. Asking git and
    // gh for them cost a subprocess each: 540 ms for `gh pr view` on a warm
    // network, and its whole timeout when it cannot reach GitHub. The probes
    // stay as fallbacks, for a Claude Code too old to send the fields or a
    // pull request it has not found yet.
    remote: hasRepo
      ? payloadRepoUrl
        ? reading({ value: payloadRepoUrl, at: now, source: "payload" })
        : timed("git", () => probe.getRemoteUrl(cwd))
      : missing("git", "not a repository"),
    repo: hasRepo
      ? reading({ value: payload?.workspace?.repo ?? null, at: now, source: "payload" })
      : missing("payload", "not a repository"),
    // Both `gh` lookups are cached per repository and answer about whichever
    // branch was checked out when they ran, so the branch travels with the
    // question: a pull request or a run from the branch you just left is not
    // an older answer, it is an answer about something else.
    pr: hasRepo
      ? payloadPr
        ? reading({ value: payloadPr, at: now, source: "payload" })
        : timed("gh", () => normalizePr(probe.getPrInfo(cwd, { branch: namedBranch }), "gh"))
      : missing("gh", "not a repository"),
    skills: skillsReading(timed, probe, payload, activity.value?.skills, activity.value?.skillsTrueCount, subagent),
    activity,
    ci: hasRepo
      ? timed("gh", () => probe.getCiStatus(cwd, { branch: namedBranch }))
      : missing("gh", "not a repository"),
    // Exposed so the diagnostic can say how much history exists, which is
    // why a rate is or is not on the bar yet.
    samples: reading({ value: [], at: now, source: "samples" }),
    rtk: timed("rtk", () => probe.getRtkSavings(cwd)),
    model: reading({
      value: payload?.model?.display_name || payload?.model?.id || "Claude",
      at: now,
      source: "payload",
    }),
    effort: reading({ value: payload?.effort?.level ?? null, at: now, source: "payload" }),
    outputStyle: reading({ value: payload?.output_style?.name ?? null, at: now, source: "payload" }),
    // Everything below arrives on stdin. None of it costs a process, and
    // none of it was on the bar before feature 002.
    agent: reading({ value: payload?.agent?.name ?? null, at: now, source: "payload" }),
    sessionName: reading({ value: payload?.session_name ?? null, at: now, source: "payload" }),
    projectDir: reading({ value: payload?.workspace?.project_dir ?? null, at: now, source: "payload" }),
    worktree: reading({
      value: payload?.worktree?.name
        ? { name: payload.worktree.name, from: payload.worktree.original_branch ?? null }
        : payload?.workspace?.git_worktree
          ? { name: payload.workspace.git_worktree, from: null }
          : null,
      at: now,
      source: "payload",
    }),
    tokens: reading({ value: getContextTokens(payload), at: now, source: "payload" }),
    sessionCost: reading({ value: getSessionCost(payload), at: now, source: "payload" }),
    context: reading({ value: getContextPercent(payload), at: now, source: "payload" }),
    fiveHour: reading({ value: fiveHourPct, at: now, source: "payload" }),
    fiveHourReset: reading({ value: fiveHourResetsAt, at: now, source: "payload" }),
    sevenDay: reading({ value: sevenDayPct, at: now, source: "payload" }),
    sevenDayReset: reading({ value: sevenDayResetsAt, at: now, source: "payload" }),
    // The merged countdown segment draws both moments, so it gets a reading
    // that holds both. With only the 5-hour one behind it, the diagnostic
    // described half of what the line shows.
    resetMerged: reading({
      value:
        fiveHourResetsAt === null && sevenDayResetsAt === null
          ? null
          : { fiveHour: fiveHourResetsAt, sevenDay: sevenDayResetsAt },
      at: now,
      source: "payload",
    }),
  };
}

/**
 * Renders a payload that's already parsed. `sources` exists so the preview
 * generator can supply fixed git/PR/skill/rtk values instead of probing the
 * real machine — previews must be reproducible, and they'd otherwise show
 * whatever branch and usage happened to be live when they were generated.
 * Runtime always uses the real probes (the defaults below).
 */
export function renderPayload(
  payload,
  {
    asciiArrows = false,
    flavor = "mocha",
    sources = {},
    trackChanges: tracking = true,
    now = Date.now(),
    // Both default to what the terminal reports. A caller that passes them
    // is a test or a preview, where the point is a fixed size.
    maxWidth = terminalWidth(),
    maxHeight = terminalHeight(),
    // A test or a preview passes its own; a real redraw finds the person's
    // file for itself.
    layout = null,
    // A fixed sample history, for a caller that has no session state to read
    // one from. A real redraw leaves this alone and uses its own.
    samples = null,
  } = {}
) {
  const probe = {
    getGitInfo,
    getPrInfo,
    getRemoteUrl,
    getActiveSkills,
    getActiveSkillsTrueCount,
    subagentActivity,
    getSessionActivity,
    getCiStatus,
    getRtkSavings,
    getDirUrl: (cwd) => getOpenTabUrl(cwd) || getDirUrl(cwd),
    ...sources,
  };

  const cwd = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  const found = layout ?? resolveLayout(cwd);

  const readings = gather(payload, probe, { now });
  return renderReadings(readings, payload, {
    asciiArrows,
    flavor,
    tracking,
    now,
    maxWidth,
    maxHeight,
    arrangement: found.arrangement,
    arrangementOrigin: found.origin,
    samples,
  });
}

/** Turns readings into the lines. Split out so the diagnostic can reuse `gather`. */
export function renderReadings(
  readings,
  payload,
  {
    asciiArrows = false,
    flavor = "mocha",
    tracking = true,
    now = Date.now(),
    // The real terminal, when Claude Code tells us what it is. The old
    // constant survives as the fallback for versions that do not.
    maxWidth = terminalWidth(),
    maxHeight = terminalHeight(),
    // The diagnostic asks for the lines with their line numbers attached, so
    // it can say "line 3" rather than "the second thing printed". With line 2
    // absent those are different lines, and the diagnostic exists to explain
    // the layout rather than to renumber it.
    asRows = false,
    // Every segment this session would draw, before any of them are arranged
    // into rows or dropped for width. The composer page is built from this:
    // it rearranges real segments rather than approximating them, so a bar it
    // shows cannot differ from the bar the terminal draws.
    asPool = false,
    // A sample history to compute the burn rate and the projection from,
    // instead of the one on disk. Only a generator passes this; a real
    // redraw has its own history and must not be told a different one.
    samples: sampleOverride = null,
    // The person's own bar: which segments are on, in what order, on which
    // line, against which edge. Nothing means the registry, unchanged.
    arrangement = null,
    // Where that arrangement came from, carried through for the diagnostic.
    arrangementOrigin = "default",
  } = {}
) {
  // The segment key decides the maximum age; the reading name says where
  // to look. They differ for the git snapshot, which three segments share.
  const shows = (key, name = key) => isRenderable(key, readings[name], now);

  const git = shows("branch", "git") ? readings.git.value : null;
  const pr = shows("pr") ? readings.pr.value : null;
  const remoteUrl = shows("remote") ? readings.remote.value : null;
  const skills = shows("skills") ? readings.skills.value : [];
  const rtkPct = shows("rtk") ? readings.rtk.value : null;
  const modelName = shows("model") ? readings.model.value : "Claude";
  const effort = shows("effort") ? readings.effort.value : null;
  const outputStyle = shows("outputStyle") ? readings.outputStyle.value : null;
  const dirLabel = readings.dir.value;
  const dirUrl = shows("dir", "dirUrl") ? readings.dirUrl.value : null;

  // The usage figures are the one place an absent value keeps its slot:
  // Principle III and FR-010 require `?%` rather than a segment that
  // quietly disappears, so a reader can tell "unknown" from "moved".
  const ctxPct = readings.context.value;
  const fiveHourPct = readings.fiveHour.value;
  const sevenDayPct = readings.sevenDay.value;
  const fiveHourResetsAt = readings.fiveHourReset.value;
  const sevenDayResetsAt = readings.sevenDayReset.value;
  const fiveHourResetLabel = formatResetCountdown(fiveHourResetsAt, now) ?? "reset time unknown";
  const sevenDayResetLabel = formatResetCountdown(sevenDayResetsAt, now) ?? "reset time unknown";

  // Only discrete state feeds change tracking — usage percentages tick on
  // almost every render and would leave the line permanently animated.
  const changes = trackChanges(
    payload?.session_id,
    {
      branch: git?.branch ?? null,
      ahead: git && git.ahead !== null ? String(git.ahead) : null,
      behind: git && git.behind !== null ? String(git.behind) : null,
      pr: pr ? `${pr.number}:${pr.state}:${pr.isDraft}` : null,
      skills: skills.join(","),
      model: modelName,
      effort: effort ?? "",
    },
    {
      enabled: tracking,
      now,
      // The four segments that need a direction rather than a value read
      // from here. Sampling costs one small write on a file that is already
      // written every redraw.
      //
      // The raw percentages, not the rounded ones the bar shows. A slope of
      // a tenth of a point per redraw quantizes into a step of one whole
      // point when sampled after rounding, and the rate computed from that
      // is wrong by whatever the rounding happened to do.
      sample: {
        contextPct: payload?.context_window?.used_percentage ?? ctxPct,
        fiveHourPct: payload?.rate_limits?.five_hour?.used_percentage ?? fiveHourPct,
        rtkPct,
      },
    }
  );

  // Sampling normally rides the session's own state file. A generated page
  // has no session, so it brings its own history rather than showing a bar
  // with two segments permanently missing.
  const sampleHistory = sampleOverride ?? changes.samples;

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const g = asciiArrows ? GLYPHS.plain : GLYPHS.nerd;
  const opts = { asciiArrows };
  // The rows are kept as segment lists until every line exists, because
  // aligning the first column across the bar needs all of them at once.
  // Rendering each line to text as it was built is what left that alignment
  // written but never applied.
  const rows = [];
  // Which of the four each rendered row is. Shedding needs to know, and a
  // line that renders only sometimes made an index-based guess wrong.
  const rendered = [];
  // Every segment built this render, in build order, each recorded once.
  // Filled from `fit` because that is the single point every line's content
  // passes through before anything is dropped.
  const pool = [];
  const pooled = new Set();

  // Where every segment goes: the registry, with the person's own choices
  // over the top of it. With no arrangement this resolves to the registry
  // unchanged, which is what keeps the default bar byte-identical.
  const resolved = resolveArrangement(SEGMENTS, arrangement, arrangementOrigin);
  const placements = new Map(resolved.placements.map((p) => [p.key, p]));

  /**
   * The placement for a built segment. A skill chip has no registry row of
   * its own, so it inherits the one its key is prefixed with.
   */
  const placementFor = (key) => placements.get(key) ?? placements.get(String(key).split(":")[0]);

  /**
   * Attaches each descriptor's placement, so position and priority both come
   * from one resolved answer rather than from the order the code happened to
   * push things in.
   */
  const attach = (seg) => {
    const meta = placementFor(seg.key);
    const registryRow = segment(seg.key) || segment(String(seg.key).split(":")[0]);
    return {
      priority: meta?.priority ?? registryRow?.priority ?? 50,
      order: meta?.order ?? registryRow?.order ?? 999,
      line: meta?.line ?? registryRow?.line ?? 1,
      ...registryRow,
      ...(meta ?? {}),
      ...seg,
    };
  };

  /** Drops the least important segments until the row fits the terminal. */
  const fitRow = (row) => fitToWidth(row, maxWidth);

  /** Records a segment in the pool once, whatever the arrangement does to it. */
  const collect = (segs) => {
    for (const seg of segs) {
      if (pooled.has(seg.key)) continue;
      pooled.add(seg.key);
      pool.push({ key: seg.key, text: seg.text, color: seg.color, ...(seg.url ? { url: seg.url } : {}) });
    }
  };

  // Line 1: working directory, then branch, ahead/behind, PR — each name
  // is an OSC 8 hyperlink when a target is known (dir -> file://, branch ->
  // GitHub tree view, PR -> PR page), with no visible URL text.
  const dirSegment = (label) => ({ key: "dir", color: "surface1", text: ` ${g.dir} ${label} `, url: dirUrl });
  const l1 = [dirSegment(dirLabel)];

  // A17: Claude can move during a session, and then the directory on the bar
  // is not the directory the session started in. Both render only when they
  // differ, because in most sessions they do not.
  const projectDir = shows("projectDir") ? readings.projectDir.value : null;
  if (projectDir && projectDir !== readings.cwd) {
    l1.push({ key: "projectDir", color: "surface2", text: ` ${g.from} ${getDirLabel(projectDir)} ` });
  }
  if (git) {
    const detached = git.detached === true || git.branch === "(detached)";
    const label = detached ? git.oid?.slice(0, 7) || "detached" : git.branch;
    // A detached HEAD is a commit, not a branch. Linking it to a tree view
    // and drawing a branch icon beside it would say otherwise.
    const branchUrl = !detached && remoteUrl ? `${remoteUrl}/tree/${git.branch}` : null;
    l1.push({
      key: "branch",
      color: changes.colourFor("branch", "lavender", palette),
      text: ` ${detached ? g.commit : g.branch} ${label} `,
      url: branchUrl,
    });
    // Working-tree state and divergence from upstream, right after the
    // branch. Each count is omitted when it's zero, so a clean branch in
    // sync with its upstream adds nothing to the line at all.
    const state = [];
    // File counts are not animated: they change on every save, and
    // Principle X reserves animation for state that changes discretely.
    if (git.changed) state.push(`${g.modified} ${git.changed}`);
    if (git.untracked) state.push(`${g.added} ${git.untracked}`);
    // A null ahead/behind means there is no upstream at all, which is not
    // the same as being in sync with one (FR-012).
    if (git.ahead) state.push(`${g.push} ${git.ahead}`);
    if (git.behind) state.push(`${g.pull} ${git.behind}`);
    if (state.length) {
      l1.push({ key: "worktreeState", color: "mauve", text: ` ${state.join("  ")} ` });
    }
    // A2's chosen form: owner and repo as text. It repeats the directory in
    // a repository whose folder is named after it, and says something the
    // directory cannot in one that is not.
    const repo = shows("repo") ? readings.repo.value : null;
    if (repo?.owner && repo.name) {
      l1.push({ key: "repo", color: "surface2", text: ` ${repo.owner}/${repo.name} ` });
    }
    // B10: closes the loop after a push without leaving the terminal. It is
    // a cached value by construction, and disappears rather than going
    // stale, because a green tick ten minutes old is worse than none.
    const ci = shows("ci") ? readings.ci.value : null;
    if (ci) {
      const running = ci.status && ci.status !== "completed";
      const passed = ci.conclusion === "success";
      const mark = running ? g.ciRunning : passed ? g.ciPass : g.ciFail;
      const colour = running ? "yellow" : passed ? "green" : "red";
      l1.push({ key: "ci", color: colour, text: ` ${mark} ${ci.workflow ?? "CI"} ` });
    }
    // What this session changed, which is a different question from what the
    // working tree looks like: the payload counts it, git does not. It sits
    // beside the tree counters because that is where the eye looks for a
    // diff stat.
    const sessionCost = shows("linesChanged", "sessionCost") ? readings.sessionCost.value : null;
    if (sessionCost && (sessionCost.linesAdded !== null || sessionCost.linesRemoved !== null)) {
      l1.push({
        key: "linesChanged",
        color: "green",
        text: ` +${sessionCost.linesAdded ?? 0} −${sessionCost.linesRemoved ?? 0} `,
      });
    }
    // B8: an unmerged path stops everything until it is resolved, which is
    // not what an ordinary changed file means.
    if (git.conflicts) {
      l1.push({ key: "conflicts", color: "red", text: ` ${g.conflict} ${git.conflicts} ` });
    }
    // A19: which worktree, and what it came from. The branch name alone does
    // not always say, and a worktree is exactly when you need to be sure.
    const worktree = shows("worktree") ? readings.worktree.value : null;
    if (worktree) {
      const from = worktree.from ? ` ${g.from} ${worktree.from}` : "";
      l1.push({ key: "worktree", color: "teal", text: ` ${worktree.name}${from} ` });
    }
    if (pr) {
      // `changes_requested` is the one review state too long to spell out on
      // a line this tight, and "changes" says it.
      const review = pr.review === "changes_requested" ? "changes" : pr.review;
      const label = pr.kind === "mr" ? "MR" : "PR";
      // Same "show a few, count the rest" shape as the skills chip: a PR
      // with zero labels must render exactly as before this field existed
      // (specs/006, FR-003), so the suffix is only ever added, never a
      // placeholder for the empty case.
      const prLabels = pr.labels ?? [];
      const shownLabels = prLabels.slice(0, 3);
      const hiddenLabels = Math.max(0, prLabels.length - shownLabels.length);
      const labelText = shownLabels.length
        ? ` ${shownLabels.join(", ")}${hiddenLabels > 0 ? ` +${hiddenLabels}` : ""}`
        : "";
      l1.push({
        key: "pr",
        color: changes.colourFor("pr", "blue", palette),
        text: ` ${g.pr} ${label} #${pr.number}${review ? ` ${review}` : ""}${labelText} `,
        url: pr.url,
      });
    }
  }
  // What every line is built from, before the arrangement decides where any
  // of it goes. Content and placement are two questions, and keeping them
  // apart is what lets a segment move to another line without its builder
  // knowing anything about it.
  const content = [...l1];

  // F7 and F6, on the line that already describes what the session is doing.
  // Both come from the transcript pass that already runs for the skills.
  const activity = shows("activity") ? readings.activity.value : null;
  function pushLine2Extras(row) {
    if (activity?.todos) {
      const { done, total, current } = activity.todos;
      const label = current ? `${current} (${done}/${total})` : `${done}/${total}`;
      row.push({ key: "todo", color: "sapphire", text: ` ${g.todo} ${label} ` });
    }
    if (activity) {
      row.push({
        key: "activity",
        color: activity.working ? "green" : "surface2",
        text: activity.working ? ` ${g.working} working ` : ` ${g.idle} idle `,
      });
    }
  }

  // Line 2: active skills, one chip per skill, distinct colors, no bullets.
  // When more are active than the line shows, the count of the rest is
  // stated rather than left silent: "these three" and "three of five" are
  // different claims, and only one of them is true (FR-013).
  if (skills.length) {
    // D7's chosen form: one chip carrying the list, not one chip per skill.
    // A chip per skill spent a separator and two spaces on each name, so
    // three of them gave up a third of the line to padding. As one list they
    // read as one fact, which is what they are: what is shaping the work
    // right now.
    const hidden = readings.skills.hiddenCount ?? 0;
    // The most recent skill is index 0 (getActiveSkills's own contract:
    // newest first). The in-progress feature id takes the parenthetical
    // when a speckit-* skill is active and one is recorded; the SDD step
    // label is the fallback when no feature id is available (specs/009,
    // research.md); neither is shown for a non-speckit skill.
    const sddStep = sddStepFor(skills[0]);
    const featureId = sddStep ? inProgressFeatureId(readings.cwd) : null;
    const skillsSuffix = featureId ?? sddStep;
    const l2 = [
      {
        key: "skills",
        color: changes.colourFor("skills", "green", palette),
        text: ` ${g.skills} ${skills.join(", ")}${hidden > 0 ? ` +${hidden}` : ""}${skillsSuffix ? ` (${skillsSuffix})` : ""} `,
      },
    ];
    pushLine2Extras(l2);
    content.push(...l2);
  } else {
    const l2 = [];
    pushLine2Extras(l2);
    content.push(...l2);
  }

  // Line 3: model, then effort and output style as separate segments. They
  // are different things, and one standing in for the other behind the
  // same icon is a segment that lies about what it shows (FR-021).
  // Composed from the registry: which segments belong on this line, and in
  // what order, is a property of the table rather than of this function.
  // What each one says is still built here, because that is content, not
  // layout.
  const line3Content = {
    model: () => ({
      color: changes.colourFor("model", "red", palette),
      text: ` ${g.model} ${modelName} `,
    }),
    effort: () => (effort ? { color: "peach", text: ` ${g.effort} ${effort} ` } : null),
  };
  const l3 = byLine(3)
    .map((s) => {
      const built = line3Content[s.key]?.();
      return built ? { key: s.key, ...built } : null;
    })
    .filter(Boolean);
  content.push(...l3);

  // Line 4: context / 5h window + its reset / 7d window + its reset / rtk.
  // Each reset segment's clock face is the actual hour the window resets,
  // and the 7-day segment names the real day it expires, so the icon
  // carries the information rather than decorating it.
  const fiveHourClock = clockFaceFor(fiveHourResetsAt) ?? g.clock;
  const sevenDayClock = clockFaceFor(sevenDayResetsAt) ?? g.clock;
  const sevenDayMoment = resetMomentLabel(sevenDayResetsAt, new Date(now));
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const farOutMoment =
    typeof sevenDayResetsAt === "number" && sevenDayResetsAt * 1000 - now > ONE_DAY_MS
      ? sevenDayMoment
      : null;
  // Whichever window resets first owns the clock face on the merged segment.
  const soonerClock =
    typeof fiveHourResetsAt === "number" && typeof sevenDayResetsAt === "number"
      ? fiveHourResetsAt <= sevenDayResetsAt
        ? fiveHourClock
        : sevenDayClock
      : (typeof fiveHourResetsAt === "number" ? fiveHourClock : null) ??
        (typeof sevenDayResetsAt === "number" ? sevenDayClock : null);

  const line4Content = {
    // The three ramped segments. Colour says which band the level is in, and
    // the bar's own characters say it again, because colour may not be the
    // only carrier (E6). An unknown level keeps the segment's own colour and
    // draws an empty track: `?%` is the honest answer, and a bar that
    // vanished would make the line's width jump.
    // The bar was ten to sixteen columns for something the number says in
    // three, on the line that is already the widest. It is gone; the band it
    // carried is now a one-character mark, so the meaning still survives
    // without colour (item E6, and Section 508).
    // The context figure carries its level in colour only. The band mark it
    // used to carry was removed on 2026-08-26 at the owner's request, so
    // this is the one ramped segment where colour is the sole carrier. The
    // 5-hour and 7-day figures beside it still mark their band, and they
    // are the ones with a consequence you cannot undo.
    context: () => ({
      color: rampColour(ctxPct, "yellow"),
      text: ` ${g.context} Context ${ctxPct ?? "?"}% `,
    }),
    fiveHour: () => ({
      color: rampColour(fiveHourPct, "green"),
      text: ` ${g.timer} 5h ${fiveHourPct ?? "?"}%${bandMark(fiveHourPct)} `,
    }),
    sevenDay: (o) => ({
      color: rampColour(sevenDayPct, "sapphire"),
      // C4's chosen form: the weekday only when the reset is more than a day
      // out. Inside a day the countdown beside it says everything, and the
      // weekday would be today's or tomorrow's name for no gain.
      text: ` ${g.calendar} 7d ${sevenDayPct ?? "?"}%${bandMark(sevenDayPct)}${o.moment && farOutMoment ? ` · ${farOutMoment}` : ""} `,
    }),
    // C6: both countdowns, one segment. The clock face is the sooner of the
    // two, since that is the one about to matter.
    // E8: dimmed, being context for the figures beside it rather than a
    // figure itself.
    resetMerged: (o) => {
      const both = [
        o.fiveHourText ? shortCountdown(fiveHourResetsAt, now) : null,
        o.sevenDayText ? shortCountdown(sevenDayResetsAt, now) : null,
      ].filter(Boolean);
      const face = soonerClock ?? g.clock;
      // An unknown reset says so. A bare clock face would be the empty slot
      // Principle III rules out: the reader could not tell "no reset time in
      // the payload" from "the segment lost its text".
      if (!both.length) return { color: "surface2", text: ` ${face} reset unknown ` };
      return { color: "surface2", text: ` ${face} ${both.join(" / ")} ` };
    },
    // C5 asked for this figure to render only once it had moved five points,
    // on the reasoning that a number repeating itself every redraw is a
    // number nobody reads. That reasoning does not survive what the number
    // is: `rtk gain` reports a lifetime average over thousands of commands,
    // and a lifetime average does not move five points. The segment showed
    // itself on a session's first redraw and was never seen again.
    //
    // So it renders whenever there is a value. Its width is already governed
    // by its priority, the lowest on the bar, which makes it the first thing
    // a narrow line drops — the same outcome the throttle was reaching for,
    // decided by the terminal rather than by a threshold the figure cannot
    // cross.
    rtk: (o) => {
      if (!o.rtk || rtkPct === null) return null;
      return { color: "mauve", text: ` ${g.rtk} rtk ${rtkPct}% saved ` };
    },

    // B1: a percentage says where you are; a rate says whether you get there
    // before the window resets, which is the decision you actually make.
    burnRate: () => {
      const rate = ratePerHour(sampleHistory, "fiveHourPct");
      if (rate === null || rate <= 0) return null;
      return {
        color: rampColour(fiveHourPct, "peach"),
        text: ` ${g.burn} ${rate.toFixed(rate < 10 ? 1 : 0)}%/h `,
      };
    },
    // B2: the sentence you were going to say out loud anyway. It renders
    // only when the window would run out before it resets, because that is
    // the only case where it changes what you do.
    //
    // It says "5h limit" rather than "empty", which is what it said until
    // 2026-09-01. Empty of what was never on the line: beside three
    // percentages, a bare "empty" reads as a segment that lost its value
    // rather than as a time. The window it projects is named for the same
    // reason, since the 7-day figure sits two segments away and is also a
    // limit.
    projection: () => {
      const at = projectFull(sampleHistory, "fiveHourPct", now);
      if (at === null) return null;
      if (typeof fiveHourResetsAt === "number" && at >= fiveHourResetsAt * 1000) return null;
      const d = new Date(at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return { color: "red", text: ` 5h limit ~${hh}:${mm} ` };
    },
    // A4, A5, A6: what the session has spent, in time and in lines.
    duration: () => {
      const c = shows("sessionCost") ? readings.sessionCost.value : null;
      const label = formatDuration(c?.durationMs);
      return label ? { color: "surface2", text: ` ${g.duration} ${label} ` } : null;
    },
  };

  const buildLine4 = ({ moment = true, fiveHourText = true, sevenDayText = true, rtk = true } = {}) => {
    const opt = { moment, fiveHourText, sevenDayText, rtk };
    return byLine(4)
      .map((s) => {
        const built = line4Content[s.key]?.(opt);
        return built ? { key: s.key, ...built } : null;
      })
      .filter(Boolean);
  };

  // The 120-column limit is a promise the constitution makes, and until now
  // nothing checked it. Content comes off in a fixed order, least
  // informative first, and the first step that brings the line inside the
  // limit is the last one taken. A wrapped statusline costs a whole extra
  // terminal row, which is worse than any one of these omissions.
  const TRIM_STEPS = [
    {},
    { moment: false },
    { moment: false, fiveHourText: false },
    { moment: false, fiveHourText: false, sevenDayText: false },
    { moment: false, fiveHourText: false, sevenDayText: false, rtk: false },
  ];
  /**
   * Puts every built segment on the line the arrangement gives it, in the
   * order it gives it, and drops what will not fit.
   *
   * Content is built once per trim step; placement is applied here. A
   * segment that has been switched off never reaches a row, whatever its
   * priority, and a segment moved to another line arrives there with its
   * own priority, so what a narrow terminal sheds is still a decision taken
   * in the registry.
   */
  const assemble = (trimStep) => {
    const built = [...content, ...buildLine4(trimStep)];
    collect(built);
    const byLineNumber = new Map([1, 2, 3, 4].map((n) => [n, []]));
    for (const seg of built) {
      const placed = attach(seg);
      if (placementFor(seg.key)?.on === false) continue;
      byLineNumber.get(placed.line)?.push(placed);
    }
    const out = [];
    const lines = [];
    for (const line of [1, 2, 3, 4]) {
      // The sort is stable, so segments sharing an order keep the sequence
      // they were built in, and the skill chips keep theirs.
      const row = byLineNumber.get(line).sort((a, b) => a.order - b.order);
      if (!row.length) continue;
      out.push(fitRow(row));
      lines.push(line);
    }
    return { rows: out, lines };
  };

  let assembled = assemble(TRIM_STEPS[0]);

  // Line 1's own trim step: the directory label, shortened from the left,
  // because the end of a path identifies it and the start rarely does.
  // Nothing else on that line is dropped — a branch, a count of uncommitted
  // work and a pull request are all things the reader asked for.
  //
  // Columns, not characters: an emoji or a CJK name occupies two columns per
  // character, and counting them as one cut too little to fit.
  const dirIndex = content.findIndex((seg) => seg.key === "dir");
  if (dirIndex !== -1) {
    const dirLine = assembled.rows.find((row) => row.some((seg) => seg.key === "dir"));
    if (dirLine && rowWidth(dirLine) > maxWidth) {
      const over = rowWidth(dirLine) - maxWidth;
      const shortened = trimFromLeft(dirLabel, displayWidth(dirLabel) - over - 1);
      if (shortened !== null) {
        content[dirIndex] = dirSegment(shortened);
        assembled = assemble(TRIM_STEPS[0]);
      }
    }
  }

  // The line carrying the limits comes off in a fixed order, least
  // informative first, and the first step that brings every line inside the
  // width is the last one taken.
  for (const step of TRIM_STEPS.slice(1)) {
    if (assembled.rows.every((row) => rowWidth(row) <= maxWidth)) break;
    assembled = assemble(step);
  }

  rows.push(...assembled.rows);
  rendered.push(...assembled.lines);

  // The pool is complete once every line has been built, and it is the
  // whole answer for a caller that asked for it: what follows is layout,
  // which is exactly what such a caller intends to decide for itself.
  if (asPool) return pool;

  // Which lines the window has room for. Everything comes back the moment
  // the rows do: shedding answers the terminal, it is not a mode the bar
  // gets stuck in.
  const keep = linesToRender(maxHeight, rendered);
  const surviving = rows
    .map((row, i) => ({ line: rendered[i], row }))
    .filter((entry) => keep.includes(entry.line));
  // Padding the first segment of each line to a common width lines the
  // boundaries up down the bar. It yields to the width limit, line by line,
  // inside `alignColumns`.
  const aligned = alignColumns(surviving.map((entry) => entry.row), maxWidth);
  const drawn = surviving.map((entry, i) => ({
    line: entry.line,
    text: renderRow(palette, aligned[i], opts),
  }));
  return asRows ? drawn : drawn.map((entry) => entry.text).join("\n");
}

/**
 * A label cut from the left to fit `columns`, with a leading ellipsis, or
 * null when it already fits or cannot usefully be cut.
 *
 * Measured in columns rather than characters, so a name written in emoji or
 * CJK loses the right amount rather than half of it.
 */
function trimFromLeft(label, columns) {
  const target = Math.max(3, columns);
  if (displayWidth(label) <= target) return null;
  const chars = [...label];
  let kept = [];
  let width = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    const next = width + displayWidth(chars[i]);
    if (next > target - 1) break;
    kept.unshift(chars[i]);
    width = next;
  }
  return kept.length ? `…${kept.join("")}` : null;
}
