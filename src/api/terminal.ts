import type { AlertItem, MarketRegime, SignalState, User } from "./types";
import { apiRequest } from "./client";

export interface AssetQuote {
  symbol: string;
  name: string;
  price: number;
  /** Direction of the latest WebSocket price tick; independent from 24h change. */
  price_direction?: "up" | "down" | "unchanged";
  /** Browser receipt time of the latest WebSocket price tick, in epoch milliseconds. */
  price_tick_at?: number;
  change_pct: number | null;
  volume_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  funding_rate: number | null;
  open_interest: number | null;
  buy_pct: number | null;
  volume_ratio: number | null;
  /** Whether the volume ratio is calculated from exact candle statistics or estimated from price history. */
  volume_ratio_source?: "exact" | "estimated" | null;
  score: number | null;
  trend: { "15M": "up" | "down" | "flat" | null; "1H": "up" | "down" | "flat" | null; "4H": "up" | "down" | "flat" | null };
  sparkline: number[];
  liquidity_sweep: boolean | null;
}

export type WatchlistTrendState = "up" | "down" | "range" | "transition" | "volatile" | null;
export interface WatchlistTimeframeAnalysis {
  regime: string | null;
  strength: string | null;
  adx: number | null;
  plus_di: number | null;
  minus_di: number | null;
  close: number | null;
  ema20: number | null;
  ema50: number | null;
  above_ema200: boolean | null;
  ema50_slope_pct: number | null;
  atr_pct: number | null;
  vol_percentile: number | null;
  bandwidth_trend: string | null;
  rel_volume: number | null;
}
export interface WatchlistMarketItem {
  symbol: string;
  name: string;
  status: string;
  price: number | null;
  change_pct: number | null;
  volume_24h: number | null;
  funding_rate: number | null;
  trend: { "15M": WatchlistTrendState; "1H": WatchlistTrendState; "4H": WatchlistTrendState };
  analyses: { "15m": WatchlistTimeframeAnalysis | null; "1h": WatchlistTimeframeAnalysis | null; "4h": WatchlistTimeframeAnalysis | null };
  score: number | null;
  score_detail: { direction: string | null; lean: string | null; strength: string | null; score: number | null; signs: Record<string, number | null> } | null;
  liquidity_sweep: { direction: "LONG" | "SHORT"; minutes: number } | null;
  active_signal: { id: string; direction: "LONG" | "SHORT" | null; status: string; score: number | null; entry_price: number | null; entry_low?: number | null; entry_high?: number | null; stop_loss?: number | null; take_profits?: number[]; created_at: string | null } | null;
  data_updated_at: string | null;
}

export interface Candle { time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number; cvd: number }
export interface ClosedOperation { id: string; symbol: string; direction: "LONG" | "SHORT"; entry_price: number; exit_price: number | null; result: "TP1" | "TP2" | "SL"; r_result: number; touched_at: string; closed_at: string }
export interface Performance { operations: number; wins: number; losses: number; win_rate: number; total_r: number; average_r: number; best_r: number; worst_r: number; streak: number; curve: { date: string; r: number }[]; trades: ClosedOperation[] }
export interface LiquidationSummary {
  window: 5 | 15 | 60; long_usdt: number; short_usdt: number; total: number; orders: number; pace: number | null; usdt_per_min: number;
  pairs: { symbol: string; long_usdt: number; short_usdt: number }[];
  largest_order: { symbol: string; side: "LONG" | "SHORT"; amount_usdt: number; created_at: string } | null;
  reading: string; updated_at: string; status?: string; message?: string | null; coverage_complete?: boolean; connected?: boolean;
  coverage_seconds?: number | null; last_event_at?: string | null; source?: string | null;
}
export interface FlowQuality {
  history_candles: number | null;
  closed_candles: number | null;
  history_minutes: number | null;
  history_hours: number | null;
  required_candles_for_4h_volume_baseline: number | null;
  volume_ratio_4h_ready: boolean;
  last_closed_candle_at: string | null;
  last_closed_age_seconds: number | null;
  coverage_complete: boolean;
  message: string | null;
}
export interface PriceCvdContext {
  status: string;
  label: string;
  price_change_pct: number | null;
  delta_usdt: number | null;
  delta_share_pct: number | null;
  lookback_candles: number | null;
  message: string;
}
export interface FlowData { symbol: string; windows: { label: "15m" | "1h" | "4h"; buy_pct: number | null; delta: number | null; delta_usdt: number | null; price: number | null; change_pct: number | null; volume_ratio: number | null; volume_usdt: number | null }[]; cvd: Candle[]; volume_ratio: number | null; reading: string; updated_at?: string; status?: string; source?: string; quality?: FlowQuality; price_cvd?: PriceCvdContext }
export interface OrderBookLevel { price: number; quantity: number; notional_usdt: number }
export interface OrderBookData {
  symbol: string; limit: number; last_update_id: number; best_bid: number; best_ask: number; mid_price: number;
  spread: number; spread_pct: number | null; bid_depth_usdt: number; ask_depth_usdt: number;
  bid_share_pct: number | null; imbalance_pct: number | null; bids: OrderBookLevel[]; asks: OrderBookLevel[];
  levels_returned: number; source: string; status: string; updated_at: string;
}
export type RadarTrendState = "up" | "down" | "flat" | "range" | "transition" | "volatile" | null;
export interface RadarTimeframeTrend {
  "15M": RadarTrendState;
  "1H": RadarTrendState;
  "4H": RadarTrendState;
}

