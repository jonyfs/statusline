import { spawnSync } from "node:child_process";

/**
 * What stands between a link on the bar and a click that opens it
 * (specs/080-linux-link-opening).
 *
 * The bar prints the same OSC 8 bytes on every platform. Whether a click
 * opens them is decided further down: by Claude Code, by a multiplexer, by
 * the terminal's gesture, and by which machine the terminal runs on. None of
 * that can be fixed from a redraw, so this module only answers questions
 * about it: the renderer asks whether a folder link can mean anything here,
 * and the doctor asks what to tell the person.
 */

/**
 * True when the bar runs on a machine reached over SSH. A click is handled by
 * the computer running the terminal, so a `file://` path here names a folder
 * on another machine, and opens nothing or the wrong thing.
 */
export function isRemoteSession(env = process.env) {
  // VS Code Remote-SSH sets SSH_CONNECTION in its terminal, but VS Code opens
  // a `file://` link against the remote workspace, so there the link works.
  if (env.TERM_PROGRAM === "vscode") return false;
  return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY);
}

/**
 * The gesture that opens a link in this terminal, when it is known. Only the
 * terminals whose default is documented are named; anything else gets null
 * and the doctor says "the terminal's link gesture".
 */
export function linkGesture(env = process.env, platform = process.platform) {
  const mac = platform === "darwin";
  // VS Code's terminal is the one that sets these on the far side of SSH.
  if (env.TERM_PROGRAM === "vscode") return mac ? "Cmd+click" : "Ctrl+click";
  // Over SSH or inside tmux, the variables describe the remote shell or tmux
  // itself, not the terminal the person clicks in: SSH forwards none of
  // VTE_VERSION, WT_SESSION or TERM_PROGRAM, and tmux sets its own.
  if (isRemoteSession(env) || env.TMUX) return null;
  if (env.TERM_PROGRAM === "iTerm.app") return "Cmd+click";
  if (env.TERM_PROGRAM === "ghostty" || env.TERM === "xterm-ghostty") return mac ? "Cmd+click" : "Ctrl+click";
  if (env.WT_SESSION) return "Ctrl+click";
  if (env.TERM_PROGRAM === "WezTerm" || env.WEZTERM_EXECUTABLE) return "click";
  if (env.KITTY_WINDOW_ID || env.TERM === "xterm-kitty") return "click";
  // GNOME Terminal, Tilix, Terminator and the other VTE terminals.
  if (env.VTE_VERSION) return "Ctrl+click";
  return null;
}

/** The first version of tmux that knows the `hyperlinks` terminal feature, as [major, minor]. */
export const TMUX_HYPERLINKS_VERSION = [3, 4];

function runTmux(args) {
  try {
    const r = spawnSync("tmux", args, { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] });
    return r.status === 0 ? r.stdout : null;
  } catch {
    return null;
  }
}

/**
 * `tmux -V` as [major, minor], or null for a build that names no number
 * (`tmux next-3.6`, `tmux openbsd-7.4`, `tmux master`): those are not ordered
 * against a release, so nothing is said about their age.
 */
export function parseTmuxVersion(text) {
  const m = text?.match(/^tmux (\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const older = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
const hasHyperlinks = (list) => /(^|[\s:,])hyperlinks($|[\s:,])/.test(list);

/**
 * Inside tmux, whether links reach the terminal outside it. tmux drops OSC 8
 * unless the attached client has the `hyperlinks` feature, which tmux 3.4
 * added, and which it turns on by itself for terminals it recognises (iTerm2,
 * for one) or from `terminal-features`. The client's own feature list is the
 * answer; the option list is only read when that one is not available, and
 * only a `*:hyperlinks` entry counts there, since a pattern for another
 * terminal says nothing about this one. Asks tmux itself, so it is for the
 * doctor only, never a redraw. `null` outside tmux.
 */
export function tmuxLinks(env = process.env, { run = runTmux } = {}) {
  if (!env.TMUX) return null;
  const version = parseTmuxVersion(run(["-V"]));
  const client = run(["display-message", "-p", "#{client_termfeatures}"]);
  let enabled = null;
  if (client !== null && client.trim() !== "") {
    enabled = hasHyperlinks(client);
  } else {
    const features = run(["show-options", "-sv", "terminal-features"]);
    if (features !== null && /^\*:(.*:)?hyperlinks(:|$)/m.test(features)) enabled = true;
  }
  return { version, enabled };
}

const TMUX_FIX = "set -as terminal-features ',*:hyperlinks' in ~/.tmux.conf, then restart tmux";

/**
 * The doctor's lines about links, in the order a person should act on them:
 * the gesture, tmux, SSH, then the host. Each says what to do.
 */
export function linkStatus(env = process.env, { platform = process.platform, tmux = tmuxLinks(env) } = {}) {
  const lines = [];
  const gesture = linkGesture(env, platform);
  lines.push(
    gesture
      ? `links: open with ${gesture} in this terminal`
      : "links: open with the terminal's link gesture: Ctrl+click in GNOME Terminal and Windows Terminal, Cmd+click in iTerm2, a plain click in kitty and WezTerm"
  );
  if (tmux) {
    const need = TMUX_HYPERLINKS_VERSION.join(".");
    if (tmux.version !== null && older(tmux.version, TMUX_HYPERLINKS_VERSION)) {
      lines.push(`links: tmux ${tmux.version.join(".")} drops them; tmux ${need} or newer can pass them on (${TMUX_FIX})`);
    } else if (tmux.enabled === false) {
      lines.push(`links: tmux drops them, the hyperlinks feature is off (${TMUX_FIX})`);
    } else if (tmux.enabled === null) {
      lines.push(`links: inside tmux, which drops them unless the hyperlinks feature is on for this terminal (${TMUX_FIX})`);
    } else {
      lines.push("links: tmux passes them on (hyperlinks feature on)");
    }
  }
  if (isRemoteSession(env)) {
    lines.push("links: over SSH, so the folder links are left out; web links open on the computer running the terminal");
    if (env.TMUX) lines.push("links: a tmux pane keeps the SSH variables it was started with, so a pane opened over SSH and attached locally still counts as SSH");
  }
  lines.push(
    "links: if none opens, test the terminal alone with printf '\\e]8;;https://example.com\\e\\\\link\\e]8;;\\e\\\\\\n'; if that opens and the bar does not, Claude Code is not passing links through"
  );
  return lines;
}
