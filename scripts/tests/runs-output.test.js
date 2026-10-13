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

await test("a basic colour code clears a truecolor value set earlier on the line", () => {
  const runs = ansiToRuns("\x1b[38;2;1;2;3m\x1b[48;2;4;5;6mA\x1b[31m\x1b[42mB\x1b[38;2;7;8;9mC");
  assert.deepEqual(runs, [{ text: "A", fg: "#010203", bg: "#040506" }, { text: "B" }, { text: "C", fg: "#070809" }]);
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
  for (const env of [{ NO_COLOR: "1" }, { CLAUDE_STATUSLINE_FLAVOR: "terminal" }]) {
    const r = runCli(["--format", "runs"], JSON.stringify({ cwd: ROOT }), env);
    const doc = JSON.parse(r.stdout);
    for (const run of doc.lines.flat()) {
      assert.ok(!("fg" in run) && !("bg" in run), `${JSON.stringify(env)}: ${JSON.stringify(run)}`);
    }
  }
});

await test("the picture matches a second reading of the ANSI output, character by character (SC-002)", () => {
  // A deliberately plain second reader: it walks the string once and keeps the
  // style of every visible code point. The converter has to agree with it on
  // foreground, background, bold, dim, underline and link.
  const cells = (ansi) => {
    const out = [];
    let fg = null, bg = null, bold = false, dim = false, underline = false, href = null;
    for (let i = 0; i < ansi.length; ) {
      if (ansi[i] === "\x1b" && ansi[i + 1] === "[") {
        const end = ansi.indexOf("m", i);
        const codes = ansi.slice(i + 2, end).split(";");
        for (let k = 0; k < codes.length; k++) {
          const [c, sub] = codes[k].split(":");
          if (c === "0" || c === "") { fg = bg = null; bold = dim = underline = false; }
          else if (c === "1") bold = true;
          else if (c === "2") dim = true;
          else if (c === "22") bold = dim = false;
          else if (c === "4") underline = sub !== "0";
          else if (c === "24") underline = false;
          else if (c === "39" || (Number(c) >= 30 && Number(c) <= 37) || (Number(c) >= 90 && Number(c) <= 97)) fg = null;
          else if (c === "49" || (Number(c) >= 40 && Number(c) <= 47) || (Number(c) >= 100 && Number(c) <= 107)) bg = null;
          else if ((c === "38" || c === "48") && codes[k + 1] === "2") {
            const v = "#" + codes.slice(k + 2, k + 5).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
            if (c === "38") fg = v; else bg = v;
            k += 4;
          }
        }
        i = end + 1;
      } else if (ansi[i] === "\x1b" && ansi[i + 1] === "]") {
        const bel = ansi.indexOf("\x07", i);
        const st = ansi.indexOf("\x1b\\", i);
        const end = bel !== -1 && (st === -1 || bel < st) ? bel : st;
        const body = ansi.slice(i + 2, end);
        const target = body.split(";").slice(2).join(";");
        href = target || null;
        i = end + (end === st ? 2 : 1);
      } else {
        const ch = String.fromCodePoint(ansi.codePointAt(i));
        i += ch.length;
        if (ch === "\n") out.push("\n");
        else if (!/[\u0000-\u001f\u007f-\u009f]/.test(ch)) out.push({ ch, fg, bg, bold, dim, underline, href });
      }
    }
    return out;
  };
  const variants = [
    [{}, {}],
    [{ CLAUDE_STATUSLINE_ASCII: "1" }, {}],
    // The terminal palette writes basic colour codes, which carry no value.
    [{}, { flavor: "terminal" }],
    // SGR 2, so `dim` is compared as true as well as false.
    [{ CLAUDE_STATUSLINE_DIM: "sgr" }, {}],
  ];
  for (const [extra, options] of variants) {
    for (const width of WIDTHS) {
      const ansi = ansiAt(width, extra, options);
      const expected = cells(ansi).filter((c) => c === "\n" || c.ch !== undefined);
      const doc = runsDocument(ansi);
      const got = [];
      doc.lines.forEach((line, n) => {
        if (n) got.push("\n");
        for (const r of line) {
          for (const ch of r.text) {
            got.push({ ch, fg: r.fg ?? null, bg: r.bg ?? null, bold: !!r.bold, dim: !!r.dim, underline: !!r.underline, href: r.href ?? null });
          }
        }
      });
      // Trailing newlines are not lines of the bar.
      while (expected.length && expected[expected.length - 1] === "\n") expected.pop();
      assert.equal(got.length, expected.length, `${width} ${JSON.stringify(extra)}: cell count`);
      for (let i = 0; i < got.length; i++) {
        assert.deepEqual(got[i], expected[i], `${width} ${JSON.stringify(extra)}: cell ${i}`);
      }
    }
  }
});

await test("a scheme in capitals is written in lower case; an unknown CSI leaves no text behind", () => {
  assert.deepEqual(ansiToRuns("\x1b]8;;HTTPS://X.COM/a\x07t\x1b]8;;\x07"), [{ text: "t", href: "https://X.COM/a" }]);
  assert.deepEqual(ansiToRuns("x\x1b[2Jy"), [{ text: "xy" }]);
  assert.deepEqual(ansiToRuns("a\x1b\u{1F600}b"), [{ text: "ab" }]);
});

await test("--format belongs to render: other commands keep their arguments", () => {
  const r = runCli(["help", "--format", "runs"], "", {});
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage:/);
  const bare = runCli(["--format"], "{}", { CLAUDE_STATUSLINE_OUTPUT: "runs" });
  assert.equal(bare.status, 0);
  assert.ok(bare.stdout.trim().startsWith("{"), "a bare --format keeps the variable");
});
