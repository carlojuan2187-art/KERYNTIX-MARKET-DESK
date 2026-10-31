import { getIntlLocale } from "@/i18n/translation";
import { t } from "@/i18n/translation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Check,
  Minus,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  addWatchlistItem,
  getDerivatives,
  getOrderFlow,
  getSignals,
  getWatchlist,
  removeWatchlistItem,
} from "@/api";
import { getCandles, type AssetQuote, type Candle, type FlowData, type WatchlistMarketItem, type WatchlistTimeframeAnalysis, type WatchlistTrendState } from "@/api/terminal";
import type { DerivativesData } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { ago, compact, number, percent, price } from "@/utils/format";
import {
  AssetIcon,
  Modal,
  PageHeader,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";
import { Score } from "@/components/SignalTable";

type WatchlistDisplayItem = Omit<AssetQuote, "price" | "trend" | "score" | "liquidity_sweep"> & WatchlistMarketItem & {
  price: number | null;
  high_24h: number | null;
  low_24h: number | null;
  open_interest: number | null;
  buy_pct: number | null;
  volume_ratio: number | null;
  sparkline: number[];
};

interface WatchlistTechnicalSummary {
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  support4h: number | null;
  resistance4h: number | null;
  supportDistancePct: number | null;
  resistanceDistancePct: number | null;
  supportMethod: "Swing 4H" | "Rango 4H" | null;
  resistanceMethod: "Swing 4H" | "Rango 4H" | null;
  candles1h: number;
  candles4h: number;
}

const timeframeEntries = [
  { key: "15m", label: "15M", trend: "15M" },
  { key: "1h", label: "1H", trend: "1H" },
  { key: "4h", label: "4H", trend: "4H" },
] as const;

function closedCandles(rows: Candle[], timeframe: "1h" | "4h"): Candle[] {
  const intervalMs = timeframe === "1h" ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
  const now = Date.now();
  const valid = rows.filter((row) => Number.isFinite(row.timestamp) && Number.isFinite(row.close) && row.close > 0);
  const closed = valid.filter((row) => row.timestamp + intervalMs <= now);
  // A stale/mock API can label all returned candles as open. Prefer its sequence over returning no usable analysis.
  return closed.length >= 35 ? closed : valid.slice(0, -1);
}

function emaSeries(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return output;
  let previous = values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  output[period - 1] = previous;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i += 1) {
    previous = values[i] * alpha + previous * (1 - alpha);
    output[i] = previous;
  }
  return output;
}

function calculateRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gain += change; else loss -= change;
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function buildTechnicalSummary(candleRows1h: Candle[], candleRows4h: Candle[], currentPrice: number | null): WatchlistTechnicalSummary {
  const candles1h = closedCandles(candleRows1h, "1h");
  const candles4h = closedCandles(candleRows4h, "4h");
  const closes = candles1h.map((row) => row.close);
  const fastEma = emaSeries(closes, 12);
  const slowEma = emaSeries(closes, 26);
  const macdSeries: number[] = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (fastEma[i] != null && slowEma[i] != null) macdSeries.push(fastEma[i]! - slowEma[i]!);
  }
  const macdSignalSeries = emaSeries(macdSeries, 9);
  const macdLine = macdSeries.length ? macdSeries[macdSeries.length - 1] : null;
  const macdSignal = macdSignalSeries.length ? macdSignalSeries[macdSignalSeries.length - 1] : null;
  const macdHistogram = macdLine != null && macdSignal != null ? macdLine - macdSignal : null;

  // Confirmed 2-left/2-right pivots from closed 4H candles; fallback to recent range extrema if there is no pivot.
  const history = candles4h.slice(-100);
  const swingSupports: number[] = [];
  const swingResistances: number[] = [];
  for (let i = 2; i < history.length - 2; i += 1) {
    const row = history[i];
    const left = history.slice(i - 2, i);
    const right = history.slice(i + 1, i + 3);
    if (left.every((item) => row.low <= item.low) && right.every((item) => row.low <= item.low)) swingSupports.push(row.low);
    if (left.every((item) => row.high >= item.high) && right.every((item) => row.high >= item.high)) swingResistances.push(row.high);
  }
  const validPrice = currentPrice != null && currentPrice > 0 ? currentPrice : (closes.length ? closes[closes.length - 1] : null);
  let support = validPrice == null ? null : swingSupports.filter((level) => level < validPrice).sort((a, b) => b - a)[0] ?? null;
  let resistance = validPrice == null ? null : swingResistances.filter((level) => level > validPrice).sort((a, b) => a - b)[0] ?? null;
  let supportMethod: WatchlistTechnicalSummary["supportMethod"] = support == null ? null : "Swing 4H";
  let resistanceMethod: WatchlistTechnicalSummary["resistanceMethod"] = resistance == null ? null : "Swing 4H";
  if (validPrice != null && history.length) {
    if (support == null) {
      support = history.slice(-30).map((row) => row.low).filter((level) => level < validPrice).sort((a, b) => b - a)[0] ?? null;
      supportMethod = support == null ? null : "Rango 4H";
    }
    if (resistance == null) {
      resistance = history.slice(-30).map((row) => row.high).filter((level) => level > validPrice).sort((a, b) => a - b)[0] ?? null;
      resistanceMethod = resistance == null ? null : "Rango 4H";
    }
  }
  return {
    rsi14: calculateRsi(closes), macdLine, macdSignal, macdHistogram, support4h: support, resistance4h: resistance,
    supportDistancePct: validPrice != null && support != null ? ((validPrice - support) / validPrice) * 100 : null,
    resistanceDistancePct: validPrice != null && resistance != null ? ((resistance - validPrice) / validPrice) * 100 : null,
    supportMethod, resistanceMethod, candles1h: candles1h.length, candles4h: candles4h.length,
  };
}

