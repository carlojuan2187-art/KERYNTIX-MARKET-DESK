import type { PaymentRecord, User } from "./types";
import { appConfig } from "./config";
import { apiRequest, clearAccessToken, restoreApiSession, setAccessToken, setStoredRefreshToken } from "./client";

export interface PhoneChallenge {
  token: string;
  phone: string;
  step: "awaiting_telegram";
  expires_at: string;
  resend_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string | null;
  user: User;
  is_new: boolean;
}

function persistAuthSession(session: AuthSession): AuthSession {
  setAccessToken(session.access_token);
  setStoredRefreshToken(session.refresh_token);
  sessionStorage.removeItem("ftrade.signedOut");
  sessionStorage.removeItem("ftrade.referrer");
  return session;
}

export async function loginPhone(phone: string): Promise<PhoneChallenge> {
  const refCode = sessionStorage.getItem("ftrade.referrer") || undefined;
  return apiRequest<PhoneChallenge>("/auth/phone", {
    method: "POST",
    body: JSON.stringify({ phone: phone.replace(/\s+/g, ""), ...(refCode ? { ref_code: refCode } : {}) }),
  });
}

/** Begin a new account registration. Telegram verification is required only here. */
export async function registerPhone(phone: string, password: string, language: "en" | "es" = "en"): Promise<PhoneChallenge> {
  const refCode = sessionStorage.getItem("ftrade.referrer") || undefined;
  return apiRequest<PhoneChallenge>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      phone: phone.replace(/\s+/g, ""),
      password,
      language,
      ...(refCode ? { ref_code: refCode } : {}),
    }),
  });
}

/** Direct returning-user login: phone + password, no Telegram challenge. */
export async function loginWithPassword(phone: string, password: string): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: phone.replace(/\s+/g, ""), password }),
  });
  return persistAuthSession(session);
}

/** Password recovery for an existing account; it is verified through Telegram. */
export async function startPasswordRecovery(phone: string): Promise<PhoneChallenge> {
  return apiRequest<PhoneChallenge>("/auth/recover", {
    method: "POST",
    body: JSON.stringify({ phone: phone.replace(/\s+/g, "") }),
  });
}

