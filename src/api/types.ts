export type PlanType = "free" | "premium";

export interface RiskProfile {
  capital: number; // USDT
  risk_pct: number; // Porcentaje: 1 = 1%.
}

export interface AlertPrefs {
  on: boolean;
  liq: boolean;
  mov: boolean;
  vol: boolean;
  signals?: boolean;
  price?: boolean;
  plans?: boolean;
  in_app?: boolean;
  telegram?: boolean;
  web_push?: boolean;
}

export interface WatchlistItem {
  symbol: string; // ej BTCUSDT
  name?: string;
}

export interface User {
  user_id: string;
  phone: string; // E.164
  telegram_chat_id?: string;
  username?: string;
  plan: PlanType;
  trial_end?: string; // ISO
  plan_end?: string; // ISO
  ref_code: string;
  referred_by?: string;
  ref_premium_valid: boolean;
  exchange?: string; // texto libre
  risk_profile: RiskProfile;
  watchlist: WatchlistItem[]; // max 10
  alert_prefs: AlertPrefs;
  tz: string; // ej America/Havana
  banned: boolean;
  ban_until?: string; // ISO
  banned_at?: string;
  banned_by?: string;
  created_at: string;
  last_activity: string;
  is_admin?: boolean;
}

export interface SignalState {
  // Legacy UI fields plus the canonical engine data returned by FastAPI.
  schema_version?: string;
  id?: string;
  visibility?: string;
  entry_zone?: { low: number; high: number; [key: string]: unknown };
  take_profits?: number[];
  targets?: Array<{ price: number; rr?: number | null; touches?: number | null; source?: string | null; [key: string]: unknown }>;
  scoring?: {
    raw_score?: number | null;
    normalized_score?: number | null;
    profile?: string | null;
    calibration?: string | null;
    components?: Array<{ name: string; points?: number | null; value?: number | null; passed?: boolean | null }>;
    raw_components?: Array<{ name: string; points?: number | null; value?: number | null; passed?: boolean | null }> | null;
    normalized_components?: Array<{ name: string; points?: number | null; value?: number | null; passed?: boolean | null }> | null;
  };
  strategy?: Record<string, unknown>;
  lifecycle?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  trade_metrics?: Record<string, unknown> | null;
  status: "PENDING" | "TOUCHED" | "CANCELLED";
  direction: "LONG" | "SHORT";
  symbol: string;
  entry_low?: number;
  entry_high?: number;
  entry_price?: number;
  stop_loss?: number;
  tp1?: number;
  tp2?: number | null;
  tp3?: number | null;
  score?: number | null; // 0-100
  score_breakdown?: Record<string, number>;
  leverage?: number | null;
  timeframes?: string[]; // ej ["15M","1H"]
  created_at: string;
  expires_at?: string | null;
  touched_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null; // ver motivos
  event?: SignalEvent | null;
  operation_result?: "OPEN" | "TP1_HIT" | "TP1" | "TP2" | "SL" | null;
  r_result?: number | null;
}

export interface SignalEvent {
  type: "new" | "touched" | "cancelled" | "tp1" | "tp2" | "sl" | "closed";
  result?: string | null; // TP1, TP2, SL
  r?: number | null;
  via?: string; // cómo se resolvió
}

export type CancelReason =
  | "ENTRY_NOT_TOUCHED"
  | "TP_REACHED_BEFORE_ENTRY"
  | "AMBIGUOUS_ENTRY_TP_ORDER"
  | "PRE_ENTRY_INVALIDATED"
  | "AMBIGUOUS_ENTRY_SL_ORDER"
  | "STALE_ENTRY_TOUCH"
  | "INVALID_GEOMETRY";

export interface LiquidationRow {
  symbol: string;
  side: "long" | "short";
  amount_usdt: number;
  timestamp: string;
}

export interface MoverRow {
  symbol: string;
  change_pct: number;
  volume_ratio: number; // x veces normal
  price: number;
}

export type MarketRegimeTimeframe = "15m" | "1h" | "4h";

export interface MarketRegimeTimeframeAnalysis {
  regime: "UP" | "DOWN" | "RANGE" | "TRANSITION" | "VOLATILE";
  strength: string;
  adx: number | null;
  atr_pct: number | null;
  vol_percentile: number | null;
  bandwidth_trend: string | null;
  rel_volume: number | null;
}

export interface MarketRegime {
  trend:
    | "TENDENCIA ALCISTA"
    | "TENDENCIA BAJISTA"
    | "RANGO"
    | "TRANSICIÓN"
    | "ALTA VOLATILIDAD";
  adx: number | null;
  atr_pct: number | null;
  bollinger_state?: string;
  volume_relative: number | null;
  funding_rate?: number | null;
  oi_value?: number | null;
  market_breadth?: number | null;
  session_now: string | null;
  updated_at: string;
  timeframes?: Partial<Record<MarketRegimeTimeframe, MarketRegimeTimeframeAnalysis>>;
}

export interface AlertItem {
  id: string;
  kind: "liq" | "mov" | "vol";
  key: string;
  text: string;
  title?: string;
  symbol?: string;
  focus?: string; // símbolo o contexto
  created_at: string;
}

export interface DerivativesData {
  symbol: string;
  funding_rate: number | null;
  funding_next: string | null;
  mark_index_delta: number | null;
  open_interest: number | null;
  oi_change_1h: number | null;
  oi_change_24h: number | null;
  long_short_ratio: {
    percent_long: number | null;
    percent_short: number | null;
    value_24h_ago?: number | null;
  };
  top_trader_ratio: { long: number | null; short: number | null };
  reading?: string;
  updated_at?: string;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string; // ISO
  impact: "alto" | "medio" | "bajo";
  category: string; // FOMC, CPI, etc.
  countdown?: number; // segundos restantes
}

export interface PaymentRecord {
  id: string;
  amount_usdt: string; // monto exacto enviado
  wallet_from?: string;
  status: "pending" | "verifying" | "confirmed" | "expired" | "failed";
  created_at: string;
  updated_at?: string;
  confirmations?: number;
}
