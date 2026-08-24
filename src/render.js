import { PALETTES, renderRow } from "./theme.js";
import { getDirLabel, getDirUrl, getGitInfo, getPrInfo, getRemoteUrl } from "./git.js";
import { getActiveSkills } from "./skills.js";
import { getContextPercent, getRateLimits, formatResetCountdown } from "./tokens.js";
import { getRtkSavings } from "./rtk.js";
import { getOpenTabUrl } from "./openTerminalTab.js";
import { clockFaceFor, resetMomentLabel } from "./timeIcons.js";
import { trackChanges } from "./changeTracker.js";

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
 * Renders a payload that's already parsed. `sources` exists so the preview
 * generator can supply fixed git/PR/skill/rtk values instead of probing the
 * real machine — previews must be reproducible, and they'd otherwise show
 * whatever branch and usage happened to be live when they were generated.
 * Runtime always uses the real probes (the defaults below).
 */
export function renderPayload(
  payload,
  { asciiArrows = false, flavor = "mocha", sources = {}, trackChanges: tracking = true } = {}
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

  const cwd = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  const modelName = payload?.model?.display_name || payload?.model?.id || "Claude";
  const effort = payload?.effort?.level || payload?.output_style?.name || "default";
  const transcriptPath = payload?.transcript_path;

  const ctxPct = getContextPercent(payload);
  const { fiveHourPct, fiveHourResetsAt, sevenDayPct, sevenDayResetsAt } = getRateLimits(payload);
  const fiveHourResetLabel = formatResetCountdown(fiveHourResetsAt) ?? "reset time unknown";
  const sevenDayResetLabel = formatResetCountdown(sevenDayResetsAt) ?? "reset time unknown";

  const dirLabel = getDirLabel(cwd);
  const dirUrl = probe.getDirUrl(cwd);
  const git = probe.getGitInfo(cwd);
  const pr = git ? probe.getPrInfo(cwd) : null;
  const remoteUrl = git ? probe.getRemoteUrl(cwd) : null;
  const skills = probe.getActiveSkills(transcriptPath, 3);
  const rtkPct = probe.getRtkSavings(cwd);

  // Only discrete state feeds change tracking — usage percentages tick on
  // almost every render and would leave the line permanently animated.
  const changes = trackChanges(
    payload?.session_id,
    {
      branch: git?.branch ?? null,
      ahead: git ? String(git.ahead) : null,
      behind: git ? String(git.behind) : null,
      pr: pr ? `${pr.number}:${pr.state}:${pr.isDraft}` : null,
      skills: skills.join(","),
      model: modelName,
      effort,
    },
    { enabled: tracking }
  );

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const g = asciiArrows ? GLYPHS.plain : GLYPHS.nerd;
  const opts = { asciiArrows };
  const lines = [];

  // Line 1: working directory, then branch, ahead/behind, PR — each name
  // is an OSC 8 hyperlink when a target is known (dir -> file://, branch ->
  // GitHub tree view, PR -> PR page), with no visible URL text.
  const l1 = [{ color: "surface1", text: ` 📁 ${dirLabel} `, url: dirUrl }];
  if (git) {
    const branchUrl = remoteUrl ? `${remoteUrl}/tree/${git.branch}` : null;
    l1.push({
      color: "lavender",
      text: ` ${changes.iconFor("branch", g.branch)} ${git.branch} `,
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
    if (git.ahead) state.push(`${changes.iconFor("ahead", g.push)} ${git.ahead}`);
    if (git.behind) state.push(`${changes.iconFor("behind", g.pull)} ${git.behind}`);
    if (state.length) {
      l1.push({ color: "mauve", text: ` ${state.join("  ")} ` });
    }
    if (pr) {
      const prState = pr.isDraft ? "draft" : pr.state.toLowerCase();
      l1.push({
        color: "blue",
        text: ` ${changes.iconFor("pr", g.pr)} PR #${pr.number} ${prState} `,
        url: pr.url,
      });
    }
  }
  lines.push(renderRow(palette, l1, opts));

  // Line 2: active skills, one chip per skill, distinct colors, no bullets
  if (skills.length) {
    const skillIcon = changes.iconFor("skills", "🧩");
    const l2 = skills.map((name, i) => ({
      color: SKILL_CHIP_COLORS[i % SKILL_CHIP_COLORS.length],
      text: ` ${skillIcon} ${name} `,
    }));
    lines.push(renderRow(palette, l2, opts));
  }

  // Line 3: model + effort
  const l3 = [
    { color: "red", text: ` ${changes.iconFor("model", "🤖")} ${modelName} ` },
    { color: "peach", text: ` ${changes.iconFor("effort", "⚡")} ${effort} ` },
  ];
  lines.push(renderRow(palette, l3, opts));

  // Line 4: context / 5h window + its reset / 7d window + its reset / rtk.
  // Each reset segment's clock face is the actual hour the window resets,
  // and the 7-day segment names the real day it expires, so the icon
  // carries the information rather than decorating it.
  const fiveHourClock = clockFaceFor(fiveHourResetsAt) ?? g.clock;
  const sevenDayClock = clockFaceFor(sevenDayResetsAt) ?? g.clock;
  const sevenDayMoment = resetMomentLabel(sevenDayResetsAt);

  const l4 = [
    { color: "yellow", text: ` 🧠 Context ${ctxPct ?? "?"}% ` },
    { color: "green", text: ` ⏱️ 5h ${fiveHourPct ?? "?"}% ` },
    { color: "peach", text: ` ${fiveHourClock} ${fiveHourResetLabel} ` },
    {
      color: "sapphire",
      text: ` ${g.calendar} 7d ${sevenDayPct ?? "?"}%${sevenDayMoment ? ` · ${sevenDayMoment}` : ""} `,
    },
    { color: "peach", text: ` ${sevenDayClock} ${sevenDayResetLabel} ` },
  ];
  if (rtkPct !== null) {
    l4.push({ color: "mauve", text: ` 🦀 rtk ${rtkPct}% saved ` });
  }
  lines.push(renderRow(palette, l4, opts));

  return lines.join("\n");
}
