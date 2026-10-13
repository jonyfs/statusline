// Preloaded into a render (`node --import`) to log every child process it
// starts and every file it opens for writing, as JSON lines in the file named
// by PASSIVE_RECORD_FILE (specs/057-passive-mode).
import cp from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const out = process.env.PASSIVE_RECORD_FILE;
const log = (entry) => {
  try {
    fs.appendFileSync(out, JSON.stringify(entry) + "\n");
  } catch {
    // the recorder never breaks a render
  }
};
const real = { ...fs };

for (const name of ["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync", "fork"]) {
  const original = cp[name];
  cp[name] = function (...args) {
    const file = typeof args[0] === "string" ? args[0] : "";
    const rest = Array.isArray(args[1]) ? args[1] : [];
    log({ kind: "child", via: name, file, args: rest.map(String) });
    return original.apply(this, args);
  };
}

const writeFlag = (flags) => typeof flags === "string" && /[wa+]/.test(flags);
const wrapPath = (name, pick) => {
  const original = fs[name];
  fs[name] = function (...args) {
    const target = pick(args);
    if (target !== undefined && String(target) !== out && !String(target).startsWith("/dev/")) {
      log({ kind: "write", via: name, path: String(target) });
    }
    return original.apply(this, args);
  };
};
for (const name of ["writeFileSync", "appendFileSync", "mkdirSync", "unlinkSync", "rmSync", "rmdirSync", "truncateSync", "utimesSync"]) {
  wrapPath(name, (a) => a[0]);
}
wrapPath("renameSync", (a) => a[1]);
wrapPath("copyFileSync", (a) => a[1]);
wrapPath("createWriteStream", (a) => a[0]);
{
  const original = fs.openSync;
  fs.openSync = function (file, flags, ...rest) {
    if (writeFlag(flags) && String(file) !== out && !String(file).startsWith("/dev/")) {
      log({ kind: "write", via: "openSync", path: String(file) });
    }
    return original.call(this, file, flags, ...rest);
  };
}
void real;
syncBuiltinESMExports();
