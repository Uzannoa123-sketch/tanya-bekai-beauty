import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIsraeliMobile, validateBooking, israelTimeToUtc, israelToday, addDays, signId, verifyId,
} from "../api/_lib/core.js";

process.env.BOOKING_LINK_SECRET = "x".repeat(40);

const tomorrow = () => addDays(israelToday(), 1);
const good = () => ({
  topic: "acne", date: tomorrow(), time: "morning", timeMode: "preference",
  fullName: "דנה לוי", phone: "050-123-4567", note: "", consent: true, website: "", elapsedMs: 20000,
});

test("phone normalisation", () => {
  assert.deepEqual(normalizeIsraeliMobile("054-682-4499"), { local: "0546824499", intl: "972546824499" });
  assert.deepEqual(normalizeIsraeliMobile("+972 54 682 4499"), { local: "0546824499", intl: "972546824499" });
  assert.equal(normalizeIsraeliMobile("03-1234567"), null);
  assert.equal(normalizeIsraeliMobile("0501234"), null);
  assert.equal(normalizeIsraeliMobile(""), null);
});

test("valid request passes", () => {
  const r = validateBooking(good());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.isBot, false);
  assert.equal(r.value.phone.local, "0501234567");
});

test("rejects past dates, unknown topics, missing consent, bad slot", () => {
  assert.deepEqual(validateBooking({ ...good(), date: israelToday() }).errors, ["date"]);
  assert.deepEqual(validateBooking({ ...good(), topic: "botox" }).errors, ["topic"]);
  assert.deepEqual(validateBooking({ ...good(), consent: false }).errors, ["consent"]);
  assert.deepEqual(validateBooking({ ...good(), timeMode: "slot", time: "25:00" }).errors, ["time"]);
  assert.equal(validateBooking({ ...good(), timeMode: "slot", time: "10:30" }).ok, true);
});

test("honeypot and too-fast submissions are flagged as bots", () => {
  assert.equal(validateBooking({ ...good(), website: "spam" }).isBot, true);
  assert.equal(validateBooking({ ...good(), elapsedMs: 500 }).isBot, true);
});

test("Israel time → UTC across summer and winter time", () => {
  assert.equal(israelTimeToUtc("2026-07-15", "10:00").toISOString(), "2026-07-15T07:00:00.000Z"); // IDT +3
  assert.equal(israelTimeToUtc("2026-12-15", "10:00").toISOString(), "2026-12-15T08:00:00.000Z"); // IST +2
});

test("signed links verify and reject tampering", () => {
  const id = "3f2c0a8e-1b2c-4d5e-8f90-123456789abc";
  const t = signId(id);
  assert.equal(verifyId(id, t), true);
  assert.equal(verifyId(id, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A")), false);
  assert.equal(verifyId("other", t), false);
});

/* ---------- Full handler with mocked Supabase + WhatsApp ---------- */
function mockRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end(b) { this.body = b; return this; },
  };
}

let calls;
beforeEach(() => {
  calls = [];
  Object.assign(process.env, {
    SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "service",
    WHATSAPP_TOKEN: "wa", WHATSAPP_PHONE_NUMBER_ID: "123", SITE_URL: "https://site.test",
    WA_TEMPLATE_OWNER_NEW_REQUEST: "tb_new_request", WA_TEMPLATE_CLIENT_RECEIVED: "tb_request_received",
  });
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const json = (b, status = 200) => ({ ok: status < 300, status, json: async () => b, text: async () => JSON.stringify(b) });
    if (String(url).startsWith("https://db.test") && (init.method || "GET") === "GET") return json([]);
    if (String(url).startsWith("https://db.test") && init.method === "POST") {
      return json([{ id: "3f2c0a8e-1b2c-4d5e-8f90-123456789abc", ...JSON.parse(init.body) }], 201);
    }
    if (String(url).startsWith("https://graph.facebook.com")) return json({ messages: [{ id: "wamid" }] });
    throw new Error("unexpected fetch " + url);
  };
});

test("POST /api/booking stores a pending request and notifies Tanya + client", async () => {
  const { default: handler } = await import("../api/booking.js");
  const res = mockRes();
  await handler({ method: "POST", body: good(), headers: { "x-forwarded-for": "1.2.3.4" } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(res.body.status, "pending");
  assert.equal(res.body.clientNotified, true);

  const insert = calls.find((c) => c.init.method === "POST" && c.url.includes("booking_requests"));
  const row = JSON.parse(insert.init.body);
  assert.equal(row.status, "pending");
  assert.equal(row.phone, "0501234567");
  assert.equal(row.appointment_start, undefined, "a request must not have a confirmed time");

  const wa = calls.filter((c) => c.url.startsWith("https://graph.facebook.com")).map((c) => JSON.parse(c.init.body));
  assert.deepEqual(wa.map((m) => [m.to, m.template.name]), [
    ["972546824499", "tb_new_request"],
    ["972501234567", "tb_request_received"],
  ]);
  assert.match(wa[0].template.components[0].parameters.at(-1).text, /^https:\/\/site\.test\/api\/booking-action\?id=.+&t=.+/);
});

test("POST /api/booking returns 400 with a Hebrew message for a bad phone", async () => {
  const { default: handler } = await import("../api/booking.js");
  const res = mockRes();
  await handler({ method: "POST", body: { ...good(), phone: "123" }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /טלפון/);
});

for (const missing of ["SUPABASE_URL", "WHATSAPP_TOKEN", "WA_TEMPLATE_OWNER_NEW_REQUEST"]) {
  test(`POST /api/booking returns 503 without ${missing} (nothing stored)`, async () => {
    delete process.env[missing];
    const { default: handler } = await import("../api/booking.js");
    const res = mockRes();
    await handler({ method: "POST", body: good(), headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0);
  });
}
