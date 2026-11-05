import { t } from "@/i18n/translation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Search,
  ShieldCheck,
  ScanLine,
  Target,
  Waves,
} from "lucide-react";
import { getRadarSnapshot } from "@/api/terminal";
import type { RadarOpportunity } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { ago, compact, dateTime, number, percent, price } from "@/utils/format";
import {
  AssetIcon,
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  Tag,
} from "@/components/ui";
import { Score } from "@/components/SignalTable";

const FILTERS = [
  { key: "all", label: "Todo el radar" },
  { key: "setup", label: "Setups activos" },
  { key: "sweep", label: "Barridos" },
  { key: "watch", label: "En vigilancia" },
  { key: "move", label: "Movimientos" },
] as const;

function kindTone(kind: RadarOpportunity["kind"]): "green" | "blue" | "amber" | "red" {
  if (kind === "setup") return "green";
  if (kind === "sweep") return "blue";
  if (kind === "watch") return "amber";
  return "red";
}

function trendText(value: string | null | undefined): string {
  const trend = String(value ?? "").trim().toUpperCase();
  if (["UP", "UPTREND", "BULLISH", "ALCISTA"].includes(trend)) return "Alcista";
  if (["DOWN", "DOWNTREND", "BEARISH", "BAJISTA"].includes(trend)) return "Bajista";
  if (["RANGE", "RANGO"].includes(trend)) return "Rango";
  if (["MIXED", "FLAT", "MIXTA"].includes(trend)) return "Mixta / rango";
  if (["TRANSITION", "TRANSICIÓN", "TRANSICION"].includes(trend)) return "Transición";
  if (["VOLATILE", "VOLÁTIL", "VOLATIL", "ALTA VOLATILIDAD"].includes(trend)) return "Alta volatilidad";
  return "Sin lectura";
}

function trendTone(value: string | null | undefined): string {
  const trend = String(value ?? "").toUpperCase();
  if (["UP", "UPTREND", "BULLISH", "ALCISTA"].includes(trend)) return "positive";
  if (["DOWN", "DOWNTREND", "BEARISH", "BAJISTA"].includes(trend)) return "negative";
  return "muted";
}

function alignmentText(value: string | null | undefined): string {
  const alignment = String(value ?? "").toLowerCase();
  if (["favor", "favorable", "aligned", "aligned_with_regime"].includes(alignment)) return "A favor de la tendencia";
  if (["contra", "contrary", "against", "against_regime"].includes(alignment)) return "Contra la tendencia";
  if (["neutral", "mixed", "unknown"].includes(alignment)) return "Neutral / mixta";
  return value || "Sin lectura";
}

function entryReference(row: RadarOpportunity): number | null {
  if (row.entry_price != null) return row.entry_price;
  const low = row.entry_zone?.low;
  const high = row.entry_zone?.high;
  if (low != null && high != null) return (low + high) / 2;
  return low ?? high ?? null;
}

function plannedRewardRisk(row: RadarOpportunity): number | null {
  const entry = entryReference(row);
  const stop = row.stop_loss;
  const target = row.take_profits?.[0];
  if (entry == null || stop == null || target == null) return null;
  const risk = Math.abs(entry - stop);
  return risk > 0 ? Math.abs(target - entry) / risk : null;
}

function formatDeadline(value: string | null | undefined): string {
  if (!value) return "Sin dato";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? dateTime(new Date(timestamp).toISOString(), "America/Puerto_Rico") : "Sin dato";
}

function hasMetricValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="radar-metric">
      <span>{t(label)}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function OpportunityMetrics({ row }: { row: RadarOpportunity }) {
  const currentPrice = row.current_price;
  if (row.kind === "setup") {
    const zone = row.entry_zone;
    const zoneLabel = zone?.low != null && zone.high != null
      ? `${price(zone.low)} – ${price(zone.high)}`
      : price(row.entry_price ?? zone?.low ?? zone?.high);
    const target1 = row.take_profits?.[0];
    const rr = plannedRewardRisk(row);
    const entry = entryReference(row);
    const distanceToEntry = currentPrice != null && entry != null && currentPrice > 0
      ? Math.abs(currentPrice - entry) / currentPrice * 100
      : null;
    return (
      <div className="radar-specific-metrics">
        <Metric label={t("Zona de entrada")} value={zoneLabel} />
        <Metric label={t("Stop loss")} value={price(row.stop_loss)} tone="negative" />
        <Metric label={t("Objetivo 1")} value={price(target1)} tone="positive" />
        <Metric label={t("R:B estimada · TP1")} value={rr == null ? "—" : `1 : ${number(rr, 2)}`} />
        <Metric label={t("Distancia a entrada")} value={distanceToEntry == null ? "—" : `${number(distanceToEntry)}%`} />
        <Metric label={t("Estado del setup")} value={t(row.status || "Sin estado")} />
        {row.atr_value != null && <Metric label={t("ATR del setup")} value={price(row.atr_value)} />}
        {row.liquidity_sweep_extreme_price != null && <Metric label={t("Extremo de liquidez")} value={price(row.liquidity_sweep_extreme_price)} />}
        {row.touched_at && <Metric label={t("Entrada tocada")} value={ago(row.touched_at)} />}
        {row.take_profits?.[1] != null && <Metric label={t("Objetivo 2")} value={price(row.take_profits[1])} tone="positive" />}
        {row.take_profits?.[2] != null && <Metric label={t("Objetivo 3")} value={price(row.take_profits[2])} tone="positive" />}
        {row.entry_expires_at && <Metric label={t("Vencimiento de entrada")} value={formatDeadline(row.entry_expires_at)} />}
      </div>
    );
  }

  if (row.kind === "sweep") {
    return (
      <div className="radar-specific-metrics">
        <Metric label={t("Nivel de liquidez")} value={price(row.level)} />
        <Metric label={t("Extremo del barrido")} value={price(row.extreme_price)} />
        <Metric label={t("Mecha / rechazo")} value={row.wick_ratio == null ? "—" : `${number(row.wick_ratio, 2)}x`} />
        <Metric label={t("Distancia del barrido")} value={row.sweep_distance_atr == null ? "—" : `${number(row.sweep_distance_atr, 2)} ATR`} />
        <Metric label={t("ATR 15M")} value={row.atr_pct == null ? "—" : `${number(row.atr_pct, 3)}%`} />
        {hasMetricValue(row.rel_volume) && <Metric label={t("Volumen relativo")} value={`${number(row.rel_volume, 2)}x`} />}
        <Metric label={t("Tendencia 1H")} value={t(trendText(row.trend_1h))} tone={trendTone(row.trend_1h)} />
        <Metric label={t("Alineación")} value={t(row.alignment_detail || alignmentText(row.alignment))} />
      </div>
    );
  }

  if (row.kind === "watch") {
    return (
      <div className="radar-specific-metrics">
        <Metric label={t("Nivel de zona")} value={price(row.level)} />
        <Metric label={t("Distancia a zona")} value={row.distance_pct == null ? "—" : `${number(row.distance_pct)}%`} />
        <Metric label={t("Distancia en ATR")} value={row.distance_atr == null ? "—" : `${number(row.distance_atr, 2)} ATR`} />
        <Metric label={t("Zonas detectadas")} value={row.zone_count == null ? "—" : String(row.zone_count)} />
        {hasMetricValue(row.rel_volume) && <Metric label={t("Volumen relativo")} value={`${number(row.rel_volume, 2)}x`} />}
        <Metric label={t("ATR 15M")} value={row.atr_pct == null ? "—" : `${number(row.atr_pct, 3)}%`} />
        <Metric label={t("Tendencia 1H")} value={t(trendText(row.trend_1h))} tone={trendTone(row.trend_1h)} />
        <Metric label={t("Alineación")} value={t(alignmentText(row.alignment))} />
      </div>
    );
  }

  const moveTone = (row.change_1h_pct ?? 0) > 0 ? "positive" : (row.change_1h_pct ?? 0) < 0 ? "negative" : "";
  return (
    <div className="radar-specific-metrics">
      <Metric label={t("Variación 1H")} value={row.change_1h_pct == null ? "—" : percent(row.change_1h_pct)} tone={moveTone} />
      {hasMetricValue(row.volume_ratio) && <Metric label={t("Volumen vs. promedio")} value={`${number(row.volume_ratio, 2)}x`} />}
      <Metric label={t("ATR 15M")} value={row.atr_pct == null ? "—" : `${number(row.atr_pct, 3)}%`} />
      <Metric label={t("Tendencia 1H")} value={t(trendText(row.trend_1h))} tone={trendTone(row.trend_1h)} />
    </div>
  );
}

