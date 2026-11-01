// Shared logic: topics, validation, phone numbers, Israel time zone, signed links.
import crypto from "node:crypto";

export const TZ = "Asia/Jerusalem";

// Must match the topics in assets/js/config.js
export const TOPICS = {
  consult: "ייעוץ ואבחון עור",
  acne: "טיפול באקנה",
  "post-acne": "טיפול בפוסט אקנה",
  pigmentation: "טיפול בפיגמנטציה",
  "anti-aging": "טיפולי אנטי אייג'ינג",
  facial: "טיפולי פנים וקוסמטיקה מתקדמת",
};

export const TIME_PREFERENCES = {
  morning: "בוקר",
  noon: "צהריים",
  evening: "אחר הצהריים / ערב",
};

export const env = (name, fallback = "") => process.env[name] ?? fallback;

/** Israeli mobile number → { local: "05XXXXXXXX", intl: "9725XXXXXXXX" } or null */
export function normalizeIsraeliMobile(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  if (!/^05\d{8}$/.test(d)) return null;
  return { local: d, intl: "972" + d.slice(1) };
}

/* ---------- Time zone ---------- */
function partsInTz(date, tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function tzOffsetMs(ts, tz = TZ) {
  const p = partsInTz(new Date(ts), tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

/** "2026-11-05" + "10:30" Israel time → Date (UTC) */
export function israelTimeToUtc(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess);
  let t = guess - off1;
  const off2 = tzOffsetMs(t);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

/** Today's date in Israel, YYYY-MM-DD */
export function israelToday(now = new Date()) {
  const p = partsInTz(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatHebrewDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function israelTimeOf(date) {
  const p = partsInTz(date);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function timeLabel(time, mode) {
  return mode === "slot" ? time : TIME_PREFERENCES[time] || time;
}

/* ---------- Booking request validation ---------- */
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export function validateBooking(body, now = new Date()) {
  const errors = [];
  const b = body && typeof body === "object" ? body : {};

  // Bot protection: hidden field filled in, or form submitted too fast
  const isBot = Boolean(b.website) || Number(b.elapsedMs) < 2500;

  const topic = Object.hasOwn(TOPICS, b.topic) ? b.topic : null;
  if (!topic) errors.push("topic");

  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  const today = israelToday(now);
  if (!date || date <= today || date > addDays(today, 60)) errors.push("date");

  const timeMode = b.timeMode === "slot" ? "slot" : "preference";
  const time = timeMode === "slot"
    ? (/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ? b.time : null)
    : (Object.hasOwn(TIME_PREFERENCES, b.time) ? b.time : null);
  if (!time) errors.push("time");

  const fullName = clean(b.fullName, 80);
  if (fullName.length < 2) errors.push("fullName");

  const phone = normalizeIsraeliMobile(b.phone);
  if (!phone) errors.push("phone");

  const note = clean(b.note, 500);
  if (b.consent !== true) errors.push("consent");

  return {
    ok: errors.length === 0,
    isBot,
    errors,
    value: { topic, date, time, timeMode, fullName, phone, note },
  };
}

export const ERROR_MESSAGES = {
  topic: "בחרי נושא לפגישה.",
  date: "בחרי יום תקין לפגישה.",
  time: "בחרי שעה לפגישה.",
  fullName: "כתבי שם מלא.",
  phone: "מספר הטלפון לא תקין. כתבי מספר נייד ישראלי.",
  consent: "כדי לשלוח את הבקשה צריך לאשר את שמירת הפרטים.",
};

/* ---------- Signed links for Tanya (approve / decline) ---------- */
function secret() {
  const s = env("BOOKING_LINK_SECRET");
  if (s.length < 32) throw new Error("BOOKING_LINK_SECRET must be at least 32 characters");
  return s;
}

export function signId(id) {
  return crypto.createHmac("sha256", secret()).update(`booking:${id}`).digest("base64url");
}

export function verifyId(id, token) {
  if (typeof id !== "string" || typeof token !== "string") return false;
  const expected = Buffer.from(signId(id));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function hashIp(ip) {
  return crypto.createHash("sha256").update(`${env("BOOKING_LINK_SECRET")}:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return Object.fromEntries(new URLSearchParams(req.body)); }
  }
  return {};
}