function targetDistance(currentPrice: number | null, target: number | null | undefined): string | null {
  if (currentPrice == null || currentPrice <= 0 || target == null || target <= 0) return null;
  const distance = Math.abs(target - currentPrice) / currentPrice * 100;
  const relative = target > currentPrice ? t("por encima") : target < currentPrice ? t("por debajo") : t("al precio actual");
  return `${percent(distance, 2)} ${relative}`;
}

function entryDistance(currentPrice: number | null, signal: { entry_price?: number | null; entry_low?: number | null; entry_high?: number | null }): string | null {
  if (currentPrice == null || currentPrice <= 0) return null;
  const low = signal.entry_low ?? null;
  const high = signal.entry_high ?? null;
  if (low != null && high != null && low > 0 && high > 0) {
    if (currentPrice >= low && currentPrice <= high) return t("Dentro de la zona");
    const boundary = currentPrice < low ? low : high;
    const distance = Math.abs(boundary - currentPrice) / currentPrice * 100;
    return `${percent(distance, 2)} ${currentPrice < low ? t("por debajo") : t("por encima")} ${t("de la zona")}`;
  }
  return targetDistance(currentPrice, signal.entry_price);
}

function trendLabel(trend: WatchlistTrendState): string {
  if (trend === "up") return "Alcista";
  if (trend === "down") return "Bajista";
  if (trend === "range") return "Rango";
  if (trend === "transition") return "Transición";
  if (trend === "volatile") return "Volátil";
  return "Sin datos";
}
function trendTone(trend: WatchlistTrendState): string {
  if (trend === "up") return "positive";
  if (trend === "down") return "negative";
  if (trend === "transition" || trend === "volatile") return "watchlist-warn";
  return "muted";
}
function TrendChip({ label, value }: { label: string; value: WatchlistTrendState }) {
  return (
    <span className={`watchlist-trend-chip ${trendTone(value)}`} title={`${label}: ${t(trendLabel(value))}`}>
      {value === "up" ? <ArrowUpRight size={13} /> : value === "down" ? <ArrowDownRight size={13} /> : value === "transition" || value === "volatile" ? <Activity size={13} /> : <Minus size={13} />}
      <small>{label}</small>
      <strong>{t(trendLabel(value))}</strong>
    </span>
  );
}
function TimeframeAnalysisCard({ label, analysis, trend }: { label: string; analysis: WatchlistTimeframeAnalysis | null; trend: WatchlistTrendState }) {
  return (
    <article className="watchlist-analysis-card">
      <div className="watchlist-analysis-card-head">
        <strong>{label}</strong>
        <span className={trendTone(trend)}>{t(trendLabel(trend))}</span>
      </div>
      {analysis ? (
        <>
          <div className="watchlist-analysis-primary">
            <div><small>{t("ADX")}</small><strong>{number(analysis.adx, 1)}</strong></div>
            <div><small>{t("ATR")}</small><strong>{percent(analysis.atr_pct, 2)}</strong></div>
            <div><small>{t("Vol. relativo")}</small><strong>{analysis.rel_volume == null ? "—" : `${number(analysis.rel_volume, 2)}x`}</strong></div>
          </div>
          <div className="watchlist-analysis-lines">
            <div><span>{t("EMA 20 / 50")}</span><strong className="mono">{price(analysis.ema20)} / {price(analysis.ema50)}</strong></div>
            <div><span>{t("Precio vs. EMA 200")}</span><strong className={analysis.above_ema200 == null ? "muted" : analysis.above_ema200 ? "positive" : "negative"}>{analysis.above_ema200 == null ? t("Sin datos") : analysis.above_ema200 ? t("Por encima") : t("Por debajo")}</strong></div>
            <div><span>{t("Pendiente EMA 50")}</span><strong className={analysis.ema50_slope_pct == null ? "muted" : analysis.ema50_slope_pct >= 0 ? "positive" : "negative"}>{percent(analysis.ema50_slope_pct, 3)}</strong></div>
            <div><span>{t("Fuerza de tendencia")}</span><strong>{t(analysis.strength || "Sin datos")}</strong></div>
            <div><span>{t("Percentil de volatilidad")}</span><strong>{analysis.vol_percentile == null ? "—" : `${number(analysis.vol_percentile, 0)}%`}</strong></div>
            <div><span>{t("Bandas de Bollinger")}</span><strong>{t(analysis.bandwidth_trend === "expanding" ? "Expandiéndose" : analysis.bandwidth_trend === "contracting" ? "Contrayéndose" : analysis.bandwidth_trend === "stable" ? "Estables" : "Sin datos")}</strong></div>
          </div>
        </>
      ) : <p className="slim-note">{t("Aún no hay suficientes velas válidas para este análisis.")}</p>}
    </article>
  );
}

