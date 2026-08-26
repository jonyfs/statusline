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
import { getActiveSkills, getSessionActivity } from "./skills.js";
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
import { byLine, segment, inChannel } from "./segments.js";
import { bar, rampColour, bandMark } from "./ramp.js";
import { movedBy, ratePerHour, projectFull, seriesOf, sparkline } from "./samples.js";
import { fitToWidth, alignColumns, linesToRender, terminalWidth, terminalHeight } from "./layout.js";

// Nerd Font Octicons, written as escapes rather than literal private-use
// characters: pasted literals silently vanished from this file once
// already, leaving empty strings that rendered as a bare gap. Every
// codepoint below was verified to exist in the installed FiraCode Nerd
// Font by reading the font's cmap table, and F418/F43A are the exact
// glyphs this machine's own ~/.config/starship.toml already uses.
const NF_BRANCH = "\u{F418}"; // nf-oct-git_branch (GitHub's branch icon)
const NF_CLOCK = "\u{F43A}";  // nf-oct-clock
const NF_PR = "\u{F407}";     // nf-oct-git_pull_request

// A blank calendar grid, deliberately NOT the 📆 emoji: every emoji font
// draws a fixed date on that glyph (Apple renders "17"), so beside a real
// expiry day it reads as a date that never changes and contradicts the
// text next to it. Unicode has no per-date emoji, so the day is text.
const NF_CALENDAR = "\u{F455}"; // nf-oct-calendar

// GitHub's own diff and sync markers, so the working-tree state reads in
// the vocabulary anyone who uses GitHub already knows. Each glyph was
// rendered and inspected before being adopted: codepoint names in Nerd
// Font tables proved unreliable (F433 "repo_push" draws a down arrow,
// F45D "arrow_up" draws a signpost), so the name is not evidence.
const NF_MODIFIED = "\u{F459}"; // boxed dot, GitHub's "modified" marker
const NF_ADDED = "\u{F457}";    // boxed plus, GitHub's "added" marker
const NF_PUSH = "\u{F40A}";     // cloud up: commits waiting to be pushed
const NF_PULL = "\u{F409}";     // cloud down: commits waiting to be pulled

// A commit, for a detached HEAD. The branch icon would claim the line is
// showing a branch when it is showing a commit id.
const NF_COMMIT = "\u{F417}"; // nf-oct-git_commit

/**
 * The whole glyph set, and the substitutes used when the terminal has no
 * Nerd Font. Swapping only the Powerline separator would be a false
 * promise: every Octicon above sits in the private use area and renders
 * as an empty box without the font, so ASCII mode has to replace all of
 * them. The substitutes are plain Unicode and emoji, which need no
 * special font.
 */
