import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isPassive } from "./paths.js";
import { pathToFileUrl } from "./openTerminalTab.js";

/**
 * The file a click on the help chip opens (specs/078-help-page, FR-005).
 *
 * A terminal decides for itself what a `file://` link to an .html page does:
 * some reveal the folder in the file manager instead of opening the page. So
 * the chip points at a small launcher beside the page, one per platform, and
 * the launcher is what asks the system for the browser:
 *
 * - macOS: a `.command` script that runs `open` on the page. Launch Services
 *   refuses a `file://` address inside a `.webloc` or `.url`, so a script it is.
 * - Windows: a `.url`, an Internet shortcut that opens in the default browser.
 * - Linux: a `.desktop` entry that runs `xdg-open` on the page.
 *
 * Passive renders write nothing, as the open-tab script does, so they fall back
 * to a plain link to the page.
 */
const LAUNCHER = {
  darwin: "open-help.command",
  win32: "open-help.url",
  linux: "open-help.desktop",
};

/** The launcher's text for `platform`, pointing at the page on disk. */
export function launcherContent(platform, pagePath) {
  const url = pathToFileUrl(pagePath);
  if (platform === "darwin") {
    // Single quotes, with each one closed, escaped and reopened.
    const quoted = "'" + pagePath.replace(/'/g, "'\\''") + "'";
    return ["#!/bin/sh", `open ${quoted}`, ""].join("\n");
  }
  if (platform === "win32") {
    return `[InternetShortcut]\r\nURL=${url}\r\n`;
  }
  // Exec arguments: the path in double quotes, with the characters that stay
  // special inside them escaped, and `%` doubled for the field codes.
  const arg = pagePath.replace(/[\\"`$]/g, (c) => `\\${c}`).replace(/%/g, "%%");
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Statusline help",
    `Exec=xdg-open "${arg}"`,
    "Terminal=false",
    "NoDisplay=true",
    "",
  ].join("\n");
}

/**
 * The URL the help chip links to: the launcher beside the page, written when it
 * is missing or out of date, or the page itself when no launcher can be written.
 */
export function helpLinkUrl(pagePath, { platform = process.platform, passive = isPassive() } = {}) {
  const page = pathToFileUrl(pagePath);
  const name = LAUNCHER[platform];
  if (passive || !name) return page;
  const file = path.join(path.dirname(pagePath), name);
  const content = launcherContent(platform, pagePath);
  try {
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) writeFileSync(file, content);
    if (platform !== "win32") chmodSync(file, 0o755);
  } catch {
    return page;
  }
  return pathToFileUrl(file);
}
