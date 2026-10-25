/** Public configuration for the API-only FTrade web client. */
const configuredBot = String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "")
  .trim()
  .replace(/^@/, "");
const validBot = configuredBot && !/(replace|your[-_ ]|placeholder|change[-_ ]?me)/i.test(configuredBot)
  ? configuredBot
  : "";

export const appConfig = {
  apiUrl: String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, ""),
  websocketUrl: String(import.meta.env.VITE_WS_URL || "").trim().replace(/\/+$/, ""),
  trialDays: Math.max(1, Number(import.meta.env.VITE_TRIAL_DAYS) || 5),
  alertDuration: Math.max(15, Number(import.meta.env.VITE_ALERT_DURATION_SECONDS) || 180),
  botUsername: validBot,
  domain: import.meta.env.VITE_APP_DOMAIN || window.location.host,
  whatsapp: [
    import.meta.env.VITE_ADMIN_WHATSAPP_1,
    import.meta.env.VITE_ADMIN_WHATSAPP_2,
    import.meta.env.VITE_ADMIN_WHATSAPP_3,
  ].filter((phone): phone is string => Boolean(phone && String(phone).trim())),
};
