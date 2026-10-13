import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { GLYPHS, renderPayload, renderReadings, gather } from "../../src/render.js";
import { renderTaskRow } from "../../src/taskRows.js";
import { displayWidth } from "../../src/theme.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";
import { PAYLOAD, SOURCES, FIXED_NOW, RENDER_OPTIONS } from "../composer-fixture.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const strip = (s) => s.replace(/\x1b\[[0-9;:]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");
const G = GLYPHS.nerd;

const withEnv = (vars, fn) => {
  const before = {};
  for (const k of Object.keys(vars)) {
    before[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
};

const ciBar = (ci) =>
  strip(
    renderPayload(fullPayload(), {
      sources: { ...gitSources(), getCiStatus: () => ci },
      trackChanges: false,
      now: NOW,
      maxWidth: 600,
      maxHeight: 40,
    })
  );

await test("a skipped or cancelled run draws its own mark, not the failure", () => {
  for (const conclusion of ["skipped", "cancelled"]) {
    const out = ciBar({ conclusion, status: "completed", workflow: "CI" });
    assert.ok(out.includes(`${G.ciSkipped} CI`), `${conclusion} draws the skipped mark`);
    assert.ok(!out.includes(`${G.ciFail} CI`), `${conclusion} is not drawn as a failure`);
  }
  assert.ok(ciBar({ conclusion: "failure", status: "completed", workflow: "CI" }).includes(`${G.ciFail} CI`));
});

await test("the skipped mark has a key in every tier", () => {
  for (const tier of ["nerd", "emoji", "plain"]) assert.ok(GLYPHS[tier].ciSkipped, tier);
});

await test("a long directory name steps from the whole name to a cut tail to the icon alone", () => {
  const at = (w) =>
    strip(
      renderPayload(fullPayload({ cwd: "/tmp/projects/a-very-long-directory-name-for-the-test" }), {
        sources: gitSources(),
        trackChanges: false,
        maxWidth: w,
        maxHeight: 40,
      })
    ).split("\n")[0];
  assert.ok(at(60).includes("a-very-long-directory-name-for-the-test"), "whole at 60");
  const cut = at(40);
  assert.ok(cut.includes("…/") && !cut.includes("a-very-long"), `a cut tail at 40: ${cut}`);
  const icon = at(22);
  assert.ok(!icon.includes("…/") && !icon.includes("the-test"), `the icon alone at 22: ${icon}`);
  assert.ok(icon.includes(G.dir), "and the icon is there");
});

await test("dir, branch, skills and effort end in an icon-only form; the model does not", () => {
  const now = FIXED_NOW * 1000;
  const pool = renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, {
    ...RENDER_OPTIONS,
    maxWidth: 360,
    maxHeight: 40,
    asPool: true,
  });
  for (const key of ["dir", "branch", "skills", "effort"]) {
    const seg = pool.find((s) => s.key === key);
    assert.ok(seg, `${key} is in the pool`);
    const last = strip(seg.variants?.[seg.variants.length - 1] ?? "").trim();
    assert.equal([...last].length, 1, `${key} ends in one glyph, not "${last}"`);
  }
  const model = pool.find((s) => s.key === "model");
  const lastModel = strip(model.variants?.[model.variants.length - 1] ?? model.text).trim();
  assert.ok([...lastModel].length > 1, "the model keeps its name");
});

const agentRow = (env) =>
  withEnv(env, () => strip(renderTaskRow({ id: "t1", name: "explore", type: "agent", startTime: NOW - 60_000, model: "claude-haiku-4-5", contextWindowSize: 200000, tokenCount: 190000 }, { columns: 100, now: NOW }).content));

await test("a hot agent row carries the alert glyph in the Nerd tier and ! in the plain ones", () => {
  const base = { CLAUDE_STATUSLINE_ICONS: undefined, CLAUDE_STATUSLINE_ASCII: undefined };
  assert.ok(agentRow(base).includes("\u{F40C}"), "nerd draws F40C");
  assert.ok(agentRow({ ...base, CLAUDE_STATUSLINE_ICONS: "plain" }).includes("!"), "plain draws !");
  assert.ok(!agentRow({ ...base, CLAUDE_STATUSLINE_ICONS: "plain" }).includes("\u{F40C}"));
  assert.ok(agentRow({ ...base, CLAUDE_STATUSLINE_ASCII: "1" }).includes("!"), "ASCII draws !");
  assert.ok(!agentRow({ ...base, CLAUDE_STATUSLINE_ASCII: "1" }).includes("\u{F40C}"));
});

await test("the cut marker of a directory name is drawn in its own colour", () => {
  const raw = renderPayload(fullPayload({ cwd: "/tmp/projects/a-very-long-directory-name-for-the-test" }), {
    sources: gitSources(),
    trackChanges: false,
    maxWidth: 40,
    maxHeight: 40,
  });
  assert.match(raw, /…\/\x1b\[[0-9;:]*m/, "an escape sits between the cut mark and the name");
});

await test("every glyph feature 054 changed is one column, with and without Ambiguous wide", async () => {
  const { displayWidth } = await import("../../src/theme.js");
  const keys = ["ciPass", "ciFail", "ciSkipped", "gateRunning", "updateReady", "updateBlocked", "todo", "context", "model"];
  for (const wide of [undefined, "1"]) {
    withEnv({ CLAUDE_STATUSLINE_AMBIGUOUS_WIDE: wide }, () => {
      for (const key of keys) {
        for (const tier of ["nerd", "plain"]) {
          assert.equal(displayWidth(GLYPHS[tier][key]), 1, `${tier}.${key} wide=${wide}`);
        }
      }
    });
  }
});

await test("the context chip names itself by its icon, with no word (E41)", () => {
  const now = FIXED_NOW * 1000;
  const pool = renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, {
    ...RENDER_OPTIONS,
    maxWidth: 360,
    maxHeight: 40,
    asPool: true,
  });
  const context = pool.find((s) => s.key === "context");
  assert.ok(context.text.includes(G.context));
  assert.ok(!/context/.test(context.text), `no word in the long form: ${context.text}`);
});

await test("a warm cache icon is peach (B14)", () => {
  const SEC = Math.floor(NOW / 1000);
  const payload = fullPayload({
    now: NOW,
    prompt_cache: { warm: true, caching_observed: true, ttl: "5m", expires_at: SEC + 110, requests: 12, misses: 0, hit_ratio: 0.91 },
  });
  const pool = renderReadings(gather(payload, gitSources(), { now: NOW }), payload, { ...RENDER_OPTIONS, now: NOW, maxWidth: 600, maxHeight: 40, asPool: true });
  const cache = pool.find((s) => s.key === "promptCache");
  assert.ok(cache, "the closing window draws the chip");
  assert.equal(cache.icon, "peach");
});

await test("the tree counts keep their own colours: modified, added, behind (section 5.2)", () => {
  const raw = renderPayload(fullPayload(), {
    sources: gitSources({ changed: 3, staged: 2, behind: 4 }),
    trackChanges: false,
    now: NOW,
    maxWidth: 600,
    maxHeight: 40,
  });
  const seq = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
  assert.ok(raw.includes(`${seq(249, 226, 175)}${G.modified}`), "modified in yellow");
  assert.ok(raw.includes(`${seq(166, 227, 161)}${G.added}`), "added in green");
  assert.ok(raw.includes(`${seq(116, 199, 236)}${G.pull}`), "behind in sapphire");
});

await test("a blocked update draws its own glyph, not the waiting one", () => {
  for (const tier of ["nerd", "emoji", "plain"]) assert.ok(GLYPHS[tier].updateBlocked, tier);
  assert.notEqual(GLYPHS.nerd.updateBlocked, GLYPHS.nerd.updateReady);
});

await test("the pill's trailing column is counted: no line is wider than the window", () => {
  const now = FIXED_NOW * 1000;
  withEnv({ CLAUDE_STATUSLINE_SEPARATOR: "round" }, () => {
    for (const width of [60, 80, 120, 200]) {
      const out = strip(
        renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, { ...RENDER_OPTIONS, maxWidth: width, maxHeight: 40, trailingRows: false })
      );
      for (const line of out.split("\n")) assert.ok(displayWidth(line) <= width, `${width}: ${displayWidth(line)} columns in "${line.slice(0, 40)}"`);
    }
  });
});

