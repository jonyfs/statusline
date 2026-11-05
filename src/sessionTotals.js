/**
 * What the session has spent, summed from the transcript as it is written
 * (specs/073-session-totals).
 *
 * Every answer in the transcript carries `message.usage` with the four
 * token counts, `message.model`, and its `tool_use` blocks. Subagents write
 * `subagents/agent-*.jsonl` beside the session's own file, and older
 * sessions mark their turns `isSidechain`. Reading all of it on every redraw
 * is what `transcriptTail.js` exists to avoid, so this keeps a byte offset
 * per file and folds in only what was appended since the last redraw, at
 * most 2 MiB per redraw: a long transcript is caught up over a few redraws
 * rather than stalling one.
 *
 * The state lives in its own file under the state root, next to the task
 * snapshots, and is best effort throughout: a file that cannot be written
 * costs this redraw's figures and nothing else.
 */

import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canWrite, stateRoot } from "./paths.js";

/** Bytes folded in per redraw, at most. */
export const STEP_BYTES = 2 * 1024 * 1024;
/** How long an output sample is kept for the rate. */
export const RATE_SPAN_MS = 15 * 60 * 1000;
/** Two samples closer than this say nothing about a rate. */
export const RATE_MIN_SPAN_MS = 60 * 1000;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const isBlock = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function emptyTotals() {
  return {
    offset: 0,
    agentOffsets: {},
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    turns: 0,
    tools: {},
    byModel: {},
    agentTokens: 0,
    agentTotals: {},
    over200kMs: 0,
    over200kAt: null,
    outputSamples: [],
  };
}

function cleanTotals(raw) {
  const t = emptyTotals();
  if (!isBlock(raw)) return t;
  for (const k of ["offset", "input", "output", "cacheRead", "cacheWrite", "turns", "agentTokens", "over200kMs"]) {
    if (finite(raw[k]) && raw[k] >= 0) t[k] = raw[k];
  }
  if (isBlock(raw.agentOffsets)) for (const [f, o] of Object.entries(raw.agentOffsets)) if (finite(o)) t.agentOffsets[f] = o;
  if (isBlock(raw.tools)) for (const [n, c] of Object.entries(raw.tools)) if (finite(c)) t.tools[n] = c;
  if (isBlock(raw.byModel)) for (const [n, c] of Object.entries(raw.byModel)) if (finite(c)) t.byModel[n] = c;
  if (isBlock(raw.agentTotals)) for (const [n, c] of Object.entries(raw.agentTotals)) if (finite(c)) t.agentTotals[n] = c;
  if (finite(raw.over200kAt)) t.over200kAt = raw.over200kAt;
  if (Array.isArray(raw.outputSamples)) t.outputSamples = raw.outputSamples.filter((s) => isBlock(s) && finite(s.at) && finite(s.output));
  return t;
}

/**
 * Folds one transcript line into the totals. `agent` says the line comes
 * from a subagent's file; a sidechain entry in the main file counts as one
 * too. Pure, so a test can feed it fabricated entries.
 */
export function foldLine(totals, line, { agent = false, agentId = null } = {}) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return totals;
  }
  if (!isBlock(entry) || entry.type !== "assistant" || !isBlock(entry.message)) return totals;
  const fromAgent = agent || entry.isSidechain === true;
  const u = entry.message.usage;
  if (isBlock(u)) {
    const n = (v) => (finite(v) && v >= 0 ? v : 0);
    const input = n(u.input_tokens), output = n(u.output_tokens), read = n(u.cache_read_input_tokens), write = n(u.cache_creation_input_tokens);
    totals.input += input;
    totals.output += output;
    totals.cacheRead += read;
    totals.cacheWrite += write;
    totals.turns += 1;
    if (fromAgent) {
      totals.agentTokens += input + output + read + write;
      // By agent (specs/077): the file's id, or the entry's own.
      const id = agentId ?? (typeof entry.agentId === "string" && entry.agentId ? entry.agentId : null);
      if (id) totals.agentTotals[id] = (totals.agentTotals[id] ?? 0) + input + output + read + write;
    }
    const model = typeof entry.message.model === "string" && entry.message.model ? entry.message.model : null;
    if (model) totals.byModel[model] = (totals.byModel[model] ?? 0) + output;
  }
  const content = entry.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (isBlock(block) && block.type === "tool_use" && typeof block.name === "string" && block.name) {
        totals.tools[block.name] = (totals.tools[block.name] ?? 0) + 1;
      }
    }
  }
  return totals;
}

/**
 * Reads `file` from `offset`, at most `budget` bytes, folding whole lines
 * in. Returns the new offset and how many bytes it consumed. A partial last
 * line is left for the next redraw. A file shorter than the offset was
 * rewritten: it is read again from zero.
 */
function foldFile(totals, file, offset, budget, opts) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    return { offset, used: 0 };
  }
  let start = finite(offset) && offset <= size ? offset : 0;
  if (start >= size || budget <= 0) return { offset: start, used: 0 };
  const want = Math.min(size - start, budget);
  const buffer = Buffer.alloc(want);
  let fd = null;
  let got = 0;
  try {
    fd = openSync(file, "r");
    got = readSync(fd, buffer, 0, want, start);
  } catch {
    return { offset: start, used: 0 };
  } finally {
    if (fd !== null) closeSync(fd);
  }
  const text = buffer.subarray(0, got).toString("utf8");
  const lastNewline = text.lastIndexOf("\n");
  // Only whole lines; the tail of a line still being written waits.
  const whole = lastNewline === -1 ? "" : text.slice(0, lastNewline + 1);
  for (const line of whole.split("\n")) if (line.trim()) foldLine(totals, line, opts);
  const consumed = Buffer.byteLength(whole, "utf8");
  return { offset: start + consumed, used: got };
}

