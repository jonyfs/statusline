import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "../test-harness.js";

// The whole suite runs in a throwaway HOME. Each case used to have to
// remember `withHome`, and forgetting it twice cost real state: fixtures
// written into ~/.claude/statusline/tasks (cd4bacb), and a render test that
// read the machine's own sample history and failed whenever that history held
// a burn rate, because `%/h` contains the slash it was asserting against.

await test("the suite runs in a throwaway HOME, not the developer's own", () => {
  const home = os.homedir();
  const tmp = path.resolve(os.tmpdir());
  assert.ok(path.resolve(home).startsWith(tmp), `HOME is ${home}, outside ${tmp}`);
  assert.equal(process.env.HOME, home);
});