export interface RadarOpportunity {
  symbol: string;
  kind: "setup" | "sweep" | "watch" | "move";
  label: string;
  direction: "LONG" | "SHORT" | null;
  score: number | null;
  detail: string;
  score_breakdown: Record<string, number>;
  created_at: string;
  snapshot_updated_at?: string | null;
  scanned_symbols?: number | null;
  snapshot_status?: string | null;
  status?: string | null;
  visibility?: string | null;
  current_price?: number | null;
  change_24h_pct?: number | null;
  volume_24h?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  funding_rate?: number | null;
  open_interest?: number | null;
  buy_pct?: number | null;
  quote_volume_ratio?: number | null;
  trend?: RadarTimeframeTrend | null;
  entry_price?: number | null;
  entry_zone?: { low: number | null; high: number | null } | null;
  stop_loss?: number | null;
  take_profits?: number[];
  entry_expires_at?: string | null;
  touched_at?: string | null;
  liquidity_sweep_extreme_price?: number | null;
  atr_value?: number | null;
  level?: number | null;
  extreme_price?: number | null;
  wick_ratio?: number | null;
  sweep_distance_atr?: number | null;
  atr_pct?: number | null;
  rel_volume?: number | null;
  trend_1h?: string | null;
  alignment?: string | null;
  alignment_detail?: string | null;
  distance_pct?: number | null;
  distance_atr?: number | null;
  zone_count?: number | null;
  change_1h_pct?: number | null;
  volume_ratio?: number | null;
}
export interface OverviewData { quotes: AssetQuote[]; signals: SignalState[]; regime: MarketRegime; performance: Performance; liquidations: LiquidationSummary; alerts: AlertItem[]; radar: RadarOpportunity[]; breadth: { up: number | null; down: number | null; total: number | null }; breadth_pct: number | null; updated_at: string }

export function regimeContext(regime: MarketRegime) {
  const states = {
    "TENDENCIA ALCISTA": { label: "Tendencia alcista", color: "var(--green)", reading: "Los datos del régimen muestran una tendencia alcista." },
    "TENDENCIA BAJISTA": { label: "Tendencia bajista", color: "var(--red)", reading: "Los datos del régimen muestran una tendencia bajista." },
    RANGO: { label: "Mercado en rango", color: "var(--amber)", reading: "Los datos del régimen muestran un mercado en rango." },
    TRANSICIÓN: { label: "En transición", color: "var(--blue)", reading: "Los datos del régimen indican una transición." },
    "ALTA VOLATILIDAD": { label: "Alta volatilidad", color: "var(--amber)", reading: "Los datos del régimen indican alta volatilidad." },
  };
  const result = states[regime.trend];
  const adx = typeof regime.adx === "number" ? regime.adx : null;
  return { ...result, strength: adx == null ? "Sin datos" : adx >= 25 ? "Fuerte" : adx >= 20 ? "Moderada" : "Débil" };
}

export function normalizeSymbol(value: string) {
  const normalized = value.toUpperCase().replace(/[\s/\-]/g, "");
  return normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
function str(value: unknown): string { return typeof value === "string" ? value : ""; }
function direction(value: unknown): "LONG" | "SHORT" { return String(value).toUpperCase() === "SHORT" ? "SHORT" : "LONG"; }
function directionOrNull(value: unknown): "LONG" | "SHORT" | null { const d = String(value ?? "").toUpperCase(); return d === "LONG" || d === "SHORT" ? d : null; }
function record(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function normalizeRadarTrend(value: unknown): RadarTrendState {
  const trend = String(value ?? "").trim().toLowerCase();
  if (["up", "uptrend", "bullish", "alcista"].includes(trend)) return "up";
  if (["down", "downtrend", "bearish", "bajista"].includes(trend)) return "down";
  if (["flat", "mixed", "range", "rango", "mixta"].includes(trend)) return trend === "flat" ? "flat" : "range";
  if (["transition", "transicion", "transición"].includes(trend)) return "transition";
  if (["volatile", "volatil", "volátil", "alta volatilidad"].includes(trend)) return "volatile";
  return null;
}

const featured = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "AVAXUSDT", "XRPUSDT", "DOGEUSDT", "LINKUSDT", "1000PEPEUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "APTUSDT", "NEARUSDT", "TIAUSDT", "WIFUSDT", "ADAUSDT"];
export async function getQuotes(): Promise<AssetQuote[]> {
  const data = await apiRequest<AssetQuote[]>("/market/quotes", { method: "GET" });
  const rank = new Map(featured.map((symbol, i) => [symbol, i] as const));
  return [...data].sort((a, b) => {
    const ai = rank.get(a.symbol), bi = rank.get(b.symbol);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return (b.volume_24h ?? 0) - (a.volume_24h ?? 0);
  });
}
export async function searchSymbols(query: string): Promise<AssetQuote[]> {
  const params = new URLSearchParams({ query: query.trim(), limit: "100" });
  return apiRequest<AssetQuote[]>(`/symbols?${params.toString()}`, { method: "GET" });
}
export async function getQuote(symbol: string): Promise<AssetQuote> {
  return apiRequest<AssetQuote>(`/symbols/${encodeURIComponent(normalizeSymbol(symbol))}`, { method: "GET" });
}
export async function getCandles(symbol = "BTCUSDT", timeframe = "1h", timezone?: string, limit = 300): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol: normalizeSymbol(symbol), timeframe, limit: String(Math.max(1, Math.min(500, Math.floor(limit)))) });
  if (timezone) params.set("tz", timezone);
  return apiRequest<Candle[]>(`/market/candles?${params.toString()}`, { method: "GET" });
}