function MarketContext({ row, refreshing }: { row: RadarOpportunity; refreshing: boolean }) {
  const trend = row.trend;
  return (
    <>
      <div className="radar-market-metrics">
        <Metric label={t("Precio actual")} value={price(row.current_price)} />
        <Metric
          label={t("Cambio 24H")}
          value={row.change_24h_pct == null ? "—" : percent(row.change_24h_pct)}
          tone={(row.change_24h_pct ?? 0) > 0 ? "positive" : (row.change_24h_pct ?? 0) < 0 ? "negative" : ""}
        />
        <Metric label={t("Volumen 24H")} value={row.volume_24h == null ? "—" : `${compact(row.volume_24h)} USDT`} />
        <Metric
          label={t("Funding")}
          value={row.funding_rate == null ? "—" : percent(row.funding_rate * 100, 4)}
          tone={(row.funding_rate ?? 0) > 0 ? "negative" : (row.funding_rate ?? 0) < 0 ? "positive" : ""}
        />
        <Metric label={t("Máximo 24H")} value={price(row.high_24h)} />
        <Metric label={t("Mínimo 24H")} value={price(row.low_24h)} />
        {hasMetricValue(row.open_interest) && <Metric label={t("Interés abierto")} value={`${compact(row.open_interest)} USDT`} />}
        {hasMetricValue(row.quote_volume_ratio) && <Metric label={t("Ratio de volumen")} value={`${number(row.quote_volume_ratio, 2)}x`} />}
        {hasMetricValue(row.buy_pct) && <Metric label={t("Flujo comprador")} value={`${number(row.buy_pct, 1)}%`} />}
      </div>
      <div className="radar-timeframe-trends" aria-label={t("Tendencia por temporalidad")}>
        <span className="radar-subsection-label">{t("Tendencia por temporalidad")}</span>
        {(["15M", "1H", "4H"] as const).map((timeframe) => {
          const value = trend?.[timeframe] ?? null;
          return (
            <span className="radar-trend-pill" key={timeframe}>
              <small>{timeframe}</small>
              <strong className={trendTone(value)}>
                {value == null && refreshing ? t("Calculando…") : t(trendText(value))}
              </strong>
            </span>
          );
        })}
      </div>
    </>
  );
}

function scoreComponentLabel(value: string): string {
  const labels: Record<string, string> = {
    structure: "Estructura",
    confluence: "Confluencia",
    momentum: "Momentum",
    liquidity: "Liquidez",
    liquidity_zone: "Zona de liquidez",
    minimum_sweep: "Calidad del barrido",
    recovery_close: "Cierre de recuperación",
    confirmation_volume: "Volumen de confirmación",
    close_position: "Posición del cierre",
    ema_reclaim: "Recuperación de EMA",
    barrier_room_rr: "Espacio para objetivo",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/^./, (first: string) => first.toUpperCase());
}

