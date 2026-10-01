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

const LINE = `status_line = [${CODEX_ITEMS.map((i) => JSON.stringify(i)).join(", ")}]`;

const isHeader = (l) => /^\s*\[[^\]]+\]\s*(#.*)?$/.test(l) || /^\s*\[\[[^\]]+\]\]\s*(#.*)?$/.test(l);
const isTui = (l) => /^\s*\[tui\]\s*(#.*)?$/.test(l);

/** Where `[tui]`'s `status_line` sits, as [start, end) line indices, and the table's bounds. */
function locate(lines) {
  const header = lines.findIndex(isTui);
  if (header === -1) return { header: -1 };
  let end = header + 1;
  while (end < lines.length && !isHeader(lines[end])) end++;
  for (let i = header + 1; i < end; i++) {
    if (!/^\s*status_line\s*=/.test(lines[i])) continue;
    let j = i;
    // A multi-line array runs to the line that closes it.
    if (lines[i].includes("[") && !/\]\s*(#.*)?$/.test(lines[i])) {
      while (j + 1 < end && !/^\s*\]\s*,?\s*(#.*)?$/.test(lines[j])) j++;
    }
    return { header, key: [i, j + 1] };
  }
  return { header, key: null };
}

/** The text with our `status_line` set under `[tui]`. */
export function setCodexStatusLine(text = "") {
  const lines = text.split("\n");
  const { header, key } = locate(lines);
  if (header === -1) {
    const base = text === "" ? "" : text.endsWith("\n") ? text : `${text}\n`;
    return `${base}${base === "" ? "" : "\n"}[tui]\n${LINE}\n`;
  }
  if (key) lines.splice(key[0], key[1] - key[0], LINE);
  else lines.splice(header + 1, 0, LINE);
  return lines.join("\n");
}

/** The text without our `status_line`; a different list is left alone. */
export function removeCodexStatusLine(text = "") {
  const lines = text.split("\n");
  const { header, key } = locate(lines);
  if (header === -1 || !key) return text;
  const value = lines.slice(key[0], key[1]).join("\n").replace(/^\s*status_line\s*=\s*/, "");
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
