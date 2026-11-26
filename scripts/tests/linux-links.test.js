/**
 * Links that open on Linux as they do on macOS and Windows
 * (specs/080-linux-link-opening).
 *
 * The report: on Ubuntu, in GNOME Terminal, inside tmux, over SSH, a plain
 * click opened none of the bar's links. The bar's bytes were already right
 * and platform-neutral; what stood in the way was the gesture, tmux and the
 * remote session. These cases pin the bytes on each platform, the folder link
 * leaving over SSH, and the doctor's lines for each condition.
 */
import assert from "node:assert/strict";
import { test } from "../test-harness.js";
import { renderPayload } from "../../src/render.js";
import { pathToFileUrl } from "../../src/openTerminalTab.js";
import { isRemoteSession, linkGesture, linkStatus, tmuxLinks } from "../../src/linkEnv.js";
import { gitSources, fullPayload } from "./fixtures/sources.js";

const NOW = Date.parse("2026-11-26T12:00:00.000Z");
const REPO = "https://github.com/someone/their-project";

const draw = (over = {}) =>
  renderPayload(
    fullPayload({
      cwd: "/home/ana/their project",
      workspace: { current_dir: "/home/ana/their project", project_dir: "/home/ana/app" },
      ...over,
    }),
    {
      sources: {
        ...gitSources({ branch: "main" }),
        getRemoteUrl: () => REPO,
        getDirUrl: () => pathToFileUrl("/home/ana/their project"),
      },
      trackChanges: false,
      now: NOW,
      maxWidth: 400,
      maxHeight: 40,
    }
  );

const targets = (out) => [...new Set([...out.matchAll(/\x1b\]8;;([^\x07]+)\x07/g)].map((m) => m[1]))];

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

await test("a link is written the same way on every platform: OSC 8, BEL-terminated, no URL in the text", () => {
  const out = withEnv({ VTE_VERSION: "7600", TERM: "xterm-256color" }, () => draw());
  assert.match(out, /\x1b\]8;;https:\/\/github\.com\/someone\/their-project\/tree\/main\x07/);
  assert.ok(!/\x1b\]8;;[^\x07]*\x1b\\/.test(out), "no ST-terminated link mixed in");
});

await test("folder URLs: a Linux path, a Windows drive path, and a path with a space and a #", () => {
  assert.equal(pathToFileUrl("/home/ana/proj"), "file:///home/ana/proj");
  assert.equal(pathToFileUrl("C:\\Users\\Ana Lima\\proj"), "file:///C:/Users/Ana%20Lima/proj");
  assert.equal(pathToFileUrl("/home/ana/a #1?"), "file:///home/ana/a%20%231%3f");
});

await test("outside SSH the directory and project-directory chips link to their folders", () => {
  const found = targets(draw());
  assert.ok(found.includes("file:///home/ana/their%20project"), found.join(" "));
  assert.ok(found.includes("file:///home/ana/app"), found.join(" "));
});

for (const name of ["SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY"]) {
  await test(`over SSH (${name}) no folder link is drawn, the web links stay, and the text does not move`, () => {
    const local = draw();
    const remote = withEnv({ [name]: "10.0.0.2 51000 10.0.0.9 22" }, () => draw());
    const found = targets(remote);
    assert.ok(!found.some((u) => u.startsWith("file://")), found.join(" "));
    assert.ok(found.some((u) => u.startsWith(REPO)), "the repository link stays");
    const visible = (s) => s.replace(/\x1b\]8;;[^\x07]*\x07/g, "");
    assert.equal(visible(remote), visible(local));
  });
}

await test("isRemoteSession reads the three SSH variables and nothing else", () => {
  assert.equal(isRemoteSession({}), false);
  assert.equal(isRemoteSession({ TMUX: "/tmp/tmux-1000/default,1,0" }), false);
  assert.equal(isRemoteSession({ SSH_TTY: "/dev/pts/3" }), true);
});

await test("the gesture: Ctrl+click on VTE and Windows Terminal, Cmd+click on iTerm2, null when unknown", () => {
  assert.equal(linkGesture({ VTE_VERSION: "7600" }, "linux"), "Ctrl+click");
  assert.equal(linkGesture({ WT_SESSION: "x" }, "win32"), "Ctrl+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "iTerm.app" }, "darwin"), "Cmd+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "ghostty" }, "linux"), "Ctrl+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "ghostty" }, "darwin"), "Cmd+click");
  assert.equal(linkGesture({}, "linux"), null);
});

await test("tmux: version and the hyperlinks feature come from tmux itself; null outside tmux", () => {
  assert.equal(tmuxLinks({}), null);
  const run = (feat) => (args) => (args[0] === "-V" ? "tmux 3.4\n" : feat);
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run("xterm*:clipboard:ccolour\n") }), { version: 3.4, enabled: false });
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run("xterm*:clipboard\n*:hyperlinks\n") }), { version: 3.4, enabled: true });
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: () => null }), { version: null, enabled: null });
});

await test("the reported setup (GNOME Terminal, tmux without hyperlinks, SSH) gets all three lines, in order", () => {
  const env = { VTE_VERSION: "7600", TMUX: "x", SSH_CONNECTION: "a b c d" };
  const lines = linkStatus(env, { platform: "linux", tmux: { version: 3.4, enabled: false } });
  const at = (re) => lines.findIndex((l) => re.test(l));
  assert.ok(at(/Ctrl\+click/) === 0, lines.join("\n"));
  assert.ok(at(/hyperlinks feature is off.*terminal-features/) > 0, lines.join("\n"));
  assert.ok(at(/over SSH/) > at(/hyperlinks feature is off/), lines.join("\n"));
  assert.match(lines.at(-1), /printf .*Claude Code is not passing links through/);
});

await test("an old tmux is named with the version it needs; a working one says so; no SSH line locally", () => {
  const old = linkStatus({ TMUX: "x" }, { platform: "linux", tmux: { version: 3.2, enabled: false } });
  assert.ok(old.some((l) => /tmux 3\.2 drops them; tmux 3\.4 or newer/.test(l)), old.join("\n"));
  const ok = linkStatus({ TMUX: "x" }, { platform: "linux", tmux: { version: 3.5, enabled: true } });
  assert.ok(ok.some((l) => /tmux passes them on/.test(l)));
  assert.ok(!ok.some((l) => /SSH/.test(l)));
  const none = linkStatus({}, { platform: "linux", tmux: null });
  assert.ok(!none.some((l) => /tmux/.test(l)));
  assert.match(none[0], /terminal's link gesture/);
});
