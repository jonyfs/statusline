/**
 * The runner behind `npm test`.
 *
 * Test files import `test` from here and await each case at module top
 * level. Awaiting matters: the previous harness called the test function
 * without awaiting it, so an async case that threw counted as a pass and
 * surfaced only as an unhandled rejection warning.
 */

let passed = 0;
let failed = 0;

export async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}

/** Strips colour codes and OSC 8 hyperlinks, leaving the text a reader sees. */
export const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\]8;;[^\x07]*\x07/g, "");

/** Prints the tally and returns the failure count, for the runner's exit code. */
export function summary() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed;
}
