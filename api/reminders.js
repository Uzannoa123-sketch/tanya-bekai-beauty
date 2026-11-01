// /api/reminders – runs automatically once a day (Vercel Cron, see vercel.json).
// Sends a WhatsApp reminder for every confirmed appointment in the next 30 hours that has not had a reminder yet.
import { env, formatHebrewDate, israelTimeOf } from "./_lib/core.js";
import { dbConfigured, dueReminders, updateBooking } from "./_lib/db.js";
import { sendTemplate } from "./_lib/whatsapp.js";

export default async function handler(req, res) {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false });
  }
  if (!dbConfigured()) return res.status(503).json({ ok: false, code: "not_configured" });

  const now = new Date();
  const due = await dueReminders(now.toISOString(), new Date(now.getTime() + 30 * 3600_000).toISOString());
  let sent = 0;
  for (const b of due) {
    const { date, time } = israelTimeOf(new Date(b.appointment_start));
    try {
      const r = await sendTemplate("972" + b.phone.slice(1), env("WA_TEMPLATE_CLIENT_REMINDER"), [
        b.full_name.split(/\s+/)[0], formatHebrewDate(date), time, env("CLINIC_ADDRESS", "שדרות האגמים 11, נתניה"),
      ]);
      if (!r.skipped) {
        await updateBooking(b.id, { reminder_sent_at: new Date().toISOString() });
        sent++;
      }
    } catch (e) {
      console.error("[reminders] failed for", b.id, e);
    }
  }
  return res.status(200).json({ ok: true, due: due.length, sent });
}
