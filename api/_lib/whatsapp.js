// Sending WhatsApp messages through the WhatsApp Business Cloud API (Meta).
// Business-initiated messages require templates approved in advance by Meta – see docs/SETUP.md.
import { env } from "./core.js";

export function whatsappConfigured() {
  return Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID"));
}

/**
 * Sends an approved template.
 * @param {string} to       number in international format, digits only (9725XXXXXXXX)
 * @param {string} template template name as approved in Meta
 * @param {string[]} params values for {{1}}, {{2}} … in the template body
 */
export async function sendTemplate(to, template, params = []) {
  if (!whatsappConfigured() || !template) {
    console.info(`[whatsapp:skipped] ${template || "(no template)"} → ${to}`);
    return { skipped: true };
  }
  const version = env("WHATSAPP_API_VERSION", "v21.0");
  const res = await fetch(`https://graph.facebook.com/${version}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: env("WHATSAPP_TEMPLATE_LANG", "he") },
        components: params.length
          ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t).slice(0, 1000) || "-" })) }]
          : [],
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${template} failed: ${res.status} ${JSON.stringify(data.error || data)}`);
  return data;
}
