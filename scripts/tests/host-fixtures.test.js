import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "../test-harness.js";
import { displayWidth } from "../../src/theme.js";
import { fixturesDir, payloads, WIDTHS, plainRows, render, root } from "../host-fixtures.js";

await test("every payload at every width draws the rows the fixture records", () => {
  for (const name of payloads()) {
    for (const width of WIDTHS) {
      const expected = readFileSync(path.join(fixturesDir, "expected", `${name}.${width}.txt`), "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
      assert.equal(plainRows(name, width).join("\n"), expected, `${name} at ${width} columns`);
    }
  }
});

await test("each payload has an expected file per width, and no expected file is orphaned", () => {
  const want = new Set(payloads().flatMap((n) => WIDTHS.map((w) => `${n}.${w}.txt`)));
  const have = new Set(readdirSync(path.join(fixturesDir, "expected")));
  assert.deepEqual([...have].sort(), [...want].sort());
});

await test("a row never overflows its width, and no row names this machine", () => {
  for (const name of payloads()) {
    for (const width of WIDTHS) {
      const doc = render(name, width);
      assert.equal(doc.contract, 1);
      for (const row of doc.lines.map((l) => l.map((r) => r.text).join(""))) {
        assert.ok(displayWidth(row) <= width, `${name} at ${width}: ${displayWidth(row)} columns`);
      }
    }
  }
  const text = readdirSync(path.join(fixturesDir, "expected")).map((f) => readFileSync(path.join(fixturesDir, "expected", f), "utf8")).join("\n");
  assert.ok(!text.includes(root), "the repository path is not in a fixture");
  assert.ok(!/\/Users\/|\/home\/|[A-Za-z]:\\/.test(text), "no home directory is in a fixture");
});

await test("the payloads need no repository, transcript or clock", () => {
  for (const name of payloads()) {
    const p = JSON.parse(readFileSync(path.join(fixturesDir, "payloads", `${name}.json`), "utf8"));
    assert.equal(p.transcript_path, undefined, name);
    assert.ok(p.cwd.startsWith("/fixtures/"), name);
    for (const w of Object.values(p.rate_limits ?? {})) assert.equal(w.resets_at, undefined, `${name}: a reset depends on the clock`);
  }
});