await test("the bar draws the glyph of the update's state on line 1", () => {
  const draw = (state) =>
    strip(
      renderPayload(fullPayload({ now: NOW }), {
        sources: { ...gitSources(), getUpdateNotice: () => ({ state, text: `update ${state}` }) },
        trackChanges: false,
        now: NOW,
        maxWidth: 600,
        maxHeight: 40,
      })
    ).split("\n")[0];
  assert.ok(draw("ready").includes(G.updateReady));
  assert.ok(draw("blocked").includes(G.updateBlocked));
  assert.ok(!draw("blocked").includes(G.updateReady));
});

await test("every update state has its own mark in the Nerd and emoji tiers, and blocked differs from waiting in all three", () => {
  const draw = (state, opts = {}) =>
    strip(
      renderPayload(fullPayload({ now: NOW }), {
        sources: { ...gitSources(), getUpdateNotice: () => ({ state, text: `update ${state}` }) },
        trackChanges: false,
        now: NOW,
        maxWidth: 600,
        maxHeight: 40,
        ...opts,
      })
    ).split("\n")[0];
  assert.ok(draw("failed").includes(G.updateBlocked), "failed is the download mark");
  assert.ok(!draw("failed").includes(G.updateReady), "and never the new box");
  for (const tier of ["nerd", "emoji", "plain"]) {
    assert.notEqual(GLYPHS[tier].updateBlocked, GLYPHS[tier].updateReady, tier);
  }
  assert.ok(draw("blocked", { asciiArrows: true }).includes(GLYPHS.plain.updateBlocked));
});

