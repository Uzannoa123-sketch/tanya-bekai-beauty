// GET /api/availability?date=YYYY-MM-DD
// With Google Calendar connected: returns real free times. Without it: { mode: "request" } – nothing invented.
import { env, israelTimeToUtc, israelToday } from "./_lib/core.js";
import { calendarConfigured, busyPeriods } from "./_lib/calendar.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const date = String(req.query?.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date" });

  // WORK_HOURS="09:00-19:00" must be set by Tanya – no default, so as not to invent hours
  const hours = env("WORK_HOURS");
  if (!calendarConfigured() || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(hours) || date <= israelToday()) {
    return res.status(200).json({ mode: "request" });
  }

  const [from, to] = hours.split("-");
  const step = Number(env("SLOT_MINUTES", "60"));
  const length = Number(env("APPOINTMENT_MINUTES", "60"));

  try {
    const dayStart = israelTimeToUtc(date, from);
    const dayEnd = israelTimeToUtc(date, to);
    const busy = await busyPeriods(dayStart, dayEnd);
    const slots = [];
    for (let t = dayStart.getTime(); t + length * 60_000 <= dayEnd.getTime(); t += step * 60_000) {
      const s = t, e = t + length * 60_000;
      if (busy.some((b) => s < b.end.getTime() && e > b.start.getTime())) continue;
      const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s));
      slots.push(hhmm);
    }
    return res.status(200).json({ mode: "calendar", slots });
  } catch (err) {
    console.error("[availability] failed", err);
    return res.status(200).json({ mode: "request" });
  }
}
