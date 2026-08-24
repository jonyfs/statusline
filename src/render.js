import { PALETTES, renderRow } from "./theme.js";
import { getDirLabel, getDirUrl, getGitInfo, getPrInfo, getRemoteUrl } from "./git.js";
import { getActiveSkills } from "./skills.js";
import { getContextPercent, getRateLimits, formatResetCountdown } from "./tokens.js";
import { getRtkSavings } from "./rtk.js";
import { getOpenTabUrl } from "./openTerminalTab.js";

// Nerd Font Octicons, written as escapes rather than literal private-use
// characters: pasted literals silently vanished from this file once
// already, leaving empty strings that rendered as a bare gap. Every
// codepoint below was verified to exist in the installed FiraCode Nerd
// Font by reading the font's cmap table, and F418/F43A are the exact
// glyphs this machine's own ~/.config/starship.toml already uses.
const NF_BRANCH = "\u{F418}"; // nf-oct-git_branch (GitHub's branch icon)
const NF_CLOCK = "\u{F43A}";  // nf-oct-clock
const NF_PR = "\u{F407}";     // nf-oct-git_pull_request

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
export function renderPayload(payload, { asciiArrows = false, flavor = "mocha", sources = {} } = {}) {
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

  const palette = PALETTES[flavor] || PALETTES.mocha;
  const opts = { asciiArrows };
  const lines = [];

  // Line 1: working directory, then branch, ahead/behind, PR — each name
  // is an OSC 8 hyperlink when a target is known (dir -> file://, branch ->
  // GitHub tree view, PR -> PR page), with no visible URL text.
  const l1 = [{ color: "surface1", text: ` 📁 ${dirLabel} `, url: dirUrl }];
  if (git) {
    const branchUrl = remoteUrl ? `${remoteUrl}/tree/${git.branch}` : null;
    l1.push({ color: "lavender", text: ` ${NF_BRANCH} ${git.branch} `, url: branchUrl });
    if (git.ahead || git.behind) {
      const parts = [];
      if (git.ahead) parts.push(`⬆${git.ahead}`);
      if (git.behind) parts.push(`⬇${git.behind}`);
      l1.push({ color: "mauve", text: ` 🔃 ${parts.join(" ")} ` });
    }
    if (pr) {
      const state = pr.isDraft ? "draft" : pr.state.toLowerCase();
      l1.push({ color: "blue", text: ` ${NF_PR} PR #${pr.number} ${state} `, url: pr.url });
    }
  }
  lines.push(renderRow(palette, l1, opts));

  // Line 2: active skills, one chip per skill, distinct colors, no bullets
  if (skills.length) {
    const l2 = skills.map((name, i) => ({
      color: SKILL_CHIP_COLORS[i % SKILL_CHIP_COLORS.length],
      text: ` 🧩 ${name} `,
    }));
    lines.push(renderRow(palette, l2, opts));
  }

  // Line 3: model + effort
  const l3 = [
    { color: "red", text: ` 🤖 ${modelName} ` },
    { color: "peach", text: ` ⚡ ${effort} ` },
  ];
  lines.push(renderRow(palette, l3, opts));

  // Line 4: context / 5h window + its reset / 7d window + its reset / rtk
  const l4 = [
    { color: "yellow", text: ` 🧠 Context ${ctxPct ?? "?"}% ` },
    { color: "green", text: ` ⏱️ 5h ${fiveHourPct ?? "?"}% ` },
    { color: "peach", text: ` ${NF_CLOCK} ${fiveHourResetLabel} ` },
    { color: "sapphire", text: ` 📆 7d ${sevenDayPct ?? "?"}% ` },
    { color: "peach", text: ` ${NF_CLOCK} ${sevenDayResetLabel} ` },
  ];
  if (rtkPct !== null) {
    l4.push({ color: "mauve", text: ` 🦀 rtk ${rtkPct}% saved ` });
  }
  lines.push(renderRow(palette, l4, opts));

  return lines.join("\n");
}
