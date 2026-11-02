import { getIntlLocale } from "@/i18n/translation";
import { t } from "@/i18n/translation";
import { useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Database,
  Info,
  RefreshCw,
  Waves,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { getDerivatives, getSignals } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import type { DerivativesData, DerivativesHistoryPoint, DerivativesSourceMeta } from "@/api/types";
import { ago, number, percent } from "@/utils/format";
import {
  Countdown,
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";

const REFRESH_MS = 45_000;

function usdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${number(value / 1e9, 2)}B`;
  if (abs >= 1e6) return `$${number(value / 1e6, 2)}M`;
  if (abs >= 1e3) return `$${number(value / 1e3, 1)}K`;
  return `$${number(value, 2)}`;
}

function fmtTimestamp(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Sin marca temporal";
  return new Date(value).toLocaleString(getIntlLocale(), {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function ageFromSeconds(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return t("Antigüedad desconocida");
  if (value < 60) return t(`Hace ${Math.round(value)} s`);
  if (value < 3600) return t(`Hace ${Math.floor(value / 60)} min`);
  return t(`Hace ${Math.floor(value / 3600)} h ${Math.floor((value % 3600) / 60)} min`);
}

function statusLabel(status?: string): string {
  switch (status) {
    case "available": return "Disponible";
    case "partial": return "Cobertura parcial";
    case "stale": return "Dato atrasado";
    default: return "No disponible";
  }
}

function statusTone(status?: string): "green" | "amber" | "red" | "muted" {
  if (status === "available") return "green";
  if (status === "partial") return "amber";
  if (status === "stale") return "red";
  return "muted";
}

function chartTime(point: DerivativesHistoryPoint): string {
  if (!point.timestamp || !Number.isFinite(point.timestamp)) return "—";
  return new Date(point.timestamp).toLocaleTimeString(getIntlLocale(), { hour: "2-digit", minute: "2-digit" });
}

function sourceDescription(meta?: DerivativesSourceMeta): string {
  if (!meta) return t("No hay metadatos de fuente.");
  if (meta.status === "unavailable") return t("Binance no devolvió una lectura válida para esta fuente.");
  const age = ageFromSeconds(meta.age_seconds);
  const coverage = meta.coverage_hours != null ? ` · ${number(meta.coverage_hours, 1)} h de cobertura` : "";
  const points = meta.points != null ? ` · ${meta.points} puntos` : "";
  return `${age}${coverage}${points}`;
}

export default function DerivadosPage() {
  const { language } = useApp();
  void language; // Subscribe to language changes so imported translations refresh.
  const { simbolo = "BTCUSDT" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: signals } = useApi(getSignals);
  const { data, loading, error, refresh } = useApi<DerivativesData>(
    () => getDerivatives(simbolo),
    [simbolo],
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh, simbolo]);

  const symbols = [
    ...new Set([
      "BTCUSDT",
      "ETHUSDT",
      ...(signals?.filter((s) => s.status !== "CANCELLED").map((s) => s.symbol) || []),
    ]),
  ];
  const direction = params.get("direccion");
  const fundingRate = data?.funding_rate ?? null;
  const longPct = data?.long_short_ratio?.percent_long ?? null;
  const shortPct = data?.long_short_ratio?.percent_short ?? null;
  const longShortRatio = data?.long_short_ratio?.ratio ?? (
    longPct != null && shortPct != null && shortPct > 0 ? longPct / shortPct : null
  );
  const oiChart = (data?.oi_history ?? []).filter((point) => point.value_usdt != null).map((point) => ({
    label: chartTime(point), value_b: (point.value_usdt ?? 0) / 1e9,
  }));
  const fundingChart = (data?.funding_history ?? []).filter((point) => point.funding_rate_pct != null).map((point) => ({
    label: chartTime(point), funding_pct: point.funding_rate_pct ?? 0,
  }));
  // Plot the exchange-reported per-period basis. Annualized basis remains a
  // separate headline metric and is never fabricated when Binance omits it.
  const basisChart = (data?.basis_history ?? []).filter((point) => point.basis_rate_pct != null).map((point) => ({
    label: chartTime(point), basis_pct: point.basis_rate_pct ?? 0,
  }));
  const sourceEntries = Object.entries(data?.sources ?? {});
  const reading = data?.market_reading;

  return (
    <div>
      <PageHeader
        eyebrow={t("CÓMO ESTÁ POSICIONADO EL MERCADO")}
        title={t("Mira detrás de las posiciones.")}
        description={t("Funding, interés abierto, ratios de cuentas y posiciones, y presión agresiva de compra/venta. Los datos históricos muestran su cobertura y antigüedad.")}
      >
        <RefreshButton loading={loading} onClick={refresh} />
      </PageHeader>
      <div className="filter-row">
        <div className="pair-chips">
          {symbols.map((symbol) => (
            <button
              className={`pair-chip ${symbol === simbolo ? "active" : ""}`}
              key={symbol}
              onClick={() => navigate(`/derivados/${symbol}${direction ? `?direccion=${direction}` : ""}`)}
            >
              {symbol.replace("USDT", "")}
            </button>
          ))}
        </div>
        <div className="derivatives-header-status">
          <span className="derivatives-refresh-dot" />
          {t("Actualización automática cada 45 s")}</div>
        <Link className="btn btn-blue" to={`/mercado/flujo/${simbolo}`}>
          <Waves size={12} /> {t("Ver flujo del par ")}<ArrowUpRight size={12} />
        </Link>
      </div>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && !loading && (
        <>
          <div className="overview-metrics derivatives-metrics">
            <div className="overview-metric">
              <div className="metric-label">{t("Funding actual ")}<Info size={12} /></div>
              <div className={`metric-value ${fundingRate == null ? "" : fundingRate >= 0 ? "positive" : "negative"}`}>
                {percent(fundingRate == null ? null : fundingRate * 100, 4)}
              </div>
              <div className="metric-note">
                {fundingRate == null ? "Sin dato del proveedor" : fundingRate >= 0 ? "Los largos pagan a los cortos" : "Los cortos pagan a los largos"}
              </div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">{t("Próximo funding ")}<Clock3 size={12} /></div>
              <div className="metric-value">{data.funding_next ? <Countdown until={data.funding_next} /> : "—"}</div>
              <div className="metric-note">{t("Liquidación estimada del contrato")}</div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">{t("Interés abierto actual ")}<Database size={12} /></div>
              <div className="metric-value">{usdCompact(data.open_interest)}</div>
              <div className="metric-note">
                {data.open_interest_contracts != null ? `${number(data.open_interest_contracts, 2)} unidades base · ${data.open_interest_updated_at ? ago(data.open_interest_updated_at) : "sin hora de fuente"}` : "Notional actual no disponible"}
              </div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">{t("Prima mark / index ")}<Info size={12} /></div>
              <div className={`metric-value ${data.mark_index_delta == null ? "" : data.mark_index_delta >= 0 ? "positive" : "negative"}`}>
                {percent(data.mark_index_delta, 4)}
              </div>
              <div className="metric-note">{t("Diferencia de precio: ")}{data.basis_usdt == null ? "—" : number(data.basis_usdt, 4)} USDT</div>
            </div>
          </div>

          <div className="derivatives-chart-grid">
            <section className="panel panel-pad derivatives-chart-panel">
              <SectionHeader title={t("Interés abierto · últimas 26 horas")} subtitle={t("Serie histórica en valor USDT, separada de la lectura actual.")} />
              <div className="derivatives-chart-kpis">
                <div><span>{t("Cambio 1H")}</span><strong className={(data.oi_change_1h ?? 0) >= 0 ? "positive" : "negative"}>{percent(data.oi_change_1h, 2)}</strong></div>
                <div><span>{t("Cambio 24H")}</span><strong className={(data.oi_change_24h ?? 0) >= 0 ? "positive" : "negative"}>{percent(data.oi_change_24h, 2)}</strong></div>
                <div><span>{t("Cobertura")}</span><strong>{number(data.oi_history_coverage_hours, 1)} h</strong></div>
              </div>
              {oiChart.length > 1 ? (
                <div className="derivatives-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={oiChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" minTickGap={24} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <YAxis tickFormatter={(value: number) => `${number(value, 2)}B`} width={64} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`$${number(Number(value), 3)}B`, "OI histórico"]} />
                      <Line type="monotone" dataKey="value_b" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="derivatives-chart-empty">{t("Se necesita más historial para dibujar la evolución del OI.")}</div>}
              <div className="detail-row"><span>{t("Variación del precio en 24H")}</span><strong className={`mono ${data.price_change_24h_pct == null ? "" : data.price_change_24h_pct >= 0 ? "positive" : "negative"}`}>{percent(data.price_change_24h_pct, 2)}</strong></div>
              <p className="slim-note"><Info size={12} />{t("El cambio de 24H solo se muestra si el historial contiene cobertura temporal suficiente.")}</p>
            </section>
            <section className="panel panel-pad derivatives-chart-panel">
              <SectionHeader title={t("Histórico de funding")} subtitle={t("Últimas tasas de financiación reportadas por Binance; no son eventos de liquidación.")} />
              <div className="derivatives-chart-kpis">
                <div><span>{t("Funding anualizado estimado")}</span><strong className={(data.funding_annualized_pct ?? 0) >= 0 ? "positive" : "negative"}>{percent(data.funding_annualized_pct, 2)}</strong></div>
                <div><span>{t("Intervalo observado")}</span><strong>{data.funding_interval_hours == null ? "—" : `${number(data.funding_interval_hours, 1)} h`}</strong></div>
              </div>
              {fundingChart.length > 1 ? (
                <div className="derivatives-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={fundingChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" minTickGap={24} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <YAxis tickFormatter={(value: number) => `${number(value, 3)}%`} width={64} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${number(Number(value), 5)}%`, "Funding"]} />
                      <ReferenceLine y={0} stroke="var(--border-strong)" />
                      <Line type="monotone" dataKey="funding_pct" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : fundingChart.length === 1 ? (
                <div className="derivatives-chart-empty">{t("Último dato válido: ")}{percent(fundingChart[0].funding_pct, 5)} · {fundingChart[0].label}{t(". Se necesita otro registro para dibujar la evolución.")}</div>
              ) : <div className="derivatives-chart-empty">{t("Binance todavía no ha devuelto tasas históricas de funding válidas para este par.")}</div>}
              <p className="slim-note"><Info size={12} />{t("El funding anualizado es una extrapolación basada en el intervalo observado; no es una rentabilidad garantizada.")}</p>
            </section>
            <section className="panel panel-pad derivatives-chart-panel derivatives-basis-panel">
              <SectionHeader title={t("Base del contrato · histórico")} subtitle={t("Evolución de la base por período reportada por Binance. La tasa anualizada se muestra aparte solo cuando el proveedor la entrega.")} />
              <div className="derivatives-chart-kpis">
                <div><span>{t("Base por período")}</span><strong className={(data.basis_rate_pct ?? 0) >= 0 ? "positive" : "negative"}>{percent(data.basis_rate_pct, 4)}</strong></div>
                <div><span>{t("Base anualizada")}</span><strong className={(data.annualized_basis_pct ?? 0) >= 0 ? "positive" : "negative"}>{percent(data.annualized_basis_pct, 2)}</strong></div>
                <div><span>{t("Cobertura")}</span><strong>{number(data.basis_coverage_hours, 1)} h</strong></div>
              </div>
              {basisChart.length > 1 ? (
                <div className="derivatives-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={basisChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" minTickGap={24} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <YAxis tickFormatter={(value: number) => `${number(value, 2)}%`} width={64} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${number(Number(value), 4)}%`, "Base por período"]} />
                      <ReferenceLine y={0} stroke="var(--border-strong)" />
                      <Line type="monotone" dataKey="basis_pct" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : basisChart.length === 1 ? (
                <div className="derivatives-chart-empty">{t("Último dato válido de base: ")}{percent(basisChart[0].basis_pct, 4)} · {basisChart[0].label}{t(". Se necesita otro registro para dibujar la evolución.")}</div>
              ) : <div className="derivatives-chart-empty">{t("Binance todavía no ha devuelto valores válidos de base por período para este par.")}</div>}
              <p className="slim-note"><Info size={12} />{t("La base por período y la base anualizada son métricas distintas. No se calcula una anualización cuando Binance no entrega ese campo.")}</p>
            </section>
          </div>

          <div className="two-col derivatives-positioning-grid derivatives-positioning-grid-single">
            <section className="panel panel-pad">
              <SectionHeader title={t("Posicionamiento de las cuentas")} subtitle={t("Ratio de cuentas long/short y cambio real de su distribución.")} />
              <div className="ratio-numbers">
                <div className="positive"><strong>{number(longPct, 1)}{longPct == null ? null : <span>%</span>}</strong><span>{t("Cuentas net-long")}</span></div>
                <div className="negative"><strong>{number(shortPct, 1)}{shortPct == null ? null : <span>%</span>}</strong><span>{t("Cuentas net-short")}</span></div>
              </div>
              <div className="bar-track ratio-bar"><span className="buy" style={{ width: `${Math.min(100, Math.max(0, longPct ?? 0))}%` }} /><span className="sell" style={{ width: `${Math.min(100, Math.max(0, shortPct ?? 0))}%` }} /></div>
              <div className="detail-row"><span>{t("Ratio long / short (último registro 1H)")}</span><strong className="mono">{number(longShortRatio, 3)}</strong></div>
              <div className="detail-row"><span>{t("Ratio de hace 24H")}</span><strong className="mono">{number(data.long_short_ratio.ratio_24h_ago, 3)}</strong></div>
              <div className="detail-row"><span>{t("Cuentas long hace 24H")}</span><strong className="mono">{percent(data.long_short_ratio.percent_long_24h_ago, 1)}</strong></div>
              <div className="detail-row"><span>{t("Cuentas short hace 24H")}</span><strong className="mono">{percent(data.long_short_ratio.percent_short_24h_ago, 1)}</strong></div>
              <div className="derivatives-mini-meta">{t("Fuente: ratio global de cuentas · ")}{data.long_short_ratio.updated_at ? ago(data.long_short_ratio.updated_at) : "marca temporal no disponible"} {t("· cobertura ")}{number(data.long_short_ratio.coverage_hours, 1)} h</div>
              <Reading title={t("Cómo interpretarlo")}>{t("Una mayoría en un lado no confirma una tendencia. El ratio describe cuentas, no tamaño de posiciones ni dirección garantizada del próximo movimiento.")}</Reading>
              <div className="detail-row"><span>{t("Cambio de interés abierto en 1 hora")}</span><strong className={`mono ${data.oi_change_1h == null ? "" : data.oi_change_1h >= 0 ? "positive" : "negative"}`}>{percent(data.oi_change_1h, 2)}</strong></div>
              <div className="detail-row"><span>{t("Cambio de interés abierto en 24 horas")}</span><strong className={`mono ${data.oi_change_24h == null ? "" : data.oi_change_24h >= 0 ? "positive" : "negative"}`}>{percent(data.oi_change_24h, 2)}</strong></div>
              {data.reading && <Reading title={t("Lectura base de KERYNTIX MARKET DESK")}>{data.reading}</Reading>}
            </section>
          </div>

          <section className="panel panel-pad derivatives-taker-panel">
            <SectionHeader title={t("Presión agresiva de compra y venta")} subtitle={t("Volumen taker agregado por ventanas. Las ventanas de 1H y 4H requieren 4 y 16 muestras de 15 minutos respectivamente.")} />
            <div className="derivatives-flow-grid">
              {(data.taker_flow?.windows ?? []).map((window) => (
                <article className="derivatives-flow-card" key={window.label}>
                  <div className="derivatives-flow-card-head"><span>{window.label}</span><Tag tone={window.status === "available" ? "green" : window.status === "partial" ? "amber" : "muted"}>{t(statusLabel(window.status))}</Tag></div>
                  <div className="derivatives-flow-buy">{percent(window.buy_pct, 1)} <span>{t("compras taker")}</span></div>
                  <div className="bar-track ratio-bar"><span className="buy" style={{ width: `${Math.min(100, Math.max(0, window.buy_pct ?? 0))}%` }} /><span className="sell" style={{ width: `${Math.min(100, Math.max(0, window.sell_pct ?? 0))}%` }} /></div>
                  <div className="detail-row"><span>{t("Ratio buy/sell")}</span><strong>{number(window.buy_sell_ratio, 3)}</strong></div>
                  <div className="detail-row"><span>{t("Delta volumen base")}</span><strong className={(window.delta_volume ?? 0) >= 0 ? "positive" : "negative"}>{number(window.delta_volume, 3)}</strong></div>
                  <div className="detail-row"><span>{t("Volumen compra / venta")}</span><strong>{number(window.buy_volume, 2)} / {number(window.sell_volume, 2)}</strong></div>
                  <div className="derivatives-mini-meta">{window.points}/{window.required_points} {t("muestras · ")}{window.updated_at ? ago(window.updated_at) : "sin timestamp"}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel panel-pad derivatives-reading-panel">
            <SectionHeader title={t("Lectura combinada de derivados")} subtitle={t("Resumen explicable de funding, OI, posicionamiento y flujo; no es una señal automática de trading.")} />
            <div className="derivatives-reading-summary">
              <Tag tone={reading?.bias === "comprador" ? "green" : reading?.bias === "vendedor" ? "red" : reading?.bias === "mixto" ? "amber" : "muted"}>
                {reading?.bias ? `Contexto ${reading.bias}` : "Contexto insuficiente"}
              </Tag>
              <p>{reading?.summary ?? "No hay suficientes métricas verificables para generar una lectura combinada."}</p>
            </div>
            {reading?.factors?.length ? <ul className="derivatives-reading-factors">{reading.factors.map((factor, index) => <li key={`${index}-${factor}`}>{factor}</li>)}</ul> : <div className="derivatives-chart-empty">{t("Las fuentes todavía no ofrecen suficientes factores para una interpretación combinada.")}</div>}
          </section>

          <section className="panel panel-pad derivatives-quality-panel">
            <SectionHeader title={t("Calidad y frescura de las fuentes")} subtitle={`Respuesta consultada ${data.updated_at ? ago(data.updated_at) : "sin timestamp"} · los históricos se actualizan con la cadencia publicada por Binance, no en cada tick.`} />
            <div className="derivatives-source-grid">
              {sourceEntries.map(([key, meta]) => (
                <div className="derivatives-source-card" key={key}>
                  <div><strong>{key.replace(/_/g, " ")}</strong><Tag tone={statusTone(meta.status)}>{t(statusLabel(meta.status))}</Tag></div>
                  <p>{sourceDescription(meta)}</p>
                  {meta.updated_at && <small>{fmtTimestamp(meta.updated_at)}</small>}
                </div>
              ))}
            </div>
          </section>

          {direction && (
            <div className="signal-context-reading">
              <Tag tone={direction === "LONG" ? "green" : "red"}>{t("Tu señal ")}{direction}</Tag>
              <p>{direction === "LONG"
                ? "Contrasta tu LONG con funding, evolución del OI, flujo taker y concentración de cuentas. La mayoría puede reforzar una tendencia, pero también elevar el riesgo de un barrido contrario."
                : "Contrasta tu SHORT con funding, evolución del OI, flujo taker y concentración de cuentas. Un mercado cargado de longs no confirma por sí solo que el precio vaya a caer."}</p>
              <Link className="link-accent" to={`/senales?par=${simbolo}`}>{t("Volver a la señal ")}<ArrowRight size={12} /></Link>
            </div>
          )}
          <p className="slim-note"><Info size={12} />{t("El interés abierto no revela por sí solo si el capital nuevo es comprador o vendedor. Ratios long/short, funding y flujo miden cosas distintas; confirma su timestamp y cobertura antes de interpretarlos.")}</p>
        </>
      )}
      {data && error && <div className="derivatives-stale-banner"><RefreshCw size={14} />{t("No se pudo actualizar el snapshot. Se conserva el último dato visible; pulsa actualizar para reintentar. Error: ")}{error}</div>}
    </div>
  );
}
