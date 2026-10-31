/** Public configuration for the API-only FTrade web client. */
const configuredBot = String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "")
  .trim()
  .replace(/^@/, "");
const validBot = configuredBot && !/(replace|your[-_ ]|placeholder|change[-_ ]?me)/i.test(configuredBot)
  ? configuredBot
  : "";

function normalizePublicPhone(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || !/^\+?[0-9\s().-]+$/.test(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  // WhatsApp click-to-chat requires an international number without +, spaces or punctuation.
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

// Official FTrade support contact supplied by the project owner. Keep this public
// fallback so WhatsApp works even when Railway has not yet defined the build variable.
const defaultSupportWhatsapp = "5359494299";
const configuredSupportWhatsapp = normalizePublicPhone(import.meta.env.VITE_SUPPORT_WHATSAPP);

const publicWhatsappContacts = [
  // Preferred single public contact shared by Plans, Support and account notices.
  configuredSupportWhatsapp || defaultSupportWhatsapp,
  // Backwards compatibility with existing deployments that still use the legacy variables.
  import.meta.env.VITE_ADMIN_WHATSAPP_1,
  import.meta.env.VITE_ADMIN_WHATSAPP_2,
  import.meta.env.VITE_ADMIN_WHATSAPP_3,
]
  .map(normalizePublicPhone)
  .filter((phone, index, all) => Boolean(phone) && all.indexOf(phone) === index);

export const appConfig = {
  apiUrl: String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, ""),
  websocketUrl: String(import.meta.env.VITE_WS_URL || "").trim().replace(/\/+$/, ""),
  trialDays: Math.max(1, Number(import.meta.env.VITE_TRIAL_DAYS) || 5),
  alertDuration: Math.max(15, Number(import.meta.env.VITE_ALERT_DURATION_SECONDS) || 180),
  botUsername: validBot,
  domain: import.meta.env.VITE_APP_DOMAIN || window.location.host,
  whatsapp: publicWhatsappContacts,
};