await test("the skills chip gives up its words before line 2 overflows", () => {
  const now = FIXED_NOW * 1000;
  for (const width of [40, 30, 24]) {
    const out = strip(
      renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, { ...RENDER_OPTIONS, maxWidth: width, maxHeight: 40, trailingRows: false })
    );
    for (const line of out.split("\n")) assert.ok(displayWidth(line) <= width, `${width}: "${line}" is ${displayWidth(line)}`);
  }
});

await test("one essential going to its icon does not take the other names with it", () => {
  const now = FIXED_NOW * 1000;
  const out = strip(
    renderReadings(gather(PAYLOAD, { ...SOURCES }, { now }), PAYLOAD, { ...RENDER_OPTIONS, maxWidth: 40, maxHeight: 40, trailingRows: false })
  );
  const first = out.split("\n")[0];
  assert.ok(/[A-Za-z]{4}/.test(first), `line 1 keeps a name at 40 columns: "${first}"`);
});

await test("an agent row follows the caller's ASCII choice, not only the settings", () => {
  const task = { id: "t1", name: "explore", type: "agent", startTime: NOW - 60_000, model: "claude-haiku-4-5", contextWindowSize: 200000, tokenCount: 190000 };
  const row = (asciiArrows) =>
    withEnv({ CLAUDE_STATUSLINE_ICONS: undefined, CLAUDE_STATUSLINE_ASCII: undefined }, () =>
      strip(renderTaskRow(task, { columns: 100, now: NOW, asciiArrows }).content)
    );
  assert.ok(row(true).includes("!") && !row(true).includes("\u{F40C}"));
  assert.ok(row(false).includes("\u{F40C}"));
});

await test("a skipped run is in the chip's text colour; the cut marker is the quiet colour", () => {
  const raw = renderPayload(fullPayload(), {
    sources: { ...gitSources(), getCiStatus: () => ({ conclusion: "skipped", status: "completed", workflow: "CI" }) },
    trackChanges: false,
    now: NOW,
    maxWidth: 600,
    maxHeight: 40,
  });
  const at = raw.indexOf(G.ciSkipped);
  assert.ok(at > 0);
  const before = raw.slice(Math.max(0, at - 24), at);
  assert.ok(!/38;2;243;139;168m$/.test(before), "not the failure red");
  const cut = renderPayload(fullPayload({ cwd: "/tmp/projects/a-very-long-directory-name-for-the-test" }), {
    sources: gitSources(),
    trackChanges: false,
    maxWidth: 40,
    maxHeight: 40,
  });
  const i = cut.indexOf("…/");
  const quietBefore = cut.slice(i - 24, i);
  const afterEnd = cut.slice(i + 2, i + 30);
  assert.match(quietBefore, /38;2;\d+;\d+;\d+m$/, "the marker has its own colour");
  assert.match(afterEnd, /^\x1b\[22m\x1b\[38;2;/, "and the name returns to the chip colour");
});

await test("the working-tree colours hold in another flavor", () => {
  const raw = withEnv({ CLAUDE_STATUSLINE_FLAVOR: "latte" }, () =>
    renderPayload(fullPayload(), {
      sources: gitSources({ changed: 3, staged: 2, behind: 4 }),
      trackChanges: false,
      now: NOW,
      maxWidth: 600,
      maxHeight: 40,
      flavor: "latte",
    })
  );
  assert.match(raw, new RegExp(`38;2;\\d+;\\d+;\\d+m${G.modified}`, "u"));
  assert.match(raw, new RegExp(`38;2;\\d+;\\d+;\\d+m${G.pull}`, "u"));
});
