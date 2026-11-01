// /api/booking-action?id=…&t=… – a page for Tanya to approve or decline a request.
// GET only shows the page (so a link preview in WhatsApp doesn't approve anything); the action happens on POST.
import {
  verifyId, readBody, escapeHtml, env, TOPICS, timeLabel, formatHebrewDate,
  israelTimeToUtc, israelTimeOf,
} from "./_lib/core.js";
import { dbConfigured, getBooking, updateBooking } from "./_lib/db.js";
import { sendTemplate } from "./_lib/whatsapp.js";
import { calendarConfigured, createEvent } from "./_lib/calendar.js";

const STATUS_TEXT = { pending: "ממתין לאישור", confirmed: "התור אושר", declined: "הבקשה נדחתה", cancelled: "בוטל" };

function page(res, status, title, inner) {
  res.status(status);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.end(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)} | TB Cosmetology</title>
<style>
body{margin:0;background:#f3ebdf;color:#2e211a;font:17px/1.6 Assistant,Arial,sans-serif}
main{max-width:520px;margin:0 auto;padding:28px 18px}
.card{background:#faf6f0;border-radius:22px;padding:24px 20px;box-shadow:0 16px 40px -28px rgba(74,52,38,.5)}
h1{font:400 28px/1.2 Bellefair,Georgia,serif;color:#4a3426;margin:0 0 14px}
dl{display:grid;gap:8px;margin:0 0 20px}dl div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e2d4c1;padding-bottom:8px}
dt{color:#6b5444}dd{margin:0;font-weight:600;text-align:left}
label{display:block;font-weight:600;margin:12px 0 6px}
input{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid #e2d4c1;border-radius:10px;background:#fff}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button{width:100%;min-height:52px;border-radius:999px;border:0;font:600 17px Assistant,Arial,sans-serif;cursor:pointer;margin-top:14px}
.ok{background:#4a3426;color:#faf6f0}.no{background:transparent;border:1px solid #cdb29a;color:#4a3426}
.pill{display:inline-block;background:#e8dccb;border-radius:999px;padding:4px 12px;font-size:14px;font-weight:600;margin-bottom:12px}
.muted{color:#6b5444;font-size:15px}
</style></head><body><main><div class="card">${inner}</div></main></body></html>`);
}

function details(b) {
  const rows = [
    ["שם", b.full_name],
    ["טלפון", `<a href="tel:${escapeHtml(b.phone)}">${escapeHtml(b.phone)}</a>`],
    ["נושא", escapeHtml(TOPICS[b.topic] || b.topic)],
    ["יום מבוקש", escapeHtml(formatHebrewDate(b.requested_date))],
    ["שעה מבוקשת", escapeHtml(timeLabel(b.requested_time, b.time_mode))],
  ];
  if (b.note) rows.push(["הערה", escapeHtml(b.note)]);
  if (b.appointment_start) {
    const t = israelTimeOf(new Date(b.appointment_start));
    rows.push(["מועד שנקבע", escapeHtml(`${formatHebrewDate(t.date)}, ${t.time}`)]);
  }
  return `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === "שם" ? escapeHtml(v) : v}</dd></div>`).join("")}</dl>`;
}

export default async function handler(req, res) {
  if (!dbConfigured()) return page(res, 503, "המערכת לא מחוברת", "<h1>מערכת התורים עוד לא מחוברת</h1>");

  const q = req.method === "POST" ? await readBody(req) : req.query || {};
  const id = String(q.id || "");
  const token = String(q.t || "");
  let valid = false;
  try { valid = verifyId(id, token); } catch (e) { console.error(e); }
  if (!valid) return page(res, 403, "קישור לא תקין", "<h1>הקישור לא תקין</h1><p class='muted'>פתחי את הקישור המלא מהודעת הוואטסאפ.</p>");

  const b = await getBooking(id);
  if (!b) return page(res, 404, "לא נמצא", "<h1>הבקשה לא נמצאה</h1>");

  const hidden = `<input type="hidden" name="id" value="${escapeHtml(id)}"><input type="hidden" name="t" value="${escapeHtml(token)}">`;

  if (req.method === "GET") {
    if (b.status !== "pending") {
      return page(res, 200, STATUS_TEXT[b.status], `<span class="pill">${STATUS_TEXT[b.status]}</span><h1>בקשה לתור</h1>${details(b)}`);
    }
    const presetTime = b.time_mode === "slot" ? b.requested_time : "";
    return page(res, 200, "בקשה לתור", `
      <span class="pill">${STATUS_TEXT.pending}</span>
      <h1>בקשה חדשה לתור</h1>
      ${details(b)}
      <form method="post">${hidden}
        <input type="hidden" name="action" value="confirm">
        <div class="row">
          <div><label for="d">תאריך</label><input id="d" type="date" name="date" value="${escapeHtml(b.requested_date)}" required></div>
          <div><label for="tm">שעה</label><input id="tm" type="time" name="time" value="${escapeHtml(presetTime)}" step="300" required></div>
        </div>
        <button class="ok" type="submit">אישור התור ושליחת אישור ללקוחה</button>
      </form>
      <form method="post">${hidden}
        <input type="hidden" name="action" value="decline">
        <button class="no" type="submit">דחיית הבקשה</button>
      </form>
      <p class="muted">אחרי האישור הלקוחה תקבל הודעת אישור בוואטסאפ ותזכורת יום לפני הפגישה.</p>`);
  }

  if (req.method !== "POST") return page(res, 405, "שגיאה", "<h1>פעולה לא נתמכת</h1>");
  if (b.status !== "pending") {
    return page(res, 409, STATUS_TEXT[b.status], `<span class="pill">${STATUS_TEXT[b.status]}</span><h1>הבקשה כבר טופלה</h1>${details(b)}`);
  }

  const firstName = b.full_name.split(/\s+/)[0];
  const phoneIntl = "972" + b.phone.slice(1);

  if (q.action === "decline") {
    const updated = await updateBooking(id, { status: "declined", decided_at: new Date().toISOString() });
    await sendTemplate(phoneIntl, env("WA_TEMPLATE_CLIENT_DECLINED"), [firstName]).catch((e) => console.error(e));
    return page(res, 200, "הבקשה נדחתה", `<span class="pill">${STATUS_TEXT.declined}</span><h1>הבקשה נדחתה</h1>${details(updated)}<p class="muted">הלקוחה קיבלה הודעה שהמועד לא פנוי ושתחזרי אליה.</p>`);
  }

  if (q.action === "confirm") {
    const date = String(q.date || "");
    const time = String(q.time || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return page(res, 400, "חסר מועד", "<h1>צריך לבחור תאריך ושעה</h1><p class='muted'>חזרי אחורה ובחרי תאריך ושעה מדויקים לתור.</p>");
    }
    const start = israelTimeToUtc(date, time);
    const patch = { status: "confirmed", appointment_start: start.toISOString(), decided_at: new Date().toISOString() };

    if (calendarConfigured()) {
      try {
        patch.calendar_event_id = await createEvent({
          start,
          minutes: Number(env("APPOINTMENT_MINUTES", "60")),
          summary: `${TOPICS[b.topic] || "פגישה"} – ${b.full_name}`,
          description: `טלפון: ${b.phone}${b.note ? `\nהערה: ${b.note}` : ""}`,
        });
      } catch (e) { console.error("[calendar] create failed", e); }
    }

    const updated = await updateBooking(id, patch);
    let sent = true;
    await sendTemplate(phoneIntl, env("WA_TEMPLATE_CLIENT_CONFIRMED"), [
      firstName, formatHebrewDate(date), time, env("CLINIC_ADDRESS", "שדרות האגמים 11, נתניה"),
    ]).catch((e) => { sent = false; console.error(e); });

    return page(res, 200, "התור אושר", `<span class="pill">${STATUS_TEXT.confirmed}</span><h1>התור אושר</h1>${details(updated)}
      <p class="muted">${sent ? "הלקוחה קיבלה הודעת אישור בוואטסאפ." : "שליחת האישור בוואטסאפ נכשלה – כדאי לשלוח לה הודעה ידנית."}</p>`);
  }

  return page(res, 400, "שגיאה", "<h1>פעולה לא מוכרת</h1>");
}
