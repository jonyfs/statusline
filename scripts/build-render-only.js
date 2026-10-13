#!/usr/bin/env node
/**
 * Builds the render-only copy of the renderer (specs/061-render-only).
 *
 *   node scripts/build-render-only.js [outDir]      default: dist/render-only
 *
 * What a host that only draws the bar needs: `bin/cli.js` (which imports
 * nothing statically and loads a command's modules only when it runs), the
 * modules the render, refresh, print-config and version paths reach, the data
 * they read, `package.json` for the version, and a `VERSION` file naming the
 * commit and the contract. No install, doctor, Codex launcher or pane, no
 * previews. Running a command that was left out fails with the module that
 * is missing, which is the answer: this copy has no such command.
 *
 * The closure is read from the import graph, so a module the renderer
 * starts to need is in the build without anyone listing it.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACT } from "../src/runs.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The modules `bin/cli.js` loads for the commands the build keeps. */
export const ENTRIES = ["render.js", "config.js", "runs.js", "printConfig.js", "refresh.js", "paths.js"].map((f) => path.join("src", f));

const IMPORT = /(?:from\s+|import\s*\(\s*)["'](\.[^"']+)["']/g;

/** Every `src/` file reachable from the entries, by static and literal dynamic imports. */
export function closure(entries = ENTRIES, base = root) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel) || !rel.startsWith("src") || !existsSync(path.join(base, rel))) continue;
    seen.add(rel);
    const text = readFileSync(path.join(base, rel), "utf8");
    for (const m of text.matchAll(IMPORT)) stack.push(path.normalize(path.join(path.dirname(rel), m[1])));
  }
  return [...seen].sort();
}

/** `data/` files the kept modules name through `new URL("./data/...")` are reached by import, so they are in the closure. */
export function buildRenderOnly(outDir = path.join(root, "dist", "render-only")) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "bin"), { recursive: true });
  const files = closure();
  for (const rel of files) {
    mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
    cpSync(path.join(root, rel), path.join(outDir, rel));
  }
  cpSync(path.join(root, "bin", "cli.js"), path.join(outDir, "bin", "cli.js"));
  cpSync(path.join(root, "package.json"), path.join(outDir, "package.json"));
  if (existsSync(path.join(root, "LICENSE"))) cpSync(path.join(root, "LICENSE"), path.join(outDir, "LICENSE"));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // a tarball without .git: the version is still true
  }
  writeFileSync(
    path.join(outDir, "VERSION"),
    JSON.stringify({ version: pkg.version, commit, contract: CONTRACT, build: "render-only", modules: files.length }, null, 2) + "\n"
  );
  return { outDir, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const { outDir, files } = buildRenderOnly(out);
  console.log(`render-only: ${files.length} modules under ${path.relative(process.cwd(), outDir)}`);
}