function mapClosedResult(row: Record<string, any>): ClosedOperation | null {
  const result = String(row.result ?? row.operation_result ?? "").toUpperCase();
  if (!(result === "TP1" || result === "TP2" || result === "SL")) return null;
  const entry = numberOrNull(row.entry_fill ?? row.entry_price ?? row.entry_zone?.low);
  const exit = numberOrNull(row.exit_price ?? (result === "TP1" ? row.take_profits?.[0] : result === "TP2" ? row.take_profits?.[1] : row.stop_loss));
  const closed = str(row.closed_at ?? row.touched_at ?? row.created_at);
  const rResult = numberOrNull(row.r_real ?? row.r_result);
  if (entry == null || rResult == null || !closed) return null;
  return {
    id: str(row.id ?? row.signal_id ?? `${row.symbol ?? "signal"}-${closed}`),
    symbol: str(row.symbol), direction: direction(row.direction), entry_price: entry, exit_price: exit,
    result, r_result: rResult,
    touched_at: str(row.touched_at ?? row.created_at), closed_at: closed,
  };
}
export async function getPerformance(period = "month"): Promise<Performance> {
  const rows = await apiRequest<Record<string, any>[]>("/signals/results?limit=100", { method: "GET" });
  const now = Date.now();
  const span = period === "day" ? 86400000 : period === "week" ? 7 * 86400000 : period === "all" ? Infinity : 30 * 86400000;
  const trades = rows.map(mapClosedResult).filter((x): x is ClosedOperation => Boolean(x)).filter((x) => {
    if (!Number.isFinite(span)) return true;
    const time = Date.parse(x.closed_at);
    return Number.isFinite(time) && now - time <= span;
  }).sort((a, b) => Date.parse(a.closed_at) - Date.parse(b.closed_at));
  const wins = trades.filter((x) => x.result === "TP1" || x.result === "TP2").length;
  const losses = trades.length - wins;
  const rs = trades.map((x) => x.r_result);
  let running = 0;
  const byDate = new Map<string, number>();
  for (const trade of trades) {
    running += trade.r_result;
    const date = trade.closed_at.slice(0, 10);
    byDate.set(date, running);
  }
  let streak = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    const isWin = trades[i].r_result > 0;
    if (i === trades.length - 1) streak = isWin ? 1 : -1;
    else if ((streak > 0 && isWin) || (streak < 0 && !isWin)) streak += isWin ? 1 : -1;
    else break;
  }
  return {
    operations: trades.length, wins, losses, win_rate: trades.length ? wins / trades.length * 100 : 0,
    total_r: rs.reduce((a, b) => a + b, 0), average_r: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0,
    best_r: rs.length ? Math.max(...rs) : 0, worst_r: rs.length ? Math.min(...rs) : 0, streak,
    curve: [...byDate.entries()].map(([date, r]) => ({ date, r })), trades: [...trades].reverse(),
  };
}

export async function getLiquidationSummary(window: 5 | 15 | 60 = 15): Promise<LiquidationSummary> {
  const raw = await apiRequest<Record<string, any>>(`/market/liquidations?window=${window}`, { method: "GET" });
  const long = numberOrNull(raw.long_usd) ?? 0, short = numberOrNull(raw.short_usd) ?? 0;
  const biggest = record(raw.biggest);
  const sideRaw = String(biggest.side ?? "").toUpperCase();
  const timestamp = numberOrNull(biggest.timestamp);
  const amount = numberOrNull(biggest.amount_usdt);
  const bySymbol = record(raw.by_symbol);
  const pairs = Object.entries(bySymbol).map(([symbol, values]) => {
    const row = record(values);
    return { symbol, long_usdt: numberOrNull(row.long) ?? 0, short_usdt: numberOrNull(row.short) ?? 0 };
  }).sort((a, b) => (b.long_usdt + b.short_usdt) - (a.long_usdt + a.short_usdt));
  const interpretation = Array.isArray(raw.interpretation) ? raw.interpretation.filter((x) => typeof x === "string").join(" ") : "";
  return {
    window, long_usdt: long, short_usdt: short, total: numberOrNull(raw.total) ?? long + short,
    orders: (numberOrNull(raw.long_n) ?? 0) + (numberOrNull(raw.short_n) ?? 0),
    pace: numberOrNull(raw.pace), usdt_per_min: numberOrNull(raw.per_min) ?? 0, pairs,
    largest_order: str(biggest.symbol) && amount != null && (sideRaw === "LONG" || sideRaw === "SHORT") ? { symbol: str(biggest.symbol), side: sideRaw, amount_usdt: amount, created_at: timestamp != null ? new Date(timestamp * 1000).toISOString() : "" } : null,
    reading: interpretation, updated_at: str(raw.updated_at), status: str(raw.status), message: typeof raw.message === "string" ? raw.message : null,
    coverage_complete: Boolean(raw.coverage_complete), connected: Boolean(raw.connected),
    coverage_seconds: numberOrNull(raw.coverage_seconds), last_event_at: str(raw.last_event_at) || null, source: str(raw.source) || null,
  };
}
export async function getOrderFlow(symbol = "BTCUSDT"): Promise<FlowData> {
  const raw = await apiRequest<Record<string, any>>(`/market/flow?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`, { method: "GET" });
  const validLabels = new Set(["15m", "1h", "4h"]);
  const windows = (Array.isArray(raw.windows) ? raw.windows : []).filter((row: any) => validLabels.has(String(row.label))).map((row: any) => ({
    label: row.label as "15m" | "1h" | "4h", buy_pct: numberOrNull(row.buy_pct),
    delta: numberOrNull(row.delta), delta_usdt: numberOrNull(row.delta_usdt),
    price: numberOrNull(row.price), change_pct: numberOrNull(row.change_pct),
    volume_ratio: numberOrNull(row.volume_ratio), volume_usdt: numberOrNull(row.volume_usdt),
  }));
  const quality = record(raw.quality);
  const priceCvd = record(raw.price_cvd);
  return {
    symbol: str(raw.symbol) || normalizeSymbol(symbol), windows, cvd: Array.isArray(raw.cvd) ? raw.cvd : [],
    volume_ratio: numberOrNull(raw.volume_ratio), reading: str(raw.reading), updated_at: str(raw.updated_at),
    status: str(raw.status), source: str(raw.source),
    quality: Object.keys(quality).length ? {
      history_candles: numberOrNull(quality.history_candles), closed_candles: numberOrNull(quality.closed_candles),
      history_minutes: numberOrNull(quality.history_minutes), history_hours: numberOrNull(quality.history_hours),
      required_candles_for_4h_volume_baseline: numberOrNull(quality.required_candles_for_4h_volume_baseline),
      volume_ratio_4h_ready: Boolean(quality.volume_ratio_4h_ready), last_closed_candle_at: str(quality.last_closed_candle_at) || null,
      last_closed_age_seconds: numberOrNull(quality.last_closed_age_seconds), coverage_complete: Boolean(quality.coverage_complete),
      message: str(quality.message) || null,
    } : undefined,
    price_cvd: Object.keys(priceCvd).length ? {
      status: str(priceCvd.status), label: str(priceCvd.label), price_change_pct: numberOrNull(priceCvd.price_change_pct),
      delta_usdt: numberOrNull(priceCvd.delta_usdt), delta_share_pct: numberOrNull(priceCvd.delta_share_pct),
      lookback_candles: numberOrNull(priceCvd.lookback_candles), message: str(priceCvd.message),
    } : undefined,
  };
}

