import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { ANIMATIONS } from "../animation-candidates.js";

const BOARD = new URL("../../specs/003-status-change-animations/animation-board.html", import.meta.url);

await test("the board regenerates, and covers every candidate", () => {
  execFileSync(process.execPath, [new URL("../generate-animation-board.js", import.meta.url).pathname]);
  const html = readFileSync(BOARD, "utf8");
  for (const a of ANIMATIONS) {
    assert.ok(html.includes(`id="c-${a.key}"`), `${a.key} has no section on the board`);
    assert.ok(html.includes(a.label), `${a.key}'s label is missing`);
    assert.ok(html.includes(a.describes), `${a.key}'s description is missing`);
  }
});

// FR-007: the page opens in a browser with nothing installed and no server. A
// single stylesheet link or script src would quietly break that for a reader
// offline, which is the reader most likely to be looking at a terminal.
await test("the board reaches for nothing outside itself", () => {
  const html = readFileSync(BOARD, "utf8");
  assert.doesNotMatch(html, /https?:\/\//, "the board must not reference a URL");
  assert.doesNotMatch(html, /<script[^>]+src=/i, "no external script");
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i, "no external stylesheet");
  assert.doesNotMatch(html, /@import/, "no imported stylesheet");
});

await test("both intervals are offered, and both are stated", () => {
  const html = readFileSync(BOARD, "utf8");
  assert.match(html, /Busy · 5\.5s/, "the busy interval is selectable");
  assert.match(html, /Idle · 60s/, "the idle interval is selectable");
  assert.match(html, /about 5 frames/, "the busy budget is stated on screen");
});
