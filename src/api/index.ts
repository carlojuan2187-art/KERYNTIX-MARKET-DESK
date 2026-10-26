import type { User, MarketRegime, DerivativesData, WatchlistItem, CalendarEventItem, SignalState } from "./types";
import type { WatchlistMarketItem } from "./terminal";
import { apiRequest } from "./client";
import {
  getQuotes, normalizeSymbol, getRadarSnapshot, getPerformance,
  getLiquidationSummary, getMoversSnapshot, getOrderFlow, getOverview,
  getAlerts as getTerminalAlerts, getWatchlist as getTerminalWatchlist,
  addWatchlistSymbol, deleteWatchlistSymbol, getMarketRegime, getDerivativesData, getCalendar,
  patchUserAlertPreferences,
} from "./terminal";

export {
  loginPhone, verifyTelegramLink, verifyCode, startPayment, verifyPayment, getPaymentHistory,
  getAccountRestriction, startTelegramLink, unlinkTelegramAccount, logout,
} from "./account";
export {
  getRadarSnapshot as getRadar,
  getPerformance as getResults,
  getOrderFlow,
  getLiquidationSummary,
  getMoversSnapshot,
  getOverview,
  getQuotes,
  getQuote,
  searchSymbols,
} from "./terminal";
export { subscribeWs, emitWs } from "./events";
export type { WsEvent } from "./events";
export type { AssetQuote, Candle, FlowData, RadarOpportunity, OverviewData, Performance, LiquidationSummary, MoversSnapshot, AppNotification, SessionRecord, SupportTicket, WatchlistMarketItem, WatchlistTimeframeAnalysis, WatchlistTrendState } from "./terminal";

export async function getBillingPlans(): Promise<{ plans: { plan: string; price_usdt: string | null; duration_days: number; network: string; token: string; wallet: string | null; auto_verification: boolean }[]; payment_configured: boolean }> {
  return apiRequest("/billing/plans", { method: "GET" });
}
export async function getMe(): Promise<User> {
  return apiRequest<User>("/auth/me", { method: "GET" });
}
export async function updateProfile(patch: Partial<User>): Promise<User> {
  const allowedKeys = ["exchange", "tz", "risk_profile"] as const;
  const unsupported = Object.keys(patch).filter((key) => !allowedKeys.includes(key as (typeof allowedKeys)[number]));
  if (unsupported.length) throw new Error(`Estos campos no se pueden cambiar desde el perfil: ${unsupported.join(", ")}.`);
  return apiRequest<User>("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
}
export async function getSignals(): Promise<SignalState[]> { return apiRequest<SignalState[]>("/signals?limit=10", { method: "GET" }); }
export async function getSignal(id: string): Promise<SignalState> {
  return apiRequest<SignalState>(`/signals/${encodeURIComponent(normalizeSymbol(id))}`, { method: "GET" });
}
export async function getWatchlist(): Promise<WatchlistMarketItem[]> { return getTerminalWatchlist(); }
export async function addWatchlistItem(item: WatchlistItem): Promise<WatchlistMarketItem[]> { return addWatchlistSymbol(item.symbol); }
export async function removeWatchlistItem(symbol: string): Promise<WatchlistMarketItem[]> { return deleteWatchlistSymbol(symbol); }
export async function getRegime(): Promise<MarketRegime> { return getMarketRegime(); }
export async function getDerivatives(symbol = "BTCUSDT"): Promise<DerivativesData> {
  return getDerivativesData(symbol) as Promise<DerivativesData>;
}
export async function getCalendarEvents(view: 7 | 30 = 7): Promise<CalendarEventItem[]> {
  const rows = await getCalendar(view);
  return rows.map((row) => {
    const impact = String(row.impact ?? "").toLowerCase();
    const normalizedImpact: CalendarEventItem["impact"] = impact === "alto" || impact === "high" ? "alto" : impact === "medio" || impact === "medium" ? "medio" : "bajo";
    return { id: String(row.id ?? `${row.category ?? "event"}-${row.date ?? ""}`), title: String(row.title ?? ""), date: String(row.date ?? ""), impact: normalizedImpact, category: String(row.category ?? "EVENTO"), countdown: typeof row.countdown === "number" ? row.countdown : undefined };
  }).filter((row) => row.title.trim() && row.date.trim());
}
export interface TickData { symbol: string; price: number; change_pct: number | null }
export async function getTicks(symbols: string[]): Promise<TickData[]> {
  const rows = await getQuotes();
  return rows.filter((row) => symbols.includes(row.symbol)).map(({ symbol, price, change_pct }) => ({ symbol, price, change_pct }));
}
export async function getMarketSummary() {
  const [liquidations, movers, alerts] = await Promise.all([getLiquidationSummary(), getMoversSnapshot(), getTerminalAlerts()]);
  return {
    liquidations: liquidations.pairs.flatMap((row) => [
      ...(row.long_usdt > 0 ? [{ symbol: row.symbol, side: "long" as const, amount_usdt: row.long_usdt, timestamp: liquidations.updated_at }] : []),
      ...(row.short_usdt > 0 ? [{ symbol: row.symbol, side: "short" as const, amount_usdt: row.short_usdt, timestamp: liquidations.updated_at }] : []),
    ]),
    movers: [...movers.gainers, ...movers.losers].map((row) => ({ symbol: row.symbol, change_pct: row.change_pct, volume_ratio: row.volume_ratio, price: row.price })),
    alerts,
  };
}
export async function getAlerts() { return getTerminalAlerts(); }
export async function updateAlertPrefs(prefs: Partial<User["alert_prefs"]>) {
  return patchUserAlertPreferences(prefs as Partial<Record<string, boolean>>) as Promise<User["alert_prefs"]>;
}

export interface CalcInput { capital: number; risk_pct: number; entry: number; stop: number; tp1: number; tp2?: number; tp3?: number; direction?: "LONG" | "SHORT" }
export interface CalcResult {
  risk_usdt: number; qty: number; position_size: number; leverage_min: number; isolated_margin: number; liquidation_approx: number;
  fee_taker_pct: number; fees_usdt: number; direction: "LONG" | "SHORT";
  results: { level: string; price: number; r: number; usdt: number; fees_usdt: number; net_usdt: number }[];
}
export async function calculatePosition(input: CalcInput): Promise<CalcResult> {
  if (![input.capital, input.risk_pct, input.entry, input.stop, input.tp1].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Capital, riesgo y precios deben ser números mayores que cero.");
  }
  return apiRequest<CalcResult>("/calculator", { method: "POST", body: JSON.stringify(input) });
}

export { getReferralSummary as getReferrals, getAdminOverview as getAdminStats, getAdminUsers as getUsers, adminBanUser as banUser, adminUnbanUser as unbanUser, activatePremium } from "./account";
export { getReferralSummary, getAdminOverview, getAdminUsers, adminBanUser, adminUnbanUser } from "./account";
export { getNotifications, markNotificationRead, markAllNotificationsRead, getSessions, revokeSession, getTickets, createTicket } from "./terminal";