export async function getOrderBook(symbol = "BTCUSDT", limit = 20): Promise<OrderBookData> {
  const raw = await apiRequest<Record<string, any>>(`/market/orderbook?symbol=${encodeURIComponent(normalizeSymbol(symbol))}&limit=${limit}`, { method: "GET" });
  const parseLevels = (value: unknown): OrderBookLevel[] => (Array.isArray(value) ? value : []).flatMap((item: any) => {
    const row = record(item);
    const price = numberOrNull(row.price), quantity = numberOrNull(row.quantity), notional = numberOrNull(row.notional_usdt);
    return price != null && quantity != null && notional != null ? [{ price, quantity, notional_usdt: notional }] : [];
  });
  return {
    symbol: str(raw.symbol) || normalizeSymbol(symbol), limit: numberOrNull(raw.limit) ?? limit,
    last_update_id: numberOrNull(raw.last_update_id) ?? 0, best_bid: numberOrNull(raw.best_bid) ?? 0,
    best_ask: numberOrNull(raw.best_ask) ?? 0, mid_price: numberOrNull(raw.mid_price) ?? 0,
    spread: numberOrNull(raw.spread) ?? 0, spread_pct: numberOrNull(raw.spread_pct),
    bid_depth_usdt: numberOrNull(raw.bid_depth_usdt) ?? 0, ask_depth_usdt: numberOrNull(raw.ask_depth_usdt) ?? 0,
    bid_share_pct: numberOrNull(raw.bid_share_pct), imbalance_pct: numberOrNull(raw.imbalance_pct),
    bids: parseLevels(raw.bids), asks: parseLevels(raw.asks), levels_returned: numberOrNull(raw.levels_returned) ?? 0,
    source: str(raw.source), status: str(raw.status), updated_at: str(raw.updated_at),
  };
}

