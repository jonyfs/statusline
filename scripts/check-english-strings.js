#!/usr/bin/env node
/**
 * Regression guard for FR-007 (specs/005-statusline-english-only): flags any
 * string literal in the rendered/output-facing source files that contains a
 * non-English character or word, so a future edit can't silently reintroduce
 * mixed-language statusline output.
 *
 * Scope is deliberately narrow: `src/*.js` and `bin/cli.js`, since those are
 * the only files whose string literals reach the terminal. Comments, dev
 * logs, and pass-through data (branch names, commit messages, task titles)
 * are read from git/tasks at runtime, not written as literals here, so they
 * are outside this scan by construction.
 *
 * A baseline run against the pre-feature codebase found zero violations
 * (specs/005-statusline-english-only/research.md), so this script exists to
 * keep that true, not to fix an existing backlog.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const TARGET_FILES = [
  ...readdirSync(path.join(repoRoot, "src"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join("src", name)),
  path.join("bin", "cli.js"),
];

// Only a non-ASCII *letter* (Unicode category L: accented Latin, Cyrillic,
// CJK, etc.) is evidence of foreign-language prose. Non-letter symbols the
// statusline legitimately emits as icons, not words, are excluded by
// construction: block/bar glyphs (█ ░ ▓ ▒), the powerline separator (▸),
// clock-face emoji, and em/en dashes used as English punctuation. A literal
// like "revisão" or "não encontrado" still trips this immediately.
const NON_ENGLISH_LETTER = /\p{L}/u;

function hasNonEnglishLetter(value) {
  for (const ch of value) {
    if (ch.codePointAt(0) > 0x7f && NON_ENGLISH_LETTER.test(ch)) return true;
  }
  return false;
}

/**
 * Blanks out `//` and block comments, preserving line breaks (so line
 * numbers reported later stay accurate) and leaving string-literal content
 * untouched. This project's style uses double quotes and template literals
 * for actual string values (verified: no `'...'`-delimited string literals
 * appear in `src/`), so an apostrophe inside an English comment like "it's"
 * or "doesn't" is never mistaken for a string delimiter once comments are
 * blanked first.
 */
function stripComments(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === "//") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (two === "/*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (text[i] === '"' || text[i] === "`") {
      const quote = text[i];
      let j = i + 1;
      while (j < text.length && text[j] !== quote) {
        j += text[j] === "\\" ? 2 : 1;
      }
      const stop = Math.min(j + 1, text.length);
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function stringLiteralsIn(text) {
  const literals = [];
  const pattern = /"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[1] ?? match[2] ?? "";
    literals.push({ value, index: match.index });
  }
  return literals;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function findViolations() {
  const violations = [];
  for (const relPath of TARGET_FILES) {
    const absPath = path.join(repoRoot, relPath);
    const text = readFileSync(absPath, "utf8");
    const scanText = stripComments(text);
    for (const { value, index } of stringLiteralsIn(scanText)) {
      if (!hasNonEnglishLetter(value)) continue;
      const line = lineNumberAt(text, index);
      violations.push({ file: relPath, line, text: value });
    }
  }
  return violations;
}

function main() {
  const violations = findViolations();
  if (violations.length === 0) {
    console.log(`no non-English tool-authored strings found (${TARGET_FILES.length} files scanned)`);
    return 0;
  }
  console.log(`${violations.length} non-English tool-authored string(s) found:\n`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${JSON.stringify(v.text)}`);
  }
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

export { findViolations };
