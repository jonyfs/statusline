/**
 * Icons derived from the actual reset timestamp, so the glyph itself
 * carries information instead of being decoration.
 *
 * Unicode has 24 clock-face emoji covering every hour and half-hour, so
 * a reset time maps onto a real icon. There is deliberately no attempt
 * to encode the *day* in an emoji: Unicode has no per-weekday or
 * per-date glyph (📅 📆 🗓️ are generic), so the weekday is rendered as
 * text next to the calendar icon rather than faked with a symbol that
 * doesn't mean what it appears to.
 */

const CLOCK_FACES = [
  "🕛", "🕧", // 12:00, 12:30
  "🕐", "🕜", // 1:00, 1:30
  "🕑", "🕝",
  "🕒", "🕞",
  "🕓", "🕟",
  "🕔", "🕠",
  "🕕", "🕡",
  "🕖", "🕢",
  "🕗", "🕣",
  "🕘", "🕤",
  "🕙", "🕥",
  "🕚", "🕦",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Clock-face emoji nearest to the given time, rounded to the half hour.
 * `resetsAtSeconds` is a Unix timestamp in seconds, as the payload sends it.
 */
export function clockFaceFor(resetsAtSeconds) {
  if (typeof resetsAtSeconds !== "number") return null;
  const d = new Date(resetsAtSeconds * 1000);
  const hour12 = d.getHours() % 12;
  const halfPast = d.getMinutes() >= 30 ? 1 : 0;
  return CLOCK_FACES[hour12 * 2 + halfPast];
}

/**
 * How the reset moment reads to a human: the weekday when it lands on a
 * different day than today ("Mon 09:00"), or just the time when it's
 * still today ("09:00"). Naming a weekday that is in fact today would
 * make an imminent reset look further away than it is.
 */
export function resetMomentLabel(resetsAtSeconds, now = new Date()) {
  if (typeof resetsAtSeconds !== "number") return null;
  const d = new Date(resetsAtSeconds * 1000);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) return hhmm;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  if (isTomorrow) return `tomorrow ${hhmm}`;
  return `${WEEKDAYS[d.getDay()]} ${hhmm}`;
}
