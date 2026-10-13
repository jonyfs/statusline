/**
 * The ANSI output of the composer fixture at four widths, with the terminal
 * environment pinned, so a hash of it is a fact about the renderer and not
 * about the machine that made it (specs/056-runs-output-contract, SC-004).
 */
import { createHash } from "node:crypto";
import { renderReadings, gather } from "../../src/render.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

export const WIDTHS = [80, 100, 144, 200];

const PINNED = { TERM: "xterm", COLORTERM: "truecolor" };
const CLEARED = ["TERM_PROGRAM", "KITTY_WINDOW_ID", "WT_SESSION", "VTE_VERSION", "COLORFGBG", "TMUX", "NO_COLOR", "CLAUDE_STATUSLINE_ASCII", "CLAUDE_STATUSLINE_OUTPUT"];

/** Runs `fn` with the environment pinned, then puts it back. */
export function pinned(fn, extra = {}) {
  const names = [...Object.keys(PINNED), ...CLEARED, ...Object.keys(extra)];
  const before = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  for (const n of CLEARED) delete process.env[n];
  Object.assign(process.env, PINNED, extra);
  try {
    return fn();
  } finally {
    for (const n of names) {
      if (before[n] === undefined) delete process.env[n];
      else process.env[n] = before[n];
    }
  }
}

/** The raw ANSI output of the fixture at `width`. */
export function ansiAt(width, extra = {}) {
  return pinned(
    () => renderReadings(gather(PAYLOAD, { ...SOURCES }, { now: FIXED_NOW * 1000 }), PAYLOAD, { ...RENDER_OPTIONS, maxWidth: width, maxHeight: 40 }),
    extra
  );
}

export const sha = (text) => createHash("sha256").update(text).digest("hex");
