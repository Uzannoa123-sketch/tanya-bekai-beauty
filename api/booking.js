// POST /api/booking – a new booking request (status: pending, waiting for Tanya's approval)
import {
  validateBooking, ERROR_MESSAGES, TOPICS, timeLabel, formatHebrewDate,
  signId, hashIp, clientIp, readBody, env,
} from "./_lib/core.js";
import { dbConfigured, insertBooking, countRecent } from "./_lib/db.js";
import { sendTemplate, whatsappConfigured } from "./_lib/whatsapp.js";

const MAX_PER_IP_PER_HOUR = 5;
const MAX_PER_PHONE_PER_HOUR = 3;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, code: "method_not_allowed" });
  }
  // Without a database or WhatsApp (Tanya would never hear about the request) – don't accept it;
  // the browser falls back to sending the request on WhatsApp.
  if (!dbConfigured() || !whatsappConfigured() || !env("WA_TEMPLATE_OWNER_NEW_REQUEST") || env("BOOKING_LINK_SECRET").length < 32) {
    return res.status(503).json({ ok: false, code: "not_configured" });
  }

  const body = await readBody(req);
  const { ok, isBot, errors, value } = validateBooking(body);

  // A bot gets a reply that looks normal, but nothing is stored or sent
  if (isBot) return res.status(201).json({ ok: true, status: "pending", clientNotified: false, ownerNotified: true });

  if (!ok) {
    return res.status(400).json({ ok: false, code: "invalid", fields: errors, message: ERROR_MESSAGES[errors[0]] });
  }

  try {
    const ipHash = hashIp(clientIp(req));
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await countRecent({ ipHash, phone: value.phone.local }, since);
    if (recent.byIp >= MAX_PER_IP_PER_HOUR || recent.byPhone >= MAX_PER_PHONE_PER_HOUR) {
      return res.status(429).json({
        ok: false, code: "rate_limited",
        message: "כבר התקבלו כמה בקשות מהמספר הזה. טניה תחזור אלייך, ואפשר גם לכתוב לה ישירות בוואטסאפ.",
      });
    }

    const row = await insertBooking({
      status: "pending",
      topic: value.topic,
      requested_date: value.date,
      requested_time: value.time,
      time_mode: value.timeMode,
      full_name: value.fullName,
      phone: value.phone.local,
      note: value.note || null,
      consent: true,
      ip_hash: ipHash,
    });

    const dateText = formatHebrewDate(value.date);
    const timeText = timeLabel(value.time, value.timeMode);
    const firstName = value.fullName.split(/\s+/)[0];
    const reviewUrl = `${env("SITE_URL").replace(/\/$/, "")}/api/booking-action?id=${row.id}&t=${signId(row.id)}`;

    const [owner, client] = await Promise.allSettled([
      // Notification to Tanya, with a link to approve or decline
      sendTemplate(env("OWNER_WHATSAPP_NUMBER", "972546824499"), env("WA_TEMPLATE_OWNER_NEW_REQUEST"), [
        value.fullName, value.phone.local, TOPICS[value.topic], dateText, timeText, value.note || "-", reviewUrl,
      ]),
      // Confirmation to the client that the request was received (not an appointment confirmation!)
      sendTemplate(value.phone.intl, env("WA_TEMPLATE_CLIENT_RECEIVED"), [firstName, dateText, timeText]),
    ]);
    if (owner.status === "rejected") console.error("[booking] owner notify failed", owner.reason);
    if (client.status === "rejected") console.error("[booking] client notify failed", client.reason);

    const clientNotified = client.status === "fulfilled" && !client.value?.skipped;
    const ownerNotified = owner.status === "fulfilled" && !owner.value?.skipped;
    return res.status(201).json({ ok: true, id: row.id, status: "pending", clientNotified, ownerNotified });
  } catch (err) {
    console.error("[booking] failed", err);
    return res.status(500).json({ ok: false, code: "server_error" });
  }
}
