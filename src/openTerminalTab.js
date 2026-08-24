import { writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * There is no cross-terminal URL scheme for "open a new tab at this
 * path" — clicking a link only ever asks the OS to `open` a URL/file,
 * and each terminal app decides what that means for itself. To get an
 * actual new tab in the SAME terminal app hosting this Claude Code
 * session, this generates a one-shot `.command` file (double-clickable
 * shell script) that macOS runs via Terminal.app, which immediately
 * hands off to the real target app over AppleScript and closes itself.
 *
 * Supported: iTerm2, Terminal.app. Anything else (Warp, VS Code's
 * integrated terminal, kitty, WezTerm, ...) has no stable AppleScript
 * automation target from here, so the caller should fall back to a
 * plain `file://` link (Finder reveal) for those.
 */
export function buildOpenTabScript(cwd, termProgram) {
  const dir = cwd || process.cwd();
  const escaped = dir.replace(/'/g, `'\\''`);

  let body = null;
  if (termProgram === "iTerm.app") {
    body = `#!/bin/bash
osascript <<'APPLESCRIPT'
tell application "iTerm2"
  activate
  tell current window
    create tab with default profile
    tell current session to write text "cd '${escaped}'"
  end tell
end tell
tell application "Terminal"
  if (count of windows) > 0 then close front window
end tell
APPLESCRIPT
`;
  } else if (termProgram === "Apple_Terminal") {
    // `do script ... in front window` adds a new TAB to that window;
    // without a target window Terminal.app opens a new window instead.
    body = `#!/bin/bash
osascript <<'APPLESCRIPT'
tell application "Terminal"
  activate
  if (count of windows) > 0 then
    do script "cd '${escaped}'" in front window
  else
    do script "cd '${escaped}'"
  end if
end tell
APPLESCRIPT
`;
  } else {
    return null;
  }

  const file = path.join(os.tmpdir(), `claude-statusline-open-tab-${process.pid}.command`);
  try {
    writeFileSync(file, body, { mode: 0o755 });
    return file;
  } catch {
    return null;
  }
}

/**
 * Returns a `file://` URL to a freshly generated open-tab script for the
 * current terminal, or null when the terminal isn't one of the
 * supported apps (caller should fall back to a plain directory link).
 */
export function getOpenTabUrl(cwd) {
  const termProgram = process.env.TERM_PROGRAM;
  const file = buildOpenTabScript(cwd, termProgram);
  return file ? `file://${encodeURI(file)}` : null;
}