function scoreBreakdown(values: unknown): Record<string, number> {
  if (Array.isArray(values)) return Object.fromEntries(values.flatMap((row: any) => typeof row?.name === "string" && typeof row?.points === "number" ? [[row.name, row.points]] : []));
  return {};
}
export async function getRadarSnapshot(): Promise<RadarOpportunity[]> {
  const [raw, quotes] = await Promise.all([
    apiRequest<Record<string, any>>("/radar", { method: "GET" }),
    getQuotes().catch((): AssetQuote[] => []),
  ]);
  const items: RadarOpportunity[] = [];
  const quoteBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const cachedPrices = record(raw.prices);
  const fundingBySymbol = record(raw.funding);
  const timeframeTrendsBySymbol = record(raw.timeframe_trends);
  const quoteContext = (symbol: string, preferredPrice?: unknown) => {
    const quote = quoteBySymbol.get(symbol);
    const trendPayload = record(timeframeTrendsBySymbol[symbol]);
    const trend = Object.keys(trendPayload).length > 0
      ? {
          "15M": normalizeRadarTrend(trendPayload["15M"]),
          "1H": normalizeRadarTrend(trendPayload["1H"]),
          "4H": normalizeRadarTrend(trendPayload["4H"]),
        }
      : quote?.trend ?? null;
    return {
      current_price: quote?.price ?? numberOrNull(preferredPrice) ?? numberOrNull(cachedPrices[symbol]) ?? null,
      change_24h_pct: quote?.change_pct ?? null,
      volume_24h: quote?.volume_24h ?? null,
      high_24h: quote?.high_24h ?? null,
      low_24h: quote?.low_24h ?? null,
      funding_rate: quote?.funding_rate ?? numberOrNull(fundingBySymbol[symbol]),
      open_interest: quote?.open_interest ?? null,
      buy_pct: quote?.buy_pct ?? null,
      quote_volume_ratio: quote?.volume_ratio ?? null,
      trend,
    };
  };
  const takeProfits = (value: unknown): number[] => Array.isArray(value)
    ? value.flatMap((target: any) => {
        const numeric = numberOrNull(target) ?? numberOrNull(record(target).price);
        return numeric == null ? [] : [numeric];
      })
    : [];
  const entryZone = (value: unknown): RadarOpportunity["entry_zone"] => {
    const zone = record(value);
    if (numberOrNull(zone.low) == null && numberOrNull(zone.high) == null) return null;
    return { low: numberOrNull(zone.low), high: numberOrNull(zone.high) };
  };

  for (const setup of Array.isArray(raw.setups) ? raw.setups : []) {
    const symbol = str(setup.symbol);
    items.push({
      symbol, kind: "setup", label: "Setup activo", direction: directionOrNull(setup.direction),
      score: numberOrNull(setup.score), detail: `Estado: ${str(setup.status) || "sin estado"}.`,
      score_breakdown: scoreBreakdown(setup.components), created_at: str(setup.created_at),
      status: str(setup.status) || null, visibility: str(setup.visibility) || null,
      ...quoteContext(symbol), entry_price: numberOrNull(setup.entry_price), entry_zone: entryZone(setup.entry_zone),
      stop_loss: numberOrNull(setup.stop_loss), take_profits: takeProfits(setup.take_profits),
      entry_expires_at: str(setup.entry_expires_at) || null, touched_at: str(setup.touched_at) || null,
      liquidity_sweep_extreme_price: numberOrNull(setup.liquidity_sweep_extreme_price), atr_value: numberOrNull(setup.atr_value),
    });
  }
  for (const sweep of Array.isArray(raw.sweeps) ? raw.sweeps : []) {
    const symbol = str(sweep.symbol);
    const eventEpoch = numberOrNull(sweep.event_ts);
    const createdAt = str(sweep.event_at) || (eventEpoch != null ? new Date(eventEpoch * 1000).toISOString() : str(raw.updated_at));
    const alignment = record(sweep.alignment);
    items.push({
      symbol, kind: "sweep", label: "Barrido detectado", direction: directionOrNull(sweep.direction),
      score: numberOrNull(sweep.score),
      detail: [sweep.level != null ? `Nivel barrido: ${sweep.level}` : "", sweep.wick_ratio != null ? `Mecha: ${sweep.wick_ratio}x` : "", alignment.status ? `Alineación: ${alignment.status}` : ""].filter(Boolean).join(" · "),
      score_breakdown: scoreBreakdown(sweep.components), created_at: createdAt,
      ...quoteContext(symbol, sweep.price), level: numberOrNull(sweep.level), extreme_price: numberOrNull(sweep.extreme_price),
      wick_ratio: numberOrNull(sweep.wick_ratio), sweep_distance_atr: numberOrNull(sweep.sweep_distance_atr),
      rel_volume: numberOrNull(sweep.rel_volume), atr_pct: numberOrNull(sweep.atr_pct),
      trend_1h: str(sweep.trend_1h) || null, alignment: str(alignment.status) || null, alignment_detail: str(alignment.text) || null,
    });
  }
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    for (const watch of Array.isArray(item.watch) ? item.watch : []) {
      const symbol = str(watch.symbol ?? item.symbol);
      const alignment = typeof watch.alignment === "string" ? watch.alignment : str(record(watch.alignment).status);
      items.push({
        symbol, kind: "watch", label: "Zona en vigilancia", direction: directionOrNull(watch.direction),
        score: numberOrNull(watch.watch_score),
        detail: [watch.distance_pct != null ? `Distancia a zona: ${watch.distance_pct}%` : "", watch.zone_count != null ? `Zonas: ${watch.zone_count}` : "", alignment ? `Alineación: ${alignment}` : ""].filter(Boolean).join(" · "),
        score_breakdown: {}, created_at: str(raw.updated_at),
        ...quoteContext(symbol, item.price), level: numberOrNull(watch.level), distance_pct: numberOrNull(watch.distance_pct),
        distance_atr: numberOrNull(watch.distance_atr), zone_count: numberOrNull(watch.zone_count),
        rel_volume: numberOrNull(watch.rel_volume ?? item.rel_volume), atr_pct: numberOrNull(item.atr_pct),
        trend_1h: str(watch.trend_1h ?? item.trend_1h) || null, alignment: alignment || null,
      });
    }
  }
  const scannerItems = Array.isArray(raw.items) ? raw.items : [];
  const scannerBySymbol = new Map(scannerItems.map((item: any) => [str(item.symbol), item]));
  for (const move of Array.isArray(raw.movers) ? raw.movers : []) {
    const symbol = str(move.symbol);
    const scannerItem = record(scannerBySymbol.get(symbol));
    items.push({
      symbol, kind: "move", label: "Movimiento detectado", direction: null, score: numberOrNull(move.score),
      detail: [move.change_1h_pct != null ? `Variación 1h: ${move.change_1h_pct}%` : "", move.vol_ratio != null ? `Volumen relativo: ${move.vol_ratio}x` : ""].filter(Boolean).join(" · "),
      score_breakdown: {}, created_at: str(move.created_at ?? raw.updated_at),
      ...quoteContext(symbol, scannerItem.price), change_1h_pct: numberOrNull(move.change_1h_pct), volume_ratio: numberOrNull(move.vol_ratio),
      atr_pct: numberOrNull(scannerItem.atr_pct), rel_volume: numberOrNull(scannerItem.rel_volume), trend_1h: str(scannerItem.trend_1h) || null,
    });
  }
  return items.filter((x) => x.symbol).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((item) => ({
    ...item, snapshot_updated_at: str(raw.updated_at) || null,
    scanned_symbols: numberOrNull(raw.scanned), snapshot_status: str(raw.status) || null,
  }));
}

