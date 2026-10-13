/**
 * The shared host fixtures (specs/060-host-fixtures): payloads, the
 * environment they are rendered in, and the plain rows of the runs form.
 *
 * A host copies `fixtures/host/` and runs the same payloads through its copy
 * of the renderer with the same environment; the rows have to match.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(here, "..");
export const fixturesDir = path.join(root, "fixtures", "host");
export const WIDTHS = [80, 100, 144, 200];

/** The names of the payload files, without `.json`, in a stable order. */
export function payloads() {
  return readdirSync(path.join(fixturesDir, "payloads"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** The environment a fixture is rendered in: nothing of the machine's own. */
export function fixtureEnv(width, extra = {}) {
  return {
    PATH: process.env.PATH,
    HOME: path.join(root, "fixtures", "host", ".no-home"),
    TZ: "UTC",
    TERM: "xterm",
    COLORTERM: "truecolor",
    COLUMNS: String(width),
    LINES: "40",
    CLAUDE_STATUSLINE_PASSIVE: "1",
    CLAUDE_STATUSLINE_UPDATES: "off",
    CLAUDE_STATUSLINE_DEBUG: "0",
    CLAUDE_STATUSLINE_FLAVOR: "mocha",
    CLAUDE_STATUSLINE_OUTPUT: "runs",
    ...extra,
  };
}

/** The runs object the renderer at `cli` prints for a payload at a width. */
export function render(name, width, { cli = path.join(root, "bin", "cli.js"), extra = {} } = {}) {
  const input = readFileSync(path.join(fixturesDir, "payloads", `${name}.json`), "utf8");
  const r = spawnSync(process.execPath, [cli], { input, encoding: "utf8", env: fixtureEnv(width, extra), cwd: fixturesDir });
  if (r.status !== 0) throw new Error(`${name} at ${width}: exit ${r.status}: ${r.stdout}${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** The text of each line, trailing blanks trimmed. */
export function plainRows(name, width, options) {
  return render(name, width, options).lines.map((line) => line.map((run) => run.text).join("").replace(/\s+$/, ""));
}
