// Storing requests in Supabase (Postgres) through the REST API, from the server only.
// The service key never reaches the browser; the table is closed to public access (RLS).
import { env } from "./core.js";

const TABLE = "booking_requests";

export function dbConfigured() {
  return Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function insertBooking(row) {
  const [created] = await rest(TABLE, { method: "POST", body: row, prefer: "return=representation" });
  return created;
}

export async function getBooking(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await rest(`${TABLE}?id=eq.${id}&limit=1`);
  return rows[0] || null;
}

export async function updateBooking(id, patch) {
  const rows = await rest(`${TABLE}?id=eq.${id}`, { method: "PATCH", body: patch, prefer: "return=representation" });
  return rows[0] || null;
}

export async function countRecent({ ipHash, phone }, sinceIso) {
  const since = encodeURIComponent(sinceIso);
  const [byIp, byPhone] = await Promise.all([
    rest(`${TABLE}?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}`),
    rest(`${TABLE}?select=id&phone=eq.${phone}&created_at=gte.${since}`),
  ]);
  return { byIp: byIp.length, byPhone: byPhone.length };
}

export async function dueReminders(fromIso, toIso) {
  return rest(
    `${TABLE}?status=eq.confirmed&reminder_sent_at=is.null` +
    `&appointment_start=gte.${encodeURIComponent(fromIso)}&appointment_start=lt.${encodeURIComponent(toIso)}`
  );
}
