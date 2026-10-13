import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../test-harness.js";
import { ansiToRuns, runsDocument, errorDocument } from "../../src/runs.js";
import { WIDTHS, ansiAt } from "./ansi-fixtures.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "bin", "cli.js");
const SCHEMA = JSON.parse(readFileSync(path.join(ROOT, "specs/056-runs-output-contract/contracts/runs-output.schema.json"), "utf8"));
const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;[^;\x07]*;[^\x07\x1b]*(?:\x07|\x1b\\)/g, "");

/** A small checker for the parts of the schema this contract uses. */
function violations(doc) {
  const out = [];
  const keys = Object.keys(doc);
  if (doc.contract !== 1) out.push("contract is not 1");
  if (keys.some((k) => !["contract", "lines", "error"].includes(k))) out.push("unknown top-level key");
  if (("lines" in doc) === ("error" in doc)) out.push("needs exactly one of lines and error");
  const run = SCHEMA.$defs.run.properties;
  for (const line of doc.lines ?? []) {
    for (const r of line) {
      if (typeof r.text !== "string" || !r.text.length) out.push("empty text");
      if (/[\u0000-\u001f\u007f]/.test(r.text)) out.push(`control character in ${JSON.stringify(r.text)}`);
      for (const k of Object.keys(r)) if (!(k in run)) out.push(`unknown run key ${k}`);
      for (const k of ["fg", "bg"]) if (k in r && !/^#[0-9a-f]{6}$/.test(r[k])) out.push(`bad ${k}`);
      for (const k of ["bold", "dim", "underline"]) if (k in r && r[k] !== true) out.push(`${k} is not true`);
      if ("href" in r && !/^(https?|file):\/\//.test(r.href)) out.push("bad href");
    }
  }
  if (doc.error) {
    if (!SCHEMA.$defs.error.properties.code.enum.includes(doc.error.code)) out.push("unknown code");
    if (!doc.error.message || /[\r\n]/.test(doc.error.message)) out.push("bad message");
  }
  return out;
}

const runCli = (args, input, env = {}) =>
  spawnSync(process.execPath, [CLI, ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_STATUSLINE_NO_REFRESH: "1", COLUMNS: "100", ...env },
    cwd: ROOT,
  });

// The converter ------------------------------------------------------------

await test("the converter reads the sequences the renderer writes", () => {
  const line =
    "\x1b[48;2;49;50;68m\x1b[38;2;255;255;255m\x1b[1m a \x1b[22m\x1b[2mb\x1b[22m\x1b[4:4mc\x1b[4:0m\x1b[0m\x1b[38;2;1;2;3mz";
  assert.deepEqual(ansiToRuns(line), [
    { text: " a ", fg: "#ffffff", bg: "#313244", bold: true },
    { text: "b", fg: "#ffffff", bg: "#313244", dim: true },
    { text: "c", fg: "#ffffff", bg: "#313244", underline: true },
    { text: "z", fg: "#010203" },
  ]);
});

await test("a link keeps its target and drops its id; an unknown scheme keeps the text", () => {
  const ok = ansiToRuns("\x1b]8;id=1;https://example.com/a\x07link\x1b]8;;\x07 after");
  assert.deepEqual(ok, [{ text: "link", href: "https://example.com/a" }, { text: " after" }]);
  const st = ansiToRuns("\x1b]8;;file:///tmp/x\x1b\\here\x1b]8;;\x1b\\");
  assert.deepEqual(st, [{ text: "here", href: "file:///tmp/x" }]);
  const bad = ansiToRuns("\x1b]8;;javascript:alert(1)\x07text\x1b]8;;\x07");
  assert.deepEqual(bad, [{ text: "text" }]);
});

await test("spaces keep their background, an unstyled run has only text, a wide character is whole", () => {
  assert.deepEqual(ansiToRuns("\x1b[48;2;1;2;3m   \x1b[0m"), [{ text: "   ", bg: "#010203" }]);
  assert.deepEqual(ansiToRuns("plain"), [{ text: "plain" }]);
  assert.deepEqual(ansiToRuns("a\u{1F600}b"), [{ text: "a\u{1F600}b" }]);
});

await test("control characters never reach a run, and equal neighbours merge", () => {
  assert.deepEqual(ansiToRuns("a\u0001b\u0003c\x1b[1md\x1b[22m\x1b[1me"), [
    { text: "abc" },
    { text: "de", bold: true },
  ]);
});

await test("an empty status is no lines, and an unknown error code is internal", () => {
  assert.deepEqual(runsDocument(""), { contract: 1, lines: [] });
  assert.equal(errorDocument("nope", "a\nb").error.code, "internal");
  assert.equal(errorDocument("bad-payload", "x").error.message, "x");
});

// The fixture ---------------------------------------------------------------

await test("the runs join to the plain text of the ANSI output at every width (SC-001)", () => {
  for (const extra of [{}, { CLAUDE_STATUSLINE_ASCII: "1" }]) {
    for (const width of WIDTHS) {
      const ansi = ansiAt(width, extra);
      const doc = runsDocument(ansi);
      assert.deepEqual(violations(doc), [], `${width} ${JSON.stringify(extra)}`);
      const joined = doc.lines.map((l) => l.map((r) => r.text).join("")).join("\n");
      const plain = strip(ansi).replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "").replace(/\n+$/, "");
      assert.equal(joined, plain, `${width} ${JSON.stringify(extra)}`);
    }
  }
});

