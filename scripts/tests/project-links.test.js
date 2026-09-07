/**
 * A link on the bar belongs to the project the bar is rendered in.
 *
 * Feature 019 gave every segment a link to the plugin's own repository,
 * because that is where the documentation lives. In a session on another
 * project, five of the eight targets then pointed at a repository that was not
 * the one being worked on, and there is no way for a reader hovering a segment
 * to tell "the tool's manual" from "the wrong repository". Reported as a bug
 * within a day, and it was one (specs/020-links-that-belong-here).
 *
 * A segment that describes the repository links into it. A segment that
 * describes the session, the model or a limit has nothing in the project to
 * point at, and gets no link rather than a link somewhere else.
 */
import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");
const WIDE = { maxWidth: 400, maxHeight: 40 };

const OWN_REPO = "https://github.com/jonyfs/statusline";
const THEIRS = "https://github.com/someone/their-project";

const draw = (over = {}) =>
  renderPayload(
    fullPayload({
      cwd: "/tmp/their-project",
      workspace: {
        current_dir: "/tmp/their-project",
        repo: { host: "github.com", owner: "someone", name: "their-project" },
      },
      context_window: { used_percentage: 62 },
      ...over,
    }),
    {
      sources: {
        ...gitSources({ branch: "feature/theirs" }),
        getRemoteUrl: () => THEIRS,
        getPrInfo: () => ({ number: 7, state: "OPEN", isDraft: false, url: `${THEIRS}/pull/7` }),
        getCiStatus: () => ({ status: "completed", conclusion: "success", workflow: "CI" }),
        getActiveSkills: () => ["humanizer"],
        getActiveSkillsTrueCount: () => 1,
        getSessionActivity: () => ({ skills: ["humanizer"], todos: null, working: true }),
        getRtkSavings: () => 81,
        getDirUrl: () => "file:///tmp/their-project",
      },
      trackChanges: false,
      now: NOW,
      ...WIDE,
    }
  );

const targets = (out) => [...new Set([...out.matchAll(/\x1b\]8;;([^\x07]+)\x07/g)].map((m) => m[1]).filter(Boolean))];

// The regression guard for what was reported. Nothing on a bar rendered in
// someone else's project may point at this plugin's repository.
await test("no link points at the plugin's own repository", () => {
  for (const url of targets(draw())) {
    assert.ok(!url.startsWith(OWN_REPO), `${url} points at the tool rather than at the project`);
  }
});

await test("every link belongs to the project the bar is rendered in", () => {
  const found = targets(draw());
  assert.ok(found.length > 0, "the bar renders links at all");
  for (const url of found) {
    const belongs = url.startsWith(THEIRS) || url.startsWith("file:///tmp/their-project");
    assert.ok(belongs, `${url} is neither this project's repository nor its directory`);
  }
});

// Scoping the link the same way the segment scopes its answer: a click from a
// branch you never pushed must not land on main's green tick.
await test("the CI link is scoped to the branch the segment answered about", () => {
  const runs = targets(draw()).find((u) => u.includes("/actions"));
  assert.ok(runs, "the CI segment carries a link");
  assert.match(runs, /branch%3Afeature%2Ftheirs/, "the branch travels with the link");
});

await test("the repository segment opens the repository", () => {
  assert.ok(targets(draw()).includes(THEIRS), "someone/their-project is reachable from its own name");
});

// A segment with nothing in the project to point at gets no link rather than
// one pointing elsewhere.
await test("a session segment carries no link", () => {
  const out = draw();
  // The context figure sits between two escape-free runs; if it had a link,
  // one of the targets would not belong to the project, which the case above
  // already forbids. This pins the intent directly.
  const contextRun = out.slice(out.indexOf("Context"));
  assert.ok(!contextRun.slice(0, 40).includes("\x1b]8;;"), "the context figure is not a link");
});
