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
  return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY);
}

/**
 * The gesture that opens a link in this terminal, when it is known. Only the
 * terminals whose default is documented are named; anything else gets null
 * and the doctor says "the terminal's link gesture".
 */
export function linkGesture(env = process.env, platform = process.platform) {
  const mac = platform === "darwin";
  if (env.TERM_PROGRAM === "iTerm.app") return "Cmd+click";
  if (env.TERM_PROGRAM === "vscode") return mac ? "Cmd+click" : "Ctrl+click";
  if (env.TERM_PROGRAM === "ghostty" || env.TERM === "xterm-ghostty") return mac ? "Cmd+click" : "Ctrl+click";
  if (env.WT_SESSION) return "Ctrl+click";
  if (env.TERM_PROGRAM === "WezTerm" || env.WEZTERM_EXECUTABLE) return "click";
  if (env.KITTY_WINDOW_ID || env.TERM === "xterm-kitty") return "click";
  // GNOME Terminal, Tilix, Terminator and the other VTE terminals.
  if (env.VTE_VERSION) return "Ctrl+click";
  return null;
}

/** The first version of tmux that knows the `hyperlinks` terminal feature. */
export const TMUX_HYPERLINKS_VERSION = 3.4;

function runTmux(args) {
  try {
    const r = spawnSync("tmux", args, { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] });
    return r.status === 0 ? r.stdout : null;
  } catch {
    return null;
  }
}

/**
 * Inside tmux, whether links reach the terminal outside it: tmux drops OSC 8
 * unless the outer terminal is declared with the `hyperlinks` feature, which
 * tmux 3.4 added. Asks tmux itself, so it is for the doctor only, never a
 * redraw. `null` outside tmux.
 */
export function tmuxLinks(env = process.env, { run = runTmux } = {}) {
  if (!env.TMUX) return null;
  const versionText = run(["-V"]);
  const m = versionText?.match(/(\d+)\.(\d+)/);
  const version = m ? Number(`${m[1]}.${m[2]}`) : null;
  const features = run(["show-options", "-sv", "terminal-features"]);
  const enabled = features === null ? null : /(^|[\s:,])hyperlinks($|[\s:,])/m.test(features);
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
      : "links: open with the terminal's link gesture (often Ctrl+click, Cmd+click on macOS)"
  );
  if (tmux) {
    if (tmux.version !== null && tmux.version < TMUX_HYPERLINKS_VERSION) {
      lines.push(`links: tmux ${tmux.version} drops them; tmux ${TMUX_HYPERLINKS_VERSION} or newer can pass them on (${TMUX_FIX})`);
    } else if (tmux.enabled === false) {
      lines.push(`links: tmux drops them, the hyperlinks feature is off (${TMUX_FIX})`);
    } else if (tmux.enabled === null) {
      lines.push(`links: inside tmux, which drops them unless the hyperlinks feature is on (${TMUX_FIX})`);
    } else {
      lines.push("links: tmux passes them on (hyperlinks feature on)");
    }
  }
  if (isRemoteSession(env)) {
    lines.push("links: over SSH, so the folder links are left out; web links open on the computer running the terminal");
  }
  lines.push(
    "links: if none opens, test the terminal alone with printf '\\e]8;;https://example.com\\e\\\\link\\e]8;;\\e\\\\\\n'; if that opens and the bar does not, Claude Code is not passing links through"
  );
  return lines;
}