export async function setAccountPassword(password: string): Promise<User> {
  return apiRequest<User>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function verifyTelegramLink(token: string) {
  return apiRequest<{ linked: boolean; telegram_chat_id?: string }>(
    `/auth/telegram-check?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
}

export async function resendCode(token: string) {
  return apiRequest<{ expires_at: string; resend_at: string }>("/auth/resend", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verifyCode(phone: string, code: string) {
  const session = await apiRequest<AuthSession>(
    "/auth/verify",
    { method: "POST", body: JSON.stringify({ phone: phone.replace(/\s+/g, ""), code }) },
  );
  return persistAuthSession(session);
}

export async function restoreAuthSession(): Promise<User | null> {
  return restoreApiSession<User>();
}

export async function logout() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem("ftrade.rt");
  } catch {
    // ignore unavailable storage
  }
  try {
    await apiRequest<void>("/auth/logout", {
      method: "POST",
      ...(stored ? { body: JSON.stringify({ refresh_token: stored }) } : {}),
    });
  } catch (error) {
    if ((error as { status?: number })?.status === 401) return;
    throw error;
  } finally {
    clearAccessToken();
    setStoredRefreshToken(null);
  }
}

export async function getAccountRestriction() {
  return apiRequest<{
    reason: string;
    status?: string;
    allowed?: boolean;
    ban_active?: boolean;
    ban_until?: string;
    access_until?: string;
  }>("/account/restriction", { method: "GET" });
}

export interface TelegramLinkRequest {
  token: string;
  deep_link: string;
  expires_at: string;
}

export async function startTelegramLink(): Promise<TelegramLinkRequest> {
  return apiRequest<TelegramLinkRequest>("/account/telegram", { method: "POST" });
}

export async function unlinkTelegramAccount(): Promise<User> {
  return apiRequest<User>("/account/telegram", { method: "DELETE" });
}

export interface PaymentSession {
  price: string;
  wallet_dest: string | null;
  record: PaymentRecord;
  expires_at: string;
}

function normalizePaymentRecord(record: PaymentRecord & { record_id?: string; expires_at?: string }): PaymentRecord {
  return {
    ...record,
    id: record.id || record.record_id || "",
    status: record.status === ("verified" as string) ? "confirmed" : record.status,
  } as PaymentRecord;
}

export async function startPayment(): Promise<PaymentSession> {
  const result = await apiRequest<{
    price: string;
    wallet_dest: string | null;
    record: PaymentRecord & { record_id?: string; expires_at?: string };
    expires_at: string;
  }>("/payments/start", { method: "POST" });
  return {
    price: result.price,
    wallet_dest: result.wallet_dest,
    expires_at: result.expires_at || result.record.expires_at || "",
    record: normalizePaymentRecord(result.record),
  };
}

export async function getPaymentHistory(): Promise<PaymentRecord[]> {
  const rows = await apiRequest<Array<PaymentRecord & { record_id?: string }>>("/payments/history?limit=50", { method: "GET" });
  return rows.map(normalizePaymentRecord);
}

export async function verifyPayment(recordId: string, wallet_from: string): Promise<PaymentRecord> {
  const result = await apiRequest<{ result?: string; record: PaymentRecord & { record_id?: string } }>(
    "/payments/verify",
    { method: "POST", body: JSON.stringify({ record_id: recordId, wallet_from }) },
  );
  return normalizePaymentRecord(result.record);
}

export interface ReferralSummary {
  link: string;
  progress: { current: number; target: number };
  referrals: {
    user_id: string;
    username: string;
    activated_premium_at: string | null;
    created_at: string;
  }[];
  rewards: { id: string; days: number; created_at: string }[];
}

export async function getReferralSummary(): Promise<ReferralSummary> {
  const result = await apiRequest<Partial<ReferralSummary> & { referral_link?: string; premium_referred?: number }>(
    "/referrals",
    { method: "GET" },
  );
  return {
    link: result.link || result.referral_link || "",
    progress: result.progress || { current: result.premium_referred || 0, target: 5 },
    referrals: (result.referrals || []).map((item) => ({
      ...item,
      username: item.username || "Usuario",
      activated_premium_at: item.activated_premium_at || null,
    })),
    rewards: result.rewards || [],
  };
}

export async function getAdminUsers(query = "", filter = "all", page = 0, limit = 6) {
  const params = new URLSearchParams({ query, filter, page: String(page), limit: String(limit) });
  const result = await apiRequest<{ users: User[]; total: number; page: number; limit: number }>(
    `/admin/users?${params.toString()}`,
    { method: "GET" },
  );
  return result;
}

export async function getAdminOverview() {
  return apiRequest<{
    trial_users: number;
    premium_users: number;
    banned_users: number;
    total_users: number;
    generated_at?: string;
  }>("/admin/stats", { method: "GET" });
}

export async function activatePremium(user_id: string, days: number, reason = "Activación Premium desde panel administrativo") {
  const requestId = `web-${crypto.randomUUID()}`;
  return apiRequest<User>(`/admin/users/${encodeURIComponent(user_id)}/premium`, {
    method: "POST",
    body: JSON.stringify({ days: Math.min(365, Math.max(1, Math.round(days))), reason, request_id: requestId }),
  });
}

export async function adminBanUser(user_id: string, until: string | undefined, reason: string) {
  return apiRequest<User>(`/admin/users/${encodeURIComponent(user_id)}/ban`, {
    method: "PATCH",
    body: JSON.stringify({ until: until || null, reason }),
  });
}

export async function adminUnbanUser(user_id: string) {
  return apiRequest<User>(`/admin/users/${encodeURIComponent(user_id)}/unban`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "Desbloqueo solicitado desde el panel administrativo" }),
  });
}

export interface StatsBaseline {
  active: boolean;
  reset_at: string | null;
  reset_by: string | null;
  reason: string | null;
  trades_counted: number;
  trades_archived: number;
  trades_total: number;
}

export async function getStatsBaseline() {
  return apiRequest<StatsBaseline>("/admin/performance/baseline", { method: "GET" });
}

export async function resetStats(reason: string) {
  return apiRequest<StatsBaseline>("/admin/performance/reset", {
    method: "POST",
    body: JSON.stringify({ reason, confirm: true }),
  });
}

export async function restoreStats() {
  return apiRequest<StatsBaseline>("/admin/performance/restore", { method: "POST" });
}

export { appConfig };
