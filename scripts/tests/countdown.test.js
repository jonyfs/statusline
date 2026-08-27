import assert from "node:assert/strict";
import { test, stripAnsi } from "../test-harness.js";
import { formatResetCountdown, getRateLimits, getContextPercent } from "../../src/tokens.js";
import { clockFaceFor, resetMomentLabel } from "../../src/timeIcons.js";
import { renderPayload } from "../../src/render.js";
import { emptySources } from "./fixtures/sources.js";

const secondsAt = (iso) => Math.floor(new Date(iso).getTime() / 1000);

await test("an hour out reads in hours and minutes", () => {
  const now = Date.parse("2026-08-25T12:00:00Z");
  assert.equal(formatResetCountdown(secondsAt("2026-08-25T13:30:00Z"), now), "resets in 1h30m");
});

await test("days out switches units instead of counting 78 hours", () => {
  const now = Date.parse("2026-08-25T12:00:00Z");
  assert.equal(formatResetCountdown(secondsAt("2026-08-28T18:00:00Z"), now), "resets in 3d 6h");
});

await test("a reset happening right now says so", () => {
  const now = Date.parse("2026-08-25T12:00:00Z");
  assert.equal(formatResetCountdown(secondsAt("2026-08-25T11:59:30Z"), now), "resetting now");
});

await test("a reset that passed hours ago is unknown, not 'resetting now'", () => {
  // The old behaviour returned "resetting now" for any past timestamp, so
  // a stale payload showed a window that had been resetting for hours.
  const now = Date.parse("2026-08-25T12:00:00Z");
  assert.equal(formatResetCountdown(secondsAt("2026-08-25T09:00:00Z"), now), null);
});

await test("a countdown is never negative and never NaN", () => {
  const now = Date.parse("2026-08-25T12:00:00Z");
  for (const iso of ["2026-08-20T00:00:00Z", "2026-08-25T11:00:00Z", "2026-09-05T00:00:00Z"]) {
    const label = formatResetCountdown(secondsAt(iso), now);
    if (label !== null) {
      assert.doesNotMatch(label, /-|NaN|undefined/, `${iso} produced ${label}`);
    }
  }
  assert.equal(formatResetCountdown(undefined, now), null);
  assert.equal(formatResetCountdown(Number.NaN, now), null);
});

await test("the countdown, the clock face and the named day agree across a DST change", () => {
  // Europe/Lisbon moves its clocks on 2026-10-25. The clock face and the
  // named moment both come from local time, so they have to agree with a
  // countdown computed from absolute time.
  const prevTz = process.env.TZ;
  process.env.TZ = "Europe/Lisbon";
  try {
    const now = Date.parse("2026-10-24T12:00:00Z");
    const resetsAt = secondsAt("2026-10-26T09:30:00Z");
    const local = new Date(resetsAt * 1000);

    const countdown = formatResetCountdown(resetsAt, now);
    const face = clockFaceFor(resetsAt);
    const moment = resetMomentLabel(resetsAt, new Date(now));

    assert.match(countdown, /^resets in \d+d \d+h$/);
    assert.ok(face, "a real timestamp must map to a real clock face");
    // The named moment quotes local wall-clock time, whatever the offset
    // was on that side of the change.
    const hh = String(local.getHours()).padStart(2, "0");
    const mm = String(local.getMinutes()).padStart(2, "0");
    assert.ok(moment.endsWith(`${hh}:${mm}`), `moment ${moment} disagrees with local ${hh}:${mm}`);
  } finally {
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  }
});

await test("usage figures come from the payload and nowhere else", () => {
  assert.equal(getContextPercent({}), null);
  assert.equal(getContextPercent({ context_window: { used_percentage: "40" } }), null);
  assert.equal(getContextPercent({ context_window: { used_percentage: 40.4 } }), 40);

  const limits = getRateLimits({ rate_limits: { five_hour: { used_percentage: 20 } } });
  assert.equal(limits.fiveHourPct, 20);
  assert.equal(limits.fiveHourResetsAt, null);
  assert.equal(limits.sevenDayPct, null);
});

await test("an unknown reset renders as text, not as a blank or a guess", () => {
  // C6 merged the two countdowns into one segment, so there is one place to
  // say it now rather than two. A bare clock face would be the empty slot
  // Principle III rules out.
  const plain = stripAnsi(
    renderPayload({}, { sources: emptySources, trackChanges: false, maxWidth: 200, maxHeight: 40 })
  );
  assert.match(plain, /reset unknown/);
});

await test("a reset a week out reads as a date, not as today's weekday", () => {
  // A weekday name only identifies a day inside the coming week. Seven days
  // out it is today's own name, and a reset a week away read as imminent.
  const now = new Date("2026-08-27T10:00:00Z");
  const sameWeekday = secondsAt("2026-09-03T13:00:00Z");
  const label = resetMomentLabel(sameWeekday, now);
  assert.doesNotMatch(label, /Thu/);
  assert.match(label, /^\d{2}\/\d{2} \d{2}:\d{2}$/);

  // Inside the week the weekday still says it best.
  assert.match(resetMomentLabel(secondsAt("2026-08-29T13:00:00Z"), now), /^Sat \d{2}:\d{2}$/);
});
