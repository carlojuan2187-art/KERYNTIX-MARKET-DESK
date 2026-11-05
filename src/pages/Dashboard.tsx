import { getIntlLocale } from "@/i18n/translation";
import { t } from "@/i18n/translation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Gauge,
  Info,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import { getCalendarEvents } from "@/api";
import {
  getOverview,
  regimeContext,
  type AssetQuote,
  type OverviewData,
} from "@/api/terminal";
import type { MarketRegime } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { ago, compact, dateTime, number, percent, price } from "@/utils/format";
import {
  AssetIcon,
  PageHeader,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { HistoryChart, MarketChart } from "@/components/Charts";
import { Sparkline } from "@/components/Sparkline";
import { SignalTable } from "@/components/SignalTable";
import { subscribeWs } from "@/api/events";

export function RegimePanel({
  regime,
  breadth: overrideBreadth,
  timeframeLabel = "4H",
}: {
  regime: MarketRegime;
  breadth?: number | null;
  timeframeLabel?: string;
}) {
  const context = regimeContext(regime);
  const breadth = overrideBreadth ?? (regime.market_breadth == null ? null : Math.round(regime.market_breadth * 100));
  return (
    <section className="context-panel panel">
      <div className="context-heading">
        <h2>{t("Régimen de mercado")}</h2>
        <Gauge size={13} className="muted" />
      </div>
      <div className="context-trend" style={{ color: context.color }}>
        {regime.trend === "TENDENCIA BAJISTA" ? (
          <TrendingDown size={19} />
        ) : regime.trend === "TENDENCIA ALCISTA" ? (
          <TrendingUp size={19} />
        ) : (
          <Activity size={19} />
        )}
        <div>
          <strong>{t(context.label)}</strong>
          <small>{t("BTC/USDT · Contexto ")}{timeframeLabel}</small>
        </div>
      </div>
      <div className="regime-gauge">
        <svg viewBox="0 0 190 107" aria-hidden="true">
          <path
            d="M18 90a77 77 0 0 1 154 0"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M18 90a77 77 0 0 1 154 0"
            fill="none"
            stroke="var(--red)"
            strokeWidth="7"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="22 78"
            opacity=".6"
          />
          <path
            d="M18 90a77 77 0 0 1 154 0"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="7"
            pathLength="100"
            strokeDasharray="32 68"
            strokeDashoffset="-25"
            opacity=".7"
          />
          <path
            d="M18 90a77 77 0 0 1 154 0"
            fill="none"
            stroke="var(--green)"
            strokeWidth="7"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="40 60"
            strokeDashoffset="-60"
          />
          {breadth != null && (
            <circle
              cx={95 + 77 * Math.cos(Math.PI * (1 - breadth / 100))}
              cy={90 - 77 * Math.sin((Math.PI * breadth) / 100)}
              r="5"
              fill="var(--text)"
              stroke="var(--surface)"
              strokeWidth="3"
            />
          )}
        </svg>
        <div className="gauge-value">
          {breadth == null ? "—" : breadth}
          <span>{t("Amplitud alcista del mercado (%)")}</span>
        </div>
      </div>
      <div className="gauge-labels">
        <span>{t("Bajista")}</span>
        <span>{t("Neutral")}</span>
        <span>{t("Alcista")}</span>
      </div>
      <div className="context-stats">
        <div>
          <span>{t("Fuerza · ADX")}</span>
          <strong className="mono">
            {number(regime.adx, 1)}{" "}
            <span
              style={{
                display: "inline",
                fontSize: 8,
                color: regime.adx != null && regime.adx >= 25 ? "var(--green)" : "var(--amber)",
              }}
            >
              {t(context.strength)}
            </span>
          </strong>
        </div>
        <div>
          <span>{t("Volatilidad · ATR")}</span>
          <strong className="mono">{number(regime.atr_pct)}%</strong>
        </div>
      </div>
      <p className="context-reading">{t(context.reading)}</p>
      <div className="context-footer">
        <span>
          <span className="live-dot" />
          {regime.session_now}
        </span>
        <Link to="/regimen" className="link-accent">
          {t("Ver análisis")}<ChevronRight size={11} />
        </Link>
      </div>
    </section>
  );
}
function Metrics({ data }: { data: OverviewData }) {
  const { signals, liquidations: liq, regime } = data;
  const breadth = data.breadth_pct;
  return (
    <div className="overview-metrics">
      <Link className="overview-metric" to="/senales">
        <div className="metric-label">{t("Señales activas ")}<Zap /></div>
        <div className="metric-main"><span className="metric-value">{signals.length.toString().padStart(2, "0")}</span><Tag tone="green" dot>{t("En seguimiento")}</Tag></div>
        <div className="metric-note"><span className="small-dot" style={{ color: "var(--amber)" }} />{signals.filter((s) => s.status === "PENDING").length} {t("pendientes ")}<span className="separator-dot">·</span> {signals.filter((s) => s.status === "TOUCHED").length} {t("entradas tocadas")}</div>
      </Link>
      <Link className="overview-metric" to="/regimen">
        <div className="metric-label">{t("Régimen de mercado ")}<Activity /></div>
        <div className="metric-main"><span className="metric-value metric-value-text">{t(regime.trend || "Sin lectura")}</span></div>
        <div className="metric-note">{t("Contexto de mercado · 4H")}</div>
      </Link>
      <Link className="overview-metric" to="/mercado">
        <div className="metric-label">{t("Amplitud del mercado ")}<ChartNoAxesCombined /></div>
        <div className="metric-main"><span className="metric-value">{breadth == null ? "—" : `${number(breadth, 1)}%`}</span></div>
        <div className="metric-note">{t("Participación alcista de los pares medidos")}</div>
      </Link>
      <Link className="overview-metric" to="/mercado/liquidaciones">
        <div className="metric-label">{t("Liquidaciones ")}<span>{t("15 min")}</span></div>
        <div className="metric-main"><span className="metric-value">{liq.total > 0 ? compact(liq.total) : "—"}</span><span className="small muted">USDT</span></div>
        <div className="metric-note">{liq.status === "unavailable" ? t("Datos temporalmente no disponibles") : `${liq.pairs.length} ${t("pares")} · ${liq.orders} ${t("eventos")}`}</div>
      </Link>
    </div>
  );
}
function SignalsPreview({ data }: { data: OverviewData }) {
  return (
    <section className="signals-preview panel">
      <div className="section-padding">
        <SectionHeader
          title={t("Señales en tu radar")}
          subtitle={t("Setups con entrada definida. Sin perseguir el precio.")}
        >
          <Link to="/senales" className="link-subtle">
            {t("Ver todas")}<ArrowUpRight size={13} />
          </Link>
        </SectionHeader>
      </div>
      <SignalTable signals={data.signals.slice(0, 3)} />
      <div className="signal-disclaimer">
        <ShieldCheck size={12} />
        {t("No persigas el precio; espera la zona indicada.")}</div>
    </section>
  );
}
function ActivityPreview({ data }: { data: OverviewData }) {
  return (
    <section className="activity-panel panel">
      <SectionHeader title={t("El mercado se mueve")}>
        <Bell size={13} className="muted" />
      </SectionHeader>
      <div className="activity-list">
        {data.alerts.map((alert, i) => (
          <Link
            key={alert.id}
            className="activity-item"
            to={
              alert.kind === "liq"
                ? "/mercado/liquidaciones"
                : alert.symbol
                  ? `/mercado/flujo/${alert.symbol}`
                  : "/mercado"
            }
          >
            <span
              className={`activity-icon ${i === 0 ? "red" : i === 2 ? "amber" : ""}`}
            >
              {i === 0 ? (
                <Waves size={13} />
              ) : i === 1 ? (
                <TrendingUp size={13} />
              ) : (
                <Activity size={13} />
              )}
            </span>
            <div>
              <h3>{t(alert.title || (alert.kind === "liq" ? "Liquidaciones" : alert.kind === "mov" ? "Movimiento de mercado" : "Aviso de volumen"))}{alert.symbol ? ` · ${alert.symbol.replace("USDT", "")}` : ""}</h3>
              <p>{t(alert.text)}</p>
              <time>
                {ago(alert.created_at)}
                <ArrowUpRight
                  size={10}
                  style={{ display: "inline", marginLeft: 5 }}
                />
              </time>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
function WatchlistPreview({ data }: { data: OverviewData }) {
  const { user } = useApp();
  const [mode, setMode] = useState("watchlist");
  const selected =
    mode === "watchlist"
      ? data.quotes.filter((q) =>
          user?.watchlist.some((w) => w.symbol === q.symbol),
        )
      : [...data.quotes].sort((a, b) => {
          if (a.change_pct == null && b.change_pct == null) return 0;
          if (a.change_pct == null) return 1;
          if (b.change_pct == null) return -1;
          return b.change_pct - a.change_pct;
        });
  return (
    <section className="watchlist-preview panel">
      <div className="section-padding">
        <SectionHeader
          title={
            t(mode === "watchlist" ? "Tu mercado, de un vistazo" : "Los que marcan el ritmo")
          }
        >
          <div className="timeframes">
            <button
              className={mode === "watchlist" ? "active" : ""}
              onClick={() => setMode("watchlist")}
            >
              {t("Mi watchlist")}</button>
            <button
              className={mode === "movers" ? "active" : ""}
              onClick={() => setMode("movers")}
            >
              {t("En movimiento")}</button>
          </div>
        </SectionHeader>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Activo")}</th>
              <th>{t("Precio")}</th>
              <th>{t("Cambio 24h")}</th>
              <th>{t("Últimas 24h")}</th>
              <th>{t("Volumen 24h")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {selected.slice(0, 4).map((q) => (
              <tr key={q.symbol}>
                <td>
                  <Link
                    className="asset-pair"
                    to={`/mercado/flujo/${q.symbol}`}
                  >
                    <AssetIcon symbol={q.symbol} size={28} />
                    <div>
                      <strong>{q.name}</strong>
                      <small>{q.symbol.replace("USDT", "")} / USDT</small>
                    </div>
                  </Link>
                </td>
                <td className="mono">{price(q.price)}</td>
                <td
                  className={`mono ${q.change_pct == null ? "muted" : q.change_pct >= 0 ? "positive" : "negative"}`}
                >
                  {percent(q.change_pct)}
                </td>
                <td>
                  <Sparkline
                    values={q.sparkline}
                    positive={q.change_pct != null && q.change_pct >= 0}
                    width={78}
                    height={23}
                  />
                </td>
                <td className="mono muted">${compact(q.volume_24h)}</td>
                <td>
                  <Link
                    className="icon-button"
                    to={`/mercado/flujo/${q.symbol}`}
                    aria-label={`${t("Analizar")} ${q.name}`}
                  >
                    <ArrowUpRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!selected.length && (
        <p className="slim-note" style={{ padding: 20 }}>
          {t("Agrega tus primeros pares desde")}{" "}
          <Link to="/watchlist" className="positive">
            {t("Mi watchlist")}</Link>
          .
        </p>
      )}
    </section>
  );
}
function CalendarPreview() {
  const { user } = useApp();
  const { data: events } = useApi(() => getCalendarEvents());
  return (
    <section className="calendar-preview panel">
      <SectionHeader title={t("En el horizonte")}>
        <Link to="/calendario" className="link-subtle">
          <CalendarDays size={13} />
        </Link>
      </SectionHeader>
      {events?.slice(0, 3).map((event) => (
        <Link to="/calendario" className="calendar-mini-event" key={event.id}>
          <div className="calendar-date">
            <span>
              {new Date(event.date)
                .toLocaleDateString(getIntlLocale(), {
                  month: "short",
                  timeZone: user?.tz,
                })
                .toUpperCase()}
            </span>
            <strong>
              {new Date(event.date).toLocaleDateString(getIntlLocale(), {
                day: "2-digit",
                timeZone: user?.tz,
              })}
            </strong>
          </div>
          <div>
            <h3>{t(event.title)}</h3>
            <p>{dateTime(event.date, user?.tz)}</p>
            <Tag tone={event.impact === "alto" ? "red" : "amber"} dot>
              {t("Impacto ")}{event.impact}
            </Tag>
          </div>
        </Link>
      ))}
    </section>
  );
}
function MarketMap({ quotes }: { quotes: AssetQuote[] }) {
  return (
    <section className="market-map-section">
      <SectionHeader
        title={t("Mapa del mercado")}
        subtitle={t("Variación en 24h. Selecciona un activo para leer su flujo.")}
      >
        <Tag tone="muted">USDT-M</Tag>
      </SectionHeader>
      <div className="market-map">
        {quotes.slice(0, 12).map((q, index) => (
          <Link
            to={`/mercado/flujo/${q.symbol}`}
            key={q.symbol}
            className={`map-cell map-cell-${index} ${q.change_pct == null ? "" : q.change_pct >= 0 ? "map-positive" : "map-negative"}`}
            style={
              {
                "--intensity": Math.min(
                  0.42,
                  0.1 + Math.abs(q.change_pct ?? 0) * 0.045,
                ),
              } as React.CSSProperties
            }
          >
            <div className="map-symbol">
              <AssetIcon symbol={q.symbol} size={index < 3 ? 30 : 22} />
              <strong>{q.symbol.replace("USDT", "")}</strong>
              <ArrowUpRight size={12} />
            </div>
            <div className="map-change">{percent(q.change_pct)}</div>
            {index < 3 && (
              <span className="map-price mono">{price(q.price)} USDT</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
function PanoramaView({ data }: { data: OverviewData }) {
  return (
    <div className="panorama-view">
      <div className="panorama-first-grid">
        <MarketMap quotes={data.quotes} />
        <section className="panorama-brief">
          <div className="eyebrow">{t("RÉGIMEN REPORTADO POR EL BACKEND")}</div>
          <h2>{t(regimeContext(data.regime).label)}<span>.</span></h2>
          <p>
            {t("Esta lectura resume el régimen que informó el backend. Confirma la cobertura, el flujo y el precio antes de decidir una operación.")}</p>
          <div className="breadth-visual">
            <svg
              viewBox="0 0 130 130"
              aria-label={data.breadth_pct == null ? "Amplitud del mercado no disponible" : `${number(data.breadth_pct, 1)} por ciento de pares al alza`}
            >
              <circle
                cx="65"
                cy="65"
                r="52"
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="9"
              />
              {data.breadth_pct != null && (
                <circle
                  cx="65"
                  cy="65"
                  r="52"
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="9"
                  pathLength="100"
                  strokeDasharray={`${data.breadth_pct} ${100 - data.breadth_pct}`}
                  strokeLinecap="round"
                  transform="rotate(-90 65 65)"
                />
              )}
            </svg>
            <div>
              <strong>
                {data.breadth_pct == null ? "—" : number(data.breadth_pct, 1)}{data.breadth_pct == null ? null : <span>%</span>}
              </strong>
              <span>{t("del mercado al alza")}</span>
            </div>
          </div>
          <div className="panorama-breadth-labels">
            <span>
              <i className="small-dot positive" />
              {data.breadth.up == null ? "—" : data.breadth.up} {t("suben")}</span>
            <span>
              <i className="small-dot negative" />
              {data.breadth.down == null ? "—" : data.breadth.down} {t("bajan")}</span>
          </div>
          <Link to="/regimen" className="btn btn-secondary">
            {t("Entender el contexto")}<ArrowRight size={13} />
          </Link>
        </section>
      </div>
      <div className="panorama-second-grid">
        <MarketChart panorama />
        <section className="panorama-performance panel panel-pad">
          <SectionHeader title={t("Disciplina que se puede medir")}>
            <ChartNoAxesCombined size={15} className="muted" />
          </SectionHeader>
          <div className={`performance-big ${data.performance.total_r < 0 ? "negative" : "positive"}`}>
            {data.performance.operations ? `${data.performance.total_r > 0 ? "+" : ""}${number(data.performance.total_r)}` : "—"}
            {data.performance.operations ? <span>R</span> : null}
          </div>
          <p className="small muted">{t("Tu rendimiento personal · 30 días")}</p>
          <HistoryChart data={data.performance.curve} height={145} hideAxis />
          <div className="detail-row">
            <span>{t("Operaciones cerradas")}</span>
            <strong className="mono">{data.performance.operations}</strong>
          </div>
          <div className="detail-row">
            <span>{t("Win rate")}</span>
            <strong className="mono positive">
              {data.performance.operations ? `${number(data.performance.win_rate, 1)}%` : "—"}
            </strong>
          </div>
          <Link className="link-accent" to="/resultados">
            {t("Explorar los resultados")}<ArrowUpRight size={13} />
          </Link>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <SignalsPreview data={data} />
        <ActivityPreview data={data} />
      </div>
    </div>
  );
}
export default function DashboardPage() {
  const { variant, quotes: liveQuotes } = useApp();
  const { data, loading, error, refresh } = useApi(getOverview);
  // Overview statistics are REST snapshots. Merge the global live quote stream
  // into every price-backed dashboard view so these values don't freeze until
  // the user manually refreshes the page.
  const liveQuoteMap = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
  const displayData = data ? {
    ...data,
    quotes: data.quotes.map((snapshot) => {
      const live = liveQuoteMap.get(snapshot.symbol);
      return live ? {
        ...snapshot,
        price: live.price,
        change_pct: live.change_pct,
        volume_24h: live.volume_24h,
        high_24h: live.high_24h,
        low_24h: live.low_24h,
        funding_rate: live.funding_rate,
        sparkline: live.sparkline,
      } : snapshot;
    }),
  } : null;
  useEffect(
    () =>
      subscribeWs((event) => {
        if (event.channel === "signals") void refresh();
      }),
    [refresh],
  );
  // If any optional dashboard source timed out, retry in the background while
  // keeping the already-rendered page visible. Do not poll while hidden.
  useEffect(() => {
    if (!data?.partial) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [data?.partial, refresh]);
  return (
    <div>
      <PageHeader
        eyebrow={t(
          variant === "terminal"
            ? "CENTRO DE OPERACIONES · DATOS DEL BACKEND"
            : "VISTA PANORÁMICA · DATOS DEL BACKEND",
        )}
        title={t(
          variant === "terminal"
            ? "El pulso del mercado."
            : "Conecta las señales del mercado.",
        )}
        description={t(
          variant === "terminal"
            ? "Menos ruido. Más contexto para tu próxima decisión."
            : "Precio, participación y oportunidades. La visión completa, sin perder el foco.",
        )}
      >
        <RefreshButton onClick={refresh} loading={loading} />
        <Link to="/senales" className="btn btn-primary">
          {t("Explorar señales")}<ArrowUpRight size={14} />
        </Link>
      </PageHeader>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {displayData && !loading && !error && displayData.partial && (
        <div className="slim-note" role="status" style={{ margin: "0 0 12px" }}>
          {t("Algunos módulos están tardando en responder. Mostramos los datos disponibles y volverán a consultarse al actualizar.")}</div>
      )}
      {displayData && !loading && !error && (
        <>
          {variant === "terminal" ? (
            <>
              <Metrics data={displayData} />
              <div className="dashboard-main-grid">
                <MarketChart />
                <RegimePanel regime={displayData.regime} />
              </div>
              <div className="dashboard-bottom-grid">
                <SignalsPreview data={displayData} />
                <ActivityPreview data={displayData} />
              </div>
              <div className="dashboard-extra-grid">
                <WatchlistPreview data={displayData} />
                <CalendarPreview />
              </div>
            </>
          ) : (
            <PanoramaView data={displayData} />
          )}
          <div className="dashboard-bottom-note">
            <span>
              <Info size={11} />
              {t("Cotizaciones, velas y métricas proceden de los servicios conectados. Si un servicio no dispone de datos, el módulo mostrará su error o estado de recopilación.")}
            </span>
            <Link to="/guia">
              {t("Aprende a interpretar los datos")}<CircleHelp size={11} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
