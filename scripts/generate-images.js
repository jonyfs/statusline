#!/usr/bin/env node
/**
 * Writes docs/images/bar.png and docs/images/bar.gif from the real renderer.
 *
 *   node scripts/generate-images.js
 *
 * The frames are what `renderPayload` prints for the full preview scenario,
 * through a session of its own so the spinner and the change highlight are the
 * ones the tracker draws: four redraws turn the spinner, and a branch switch
 * marks the branch. Painting is left to scripts/rasterise-ansi.py, which needs
 * Python with Pillow and a Nerd Font, and no browser. The output depends on the
 * font on the machine, so docs/images/ is not checked for staleness
 * (specs/049-rows-themes-docs).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The tracker keeps its state under HOME; a throwaway one keeps this script
// from touching the person's own sessions. Set before anything loads.
const realHome = process.env.HOME;
const home = mkdtempSync(path.join(os.tmpdir(), "statusline-images-"));
process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.TZ = "UTC";
process.env.COLORTERM = "truecolor";
delete process.env.NO_COLOR;
delete process.env.TERM_PROGRAM;
process.env.TERM = "xterm";

const { renderPayload } = await import("../src/render.js");
const { SCENARIOS, FIXED_NOW } = await import("./preview-fixtures.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "images");
mkdirSync(OUT, { recursive: true });

const scenario = SCENARIOS.find((s) => s.file === "full.svg");
const noArrangement = { arrangement: null, origin: "default", path: null, error: null };
const activity = { working: true, background: { shells: 0, agents: 0 }, todos: { done: 9, total: 24, current: "the composer page" }, skills: ["speckit-implement"] };

const realNow = Date.now;
Date.now = () => FIXED_NOW * 1000;
const frame = (i, branch) =>
  renderPayload(
    { ...scenario.payload, session_id: "images" },
    {
      sources: {
        ...scenario.sources,
        getGitInfo: () => ({ branch, upstream: `origin/${branch}`, ahead: 2, behind: 0, changed: 4, untracked: 1 }),
        getSessionActivity: () => activity,
      },
      trackChanges: true,
      layout: noArrangement,
      maxWidth: 120,
      maxHeight: 40,
      now: FIXED_NOW * 1000 + i * 1000,
    }
  );

// Four redraws on one branch turn the spinner a full turn; the fifth is on
// another branch, so that segment is marked bold and underlined.
const frames = [0, 1, 2, 3].map((i) => frame(i, "feature/preview-images"));
frames.push(frame(4, "feature/rows-themes-docs"));
Date.now = realNow;

const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-frames-"));
const files = frames.map((text, i) => {
  const file = path.join(dir, `frame-${i}.ansi`);
  writeFileSync(file, text);
  return file;
});

const python = process.env.STATUSLINE_PYTHON ?? "python3";
const rasterise = path.join(ROOT, "scripts", "rasterise-ansi.py");
// The painter runs with the person's own HOME, where their Python packages and
// fonts are, not the throwaway one the frames were drawn under.
const env = { ...process.env, HOME: realHome };
execFileSync(python, [rasterise, path.join(OUT, "bar.png"), files[0]], { stdio: "inherit", env });
execFileSync(python, [rasterise, path.join(OUT, "bar.gif"), ...files, "--delay", "700"], { stdio: "inherit", env });
console.log(`${frames.length} frames drawn into docs/images/`);
