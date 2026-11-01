// Google Calendar connection (optional) using a service account. No external libraries.
import crypto from "node:crypto";
import { env, TZ } from "./core.js";

export function calendarConfigured() {
  return Boolean(env("GOOGLE_CALENDAR_ID") && env("GOOGLE_SERVICE_ACCOUNT_EMAIL") && env("GOOGLE_PRIVATE_KEY"));
}

let cached = { token: null, exp: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const key = env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function gcal(path, init = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar ${path} failed: ${res.status} ${JSON.stringify(data.error || data)}`);
  return data;
}

/** Busy periods in the calendar between two times */
export async function busyPeriods(fromDate, toDate) {
  const id = env("GOOGLE_CALENDAR_ID");
  const data = await gcal("freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: fromDate.toISOString(), timeMax: toDate.toISOString(), timeZone: TZ, items: [{ id }] }),
  });
  return (data.calendars?.[id]?.busy || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function createEvent({ start, minutes, summary, description }) {
  const id = encodeURIComponent(env("GOOGLE_CALENDAR_ID"));
  const end = new Date(start.getTime() + minutes * 60_000);
  const data = await gcal(`calendars/${id}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
    }),
  });
  return data.id;
}