export interface MoversSnapshot { window: 5 | 15 | 60; gainers: AssetQuote[]; losers: AssetQuote[]; volume_flat: AssetQuote[]; btc_change_pct: number | null; breadth_pct: number | null; breadth: { up: number | null; down: number | null; total: number | null }; reading: string; updated_at: string; status?: string; message?: string | null; collected_minutes?: number | null; required_minutes?: number | null; eligible_count?: number | null; source?: string | null }
export async function getMoversSnapshot(window: 5 | 15 | 60 = 15): Promise<MoversSnapshot> {
  const [raw, quotes] = await Promise.all([
    apiRequest<Record<string, any>>(`/market/movers?window=${window}`, { method: "GET" }), getQuotes(),
  ]);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const toQuote = (entry: any): AssetQuote | null => {
    const base = bySymbol.get(str(entry.symbol));
    const price = numberOrNull(entry.price) ?? base?.price;
    if (!price || !str(entry.symbol)) return null;
    return {
      symbol: str(entry.symbol), name: base?.name ?? str(entry.symbol), price,
      change_pct: numberOrNull(entry.change_pct), volume_24h: numberOrNull(entry.qvol_24h) ?? base?.volume_24h ?? null,
      high_24h: base?.high_24h ?? null, low_24h: base?.low_24h ?? null,
      funding_rate: base?.funding_rate ?? null, open_interest: base?.open_interest ?? null,
      buy_pct: numberOrNull(entry.buy_pct) ?? base?.buy_pct ?? null, volume_ratio: numberOrNull(entry.volume_ratio) ?? base?.volume_ratio ?? null,
      volume_ratio_source: entry.volume_ratio == null ? null : entry.volume_exact === true ? "exact" : "estimated",
      score: base?.score ?? null, trend: base?.trend ?? { "15M": null, "1H": null, "4H": null }, sparkline: base?.sparkline ?? [], liquidity_sweep: base?.liquidity_sweep ?? null,
    };
  };
  const mapGroup = (key: string) => (Array.isArray(raw[key]) ? raw[key] : []).map(toQuote).filter((q: AssetQuote | null): q is AssetQuote => q != null);
  const breadth = record(raw.breadth);
  const btc = record(raw.btc);
  const up = numberOrNull(breadth.up), down = numberOrNull(breadth.down), total = numberOrNull(breadth.total);
  return { window, gainers: mapGroup("gainers"), losers: mapGroup("losers"), volume_flat: mapGroup("flat_volume"), btc_change_pct: numberOrNull(btc.change_pct), breadth_pct: up != null && total != null && total > 0 ? up / total * 100 : null,
    breadth: { up, down, total }, reading: str(raw.message), updated_at: str(raw.updated_at), status: str(raw.status), message: typeof raw.message === "string" ? raw.message : null,
    collected_minutes: numberOrNull(raw.collected_minutes), required_minutes: numberOrNull(raw.required_minutes), eligible_count: numberOrNull(raw.eligible_count), source: str(raw.source) || null };
}

export interface AppNotification { id: string; title: string; text: string; created_at: string; read: boolean; href: string }
export async function getNotifications(): Promise<AppNotification[]> {
  const response = await apiRequest<{ items: Record<string, any>[] }>("/notifications?limit=100", { method: "GET" });
  return (response.items || []).map((item) => {
    const kind = str(item.kind).toLowerCase();
    const symbol = str(item.symbol || item.metadata?.symbol);
    const href = symbol ? `/mercado/flujo/${encodeURIComponent(symbol)}` : kind.includes("signal") ? "/signals" : kind.includes("payment") || kind.includes("plan") ? "/planes" : "/mercado";
    return { id: str(item.id), title: str(item.title), text: str(item.message), created_at: str(item.created_at), read: Boolean(item.read_at), href };
  });
}
export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}
export async function markAllNotificationsRead(): Promise<void> { await apiRequest("/notifications/read-all", { method: "POST" }); }

export interface SessionRecord { id: string; device: string; location: string; current: boolean; last_activity: string }
export async function getSessions(): Promise<SessionRecord[]> { return apiRequest<SessionRecord[]>("/sessions", { method: "GET" }); }
export async function revokeSession(id: string): Promise<void> { await apiRequest(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); }

export interface SupportTicket { id: string; subject: string; message: string; created_at: string; status: "Abierto" | "En curso" | "Esperando respuesta" | "Cerrado" }
function mapTicket(raw: Record<string, any>): SupportTicket {
  const statuses: Record<string, SupportTicket["status"]> = { open: "Abierto", in_progress: "En curso", waiting_user: "Esperando respuesta", closed: "Cerrado" };
  const firstMessage = Array.isArray(raw.messages) ? raw.messages.find((x: any) => x.sender_role === "user") ?? raw.messages[0] : null;
  return { id: str(raw.ticket_id ?? raw.id), subject: str(raw.subject), message: str(firstMessage?.message), created_at: str(raw.created_at), status: statuses[str(raw.status)] ?? "Abierto" };
}
export async function getTickets(): Promise<SupportTicket[]> {
  const result = await apiRequest<{ items: Record<string, any>[] }>("/support/tickets?limit=100", { method: "GET" });
  return (result.items || []).map(mapTicket);
}
export async function createTicket(subject: string, message: string): Promise<SupportTicket> {
  if (subject.trim().length < 5 || message.trim().length < 10) throw new Error("El asunto debe tener al menos 5 caracteres y el mensaje al menos 10.");
  return mapTicket(await apiRequest<Record<string, any>>("/support/tickets", { method: "POST", body: JSON.stringify({ subject: subject.trim(), message: message.trim() }) }));
}

