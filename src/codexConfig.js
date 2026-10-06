/**
 * The one key this plugin writes into Codex's `config.toml`
 * (specs/029-multi-harness).
 *
 * Codex CLI runs no external status line command; its status line is a list
 * of built-in items under `[tui] status_line`. These are the items closest to
 * this project's bar, in its order, and Codex 0.158.0 was seen drawing them.
 *
 * No TOML library: the project has no runtime dependencies (Principle IV).
 * The edit is line-level and limited to one key in one table, which is all it
 * needs, and every other byte of the file is kept.
 */

export const CODEX_ITEMS = [
  "model-with-reasoning",
  "current-dir",
  "git-branch",
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "fast-mode",
  "run-state",
  "task-progress",
];

export const CODEX_STATUS_LINE = `status_line = [${CODEX_ITEMS.map((i) => JSON.stringify(i)).join(", ")}]`;

const isHeader = (l) => /^\s*\[[^\]]+\]\s*(#.*)?$/.test(l) || /^\s*\[\[[^\]]+\]\]\s*(#.*)?$/.test(l);
// TOML lets a bare key also be written quoted, and allows spaces inside the
// brackets; Codex reads `["tui"]` and `[ tui ]` as the same table as `[tui]`.
const isTui = (l) => /^\s*\[\s*(tui|"tui"|'tui')\s*\]\s*(#.*)?$/.test(l);
const KEY = /^\s*(status_line|"status_line"|'status_line')\s*=\s*/;
// The root table can also define tui as a dotted key or an inline table. A
// `[tui]` header after that is a second definition, which Codex will not load.
const isRootTui = (l) => /^\s*(tui|"tui"|'tui')\s*[.=]/.test(l);

/**
 * The line where the value that starts on `lines[i]` ends. Brackets are
 * counted outside strings and comments, so an array may close on its last
 * item's line and an item may hold a `]`. -1 when it never closes before `end`.
 */
function valueEnd(lines, i, end) {
  let depth = 0;
  for (let j = i; j < end; j++) {
    const l = lines[j];
    let quote = null;
    for (let k = j === i ? l.indexOf("=") + 1 : 0; k < l.length; k++) {
      const c = l[k];
      if (quote) {
        if (quote === '"' && c === "\\") k++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "#") break;
      else if (c === "[") depth++;
      else if (c === "]") depth--;
    }
    if (depth <= 0) return j;
  }
  return -1;
}

/**
 * Where `[tui]`'s `status_line` sits, as [start, end) line indices, and the
 * table's bounds. `unsafe` when the file defines tui in a way a line edit
 * cannot follow, so neither writer touches it.
 */
function locate(lines) {
  const firstHeader = lines.findIndex(isHeader);
  if (lines.slice(0, firstHeader === -1 ? lines.length : firstHeader).some(isRootTui)) return { unsafe: true };
  const header = lines.findIndex(isTui);
  if (header === -1) return { header: -1 };
  let end = header + 1;
  while (end < lines.length && !isHeader(lines[end])) end++;
  for (let i = header + 1; i < end; i++) {
    if (!KEY.test(lines[i])) continue;
    const j = valueEnd(lines, i, end);
    if (j === -1) return { unsafe: true };
    return { header, key: [i, j + 1] };
  }
  return { header, key: null };
}

/**
 * The text with our `status_line` set under `[tui]`, or null when the file
 * defines tui in a form this writer does not edit; the caller leaves it alone.
 */
export function setCodexStatusLine(text = "") {
  const lines = text.split("\n");
  const { header, key, unsafe } = locate(lines);
  if (unsafe) return null;
  if (header === -1) {
    const base = text === "" ? "" : text.endsWith("\n") ? text : `${text}\n`;
    return `${base}${base === "" ? "" : "\n"}[tui]\n${CODEX_STATUS_LINE}\n`;
  }
  if (key) lines.splice(key[0], key[1] - key[0], CODEX_STATUS_LINE);
  else lines.splice(header + 1, 0, CODEX_STATUS_LINE);
  return lines.join("\n");
}

/** The text without our `status_line`; a different list is left alone. */
export function removeCodexStatusLine(text = "") {
  const lines = text.split("\n");
  const { header, key, unsafe } = locate(lines);
  if (unsafe || header === -1 || !key) return text;
  const value = lines.slice(key[0], key[1]).join("\n").replace(KEY, "");
  let items;
  try {
    items = JSON.parse(value.replace(/,\s*\]/, "]").replace(/#.*$/gm, ""));
  } catch {
    return text;
  }
  if (JSON.stringify(items) !== JSON.stringify(CODEX_ITEMS)) return text;
  lines.splice(key[0], key[1] - key[0]);
  // A `[tui]` table this plugin created, and left empty, goes with it.
  const tableEmpty = (header + 1 >= lines.length || isHeader(lines[header + 1]) || lines.slice(header + 1).every((l) => l.trim() === ""));
  if (tableEmpty && /^\[tui\]$/.test(lines[header].trim())) {
    lines.splice(header, 1);
    if (header > 0 && lines[header - 1] === "") lines.splice(header - 1, 1);
  }
  return lines.join("\n");
}

/** Whether `[tui] status_line` is the list this plugin writes. */
export function hasCodexStatusLine(text = "") {
  return removeCodexStatusLine(text) !== text;
}
