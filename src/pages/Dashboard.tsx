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
  Flame,
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
import { HistoryChart, MarketChart, Sparkline } from "@/components/Charts";
import { SignalTable } from "@/components/SignalTable";
import { subscribeWs } from "@/api/events";

export function RegimePanel({
  regime,
  breadth: overrideBreadth,
}: {
  regime: MarketRegime;
  breadth?: number | null;
}) {
  const context = regimeContext(regime);
  const breadth = overrideBreadth ?? (regime.market_breadth == null ? null : Math.round(regime.market_breadth * 100));
  return (
    <section className="context-panel panel">
      <div className="context-heading">
        <h2>Régimen de mercado</h2>
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
          <strong>{context.label}</strong>
          <small>BTC/USDT · Contexto 4H</small>
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
          <span>Amplitud alcista del mercado (%)</span>
        </div>
      </div>
      <div className="gauge-labels">
        <span>Bajista</span>
        <span>Neutral</span>
        <span>Alcista</span>
      </div>
      <div className="context-stats">
        <div>
          <span>Fuerza · ADX</span>
          <strong className="mono">
            {number(regime.adx, 1)}{" "}
            <span
              style={{
                display: "inline",
                fontSize: 8,
                color: regime.adx >= 25 ? "var(--green)" : "var(--amber)",
              }}
            >
              {context.strength}
            </span>
          </strong>
        </div>
        <div>
          <span>Volatilidad · ATR</span>
          <strong className="mono">{number(regime.atr_pct)}%</strong>
        </div>
      </div>
      <p className="context-reading">{context.reading}</p>
      <div className="context-footer">
        <span>
          <span className="live-dot" />
          {regime.session_now}
        </span>
        <Link to="/regimen" className="link-accent">
          Ver análisis
          <ChevronRight size={11} />
        </Link>
      </div>
    </section>
  );
}
function Metrics({ data }: { data: OverviewData }) {
  const { performance: p, signals, liquidations: liq } = data;
  return (
    <div className="overview-metrics">
      <Link className="overview-metric" to="/senales">
        <div className="metric-label">
          Señales activas
          <Zap />
        </div>
        <div className="metric-main">
          <span className="metric-value">
            {signals.length.toString().padStart(2, "0")}
          </span>
          <Tag tone="green" dot>
            En seguimiento
          </Tag>
        </div>
        <div className="metric-note">
          <span className="small-dot" style={{ color: "var(--amber)" }} />
          {signals.filter((s) => s.status === "PENDING").length} pendientes{" "}
          <span className="separator-dot">·</span>{" "}
          {signals.filter((s) => s.status === "TOUCHED").length} entradas
          tocadas
        </div>
      </Link>
      <Link className="overview-metric" to="/resultados">
        <div className="metric-label">
          Win rate <span>30 días</span>
        </div>
        <div className="metric-main">
          <span className="metric-value">
            {p.operations ? number(p.win_rate, 1) : "—"}
            {p.operations ? <small>%</small> : null}
          </span>
          <Sparkline values={p.curve.map((v) => v.r)} width={68} height={25} />
        </div>
        <div className="metric-note">
          <span className="positive">{p.wins} ganadas</span> de {p.operations}{" "}
          operaciones cerradas
        </div>
      </Link>
      <Link className="overview-metric" to="/resultados">
        <div className="metric-label">
          Rendimiento acumulado
          <ChartNoAxesCombined />
        </div>
        <div className="metric-main">
          <span className={`metric-value ${p.operations && p.total_r < 0 ? "negative" : "positive"}`}>
            {p.operations ? `${p.total_r > 0 ? "+" : ""}${number(p.total_r)}` : "—"}
            {p.operations ? <small>R</small> : null}
          </span>
          <Sparkline
            values={p.curve.map((v) => v.r)}
            width={68}
            height={25}
            fill
          />
        </div>
        <div className="metric-note">
          R medio <span className={p.operations && p.average_r < 0 ? "negative" : "positive"}>{p.operations ? `${p.average_r > 0 ? "+" : ""}${number(p.average_r)}R` : "—"}</span>
          <span className="separator-dot">·</span> Últimos 30 días
        </div>
      </Link>
      <Link className="overview-metric" to="/mercado/liquidaciones">
        <div className="metric-label">
          Liquidaciones <span>15 min</span>
        </div>
        <div className="metric-main">
          <span className="metric-value">
            {liq.total > 0 ? `$${number(liq.total / 1e6, 1)}` : "—"}
            {liq.total > 0 ? <small>M</small> : null}
          </span>
          <span className={`metric-note ${liq.pace == null ? "muted" : liq.pace >= 1 ? "negative" : "positive"}`} style={{ marginTop: 0 }}>
            {liq.pace == null ? "—" : `${number(liq.pace, 1)}x`}
            {liq.pace != null ? <Flame size={12} /> : null}
          </span>
        </div>
        <div className="metric-note">
          <span className={liq.total > 0 ? "negative" : "muted"}>
            {liq.total > 0 ? `${number((liq.long_usdt / liq.total) * 100, 1)}% longs` : "Sin cobertura suficiente"}
          </span>
          <span className="separator-dot">·</span> {liq.status === "ok" ? "Ventana recopilada" : "Recopilando historial"}
        </div>
      </Link>
    </div>
  );
}
function SignalsPreview({ data }: { data: OverviewData }) {
  return (
    <section className="signals-preview panel">
      <div className="section-padding">
        <SectionHeader
          title="Señales en tu radar"
          subtitle="Setups con entrada definida. Sin perseguir el precio."
        >
          <Link to="/senales" className="link-subtle">
            Ver todas
            <ArrowUpRight size={13} />
          </Link>
        </SectionHeader>
      </div>
      <SignalTable signals={data.signals.slice(0, 3)} />
      <div className="signal-disclaimer">
        <ShieldCheck size={12} />
        No persigas el precio; espera la zona indicada.
      </div>
    </section>
  );
}
function ActivityPreview({ data }: { data: OverviewData }) {
  return (
    <section className="activity-panel panel">
      <SectionHeader title="El mercado se mueve">
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
              <h3>{alert.title || (alert.kind === "liq" ? "Liquidaciones" : alert.kind === "mov" ? "Movimiento de mercado" : "Aviso de volumen")}{alert.symbol ? ` · ${alert.symbol.replace("USDT", "")}` : ""}</h3>
              <p>{alert.text}</p>
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
            mode === "watchlist"
              ? "Tu mercado, de un vistazo"
              : "Los que marcan el ritmo"
          }
        >
          <div className="timeframes">
            <button
              className={mode === "watchlist" ? "active" : ""}
              onClick={() => setMode("watchlist")}
            >
              Mi watchlist
            </button>
            <button
              className={mode === "movers" ? "active" : ""}
              onClick={() => setMode("movers")}
            >
              En movimiento
            </button>
          </div>
        </SectionHeader>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Activo</th>
              <th>Precio</th>
              <th>Cambio 24h</th>
              <th>Últimas 24h</th>
              <th>Volumen 24h</th>
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
                    aria-label={`Analizar ${q.name}`}
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
          Agrega tus primeros pares desde{" "}
          <Link to="/watchlist" className="positive">
            Mi watchlist
          </Link>
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
      <SectionHeader title="En el horizonte">
        <Link to="/calendario" className="link-subtle">
          <CalendarDays size={13} />
        </Link>
      </SectionHeader>
      {events?.slice(0, 3).map((event) => (
        <Link to="/calendario" className="calendar-mini-event" key={event.id}>
          <div className="calendar-date">
            <span>
              {new Date(event.date)
                .toLocaleDateString("es", {
                  month: "short",
                  timeZone: user?.tz,
                })
                .toUpperCase()}
            </span>
            <strong>
              {new Date(event.date).toLocaleDateString("es", {
                day: "2-digit",
                timeZone: user?.tz,
              })}
            </strong>
          </div>
          <div>
            <h3>{event.title}</h3>
            <p>{dateTime(event.date, user?.tz)}</p>
            <Tag tone={event.impact === "alto" ? "red" : "amber"} dot>
              Impacto {event.impact}
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
        title="Mapa del mercado"
        subtitle="Variación en 24h. Selecciona un activo para leer su flujo."
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
          <div className="eyebrow">RÉGIMEN REPORTADO POR EL BACKEND</div>
          <h2>{regimeContext(data.regime).label}<span>.</span></h2>
          <p>
            Esta lectura resume el régimen que informó el backend. Confirma la cobertura, el flujo y el precio antes de decidir una operación.
          </p>
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
              <span>del mercado al alza</span>
            </div>
          </div>
          <div className="panorama-breadth-labels">
            <span>
              <i className="small-dot positive" />
              {data.breadth.up == null ? "—" : data.breadth.up} suben
            </span>
            <span>
              <i className="small-dot negative" />
              {data.breadth.down == null ? "—" : data.breadth.down} bajan
            </span>
          </div>
          <Link to="/regimen" className="btn btn-secondary">
            Entender el contexto
            <ArrowRight size={13} />
          </Link>
        </section>
      </div>
      <div className="panorama-second-grid">
        <MarketChart panorama />
        <section className="panorama-performance panel panel-pad">
          <SectionHeader title="Disciplina que se puede medir">
            <ChartNoAxesCombined size={15} className="muted" />
          </SectionHeader>
          <div className={`performance-big ${data.performance.total_r < 0 ? "negative" : "positive"}`}>
            {data.performance.operations ? `${data.performance.total_r > 0 ? "+" : ""}${number(data.performance.total_r)}` : "—"}
            {data.performance.operations ? <span>R</span> : null}
          </div>
          <p className="small muted">Rendimiento acumulado · 30 días</p>
          <HistoryChart data={data.performance.curve} height={145} hideAxis />
          <div className="detail-row">
            <span>Operaciones cerradas</span>
            <strong className="mono">{data.performance.operations}</strong>
          </div>
          <div className="detail-row">
            <span>Win rate</span>
            <strong className="mono positive">
              {data.performance.operations ? `${number(data.performance.win_rate, 1)}%` : "—"}
            </strong>
          </div>
          <Link className="link-accent" to="/resultados">
            Explorar los resultados
            <ArrowUpRight size={13} />
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
  return (
    <div>
      <PageHeader
        eyebrow={
          variant === "terminal"
            ? "CENTRO DE OPERACIONES · DATOS DEL BACKEND"
            : "VISTA PANORÁMICA · DATOS DEL BACKEND"
        }
        title={
          variant === "terminal"
            ? "El pulso del mercado."
            : "Conecta las señales del mercado."
        }
        description={
          variant === "terminal"
            ? "Menos ruido. Más contexto para tu próxima decisión."
            : "Precio, participación y oportunidades. La visión completa, sin perder el foco."
        }
      >
        <RefreshButton onClick={refresh} loading={loading} />
        <Link to="/senales" className="btn btn-primary">
          Explorar señales
          <ArrowUpRight size={14} />
        </Link>
      </PageHeader>
      <ResourceState loading={loading} error={error} retry={refresh} />
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
              "Cotizaciones, velas y métricas proceden de los servicios conectados. Si un servicio no dispone de datos, el módulo mostrará su error o estado de recopilación."
            </span>
            <Link to="/guia">
              Aprende a interpretar los datos
              <CircleHelp size={11} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