const GLYPHS = {
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
const SKILLS_SHOWN = 3;
const SKILLS_PROBED = 10;

function skillsReading(timed, probe, payload) {
  // The session id lets the hook's event file be found. Without one, or
  // without the hook, the transcript answers instead and the line is the
  // same, only slower to react.
  const all = timed("transcript", () =>
    probe.getActiveSkills(payload?.transcript_path, SKILLS_PROBED, { sessionId: payload?.session_id })
  );
  const list = Array.isArray(all.value) ? all.value : [];
  return {
    ...all,
    value: list.slice(0, SKILLS_SHOWN),
    hiddenCount: Math.max(0, list.length - SKILLS_SHOWN),
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
    pr: hasRepo
      ? payloadPr
        ? reading({ value: payloadPr, at: now, source: "payload" })
        : timed("gh", () => normalizePr(probe.getPrInfo(cwd), "gh"))
      : missing("gh", "not a repository"),
    skills: skillsReading(timed, probe, payload),
    // One pass over the transcript answers all three. Reading the file
    // three times would have tripled the only cost on this path that ever
    // grew with the session.
    activity: timed("transcript", () =>
      probe.getSessionActivity(payload?.transcript_path, { now })
    ),
    ci: hasRepo ? timed("gh", () => probe.getCiStatus(cwd)) : missing("gh", "not a repository"),
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
  } = {}
) {
  const probe = {
    getGitInfo,
    getPrInfo,
    getRemoteUrl,
    getActiveSkills,
    getSessionActivity,
    getCiStatus,
    getRtkSavings,
    getDirUrl: (cwd) => getOpenTabUrl(cwd) || getDirUrl(cwd),
    ...sources,
  };

  const readings = gather(payload, probe, { now });
  return renderReadings(readings, payload, { asciiArrows, flavor, tracking, now, maxWidth, maxHeight });
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

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const g = asciiArrows ? GLYPHS.plain : GLYPHS.nerd;
  const opts = { asciiArrows };
  const lines = [];
  // Which of the four each rendered row is. Shedding needs to know, and a
  // line that renders only sometimes made an index-based guess wrong.
  const rendered = [];

  /**
   * Attaches each descriptor's registry row and drops the least important
   * until the row fits the terminal. A skill chip has no registry row of its
   * own, so the whole line inherits the skills priority.
   */
  const fit = (row) => {
    const withPriority = row.map((seg) => {
      const meta = segment(seg.key) || segment(String(seg.key).split(":")[0]);
      return { align: "left", priority: meta?.priority ?? 50, ...meta, ...seg };
    });
    return fitToWidth(withPriority, maxWidth);
  };

  // Line 1: working directory, then branch, ahead/behind, PR — each name
  // is an OSC 8 hyperlink when a target is known (dir -> file://, branch ->
  // GitHub tree view, PR -> PR page), with no visible URL text.
  const dirSegment = (label) => ({ key: "dir", color: "surface1", text: ` 📁 ${label} `, url: dirUrl });
  const l1 = [dirSegment(dirLabel)];

  // A17: Claude can move during a session, and then the directory on the bar
  // is not the directory the session started in. Both render only when they
  // differ, because in most sessions they do not.
  const projectDir = shows("projectDir") ? readings.projectDir.value : null;
  if (projectDir && projectDir !== readings.cwd) {
    l1.push({ key: "projectDir", color: "surface2", text: ` ← ${getDirLabel(projectDir)} ` });
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
      const mark = ci.status && ci.status !== "completed" ? "◐" : ci.conclusion === "success" ? "✓" : "✗";
      const colour = mark === "✓" ? "green" : mark === "✗" ? "red" : "yellow";
      l1.push({ key: "ci", color: colour, text: ` ${mark} ${ci.workflow ?? "CI"} ` });
    }
    // B8: an unmerged path stops everything until it is resolved, which is
    // not what an ordinary changed file means.
    if (git.conflicts) {
      l1.push({ key: "conflicts", color: "red", text: ` ✖ ${git.conflicts} ` });
    }
    // A19: which worktree, and what it came from. The branch name alone does
    // not always say, and a worktree is exactly when you need to be sure.
    const worktree = shows("worktree") ? readings.worktree.value : null;
    if (worktree) {
      const from = worktree.from ? ` ← ${worktree.from}` : "";
      l1.push({ key: "worktree", color: "teal", text: ` ${worktree.name}${from} ` });
    }
    if (pr) {
      // `changes_requested` is the one review state too long to spell out on
      // a line this tight, and "changes" says it.
      const review = pr.review === "changes_requested" ? "changes" : pr.review;
      const label = pr.kind === "mr" ? "MR" : "PR";
      l1.push({
        key: "pr",
        color: changes.colourFor("pr", "blue", palette),
        text: ` ${g.pr} ${label} #${pr.number}${review ? ` ${review}` : ""} `,
        url: pr.url,
      });
    }
  }
  // Line 1's own trim step: the directory label, shortened from the left,
  // because the end of a path identifies it and the start rarely does.
  // Nothing else on this line is dropped — a branch, a count of uncommitted
  // work and a pull request are all things the reader asked for.
  let line1 = renderRow(palette, fit(l1), opts);
  if (displayWidth(line1) > maxWidth) {
    const over = displayWidth(line1) - maxWidth;
    const keep = Math.max(3, dirLabel.length - over - 1);
    if (keep < dirLabel.length) {
      l1[0] = dirSegment(`…${dirLabel.slice(dirLabel.length - keep)}`);
      line1 = renderRow(palette, fit(l1), opts);
    }
  }
  lines.push(line1);
  rendered.push(1);

  // F7 and F6, on the line that already describes what the session is doing.
  // Both come from the transcript pass that already runs for the skills.
  const activity = shows("activity") ? readings.activity.value : null;
  function pushLine2Extras(row) {
    if (activity?.todos) {
      const { done, total, current } = activity.todos;
      const label = current ? `${current} (${done}/${total})` : `${done}/${total}`;
      row.push({ key: "todo", color: "sapphire", text: ` ▸ ${label} ` });
    }
    if (activity) {
      row.push({
        key: "activity",
        color: activity.working ? "green" : "surface2",
        text: activity.working ? ` ● working ` : ` ○ idle `,
      });
    }
  }

  // Line 2: active skills, one chip per skill, distinct colors, no bullets.
  // When more are active than the line shows, the count of the rest is
  // stated rather than left silent: "these three" and "three of five" are
  // different claims, and only one of them is true (FR-013).
  if (skills.length) {
    const skillIcon = "🧩";
    const l2 = skills.map((name, i) => ({
      key: `skills:${i}`,
      color: changes.colourFor("skills", SKILL_CHIP_COLORS[i % SKILL_CHIP_COLORS.length], palette),
      text: ` ${skillIcon} ${name} `,
    }));
    const hidden = readings.skills.hiddenCount ?? 0;
    if (hidden > 0) {
      l2.push({ key: "skills:more", color: "surface2", text: ` +${hidden} more ` });
    }
    pushLine2Extras(l2);
    lines.push(renderRow(palette, fit(l2), opts));
    rendered.push(2);
  } else {
    const l2 = [];
    pushLine2Extras(l2);
    if (l2.length) {
      lines.push(renderRow(palette, fit(l2), opts));
      rendered.push(2);
    }
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
      text: ` 🤖 ${modelName} `,
    }),
    // C3: how the model is configured, in one segment. Effort and output
    // style are the same idea seen twice, and they change together.
    effortStyle: () => {
      const parts = [];
      if (effort) parts.push(`⚡ ${effort}`);
      if (outputStyle && outputStyle !== "default") parts.push(`🎨 ${outputStyle}`);
      return parts.length ? { color: "peach", text: ` ${parts.join(" · ")} ` } : null;
    },
    // A14: a session running under an agent gave no sign of it, which is
    // exactly the case where you most want to know.
    agent: () => {
      const name = shows("agent") ? readings.agent.value : null;
      return name ? { color: "pink", text: ` ⚙ ${name} ` } : null;
    },
    // A15: tells one terminal from another when several sessions are open.
    sessionName: () => {
      const name = shows("sessionName") ? readings.sessionName.value : null;
      return name ? { color: "surface2", text: ` ${name} ` } : null;
    },
  };
  const l3 = byLine(3)
    .map((s) => {
      const built = line3Content[s.key]?.();
      return built ? { key: s.key, ...built } : null;
    })
    .filter(Boolean);
  lines.push(renderRow(palette, fit(l3), opts));
  rendered.push(3);

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
    context: () => ({
      color: rampColour(ctxPct, "yellow"),
      text: ` 🧠 Context ${ctxPct ?? "?"}%${bandMark(ctxPct)} `,
    }),
    fiveHour: () => ({
      color: rampColour(fiveHourPct, "green"),
      text: ` ⏱️ 5h ${fiveHourPct ?? "?"}%${bandMark(fiveHourPct)} `,
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
    // C5's chosen form: the savings figure only earns its width once it has
    // moved five points. It is the slowest-moving thing on the line, and a
    // number that says the same thing every redraw is a number nobody reads.
    rtk: (o) => {
      if (!o.rtk || rtkPct === null) return null;
      const shown = changes.lastShown?.rtk;
      if (!movedBy(shown, rtkPct, 5)) return null;
      changes.remember?.("rtk", rtkPct);
      return { color: "mauve", text: ` 🦀 rtk ${rtkPct}% saved ` };
    },

    // B3: auto-compaction fires around 95% and takes the conversation with
    // it. The threshold is not in the payload, so this is inferred, and it
    // says so by warning rather than by counting down to a number it cannot
    // know exactly.
    compaction: () => {
      if (typeof ctxPct !== "number" || ctxPct < 85) return null;
      return { color: "red", text: ` ⚠ compacting soon ` };
    },
    // B1: a percentage says where you are; a rate says whether you get there
    // before the window resets, which is the decision you actually make.
    burnRate: () => {
      const rate = ratePerHour(changes.samples, "fiveHourPct");
      if (rate === null || rate <= 0) return null;
      return {
        color: rampColour(fiveHourPct, "peach"),
        text: ` ↑ ${rate.toFixed(rate < 10 ? 1 : 0)}%/h `,
      };
    },
    // B2: the sentence you were going to say out loud anyway. It renders
    // only when the window would run out before it resets, because that is
    // the only case where it changes what you do.
    projection: () => {
      const at = projectFull(changes.samples, "fiveHourPct", now);
      if (at === null) return null;
      if (typeof fiveHourResetsAt === "number" && at >= fiveHourResetsAt * 1000) return null;
      const d = new Date(at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return { color: "red", text: ` empty ~${hh}:${mm} ` };
    },
    // B4: a shape says whether context is creeping or jumping, which a
    // single number never does.
    trend: () => {
      const spark = sparkline(seriesOf(changes.samples, "contextPct", 8));
      return spark ? { color: "surface2", text: ` ${spark} ` } : null;
    },
    // B12: the countdowns beside it are already time-based; a clock makes
    // the arithmetic disappear. It needs the refresh interval to stay
    // honest while the session is idle.
    clock: () => {
      const d = new Date(now);
      return {
        color: "surface2",
        text: ` ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} `,
      };
    },
    // A7: a percentage of an unstated total is half a fact. Tokens are the
    // unit the limit is actually in.
    tokens: () => {
      const t = shows("tokens") ? readings.tokens.value : null;
      if (!t || t.used === null) return null;
      const total = t.size ? ` / ${abbreviate(t.size)}` : "";
      return { color: "surface2", text: ` ${abbreviate(t.used)}${total} ` };
    },
    // A8: 38% of 200k and 38% of 1M are very different amounts of room.
    contextSize: () => {
      const t = shows("tokens") ? readings.tokens.value : null;
      return t?.size ? { color: "surface2", text: ` ${abbreviate(t.size)} window ` } : null;
    },
    // A10: the payload computes this at a fixed threshold, whatever the
    // window size, so it says something the percentage cannot.
    exceeds200k: () => {
      const t = shows("tokens") ? readings.tokens.value : null;
      return t?.exceeds200k ? { color: "red", text: ` ⚠ 200k ` } : null;
    },
    // A4, A5, A6: what the session has spent, in time and in lines.
    duration: () => {
      const c = shows("sessionCost") ? readings.sessionCost.value : null;
      const label = formatDuration(c?.durationMs);
      return label ? { color: "surface2", text: ` ⏳ ${label} ` } : null;
    },
    linesChanged: () => {
      const c = shows("sessionCost") ? readings.sessionCost.value : null;
      if (!c || (c.linesAdded === null && c.linesRemoved === null)) return null;
      return { color: "green", text: ` +${c.linesAdded ?? 0} −${c.linesRemoved ?? 0} ` };
    },
    apiTime: () => {
      const c = shows("sessionCost") ? readings.sessionCost.value : null;
      const label = formatDuration(c?.apiMs);
      return label ? { color: "surface2", text: ` api ${label} ` } : null;
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
  let line4 = renderRow(palette, fit(buildLine4(TRIM_STEPS[0])), opts);
  for (const step of TRIM_STEPS.slice(1)) {
    if (displayWidth(line4) <= maxWidth) break;
    line4 = renderRow(palette, fit(buildLine4(step)), opts);
  }
  lines.push(line4);
  rendered.push(4);

  // Which lines the window has room for. Everything comes back the moment
  // the rows do: shedding answers the terminal, it is not a mode the bar
  // gets stuck in.
  const keep = linesToRender(maxHeight, rendered);
  return lines.filter((_, i) => keep.includes(rendered[i])).join("\n");
}
