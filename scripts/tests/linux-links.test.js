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
import { isRemoteSession, linkGesture, linkStatus, parseTmuxVersion, tmuxLinks } from "../../src/linkEnv.js";
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

await test("isRemoteSession reads the three SSH variables, and leaves VS Code Remote-SSH alone", () => {
  assert.equal(isRemoteSession({}), false);
  assert.equal(isRemoteSession({ TMUX: "/tmp/tmux-1000/default,1,0" }), false);
  assert.equal(isRemoteSession({ SSH_TTY: "/dev/pts/3" }), true);
  // VS Code opens file:// against the remote workspace, so the link works there.
  assert.equal(isRemoteSession({ SSH_CONNECTION: "a b c d", TERM_PROGRAM: "vscode" }), false);
});

await test("a generator passes remote: false and gets the folder links whatever machine it runs on", () => {
  const out = withEnv({ SSH_CONNECTION: "a b c d" }, () =>
    renderPayload(fullPayload({ cwd: "/home/ana/p", workspace: { current_dir: "/home/ana/p" } }), {
      remote: false,
      sources: { ...gitSources({ branch: "main" }), getDirUrl: () => "file:///home/ana/p" },
      trackChanges: false,
      now: NOW,
      maxWidth: 400,
      maxHeight: 40,
    })
  );
  assert.ok(targets(out).includes("file:///home/ana/p"));
});

await test("the gesture: Ctrl+click on VTE and Windows Terminal, Cmd+click on iTerm2, null when unknown", () => {
  assert.equal(linkGesture({ VTE_VERSION: "7600" }, "linux"), "Ctrl+click");
  assert.equal(linkGesture({ WT_SESSION: "x" }, "win32"), "Ctrl+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "iTerm.app" }, "darwin"), "Cmd+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "ghostty" }, "linux"), "Ctrl+click");
  assert.equal(linkGesture({ TERM_PROGRAM: "ghostty" }, "darwin"), "Cmd+click");
  assert.equal(linkGesture({}, "linux"), null);
});

await test("over SSH or inside tmux the terminal is not named: the variables describe the far side", () => {
  // What a real GNOME Terminal -> ssh -> tmux shell has: no VTE_VERSION, tmux's own TERM.
  const real = { TERM: "tmux-256color", TERM_PROGRAM: "tmux", TMUX: "/tmp/tmux-1000/default,1,0", SSH_CONNECTION: "a b c d" };
  assert.equal(linkGesture(real, "linux"), null);
  // A local tmux inherits VTE_VERSION from where it was started, which may not be this terminal.
  assert.equal(linkGesture({ VTE_VERSION: "7600", TMUX: "x" }, "linux"), null);
  assert.equal(linkGesture({ TERM_PROGRAM: "vscode", SSH_CONNECTION: "a b c d" }, "linux"), "Ctrl+click");
});

await test("tmux -V: major and minor as integers; a build with no number is unknown", () => {
  assert.deepEqual(parseTmuxVersion("tmux 3.4\n"), [3, 4]);
  assert.deepEqual(parseTmuxVersion("tmux 3.10a\n"), [3, 10]);
  assert.equal(parseTmuxVersion("tmux openbsd-7.4\n"), null);
  assert.equal(parseTmuxVersion("tmux next-3.6\n"), null);
  assert.equal(parseTmuxVersion(null), null);
});

await test("tmux: the attached client's features decide; the option list counts only a *:hyperlinks entry", () => {
  assert.equal(tmuxLinks({}), null);
  const run = (client, options) => (args) => (args[0] === "-V" ? "tmux 3.5\n" : args[0] === "display-message" ? client : options);
  // iTerm2 detected by tmux: hyperlinks on with nothing in tmux.conf.
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run("256,RGB,clipboard,hyperlinks,title\n", "xterm*:clipboard\n") }), { version: [3, 5], enabled: true });
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run("256,RGB,clipboard,title\n", "*:hyperlinks\n") }), { version: [3, 5], enabled: false });
  // No client answer: only a pattern for every terminal says anything.
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run("", "screen*:hyperlinks\n") }), { version: [3, 5], enabled: null });
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: run(null, "xterm*:clipboard\n*:hyperlinks\n") }), { version: [3, 5], enabled: true });
  assert.deepEqual(tmuxLinks({ TMUX: "x" }, { run: () => null }), { version: null, enabled: null });
});

await test("the reported setup (GNOME Terminal, ssh, tmux without hyperlinks) gets every line, in order", () => {
  const env = { TERM: "tmux-256color", TERM_PROGRAM: "tmux", TMUX: "x", SSH_CONNECTION: "a b c d" };
  const lines = linkStatus(env, { platform: "linux", tmux: { version: [3, 4], enabled: false } });
  const at = (re) => lines.findIndex((l) => re.test(l));
  assert.equal(at(/Ctrl\+click in GNOME Terminal/), 0, lines.join("\n"));
  assert.ok(at(/hyperlinks feature is off.*terminal-features/) > 0, lines.join("\n"));
  assert.ok(at(/over SSH/) > at(/hyperlinks feature is off/), lines.join("\n"));
  assert.ok(at(/keeps the SSH variables/) > at(/over SSH/), lines.join("\n"));
  assert.match(lines.at(-1), /printf .*Claude Code is not passing links through/);
});

await test("an old tmux is named with the version it needs; 3.10 is not older than 3.4; no SSH line locally", () => {
  const old = linkStatus({ TMUX: "x" }, { platform: "linux", tmux: { version: [3, 2], enabled: false } });
  assert.ok(old.some((l) => /tmux 3\.2 drops them; tmux 3\.4 or newer/.test(l)), old.join("\n"));
  const ten = linkStatus({ TMUX: "x" }, { platform: "linux", tmux: { version: [3, 10], enabled: true } });
  assert.ok(ten.some((l) => /tmux passes them on/.test(l)), ten.join("\n"));
  assert.ok(!ten.some((l) => /SSH/.test(l)));
  const none = linkStatus({}, { platform: "linux", tmux: null });
  assert.ok(!none.some((l) => /tmux/.test(l)));
  assert.match(none[0], /terminal's link gesture/);
  assert.equal(linkStatus({ VTE_VERSION: "7600" }, { platform: "linux", tmux: null })[0], "links: open with Ctrl+click in this terminal");
});