/** The subagent files beside a session's transcript, or none. */
function agentFiles(transcriptPath, sessionId) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return [];
  const dir = path.join(path.dirname(transcriptPath), String(sessionId ?? path.basename(transcriptPath, ".jsonl")), "subagents");
  try {
    return readdirSync(dir)
      .filter((n) => /^agent-.+\.jsonl$/.test(n))
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

function totalsFile(sessionId, env = process.env) {
  const safe = String(sessionId || "default").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(stateRoot(env), "state", `${safe}.totals.json`);
}

export function loadTotals(sessionId, env = process.env) {
  try {
    return cleanTotals(JSON.parse(readFileSync(totalsFile(sessionId, env), "utf8")));
  } catch {
    return emptyTotals();
  }
}

function saveTotals(sessionId, totals, env = process.env) {
  if (!canWrite(env)) return false;
  try {
    const file = totalsFile(sessionId, env);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(totals));
    return true;
  } catch {
    return false;
  }
}

/**
 * Folds what was appended since the last redraw into `totals`, in place,
 * and notes the time above 200k and one output sample. Pure apart from the
 * file reads, so a test can hand it a temporary transcript.
 */
export function advanceTotals(totals, { transcriptPath, sessionId = null, now = Date.now(), exceeds200k = false, budget = STEP_BYTES } = {}) {
  let left = budget;
  if (typeof transcriptPath === "string" && transcriptPath) {
    const main = foldFile(totals, transcriptPath, totals.offset, left, { agent: false });
    totals.offset = main.offset;
    left -= main.used;
    for (const file of agentFiles(transcriptPath, sessionId)) {
      if (left <= 0) break;
      const id = path.basename(file).replace(/^agent-/, "").replace(/\.jsonl$/, "");
      const r = foldFile(totals, file, totals.agentOffsets[file] ?? 0, left, { agent: true, agentId: id });
      totals.agentOffsets[file] = r.offset;
      left -= r.used;
    }
  }
  // Time above 200k: the gap since the last redraw that also saw the flag.
  if (exceeds200k) {
    if (finite(totals.over200kAt) && now > totals.over200kAt) totals.over200kMs += now - totals.over200kAt;
    totals.over200kAt = now;
  } else {
    totals.over200kAt = null;
  }
  const ring = totals.outputSamples.filter((s) => now - s.at <= RATE_SPAN_MS && s.at <= now);
  const last = ring[ring.length - 1];
  if (!last || last.output !== totals.output) ring.push({ at: now, output: totals.output });
  totals.outputSamples = ring.slice(-60);
  return totals;
}

/** Output tokens per minute over the ring, or null below a minute of span or without a rise. */
export function outputPerMinute(totals) {
  const ring = totals?.outputSamples ?? [];
  if (ring.length < 2) return null;
  const first = ring[0], last = ring[ring.length - 1];
  const span = last.at - first.at;
  if (span < RATE_MIN_SPAN_MS || last.output <= first.output) return null;
  return ((last.output - first.output) / span) * 60_000;
}

/**
 * The figures the bar draws: `{ total, perMinute, agentTokens, mix, turns,
 * tools, over200kMs }`. `mix` is `{ model, pct }` for the largest model
 * that is not `ownModel` when another model answered at all, else null.
 */
export function summarize(totals, { ownModel = null } = {}) {
  if (!totals) return null;
  const total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  const entries = Object.entries(totals.byModel).filter(([, out]) => out > 0);
  const outputAll = entries.reduce((s, [, out]) => s + out, 0);
  let mix = null;
  if (entries.length > 1 && outputAll > 0) {
    const own = ownModel ? String(ownModel).toLowerCase() : null;
    const others = entries.filter(([m]) => !own || !m.toLowerCase().includes(own)).sort((a, b) => b[1] - a[1]);
    const pick = others[0] ?? entries.sort((a, b) => b[1] - a[1])[1];
    if (pick) mix = { model: pick[0], pct: Math.round((pick[1] / outputAll) * 100) };
  }
  const tools = Object.entries(totals.tools).sort((a, b) => b[1] - a[1]);
  return {
    total,
    perMinute: outputPerMinute(totals),
    agentTokens: totals.agentTokens,
    agentTotals: totals.agentTotals,
    mix,
    turns: totals.turns,
    toolCalls: tools.reduce((s, [, c]) => s + c, 0),
    tools,
    over200kMs: totals.over200kMs,
  };
}

/** A family name from a model id: `claude-opus-5-5` is `opus`. */
export function modelFamily(id) {
  const m = String(id ?? "").toLowerCase().match(/opus|sonnet|haiku|fable|mythos/);
  return m ? m[0] : String(id ?? "").slice(0, 8);
}

/**
 * The probe the renderer calls once per redraw: loads, advances, saves,
 * summarizes. Null without a transcript.
 */
export function getSessionTotals({ transcriptPath, sessionId = null, now = Date.now(), exceeds200k = false, ownModel = null, env = process.env } = {}) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return null;
  const totals = loadTotals(sessionId, env);
  advanceTotals(totals, { transcriptPath, sessionId, now, exceeds200k });
  saveTotals(sessionId, totals, env);
  return summarize(totals, { ownModel });
}