export async function getAlerts(): Promise<AlertItem[]> {
  const result = await apiRequest<{ items: Record<string, any>[] }>("/notifications?limit=100", { method: "GET" });
  return (result.items || []).map((item) => {
    const kindText = `${str(item.kind)} ${str(item.title)}`.toLowerCase();
    const kind: AlertItem["kind"] = kindText.includes("liq") || kindText.includes("liquid") ? "liq" : kindText.includes("mov") || kindText.includes("price") ? "mov" : "vol";
    return { id: str(item.id), kind, key: str(item.event_id || item.id), text: str(item.message), title: str(item.title) || undefined, symbol: str(item.symbol || item.metadata?.symbol) || undefined, focus: str(item.symbol || item.metadata?.symbol) || undefined, created_at: str(item.created_at) };
  });
}
export async function getMarketSummary(): Promise<{ liquidations: { symbol: string; side: "long" | "short"; amount_usdt: number; timestamp: string }[]; movers: { symbol: string; change_pct: number | null; volume_ratio: number | null; price: number }[]; alerts: AlertItem[] }> {
  const [liquidations, movers, alerts] = await Promise.all([getLiquidationSummary(), getMoversSnapshot(), getAlerts()]);
  return { liquidations: liquidations.pairs.flatMap((x) => [
    ...(x.long_usdt > 0 ? [{ symbol: x.symbol, side: "long" as const, amount_usdt: x.long_usdt, timestamp: liquidations.updated_at }] : []),
    ...(x.short_usdt > 0 ? [{ symbol: x.symbol, side: "short" as const, amount_usdt: x.short_usdt, timestamp: liquidations.updated_at }] : []),
  ]), movers: [...movers.gainers, ...movers.losers].map((q) => ({ symbol: q.symbol, change_pct: q.change_pct, volume_ratio: q.volume_ratio, price: q.price })), alerts };
}

export async function getOverview(): Promise<OverviewData> {
  const [quotes, signals, regime, performance, liquidations, alerts, radar, moverSnapshot] = await Promise.all([
    getQuotes(), apiRequest<SignalState[]>("/signals?limit=10", { method: "GET" }),
    apiRequest<MarketRegime>("/market/regime", { method: "GET" }), getPerformance(), getLiquidationSummary(), getAlerts(), getRadarSnapshot(), getMoversSnapshot(),
  ]);
  return { quotes, signals: signals.filter((x) => x.status !== "CANCELLED"), regime, performance, liquidations, alerts, radar,
    breadth: moverSnapshot.breadth, breadth_pct: moverSnapshot.breadth_pct, updated_at: moverSnapshot.updated_at };
}

