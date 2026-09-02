import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "../test-harness.js";
import { ANIMATIONS, animation, animationFor, frameFor, frameWidth } from "../animation-candidates.js";
import { displayWidth } from "../../src/theme.js";

const outlines = JSON.parse(
  readFileSync(new URL("../../src/preview/glyphs.json", import.meta.url), "utf8")
).glyphs;

await test("every candidate has matching nerd and plain sequences", () => {
  assert.ok(ANIMATIONS.length > 0, "there is something to choose from");
  for (const a of ANIMATIONS) {
    assert.equal(
      a.nerd.length,
      a.plain.length,
      `${a.key}: a substitute that runs out of frames stops mid-animation`
    );
    assert.ok(a.nerd.length >= 2, `${a.key}: one frame is not a sequence`);
    assert.ok(a.segments.length > 0, `${a.key}: a candidate nobody could use`);
    assert.ok(a.label && a.describes, `${a.key}: the preview page needs both`);
  }
});

// The failure this catches is the one that would be least obvious and most
// annoying: every segment after the animated one sliding a column back and
// forth once every five seconds.
await test("every frame of a candidate is the same width", () => {
  for (const a of ANIMATIONS) {
    assert.ok(
      frameWidth(a.nerd) !== null,
      `${a.key}: nerd frames measure ${a.nerd.map(displayWidth).join(", ")} columns`
    );
    assert.ok(
      frameWidth(a.plain) !== null,
      `${a.key}: plain frames measure ${a.plain.map(displayWidth).join(", ")} columns`
    );
  }
});

// A private-use glyph missing from the extractor renders in the terminal and
// shows a box anywhere the outlines are what gets drawn, which includes the
// preview page. Frames outside the private-use planes need no outline: they
// are ordinary Unicode and the page draws them as text, which is why the
// Braille spinner works for a reader with no Nerd Font at all.
const isPrivateUse = (cp) =>
  (cp >= 0xe000 && cp <= 0xf8ff) ||
  (cp >= 0xf0000 && cp <= 0xffffd) ||
  (cp >= 0x100000 && cp <= 0x10fffd);

await test("every private-use frame has an extracted outline", () => {
  for (const a of ANIMATIONS) {
    for (const frame of a.nerd) {
      const cp = frame.codePointAt(0);
      if (!isPrivateUse(cp)) continue;
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      assert.ok(
        outlines[hex],
        `${a.key}: U+${hex} is not in src/preview/glyphs.json. Add it to ` +
          "scripts/extract-glyphs.py and regenerate."
      );
    }
  }
});

// A statusline that threw because a frame index was out of range would have
// traded the whole bar for a decoration.
await test("frameFor is total: nothing makes it throw, everything returns a string", () => {
  const settled = "X";
  const frames = [null, undefined, NaN, -1, -0.5, 0, 1, 2, 3, 99, Infinity];
  for (const key of ["branch", "pr", "skills", "model", "context", "nonsense", "", null]) {
    for (const frame of frames) {
      for (const ascii of [true, false]) {
        const out = frameFor(key, frame, { ascii, settled });
        assert.equal(typeof out, "string", `${key} / ${frame} / ascii=${ascii}`);
      }
    }
  }
  assert.equal(frameFor("branch", 0), "", "no settled value given is an empty string, not a throw");
});

await test("a segment with no chosen candidate renders settled", () => {
  // Until the owner has chosen from the preview page, CHOSEN is empty and
  // nothing animates. That is what lets User Story 1 ship with the bar
  // unchanged.
  const settled = "\u{F418}";
  for (const key of ["branch", "pr", "skills", "model"]) {
    if (animationFor(key)) continue;
    assert.equal(frameFor(key, 2, { settled }), settled);
  }
});

await test("past the last frame the sequence holds rather than looping", () => {
  for (const a of ANIMATIONS) {
    for (const segment of a.segments) {
      if (animationFor(segment)?.key !== a.key) continue;
      const last = a.nerd[a.nerd.length - 1];
      assert.equal(frameFor(segment, a.nerd.length, { settled: "X" }), last);
      assert.equal(frameFor(segment, a.nerd.length + 40, { settled: "X" }), last);
    }
  }
});

await test("a candidate can be looked up by key, and an unknown key is undefined", () => {
  for (const a of ANIMATIONS) assert.equal(animation(a.key), a);
  assert.equal(animation("no-such-candidate"), undefined);
});