await test("replaying the runs as escapes gives the picture of the ANSI output (SC-002)", () => {
  const replay = (runs) =>
    runs
      .map((r) => {
        const on = [];
        if (r.bg) on.push(`48;2;${parseInt(r.bg.slice(1, 3), 16)};${parseInt(r.bg.slice(3, 5), 16)};${parseInt(r.bg.slice(5, 7), 16)}`);
        if (r.fg) on.push(`38;2;${parseInt(r.fg.slice(1, 3), 16)};${parseInt(r.fg.slice(3, 5), 16)};${parseInt(r.fg.slice(5, 7), 16)}`);
        if (r.bold) on.push("1");
        if (r.dim) on.push("2");
        if (r.underline) on.push("4");
        const link = r.href ? `\x1b]8;;${r.href}\x07` : "";
        const unlink = r.href ? "\x1b]8;;\x07" : "";
        return `${on.length ? `\x1b[${on.join(";")}m` : ""}${link}${r.text}${unlink}\x1b[0m`;
      })
      .join("");
  for (const width of WIDTHS) {
    const ansi = ansiAt(width);
    for (const line of ansi.split("\n")) {
      const runs = ansiToRuns(line);
      assert.deepEqual(ansiToRuns(replay(runs)), runs, `${width}: a line does not survive the replay`);
    }
    // An independent count: every colour and every link in the raw output is in the runs.
    const doc = runsDocument(ansi);
    const all = doc.lines.flat();
    const bgs = new Set([...ansi.matchAll(/48;2;(\d+);(\d+);(\d+)m/g)].map((m) => `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("")}`));
    const seen = new Set(all.map((r) => r.bg).filter(Boolean));
    for (const bg of seen) assert.ok(bgs.has(bg), `${width}: ${bg} is not in the output`);
    const links = new Set([...ansi.matchAll(/\x1b\]8;[^;\x07]*;([^\x07\x1b]+)(?:\x07|\x1b\\)/g)].map((m) => m[1]));
    for (const r of all) if (r.href) assert.ok(links.has(r.href), `${width}: ${r.href}`);
    assert.ok(all.some((r) => r.bold), `${width}: bold survives`);
    assert.ok(all.some((r) => r.href), `${width}: links survive`);
  }
});

// The command ----------------------------------------------------------------

await test("the command prints one valid object with the variable or the flag", () => {
  const payload = JSON.stringify({ model: { display_name: "Opus 5" }, cwd: ROOT });
  for (const [args, env] of [[[], { CLAUDE_STATUSLINE_OUTPUT: "runs" }], [["--format", "runs"], {}], [["--format=runs"], {}]]) {
    const r = runCli(args, payload, env);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim().split("\n").length, 1, "one line, one object");
    const doc = JSON.parse(r.stdout);
    assert.deepEqual(violations(doc), []);
    assert.ok(doc.lines.length >= 1);
  }
});

await test("an empty status payload is an object with a footer, not an error", () => {
  const r = runCli([], "{}", { CLAUDE_STATUSLINE_OUTPUT: "runs" });
  assert.equal(r.status, 0);
  assert.deepEqual(violations(JSON.parse(r.stdout)), []);
});

await test("every documented error is exit 75, a valid object and no stack (SC-003)", () => {
  const cases = [
    ["bad-payload", "", {}],
    ["bad-payload", "not json", {}],
    ["bad-payload", "[]", {}],
    ["bad-payload", "null", {}],
    ["bad-payload", '"text"', {}],
    ["internal", "{}", { CLAUDE_STATUSLINE_TEST_THROW: "1" }],
    ["node-version", "{}", { CLAUDE_STATUSLINE_TEST_NODE_MAJOR: "14" }],
  ];
  for (const [code, input, env] of cases) {
    const r = runCli([], input, { CLAUDE_STATUSLINE_OUTPUT: "runs", ...env });
    assert.equal(r.status, 75, `${code} ${JSON.stringify(input)}: exit ${r.status}`);
    const doc = JSON.parse(r.stdout);
    assert.deepEqual(violations(doc), []);
    assert.equal(doc.error.code, code);
    assert.ok(!/\n\s+at /.test(r.stdout), "no stack trace on stdout");
  }
});

await test("a valid object with unknown fields still draws", () => {
  const r = runCli(["--format", "runs"], JSON.stringify({ nothing: { known: 1 }, cwd: ROOT }));
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout).lines.length >= 1);
});

await test("the default mode keeps its failure lines and exit 0", () => {
  const bad = runCli([], "not json");
  assert.equal(bad.status, 0);
  assert.ok(!bad.stdout.trim().startsWith("{"), "a bar, not an object");
  const threw = runCli([], "{}", { CLAUDE_STATUSLINE_TEST_THROW: "1" });
  assert.equal(threw.status, 0);
  assert.match(strip(threw.stdout), /statusline unavailable/);
  const ansi = runCli(["--format", "ansi"], "{}", { CLAUDE_STATUSLINE_OUTPUT: "runs" });
  assert.ok(!ansi.stdout.trim().startsWith("{"), "--format ansi wins over the variable");
});

await test("NO_COLOR gives runs with no colour, and the terminal palette none either", () => {
  const r = runCli(["--format", "runs"], JSON.stringify({ cwd: ROOT }), { NO_COLOR: "1" });
  const doc = JSON.parse(r.stdout);
  for (const run of doc.lines.flat()) {
    assert.ok(!("fg" in run) && !("bg" in run), JSON.stringify(run));
  }
});