export async function getSessionsForCurrentUser(): Promise<SessionRecord[]> { return getSessions(); }
function watchlistTrend(value: unknown): WatchlistTrendState {
  const regime = String(value ?? "").trim().toUpperCase();
  if (["UP", "BULLISH", "ALCISTA"].includes(regime)) return "up";
  if (["DOWN", "BEARISH", "BAJISTA"].includes(regime)) return "down";
  if (["RANGE", "FLAT", "NEUTRAL", "LATERAL"].includes(regime)) return "range";
  if (["TRANSITION", "TRANSICION", "TRANSICIÓN"].includes(regime)) return "transition";
  if (["VOLATILE", "VOLATIL", "VOLÁTIL", "HIGH_VOLATILITY"].includes(regime)) return "volatile";
  return null;
}
function mapWatchlistAnalysis(value: unknown): WatchlistTimeframeAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = record(value);
  return {
    regime: str(row.regime) || null, strength: str(row.strength) || null,
    adx: numberOrNull(row.adx), plus_di: numberOrNull(row.plus_di), minus_di: numberOrNull(row.minus_di),
    close: numberOrNull(row.close), ema20: numberOrNull(row.ema20), ema50: numberOrNull(row.ema50),
    above_ema200: typeof row.above_ema200 === "boolean" ? row.above_ema200 : null,
    ema50_slope_pct: numberOrNull(row.ema50_slope_pct), atr_pct: numberOrNull(row.atr_pct),
    vol_percentile: numberOrNull(row.vol_percentile), bandwidth_trend: str(row.bandwidth_trend) || null,
    rel_volume: numberOrNull(row.rel_volume),
  };
}
function mapWatchlistRow(value: Record<string, any>): WatchlistMarketItem | null {
  const symbol = str(value.symbol).toUpperCase();
  if (!symbol) return null;
  const rawAnalyses = record(value.analyses);
  const analyses = {
    "15m": mapWatchlistAnalysis(rawAnalyses["15m"]),
    "1h": mapWatchlistAnalysis(rawAnalyses["1h"]),
    "4h": mapWatchlistAnalysis(rawAnalyses["4h"]),
  };
  const rawTrend = record(value.trend);
  const sweepRaw = value.liquidity_sweep;
  const sweepRow = record(sweepRaw);
  const sweepDirection = String(sweepRow.direction ?? "").toUpperCase();
  const liquiditySweep = (sweepDirection === "LONG" || sweepDirection === "SHORT")
    ? { direction: sweepDirection as "LONG" | "SHORT", minutes: numberOrNull(sweepRow.minutes) ?? 0 }
    : null;
  const signalRaw = record(value.active_signal);
  const signalDirection = String(signalRaw.direction ?? "").toUpperCase();
  const activeSignal = Object.keys(signalRaw).length ? {
    id: str(signalRaw.id), direction: signalDirection === "LONG" || signalDirection === "SHORT" ? signalDirection as "LONG" | "SHORT" : null,
    status: str(signalRaw.status), score: numberOrNull(signalRaw.score), entry_price: numberOrNull(signalRaw.entry_price),
    entry_low: numberOrNull(signalRaw.entry_low ?? record(signalRaw.entry_zone).low),
    entry_high: numberOrNull(signalRaw.entry_high ?? record(signalRaw.entry_zone).high),
    stop_loss: numberOrNull(signalRaw.stop_loss),
    take_profits: (Array.isArray(signalRaw.take_profits) && signalRaw.take_profits.length ? signalRaw.take_profits : [signalRaw.tp1, signalRaw.tp2, signalRaw.tp3]).map(numberOrNull).filter((value: number | null): value is number => value != null && value > 0),
    created_at: str(signalRaw.created_at) || null,
  } : null;
  const scoreRaw = record(value.score_detail);
  const signsRaw = record(scoreRaw.signs);
  const scoreDetail = Object.keys(scoreRaw).length ? {
    direction: str(scoreRaw.direction) || null, lean: str(scoreRaw.lean) || null, strength: str(scoreRaw.strength) || null,
    score: numberOrNull(scoreRaw.score), signs: Object.fromEntries(Object.entries(signsRaw).map(([key, sign]) => [key, numberOrNull(sign)])),
  } : null;
  return {
    symbol, name: str(value.name) || symbol.replace(/USDT$/, ""), status: str(value.status) || "unknown",
    price: numberOrNull(value.price), change_pct: numberOrNull(value.change_pct), volume_24h: numberOrNull(value.volume_24h),
    funding_rate: numberOrNull(value.funding_rate),
    trend: { "15M": watchlistTrend(rawTrend["15M"] ?? analyses["15m"]?.regime), "1H": watchlistTrend(rawTrend["1H"] ?? analyses["1h"]?.regime), "4H": watchlistTrend(rawTrend["4H"] ?? analyses["4h"]?.regime) },
    analyses, score: numberOrNull(value.score), score_detail: scoreDetail, liquidity_sweep: liquiditySweep,
    active_signal: activeSignal, data_updated_at: str(value.data_updated_at) || null,
  };
}
export async function getWatchlist(): Promise<WatchlistMarketItem[]> {
  const result = await apiRequest<{ items: Record<string, any>[] }>("/watchlist", { method: "GET" });
  return (result.items || []).map(mapWatchlistRow).filter((x): x is WatchlistMarketItem => x !== null);
}
export async function addWatchlistSymbol(symbol: string): Promise<WatchlistMarketItem[]> {
  const result = await apiRequest<{ items: Record<string, any>[] }>("/watchlist", { method: "POST", body: JSON.stringify({ symbol: normalizeSymbol(symbol) }) });
  return (result.items || []).map(mapWatchlistRow).filter((x): x is WatchlistMarketItem => x !== null);
}
export async function deleteWatchlistSymbol(symbol: string): Promise<WatchlistMarketItem[]> {
  const result = await apiRequest<{ items: Record<string, any>[] }>(`/watchlist/${encodeURIComponent(normalizeSymbol(symbol))}`, { method: "DELETE" });
  return (result.items || []).map(mapWatchlistRow).filter((x): x is WatchlistMarketItem => x !== null);
}
export async function getMarketRegime(): Promise<MarketRegime> { return apiRequest<MarketRegime>("/market/regime", { method: "GET" }); }
export async function getDerivativesData(symbol = "BTCUSDT"): Promise<Record<string, any>> { return apiRequest<Record<string, any>>(`/derivatives?symbol=${encodeURIComponent(normalizeSymbol(symbol))}`, { method: "GET" }); }
export async function getCalendar(view: 7 | 30 = 7): Promise<Record<string, any>[]> { return apiRequest<Record<string, any>[]>(`/calendar?view=${view}`, { method: "GET" }); }
export async function getUserAlertPreferences(): Promise<Record<string, boolean>> {
  const result = await apiRequest<{ preferences: Record<string, boolean> }>("/account/alert-preferences", { method: "GET" });
  return result.preferences;
}
export async function patchUserAlertPreferences(prefs: Partial<Record<string, boolean>>): Promise<Record<string, boolean>> {
  const result = await apiRequest<{ preferences: Record<string, boolean> }>("/account/alert-preferences", { method: "PATCH", body: JSON.stringify(prefs) });
  return result.preferences;
}
export async function getPriceAlerts(): Promise<Record<string, any>[]> { return apiRequest<Record<string, any>[]>("/alerts/price", { method: "GET" }); }
export async function createPriceAlert(input: { symbol: string; condition: "above" | "below"; target_price: number; repeat?: boolean }): Promise<Record<string, any>> { return apiRequest<Record<string, any>>("/alerts/price", { method: "POST", body: JSON.stringify(input) }); }
export async function deletePriceAlert(id: string): Promise<void> { await apiRequest(`/alerts/price/${encodeURIComponent(id)}`, { method: "DELETE" }); }

export function loadUserPreferences(): Partial<User> { return {}; }
export function saveUserPreferences(_user: User): void { /* persisted preferences belong to the backend */ }
export function recordClosedOperation(_signal: SignalState): void { /* immutable outcomes are owned by the backend */ }
