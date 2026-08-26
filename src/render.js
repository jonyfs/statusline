import { PALETTES, renderRow, displayWidth } from "./theme.js";
import { getDirLabel, getDirUrl, getGitInfo, getPrInfo, getRemoteUrl, normalizePr, repoUrlFromPayload } from "./git.js";
import { getActiveSkills } from "./skills.js";
import { getContextPercent, getRateLimits, formatResetCountdown } from "./tokens.js";
import { getRtkSavings } from "./rtk.js";
import { getOpenTabUrl } from "./openTerminalTab.js";
import { clockFaceFor, resetMomentLabel } from "./timeIcons.js";
import { trackChanges } from "./changeTracker.js";
import { reading, missing, isRenderable } from "./freshness.js";
import { byLine, segment, inChannel } from "./segments.js";
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
    rtk: timed("rtk", () => probe.getRtkSavings(cwd)),
    model: reading({
      value: payload?.model?.display_name || payload?.model?.id || "Claude",
      at: now,
      source: "payload",
    }),
    effort: reading({ value: payload?.effort?.level ?? null, at: now, source: "payload" }),
    outputStyle: reading({ value: payload?.output_style?.name ?? null, at: now, source: "payload" }),
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
    { enabled: tracking, now }
  );

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const g = asciiArrows ? GLYPHS.plain : GLYPHS.nerd;
  const opts = { asciiArrows };
  const lines = [];

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
  if (git) {
    const detached = git.detached === true || git.branch === "(detached)";
    const label = detached ? git.oid?.slice(0, 7) || "detached" : git.branch;
    // A detached HEAD is a commit, not a branch. Linking it to a tree view
    // and drawing a branch icon beside it would say otherwise.
    const branchUrl = !detached && remoteUrl ? `${remoteUrl}/tree/${git.branch}` : null;
    l1.push({
      key: "branch",
      color: "lavender",
      text: ` ${detached ? g.commit : changes.iconFor("branch", g.branch)} ${label} `,
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
    if (git.ahead) state.push(`${changes.iconFor("ahead", g.push)} ${git.ahead}`);
    if (git.behind) state.push(`${changes.iconFor("behind", g.pull)} ${git.behind}`);
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
    if (pr) {
      // `changes_requested` is the one review state too long to spell out on
      // a line this tight, and "changes" says it.
      const review = pr.review === "changes_requested" ? "changes" : pr.review;
      const label = pr.kind === "mr" ? "MR" : "PR";
      l1.push({
        key: "pr",
        color: "blue",
        text: ` ${changes.iconFor("pr", g.pr)} ${label} #${pr.number}${review ? ` ${review}` : ""} `,
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

  // Line 2: active skills, one chip per skill, distinct colors, no bullets.
  // When more are active than the line shows, the count of the rest is
  // stated rather than left silent: "these three" and "three of five" are
  // different claims, and only one of them is true (FR-013).
  if (skills.length) {
    const skillIcon = changes.iconFor("skills", "🧩");
    const l2 = skills.map((name, i) => ({
      key: `skills:${i}`,
      color: SKILL_CHIP_COLORS[i % SKILL_CHIP_COLORS.length],
      text: ` ${skillIcon} ${name} `,
    }));
    const hidden = readings.skills.hiddenCount ?? 0;
    if (hidden > 0) {
      l2.push({ key: "skills:more", color: "surface2", text: ` +${hidden} more ` });
    }
    lines.push(renderRow(palette, fit(l2), opts));
  }

  // Line 3: model, then effort and output style as separate segments. They
  // are different things, and one standing in for the other behind the
  // same icon is a segment that lies about what it shows (FR-021).
  // Composed from the registry: which segments belong on this line, and in
  // what order, is a property of the table rather than of this function.
  // What each one says is still built here, because that is content, not
  // layout.
  const line3Content = {
    model: () => ({ color: "red", text: ` ${changes.iconFor("model", "🤖")} ${modelName} ` }),
    effort: () => (effort ? { color: "peach", text: ` ${changes.iconFor("effort", "⚡")} ${effort} ` } : null),
    outputStyle: () =>
      outputStyle && outputStyle !== "default"
        ? { color: "flamingo", text: ` 🎨 ${outputStyle} ` }
        : null,
  };
  const l3 = byLine(3)
    .map((s) => {
      const built = line3Content[s.key]?.();
      return built ? { key: s.key, ...built } : null;
    })
    .filter(Boolean);
  lines.push(renderRow(palette, fit(l3), opts));

  // Line 4: context / 5h window + its reset / 7d window + its reset / rtk.
  // Each reset segment's clock face is the actual hour the window resets,
  // and the 7-day segment names the real day it expires, so the icon
  // carries the information rather than decorating it.
  const fiveHourClock = clockFaceFor(fiveHourResetsAt) ?? g.clock;
  const sevenDayClock = clockFaceFor(sevenDayResetsAt) ?? g.clock;
  const sevenDayMoment = resetMomentLabel(sevenDayResetsAt, new Date(now));

  const line4Content = {
    context: () => ({ color: "yellow", text: ` 🧠 Context ${ctxPct ?? "?"}% ` }),
    fiveHour: () => ({ color: "green", text: ` ⏱️ 5h ${fiveHourPct ?? "?"}% ` }),
    fiveHourReset: (o) => ({
      color: "peach",
      text: ` ${fiveHourClock}${o.fiveHourText ? ` ${fiveHourResetLabel}` : ""} `,
    }),
    sevenDay: (o) => ({
      color: "sapphire",
      text: ` ${g.calendar} 7d ${sevenDayPct ?? "?"}%${o.moment && sevenDayMoment ? ` · ${sevenDayMoment}` : ""} `,
    }),
    sevenDayReset: (o) => ({
      color: "peach",
      text: ` ${sevenDayClock}${o.sevenDayText ? ` ${sevenDayResetLabel}` : ""} `,
    }),
    rtk: (o) => (o.rtk && rtkPct !== null ? { color: "mauve", text: ` 🦀 rtk ${rtkPct}% saved ` } : null),
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

  // Which lines the window has room for. Everything comes back the moment
  // the rows do: shedding answers the terminal, it is not a mode the bar
  // gets stuck in.
  const present = [1, skills.length ? 2 : null, 3, 4].filter(Boolean);
  const keep = linesToRender(maxHeight, present);
  return lines.filter((_, i) => keep.includes(present[i])).join("\n");
}