export default function RadarPage() {
  const { language, quotes } = useApp();
  void language; // Subscribe to language changes so imported translations refresh.
  const { data, loading, error, refresh } = useApi(() => getRadarSnapshot(quotes));
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const radarRows = data;
  const snapshotStatus = radarRows?.snapshot_status ?? "unknown";
  const snapshotRefreshing = Boolean(
    radarRows?.snapshot_refreshing ||
    radarRows?.setups_refreshing ||
    radarRows?.timeframe_trends_refreshing
  );
  useEffect(() => {
    if (!snapshotRefreshing && snapshotStatus !== "warming") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [refresh, snapshotRefreshing, snapshotStatus]);
  const allRows = data ?? [];
  const snapshotMeta = allRows.find((row) => row.snapshot_updated_at);
  const matchingRows = allRows.filter((item) => {
    const matchesFilter = filter === "all" || item.kind === filter;
    const text = `${item.symbol} ${item.label} ${item.detail} ${item.direction ?? ""}`.toLowerCase();
    return matchesFilter && text.includes(query.trim().toLowerCase());
  });
  const summary = {
    setups: allRows.filter((row) => row.kind === "setup").length,
    sweeps: allRows.filter((row) => row.kind === "sweep").length,
    watch: allRows.filter((row) => row.kind === "watch").length,
    moves: allRows.filter((row) => row.kind === "move").length,
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("ANTES DE LA SEÑAL")}
        title={t("Oportunidades en formación.")}
        description={t("Una lectura más completa de cada activo: calidad, contexto de mercado, estructura, volatilidad y niveles relevantes.")}
      >
        <RefreshButton onClick={refresh} loading={loading} />
      </PageHeader>

      <section className="radar-summary-grid" aria-label={t("Resumen del radar")}>
        <div className="radar-summary-card">
          <span>{t("Oportunidades detectadas")}</span>
          <strong>{allRows.length}</strong>
          <small>{t("En el snapshot actual")}</small>
        </div>
        <div className="radar-summary-card">
          <span>{t("Setups activos")}</span>
          <strong>{summary.setups}</strong>
          <small>{t("Con zona y gestión de riesgo")}</small>
        </div>
        <div className="radar-summary-card">
          <span>{t("Barridos recientes")}</span>
          <strong>{summary.sweeps}</strong>
          <small>{t("Liquidez detectada")}</small>
        </div>
        <div className="radar-summary-card">
          <span>{t("En observación")}</span>
          <strong>{summary.watch + summary.moves}</strong>
          <small>{summary.watch} {t("zonas · ")}{summary.moves} {t("movimientos")}</small>
        </div>
      </section>

      <div className="filter-row radar-controls">
        <div className="pair-chips">
          {FILTERS.map((item) => (
            <button
              className={`pair-chip ${filter === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => setFilter(item.key)}
              type="button"
            >
              {t(item.label)}
              <span>{item.key === "all" ? allRows.length : allRows.filter((row) => row.kind === item.key).length}</span>
            </button>
          ))}
        </div>
        <label className="radar-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Buscar par o tipo de oportunidad")}
            aria-label={t("Buscar oportunidades por par o tipo")}
          />
        </label>
        <span className="status-row radar-scan-status">
          <ScanLine size={12} />
          {t("Scanner · 15M / 5M")}{(radarRows?.snapshot_updated_at ?? snapshotMeta?.snapshot_updated_at) ? ` · Actualizado ${ago((radarRows?.snapshot_updated_at ?? snapshotMeta?.snapshot_updated_at)!)}` : ""}{snapshotMeta?.scanned_symbols != null ? ` · ${snapshotMeta.scanned_symbols} activos analizados` : ""}{snapshotStatus === "partial" ? " · Lectura parcial" : ""}{snapshotRefreshing ? " · Actualizando en segundo plano" : ""}
        </span>
      </div>

      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !matchingRows.length}
        emptyText={query
          ? "No hay oportunidades que coincidan con esa búsqueda."
          : snapshotStatus === "warming" || snapshotRefreshing
            ? "El radar está preparando la lectura del mercado y sus temporalidades. Esta pantalla se actualizará automáticamente."
            : "No hay oportunidades en esta categoría. Prueba otra vista del radar."}
      />

      {!loading && !error && matchingRows.length > 0 && (
        <div className="radar-list">
          {matchingRows.map((row, index) => (
            <article className="radar-row radar-opportunity-card" key={`${row.symbol}-${row.kind}-${row.direction ?? "na"}`}>
              <span className="radar-index mono">{String(index + 1).padStart(2, "0")}</span>
              <div className="radar-opportunity-main">
                <div className="radar-opportunity-heading">
                  <div className="asset-pair">
                    <AssetIcon symbol={row.symbol} size={39} />
                    <div>
                      <strong>{row.symbol.replace("USDT", " / USDT")}</strong>
                      <small><Clock3 size={10} /> {ago(row.created_at)}</small>
                    </div>
                  </div>
                  <div className="radar-tag-group">
                    <Tag tone={kindTone(row.kind)} dot>{t(row.label)}</Tag>
                    {row.direction && <Tag tone={row.direction === "LONG" ? "green" : "red"}>{row.direction}</Tag>}
                    {row.status && <Tag tone={row.status === "TOUCHED" ? "blue" : "muted"}>{row.status}</Tag>}
                    {row.visibility && <Tag tone="muted">{row.visibility === "premium" ? "Premium" : row.visibility === "free" ? "Free" : row.visibility}</Tag>}
                  </div>
                </div>

                {row.detail && <p className="radar-description">{row.detail}</p>}

                <div className="radar-data-section">
                  <div className="radar-data-heading"><Activity size={13} /> {t("Datos específicos de la oportunidad")}</div>
                  <OpportunityMetrics row={row} />
                </div>

                <div className="radar-data-section radar-context-section">
                  <div className="radar-data-heading"><Waves size={13} /> {t("Contexto de mercado")}</div>
                  <MarketContext row={row} refreshing={snapshotRefreshing} />
                </div>

                {Object.keys(row.score_breakdown).length > 0 && (
                  <div className="radar-breakdown" aria-label={t("Desglose del score")}>
                    {Object.entries(row.score_breakdown).map(([key, value]) => (
                      <span key={key} title={scoreComponentLabel(key)}>
                        {scoreComponentLabel(key)}
                        <strong className="mono">{number(value, 1)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="radar-score">
                {row.score == null ? <span className="muted">{t("Score —")}</span> : <Score value={Math.round(row.score)} />}
                {row.kind === "move" && row.change_1h_pct != null && (
                  <span className={row.change_1h_pct >= 0 ? "positive" : "negative"}>
                    {row.change_1h_pct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {row.change_1h_pct >= 0 ? "Impulso alcista" : "Impulso bajista"}
                  </span>
                )}
                <Link
                  className="btn btn-secondary"
                  to={row.kind === "setup" ? `/senales?par=${row.symbol}` : `/mercado/flujo/${row.symbol}`}
                >
                  {row.kind === "setup" ? "Ver señal" : "Ver flujo"}
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <Reading title={t("Cómo leer estos datos")}>
        <strong>{t("Score:")}</strong> {t("mide la puntuación que aporta el motor para ese tipo de oportunidad; no es una probabilidad de ganancia. ")}<strong>{t("R:B estimada:")}</strong> {t("compara la distancia entre entrada, stop y primer objetivo del setup. ")}<strong>{t("Volumen relativo:")}</strong> {t("compara la participación reciente con su referencia. Un barrido, una zona cercana o un movimiento anómalo no son por sí solos una señal confirmada: verifica la entrada, el stop y el contexto antes de tomar decisiones.")}</Reading>
      <div className="radar-footer-actions">
        <Link className="btn btn-quiet" to="/guia">
          <ShieldCheck size={14} /> {t("Aprende a interpretar el radar ")}<ArrowRight size={13} />
        </Link>
        <Link className="btn btn-quiet" to="/senales">
          <Target size={14} /> {t("Consultar señales confirmadas ")}<ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