export default function WatchlistPage() {
  const { quotes, user, setUser, toast } = useApp();
  const { data, setData, loading, error, refresh } = useApi(getWatchlist);
  const { data: signals } = useApi(getSignals);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<WatchlistDisplayItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailDerivatives, setDetailDerivatives] = useState<DerivativesData | null>(null);
  const [detailFlow, setDetailFlow] = useState<FlowData | null>(null);
  const [detailAnalyticsLoading, setDetailAnalyticsLoading] = useState(false);
  const [detailAnalyticsUnavailable, setDetailAnalyticsUnavailable] = useState(false);
  const [detailTechnical, setDetailTechnical] = useState<WatchlistTechnicalSummary | null>(null);
  const [detailTechnicalLoading, setDetailTechnicalLoading] = useState(false);
  const [detailTechnicalUnavailable, setDetailTechnicalUnavailable] = useState(false);
  const closeDetail = useCallback(() => setSelected(null), []);

  // Load high-cost per-symbol derivatives and flow only when the user opens a pair.
  // The backend already caches both endpoints, so this avoids burdening every watchlist refresh.
  useEffect(() => {
    const symbol = selected?.symbol;
    if (!symbol) {
      setDetailDerivatives(null);
      setDetailFlow(null);
      setDetailAnalyticsLoading(false);
      setDetailAnalyticsUnavailable(false);
      return;
    }
    let cancelled = false;
    setDetailDerivatives(null);
    setDetailFlow(null);
    setDetailAnalyticsUnavailable(false);
    setDetailAnalyticsLoading(true);
    void Promise.allSettled([getDerivatives(symbol), getOrderFlow(symbol)]).then(([derivatives, flow]) => {
      if (cancelled) return;
      setDetailDerivatives(derivatives.status === "fulfilled" ? derivatives.value : null);
      setDetailFlow(flow.status === "fulfilled" ? flow.value : null);
      setDetailAnalyticsUnavailable(derivatives.status === "rejected" && flow.status === "rejected");
    }).finally(() => {
      if (!cancelled) setDetailAnalyticsLoading(false);
    });
    return () => { cancelled = true; };
  }, [selected?.symbol]);
  useEffect(() => {
    const symbol = selected?.symbol;
    if (!symbol) {
      setDetailTechnical(null);
      setDetailTechnicalLoading(false);
      setDetailTechnicalUnavailable(false);
      return;
    }
    let cancelled = false;
    setDetailTechnical(null);
    setDetailTechnicalUnavailable(false);
    setDetailTechnicalLoading(true);
    void Promise.allSettled([
      getCandles(symbol, "1h", undefined, 150),
      getCandles(symbol, "4h", undefined, 120),
    ]).then(([oneHour, fourHour]) => {
      if (cancelled) return;
      const candles1h = oneHour.status === "fulfilled" ? oneHour.value : [];
      const candles4h = fourHour.status === "fulfilled" ? fourHour.value : [];
      if (!candles1h.length && !candles4h.length) {
        setDetailTechnical(null);
        setDetailTechnicalUnavailable(true);
        return;
      }
      setDetailTechnical(buildTechnicalSummary(candles1h, candles4h, selected?.price ?? null));
      setDetailTechnicalUnavailable(oneHour.status === "rejected" && fourHour.status === "rejected");
    }).catch(() => {
      if (!cancelled) setDetailTechnicalUnavailable(true);
    }).finally(() => {
      if (!cancelled) setDetailTechnicalLoading(false);
    });
    return () => { cancelled = true; };
  }, [selected?.symbol]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const items: WatchlistDisplayItem[] = (data ?? []).map((item) => {
    const live = quoteMap.get(item.symbol);
    return {
      ...item,
      name: item.name || live?.name || item.symbol,
      price: live?.price ?? item.price,
      change_pct: live?.change_pct ?? item.change_pct,
      volume_24h: live?.volume_24h ?? item.volume_24h,
      high_24h: live?.high_24h ?? null,
      low_24h: live?.low_24h ?? null,
      funding_rate: live?.funding_rate ?? item.funding_rate,
      open_interest: live?.open_interest ?? null,
      buy_pct: live?.buy_pct ?? null,
      volume_ratio: item.analyses["1h"]?.rel_volume ?? live?.volume_ratio ?? null,
      sparkline: live?.sparkline ?? [],
    };
  });
  const suggestions = quotes.filter(
    (q) =>
      `${q.symbol} ${q.name}`
        .toLowerCase()
        .includes(query.toLowerCase().replace(/[\s/]/g, "")) &&
      !data?.some((i) => i.symbol === q.symbol),
  );
  async function add(symbol: string) {
    setBusy(true);
    setFormError("");
    try {
      const updated = await addWatchlistItem({ symbol });
      setData(updated);
      if (user) setUser({ ...user, watchlist: updated });
      setQuery("");
      setAdding(false);
      toast("Par añadido a tu watchlist");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(symbol: string) {
    const updated = await removeWatchlistItem(symbol);
    setData(updated);
    if (user) setUser({ ...user, watchlist: updated });
    toast("Par eliminado de tu watchlist");
  }
  const selectedScannerSignal = selected ? signals?.find((signal) => signal.symbol === selected.symbol && ["PENDING", "TOUCHED"].includes(String(signal.status).toUpperCase())) : undefined;
  const selectedActiveSignal = selected?.active_signal ?? (selectedScannerSignal ? {
    id: selectedScannerSignal.id ?? "", direction: selectedScannerSignal.direction, status: selectedScannerSignal.status,
    score: selectedScannerSignal.score ?? null, entry_price: selectedScannerSignal.entry_price ?? selectedScannerSignal.entry_low ?? null,
    entry_low: selectedScannerSignal.entry_zone?.low ?? selectedScannerSignal.entry_low ?? null,
    entry_high: selectedScannerSignal.entry_zone?.high ?? selectedScannerSignal.entry_high ?? null,
    stop_loss: selectedScannerSignal.stop_loss ?? null,
    take_profits: selectedScannerSignal.take_profits?.length ? selectedScannerSignal.take_profits : [selectedScannerSignal.tp1, selectedScannerSignal.tp2, selectedScannerSignal.tp3].filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    created_at: selectedScannerSignal.created_at ?? null,
  } : null);
  const flow15m = detailFlow?.windows.find((row) => row.label === "15m");
  const selectedFundingRate = detailDerivatives?.funding_rate ?? selected?.funding_rate ?? null;
  const nextFundingTime = detailDerivatives?.funding_next && Number.isFinite(Date.parse(detailDerivatives.funding_next))
    ? new Date(detailDerivatives.funding_next).toLocaleTimeString(getIntlLocale(), { hour: "2-digit", minute: "2-digit" })
    : null;
  const rangePosition = selected && selected.price != null && selected.high_24h != null && selected.low_24h != null && selected.high_24h > selected.low_24h
    ? Math.max(0, Math.min(100, ((selected.price - selected.low_24h) / (selected.high_24h - selected.low_24h)) * 100))
    : null;
  const summaryMetrics = selected ? [
    { label: "Volumen 24H", display: selected.volume_24h == null ? null : `$${compact(selected.volume_24h)}`, tone: "muted" },
    { label: "Interés abierto", display: detailAnalyticsLoading ? "Cargando…" : detailDerivatives?.open_interest == null ? null : `$${compact(detailDerivatives.open_interest)}`, tone: "muted" },
    { label: "Funding rate", display: selectedFundingRate == null ? null : percent(selectedFundingRate * 100, 4), tone: selectedFundingRate == null ? "muted" : selectedFundingRate > 0 ? "negative" : selectedFundingRate < 0 ? "positive" : "muted" },
    { label: "Compra agresiva 15M", display: detailAnalyticsLoading ? "Cargando…" : flow15m?.buy_pct == null ? null : `${number(flow15m.buy_pct, 1)}%`, tone: flow15m?.buy_pct == null ? "muted" : flow15m.buy_pct >= 50 ? "positive" : "negative" },
    { label: "Volumen relativo 1H", display: selected.volume_ratio == null ? null : `${number(selected.volume_ratio, 2)}x`, tone: "muted" },
    { label: "Máximo / mínimo 24H", display: selected.high_24h == null || selected.low_24h == null ? null : `${price(selected.high_24h)} / ${price(selected.low_24h)}`, tone: "muted" },
  ].filter((metric) => metric.display != null) : [];
  const derivativeMetrics = detailDerivatives ? [
    { label: "Cambio OI 1H", display: detailDerivatives.oi_change_1h == null ? null : percent(detailDerivatives.oi_change_1h), tone: detailDerivatives.oi_change_1h == null ? "muted" : detailDerivatives.oi_change_1h >= 0 ? "positive" : "negative" },
    { label: "Cambio OI 24H", display: detailDerivatives.oi_change_24h == null ? null : percent(detailDerivatives.oi_change_24h), tone: detailDerivatives.oi_change_24h == null ? "muted" : detailDerivatives.oi_change_24h >= 0 ? "positive" : "negative" },
    { label: "Cuentas long / short", display: detailDerivatives.long_short_ratio?.percent_long == null || detailDerivatives.long_short_ratio?.percent_short == null ? null : `${number(detailDerivatives.long_short_ratio.percent_long, 1)}% / ${number(detailDerivatives.long_short_ratio.percent_short, 1)}%`, tone: "muted" },
    { label: "Prima mark / índice", display: detailDerivatives.mark_index_delta == null ? null : percent(detailDerivatives.mark_index_delta, 3), tone: detailDerivatives.mark_index_delta == null ? "muted" : detailDerivatives.mark_index_delta > 0 ? "negative" : detailDerivatives.mark_index_delta < 0 ? "positive" : "muted" },
    { label: "Próximo funding", display: nextFundingTime, tone: "muted" },
  ].filter((metric) => metric.display != null) : [];
  return (
    <div>
      <PageHeader
        eyebrow={t("TU SELECCIÓN, TU PERSPECTIVA")}
        title={t("Sigue lo que te importa.")}
        description={t("Tendencia, participación y contexto de hasta 10 pares. Sin alterar tus señales.")}
      >
        <Tag tone="muted">{data?.length || 0} / 10 {t("pares")}</Tag>
        <button
          className="btn btn-primary"
          onClick={() => setAdding((value) => !value)}
          disabled={(data?.length || 0) >= 10}
        >
          <Plus size={14} />
          {t("Agregar par")}</button>
      </PageHeader>
      {adding && (
        <section className="watchlist-search panel panel-pad">
          <SectionHeader title={t("Añade un par de Binance Futures")} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add(query);
            }}
          >
            <div className="search-field">
              <Search size={16} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="AVAX, avaxusdt, AVAX/USDT, 1000PEPE..."
                aria-label={t("Buscar par para watchlist")}
              />
              <button
                className="btn btn-primary"
                disabled={busy || !query.trim()}
                type="submit"
              >
                {t("Agregar")}</button>
            </div>
          </form>
          <div className="pair-chips" style={{ marginTop: 13 }}>
            {suggestions.slice(0, 7).map((q) => (
              <button
                key={q.symbol}
                className="pair-chip"
                disabled={busy}
                onClick={() => void add(q.symbol)}
              >
                <AssetIcon symbol={q.symbol} size={16} />
                {q.symbol.replace("USDT", "")}
                <Plus size={11} />
              </button>
            ))}
          </div>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          {!suggestions.length && (
            <p className="slim-note">
              {t("No hay coincidencias nuevas entre las cotizaciones recibidas del backend.")}</p>
          )}
        </section>
      )}
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !data?.length}
        emptyText={t("Tu próxima oportunidad empieza por observar. Agrega BTC, ETH o SOL para empezar.")}
      />
      {!loading && !error && !data?.length && (
        <div className="pair-chips">
          {quotes.slice(0, 3).map(({ symbol }) => (
            <button
              className="pair-chip"
              key={symbol}
              onClick={() => void add(symbol)}
            >
              <Plus size={12} />
              {symbol}
            </button>
          ))}
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <section className="panel watchlist-full">
          <div className="watchlist-summary-bar">
            <div>
              <strong>{t("Lectura técnica de tus pares")}</strong>
              <span>{t("Las tendencias se calculan con velas cerradas. El precio se actualiza con la cotización más reciente disponible.")}</span>
            </div>
            <button className="btn btn-quiet" onClick={() => void refresh()}><Activity size={13} /> {t("Actualizar análisis")}</button>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Par")}</th>
                  <th>{t("Precio (USDT)")}</th>
                  <th>24h</th>
                  <th>{t("Tendencia 15M / 1H / 4H")}</th>
                  <th>{t("Score multi-TF")}</th>
                  <th>{t("Volumen 24h / relativo")}</th>
                  <th>{t("ADX / ATR (1H)")}</th>
                  <th>{t("Funding")}</th>
                  <th>{t("Contexto")}</th>
                  <th>{t("Últimas 24h")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  const scannerSignal = signals?.find((signal) => signal.symbol === q.symbol && ["PENDING", "TOUCHED"].includes(String(signal.status).toUpperCase()));
                  const activeSignal = q.active_signal ?? (scannerSignal ? {
                    id: scannerSignal.id ?? "", direction: scannerSignal.direction, status: scannerSignal.status,
                    score: scannerSignal.score ?? null, entry_price: scannerSignal.entry_price ?? scannerSignal.entry_low ?? null,
                    entry_low: scannerSignal.entry_zone?.low ?? scannerSignal.entry_low ?? null, entry_high: scannerSignal.entry_zone?.high ?? scannerSignal.entry_high ?? null,
                    stop_loss: scannerSignal.stop_loss ?? null, take_profits: scannerSignal.take_profits?.length ? scannerSignal.take_profits : [scannerSignal.tp1, scannerSignal.tp2, scannerSignal.tp3].filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
                    created_at: scannerSignal.created_at ?? null,
                  } : null);
                  const frame1h = q.analyses["1h"];
                  const lean = q.score_detail?.lean ?? q.score_detail?.direction;
                  return (
                    <tr key={q.symbol}>
                      <td>
                        <button className="asset-pair watchlist-detail-button" onClick={() => setSelected(q)} aria-label={`Ver análisis de ${q.symbol}`}>
                          <AssetIcon symbol={q.symbol} size={31} />
                          <div><strong>{q.symbol.replace("USDT", " / USDT")}</strong><small>{q.name}</small></div>
                        </button>
                      </td>
                      <td className="mono">{price(q.price)}<small className="watchlist-cell-sub">{q.status === "unavailable" ? "Cotización no disponible" : "USDT"}</small></td>
                      <td className={`mono ${q.change_pct == null ? "muted" : q.change_pct >= 0 ? "positive" : "negative"}`}>{percent(q.change_pct)}</td>
                      <td>
                        <div className="trend-directions">
                          {timeframeEntries.map((tf) => <TrendChip key={tf.key} label={tf.label} value={q.trend[tf.trend]} />)}
                        </div>
                      </td>
                      <td>
                        <div className="watchlist-score-block">
                          {q.score == null ? <span className="muted">{t("Sin score")}</span> : <Score value={q.score} />}
                          <small className={lean === "LONG" ? "positive" : lean === "SHORT" ? "negative" : "muted"}>{lean || "Sin dirección"}{q.score_detail?.strength ? ` · ${q.score_detail.strength}` : ""}</small>
                        </div>
                      </td>
                      <td>
                        <div className="watchlist-table-metric"><strong>${compact(q.volume_24h)}</strong><small>{t("Rel. ")}{q.volume_ratio == null ? "—" : `${number(q.volume_ratio, 2)}x`}</small></div>
                      </td>
                      <td>
                        <div className="watchlist-table-metric"><strong>{t("ADX ")}{number(frame1h?.adx, 1)}</strong><small>{t("ATR ")}{percent(frame1h?.atr_pct, 2)}</small></div>
                      </td>
                      <td className={`mono ${q.funding_rate == null ? "muted" : q.funding_rate > 0 ? "negative" : q.funding_rate < 0 ? "positive" : "muted"}`}>{q.funding_rate == null ? "—" : percent(q.funding_rate * 100, 4)}<small className="watchlist-cell-sub">{t("por periodo")}</small></td>
                      <td>
                        <div className="watchlist-context">
                          {activeSignal && <Link to={`/senales?par=${q.symbol}`}><Tag tone="green" dot>{t("Señal ")}{activeSignal.direction || "activa"}</Tag></Link>}
                          {q.liquidity_sweep && <Tag tone="blue">{t("Barrido ")}{q.liquidity_sweep.direction} · {Math.round(q.liquidity_sweep.minutes)}m</Tag>}
                          {!activeSignal && !q.liquidity_sweep && <span className="muted">{t("En observación")}</span>}
                          {q.status === "unavailable" && <span className="muted">{t("Precio sin actualizar")}</span>}
                        </div>
                      </td>
                      <td>
                        <button className="watchlist-sparkline-button" onClick={() => setSelected(q)} aria-label={`Ampliar datos de ${q.symbol}`}>
                          <Sparkline values={q.sparkline} positive={q.change_pct != null && q.change_pct >= 0} width={71} height={25} />
                          <small>{q.high_24h == null || q.low_24h == null ? "Ver análisis" : `${price(q.low_24h)}–${price(q.high_24h)}`}</small>
                        </button>
                      </td>
                      <td><button className="icon-button" aria-label={`Quitar ${q.symbol}`} onClick={() => void remove(q.symbol)}><Trash2 size={13} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="slim-note">
        <Star size={12} />
        {t("Tu watchlist es informativa. Añadir o quitar un par no modifica las señales generadas por el scanner.")}</p>
      {selected && (
        <Modal title={selected.name} onClose={closeDetail}>
          <div className="flow-title">
            <div className="asset-pair">
              <AssetIcon symbol={selected.symbol} size={42} />
              <div>
                <h2>{selected.symbol.replace("USDT", " / USDT")}</h2>
                <small>{t("Binance USDT-M Futures")}</small>
              </div>
            </div>
            {selected.score == null ? <span className="muted">—</span> : <Score value={selected.score} />}
          </div>
          <div className="chart-price">
            {price(selected.price)} <span>USDT</span>
          </div>
          <span className={selected.change_pct == null ? "muted" : selected.change_pct >= 0 ? "positive" : "negative"}>
            {percent(selected.change_pct)}{" "}
            <span className="muted small">24h</span>
          </span>
          <Sparkline
            values={selected.sparkline}
            positive={selected.change_pct != null && selected.change_pct >= 0}
            width={Math.min(410, window.innerWidth - 90)}
            height={85}
            fill
          />
          {summaryMetrics.length > 0 && <div className="watchlist-detail-grid">
            {summaryMetrics.map((metric) => <div className="watchlist-detail-metric" key={metric.label}><small>{t(metric.label)}</small><strong className={metric.tone}>{metric.display}</strong></div>)}
          </div>}
          {rangePosition != null && (
            <section className="watchlist-range-section">
              <div className="watchlist-detail-section-head"><div><h3>{t("Posición dentro del rango de 24H")}</h3><p>{t("Ubicación del último precio entre el mínimo y el máximo del día; no es una señal por sí sola.")}</p></div><strong>{number(rangePosition, 0)}%</strong></div>
              <div className="watchlist-range-track" role="img" aria-label={`Precio al ${number(rangePosition, 0)} por ciento del rango de 24 horas`}><span style={{ left: `${rangePosition}%` }} /></div>
              <div className="watchlist-range-labels"><span>{t("Mín. ")}{price(selected.low_24h)}</span><span>{t("Máx. ")}{price(selected.high_24h)}</span></div>
            </section>
          )}
          <section className="watchlist-timeframe-section">
            <div className="watchlist-detail-section-head"><div><h3>{t("Derivados y posicionamiento")}</h3><p>{t("Interés abierto, cambios de exposición y sesgo de participantes en futuros.")}</p></div></div>
            {detailAnalyticsLoading ? <p className="slim-note">{t("Consultando métricas reales de Binance Futures…")}</p> : derivativeMetrics.length ? (
              <div className="watchlist-derivatives-grid">
                {derivativeMetrics.map((metric) => <div className="watchlist-detail-metric" key={metric.label}><small>{t(metric.label)}</small><strong className={metric.tone}>{metric.display}</strong></div>)}
              </div>
            ) : <p className="slim-note">{detailAnalyticsUnavailable ? "Binance no proporcionó métricas de derivados para este par en esta consulta." : "No hay métricas de derivados disponibles para este par."}</p>}
            {detailDerivatives?.reading && <p className="watchlist-analytics-reading">{detailDerivatives.reading}</p>}
            {detailDerivatives?.updated_at && <p className="watchlist-data-stamp">{t("Derivados actualizados ")}{ago(detailDerivatives.updated_at)}</p>}
          </section>
          <section className="watchlist-timeframe-section">
            <div className="watchlist-detail-section-head"><div><h3>{t("Flujo comprador y vendedor")}</h3><p>{t("Agresión compradora, delta y volumen relativo calculados a partir de velas recientes.")}</p></div></div>
            {detailAnalyticsLoading ? <p className="slim-note">{t("Calculando flujo por temporalidad…")}</p> : detailFlow?.windows.some((row) => row.buy_pct != null || row.delta_usdt != null || row.volume_ratio != null) ? (
              <div className="watchlist-flow-grid">
                {(["15m", "1h", "4h"] as const).map((label) => {
                  const row = detailFlow?.windows.find((window) => window.label === label);
                  if (!row || (row.buy_pct == null && row.delta_usdt == null && row.volume_ratio == null)) return null;
                  return <article className="watchlist-flow-card" key={label}>
                    <strong>{label.toUpperCase()}</strong>
                    {row.buy_pct != null && <div><span>{t("Agresión compradora")}</span><b className={row.buy_pct >= 50 ? "positive" : "negative"}>{number(row.buy_pct, 1)}%</b></div>}
                    {row.delta_usdt != null && <div><span>{t("Delta neto")}</span><b className={row.delta_usdt >= 0 ? "positive" : "negative"}>{row.delta_usdt >= 0 ? "+" : "−"}${compact(Math.abs(row.delta_usdt))}</b></div>}
                    {row.volume_ratio != null && <div><span>{t("Volumen vs. normal")}</span><b>{number(row.volume_ratio, 2)}x</b></div>}
                  </article>;
                })}
              </div>
            ) : <p className="slim-note">{t("No hay suficientes velas recientes para calcular el flujo de este par.")}</p>}
            {detailFlow?.reading && <p className="watchlist-analytics-reading">{detailFlow.reading}</p>}
            {detailFlow?.updated_at && <p className="watchlist-data-stamp">{t("Flujo actualizado ")}{ago(detailFlow.updated_at)}</p>}
          </section>
          <section className="watchlist-timeframe-section">
            <div className="watchlist-detail-section-head"><div><h3>{t("Análisis por temporalidad")}</h3><p>{t("Indicadores calculados con velas cerradas de Binance Futures.")}</p></div></div>
            <div className="watchlist-analysis-grid">
              {timeframeEntries.map((tf) => <TimeframeAnalysisCard key={tf.key} label={tf.label} analysis={selected.analyses[tf.key]} trend={selected.trend[tf.trend]} />)}
            </div>
          </section>
          <section className="watchlist-timeframe-section">
            <div className="watchlist-detail-section-head"><div><h3>{t("Momentum y niveles técnicos")}</h3><p>{t("RSI(14) y MACD sobre velas cerradas de 1H; soportes y resistencias por pivotes de 4H. Los niveles son zonas técnicas aproximadas, no garantías.")}</p></div></div>
            {detailTechnicalLoading ? <p className="slim-note">{t("Calculando RSI, MACD y niveles sobre velas de Binance…")}</p> : detailTechnical ? (
              <div className="watchlist-technical-grid">
                <article className="watchlist-technical-card">
                  <small>{t("RSI (14) · 1H")}</small>
                  <strong className={detailTechnical.rsi14 == null ? "muted" : detailTechnical.rsi14 >= 70 ? "negative" : detailTechnical.rsi14 <= 30 ? "positive" : ""}>{detailTechnical.rsi14 == null ? t("Sin lectura") : number(detailTechnical.rsi14, 1)}</strong>
                  <span>{t(detailTechnical.rsi14 == null ? "Se requieren al menos 15 cierres" : detailTechnical.rsi14 >= 70 ? "Zona de sobrecompra" : detailTechnical.rsi14 <= 30 ? "Zona de sobreventa" : detailTechnical.rsi14 >= 55 ? "Impulso comprador" : detailTechnical.rsi14 <= 45 ? "Impulso vendedor" : "Zona neutral")}</span>
                </article>
                <article className="watchlist-technical-card">
                  <small>{t("MACD (12, 26, 9) · 1H")}</small>
                  <strong className={detailTechnical.macdHistogram == null ? "muted" : detailTechnical.macdHistogram >= 0 ? "positive" : "negative"}>{t(detailTechnical.macdHistogram == null ? "Sin lectura" : detailTechnical.macdHistogram >= 0 ? "Histograma positivo" : "Histograma negativo")}</strong>
                  <span>{detailTechnical.macdLine == null || detailTechnical.macdSignal == null || detailTechnical.macdHistogram == null ? t("Se requieren más velas") : `MACD ${price(detailTechnical.macdLine)} · ${t("señal")} ${price(detailTechnical.macdSignal)} · ${t("hist.")} ${price(detailTechnical.macdHistogram)}`}</span>
                </article>
                <article className="watchlist-technical-card">
                  <small>{t("Soporte más cercano · 4H")}</small>
                  <strong>{detailTechnical.support4h == null ? t("Sin nivel claro") : price(detailTechnical.support4h)}</strong>
                  <span>{detailTechnical.supportDistancePct == null ? t(detailTechnical.supportMethod ?? "No identificado") : `${percent(detailTechnical.supportDistancePct, 2)} ${t("por encima del soporte")}`}{detailTechnical.supportMethod ? ` · ${t(detailTechnical.supportMethod)}` : ""}</span>
                </article>
                <article className="watchlist-technical-card">
                  <small>{t("Resistencia más cercana · 4H")}</small>
                  <strong>{detailTechnical.resistance4h == null ? t("Sin nivel claro") : price(detailTechnical.resistance4h)}</strong>
                  <span>{detailTechnical.resistanceDistancePct == null ? t(detailTechnical.resistanceMethod ?? "No identificada") : `${percent(detailTechnical.resistanceDistancePct, 2)} ${t("por debajo de la resistencia")}`}{detailTechnical.resistanceMethod ? ` · ${t(detailTechnical.resistanceMethod)}` : ""}</span>
                </article>
              </div>
            ) : <p className="slim-note">{t(detailTechnicalUnavailable ? "No se pudieron consultar las velas de Binance en este momento." : "No hay suficientes velas cerradas para calcular los indicadores.")}</p>}
            {detailTechnical && <p className="watchlist-data-stamp">{t("Muestra: ")}{detailTechnical.candles1h} {t("velas cerradas de 1H y ")}{detailTechnical.candles4h} {t("de 4H. RSI/MACD se calculan localmente desde velas reales; los soportes y resistencias son pivotes recientes o extremos de rango.")}</p>}
          </section>
          {selectedActiveSignal && (selectedActiveSignal.entry_price != null || selectedActiveSignal.entry_low != null || selectedActiveSignal.entry_high != null || selectedActiveSignal.stop_loss != null || (selectedActiveSignal.take_profits?.length ?? 0) > 0) && (
            <section className="watchlist-timeframe-section">
              <div className="watchlist-detail-section-head"><div><h3>{t("Distancia a los niveles de señal")}</h3><p>{t("Distancia entre el precio actual y los niveles de la señal activa. Las distancias no significan que el precio vaya a alcanzarlos.")}</p></div></div>
              <div className="watchlist-levels-grid">
                {(selectedActiveSignal.entry_price != null || selectedActiveSignal.entry_low != null || selectedActiveSignal.entry_high != null) && <article className="watchlist-level-card"><small>{t("Entrada ")}{selectedActiveSignal.entry_low != null && selectedActiveSignal.entry_high != null ? "(zona)" : ""}</small><strong>{selectedActiveSignal.entry_low != null && selectedActiveSignal.entry_high != null ? `${price(selectedActiveSignal.entry_low)} – ${price(selectedActiveSignal.entry_high)}` : price(selectedActiveSignal.entry_price ?? selectedActiveSignal.entry_low ?? selectedActiveSignal.entry_high)}</strong><span>{entryDistance(selected.price, selectedActiveSignal) ?? t("Precio actual no disponible")}</span></article>}
                {selectedActiveSignal.stop_loss != null && <article className="watchlist-level-card"><small>{t("Stop-loss")}</small><strong>{price(selectedActiveSignal.stop_loss)}</strong><span>{targetDistance(selected.price, selectedActiveSignal.stop_loss) ?? t("Precio actual no disponible")} {selected.price == null ? "" : t("desde el precio actual")}</span></article>}
                {(selectedActiveSignal.take_profits ?? []).filter((target) => typeof target === "number" && Number.isFinite(target) && target > 0).slice(0, 3).map((target, index) => <article className="watchlist-level-card" key={`tp-${index}`}><small>{t("Objetivo TP")}{index + 1}</small><strong>{price(target)}</strong><span>{targetDistance(selected.price, target) ?? t("Precio actual no disponible")} {selected.price == null ? "" : t("desde el precio actual")}</span></article>)}
              </div>
              <p className="watchlist-data-stamp">{t("Señal ")}{selectedActiveSignal.direction ?? "sin dirección"} · {selectedActiveSignal.status}{selectedActiveSignal.created_at ? ` · creada ${ago(selectedActiveSignal.created_at)}` : ""}</p>
            </section>
          )}
          <section className="watchlist-timeframe-section">
            <div className="watchlist-detail-section-head"><div><h3>{t("Sesgo combinado")}</h3><p>{t("Resumen de la combinación 15M / 1H / 4H. Es contexto informativo, no una orden de entrada.")}</p></div></div>
            <div className="watchlist-combined-bias">
              <div><small>{t("Dirección ponderada")}</small><strong className={(selected.score_detail?.lean ?? selected.score_detail?.direction) === "LONG" ? "positive" : (selected.score_detail?.lean ?? selected.score_detail?.direction) === "SHORT" ? "negative" : "muted"}>{selected.score_detail?.lean ?? selected.score_detail?.direction ?? "Sin datos"}</strong></div>
              <div><small>{t("Fuerza")}</small><strong>{selected.score_detail?.strength ?? "Sin confirmar"}</strong></div>
              <div><small>{t("Score")}</small><strong>{selected.score_detail?.score == null ? "—" : `${selected.score_detail.score}/100`}</strong></div>
              <div><small>{t("Actualizado")}</small><strong>{selected.data_updated_at ? ago(selected.data_updated_at) : "Sin marca temporal"}</strong></div>
            </div>
          </section>
          <div className="detail-row">
            <span>{t("Señal activa")}</span>
            {selectedActiveSignal ? (
              <div className="watchlist-modal-signal">
                <Link className="link-accent" to={`/senales?par=${selected.symbol}`}><Check size={12} /> {t("Ver señal ")}<ArrowRight size={12} /></Link>
                <strong className={selectedActiveSignal.direction === "LONG" ? "positive" : selectedActiveSignal.direction === "SHORT" ? "negative" : "muted"}>{selectedActiveSignal.direction || "Activa"} · {selectedActiveSignal.status}</strong>
                <small>{t("Entrada ")}{selectedActiveSignal.entry_low != null && selectedActiveSignal.entry_high != null ? `${price(selectedActiveSignal.entry_low)}–${price(selectedActiveSignal.entry_high)}` : price(selectedActiveSignal.entry_price ?? selectedActiveSignal.entry_low ?? selectedActiveSignal.entry_high)} · {selectedActiveSignal.created_at ? ago(selectedActiveSignal.created_at) : "fecha no disponible"}</small>
              </div>
            ) : <span className="muted">{t("Sin señal activa confirmada")}</span>}
          </div>
          <div className="detail-row">
            <span>{t("Barrido de liquidez")}</span>
            {selected.liquidity_sweep ? <strong className={selected.liquidity_sweep.direction === "LONG" ? "positive" : "negative"}>{selected.liquidity_sweep.direction} {t("· hace ")}{Math.round(selected.liquidity_sweep.minutes)} {t("min")}</strong> : <span className="muted">{t("Sin barrido reciente (ventana de 20 min)")}</span>}
          </div>
          <div className="signal-detail-actions">
            <Link
              className="btn btn-primary"
              to={`/mercado/flujo/${selected.symbol}`}
            >
              {t("Ver flujo")}<ArrowUpRight size={13} />
            </Link>
            <Link className="btn btn-blue" to={`/derivados/${selected.symbol}`}>
              {t("Derivados")}<ArrowUpRight size={13} />
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}
