import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Info,
  Search,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import {
  getLiquidationSummary,
  getMoversSnapshot,
  getOrderFlow,
  type AssetQuote,
} from "@/api/terminal";
import { useApp } from "@/context/AppContext";
import { useApi } from "@/hooks/useApi";
import { ago, compact, number, percent, price } from "@/utils/format";
import {
  AssetIcon,
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { HistoryChart } from "@/components/Charts";
import { subscribeWs } from "@/api/events";

export default function MercadoPage() {
  const { quotes, user } = useApp();
  const { simbolo = "BTCUSDT" } = useParams();
  const location = useLocation();
  const tab = location.pathname.includes("liquidaciones")
    ? "liquidaciones"
    : location.pathname.includes("movers")
      ? "movers"
      : "flujo";
  const [params, setParams] = useSearchParams();
  const windowValue = Number(params.get("ventana"));
  const window: 5 | 15 | 60 =
    windowValue === 5 || windowValue === 60 ? windowValue : 15;
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const flow = useApi(() => getOrderFlow(simbolo), [simbolo]);
  const liq = useApi(() => getLiquidationSummary(window), [window]);
  const movers = useApi(() => getMoversSnapshot(window), [window]);
  useEffect(
    () =>
      subscribeWs((event) => {
        const payload = event.payload as { window?: number };
        if (payload.window !== window) return;
        if (event.channel === "market.liquidations" && tab === "liquidaciones")
          void liq.refresh();
        if (event.channel === "market.movers" && tab === "movers")
          void movers.refresh();
      }),
    [window, tab, liq.refresh, movers.refresh],
  );
  const active =
    tab === "flujo" ? flow : tab === "liquidaciones" ? liq : movers;
  const defaultPairs = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    ...(user?.watchlist.map((q) => q.symbol) || []),
  ];
  const pairSymbols = [...new Set(defaultPairs)];
  const quote = quotes.find((q) => q.symbol === simbolo);
  const sourceStatus = tab === "flujo" ? flow.data?.status : tab === "liquidaciones" ? liq.data?.status : movers.data?.status;
  const sourceMessage = tab === "flujo" ? flow.data?.reading : tab === "liquidaciones" ? liq.data?.message : movers.data?.message;
  const isCollecting = sourceStatus === "collecting";
  const hasCompleteSource = sourceStatus === "ok";
  const liquidationLongPct = liq.data && liq.data.total > 0 ? liq.data.long_usdt / liq.data.total * 100 : null;
  const liquidationShortPct = liq.data && liq.data.total > 0 ? liq.data.short_usdt / liq.data.total * 100 : null;
  return (
    <div>
      <PageHeader
        eyebrow="DETRÁS DE CADA MOVIMIENTO"
        title="El mercado, en tiempo real."
        description="Entiende quién compra, quién vende y dónde se concentra la actividad."
      >
        <RefreshButton loading={active.loading} onClick={active.refresh} />
      </PageHeader>
      <nav className="tabs" aria-label="Vistas del mercado">
        {[
          {
            key: "flujo",
            label: "Flujo agresivo",
            icon: Waves,
            to: `/mercado/flujo/${simbolo}`,
          },
          {
            key: "liquidaciones",
            label: "Liquidaciones",
            icon: Flame,
            to: "/mercado/liquidaciones",
          },
          {
            key: "movers",
            label: "Movers",
            icon: TrendingUp,
            to: "/mercado/movers",
          },
        ].map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`tab ${tab === item.key ? "active" : ""}`}
          >
            <item.icon size={14} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="filter-row">
        {tab === "flujo" ? (
          <div className="pair-chips">
            {pairSymbols.map((symbol) => (
              <Link
                key={symbol}
                to={`/mercado/flujo/${symbol}`}
                className={`pair-chip ${simbolo === symbol ? "active" : ""}`}
              >
                {symbol.replace("USDT", "")}
              </Link>
            ))}
            <button
              className="pair-chip"
              onClick={() => setSearching((value) => !value)}
            >
              <Search size={11} />
              Otro par
            </button>
          </div>
        ) : (
          <span className="slim-note" style={{ padding: 0 }}>
            Solo pares de Binance USDT-M Futures
          </span>
        )}
        <div className="window-controls">
          {tab !== "flujo" && (
            <div className="timeframes">
              {[5, 15, 60].map((value) => (
                <button
                  className={window === value ? "active" : ""}
                  key={value}
                  onClick={() => setParams({ ventana: String(value) })}
                >
                  {value === 60 ? "1h" : `${value}m`}
                </button>
              ))}
            </div>
          )}
          <span className="status-row" title={sourceMessage || "Estado informado por el backend"}>
            <span className={`live-dot ${hasCompleteSource ? "" : "muted"}`} />
            {isCollecting ? "Recopilando datos" : hasCompleteSource ? "Datos del backend" : "Estado del proveedor"}
          </span>
        </div>
      </div>
      {sourceMessage && (
        <p className="slim-note" role="status">{sourceMessage}</p>
      )}
      {searching && tab === "flujo" && (
        <div className="inline-pair-search">
          <div className="search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca por nombre o símbolo"
              aria-label="Buscar otro par"
            />
          </div>
          <div className="pair-chips">
            {quotes
              .filter((q) =>
                `${q.symbol} ${q.name}`
                  .toLowerCase()
                  .includes(search.toLowerCase().replace("/", "")),
              )
              .slice(0, 8)
              .map((q) => (
                <Link
                  className="pair-chip"
                  key={q.symbol}
                  to={`/mercado/flujo/${q.symbol}`}
                  onClick={() => setSearching(false)}
                >
                  <AssetIcon symbol={q.symbol} size={15} />
                  {q.symbol}
                </Link>
              ))}
          </div>
        </div>
      )}
      <ResourceState
        loading={active.loading}
        error={active.error}
        retry={active.refresh}
      />
      {tab === "flujo" && flow.data && !flow.loading && !flow.error && (
        <>
          <div className="flow-title">
            <div className="asset-pair">
              <AssetIcon symbol={simbolo} size={37} />
              <div>
                <h2>{simbolo.replace("USDT", " / USDT")}</h2>
                <small>Compra agresiva frente a venta agresiva</small>
              </div>
            </div>
            <div className="flow-quote">
              <strong className="mono">
                {price(quote?.price ?? flow.data.windows[0]?.price)}
              </strong>
              <span
                className={
                  quote?.change_pct == null ? "muted" : quote.change_pct >= 0 ? "positive" : "negative"
                }
              >
                {quote ? percent(quote.change_pct) : ""}{" "}
                <span className="muted">24h</span>
              </span>
            </div>
          </div>
          <div className="flow-windows">
            {flow.data.windows.map((item) => (
              <section className="flow-window panel panel-pad" key={item.label}>
                <div className="section-heading">
                  <h2>Ventana {item.label}</h2>
                  <Tag tone={item.buy_pct == null ? "muted" : item.buy_pct > 50 ? "green" : item.buy_pct < 50 ? "red" : "amber"}>
                    {item.buy_pct == null ? "Sin datos" : item.buy_pct > 50 ? "Compra dominante" : item.buy_pct < 50 ? "Venta dominante" : "Flujo equilibrado"}
                  </Tag>
                </div>
                <div className="flow-buy-value positive">
                  {number(item.buy_pct, 1)}
                  {item.buy_pct == null ? null : <small>%</small>}
                  <span>compra agresiva</span>
                </div>
                <div className="buy-sell-labels">
                  <span className="positive">
                    Compras {item.buy_pct == null ? "—" : `${number(item.buy_pct, 1)}%`}
                  </span>
                  <span className="negative">
                    Ventas {item.buy_pct == null ? "—" : `${number(100 - item.buy_pct, 1)}%`}
                  </span>
                </div>
                <div className="bar-track">
                  <span className="buy" style={{ width: `${item.buy_pct ?? 0}%` }} />
                  <span
                    className="sell"
                    style={{ width: `${item.buy_pct == null ? 0 : 100 - item.buy_pct}%` }}
                  />
                </div>
                <div className="detail-row">
                  <span>Delta en {simbolo.replace("USDT", "")}</span>
                  <strong
                    className={`mono ${item.delta == null ? "" : item.delta >= 0 ? "positive" : "negative"}`}
                  >
                    {item.delta != null && item.delta >= 0 ? "+" : ""}
                    {number(item.delta, 3)}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Delta en USDT</span>
                  <strong
                    className={`mono ${item.delta_usdt == null ? "" : item.delta_usdt >= 0 ? "positive" : "negative"}`}
                  >
                    {item.delta_usdt != null && item.delta_usdt >= 0 ? "+" : ""}{item.delta_usdt == null ? compact(item.delta_usdt) : `$${compact(item.delta_usdt)}`}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Precio · {item.label}</span>
                  <strong className="mono">{price(item.price)}</strong>
                </div>
              </section>
            ))}
          </div>
          <div className="two-col-wide" style={{ marginTop: 22 }}>
            <section className="panel panel-pad">
              <SectionHeader
                title="Lo que revela el volumen"
                subtitle="Delta acumulado (CVD) · Últimas 4 horas"
              >
                <Tag
                  tone={flow.data.windows.find((item) => item.label === "4h")?.buy_pct == null ? "muted" : (flow.data.windows.find((item) => item.label === "4h")?.buy_pct ?? 50) > 50 ? "green" : "red"}
                >
                  {flow.data.windows.find((item) => item.label === "4h")?.buy_pct == null ? null : (flow.data.windows.find((item) => item.label === "4h")!.buy_pct! >= 50 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
                  Tendencia{" "}
                  {flow.data.windows.find((item) => item.label === "4h")?.buy_pct == null
                    ? "—"
                    : (flow.data.windows.find((item) => item.label === "4h")!.buy_pct! > 50 ? "compradora" : flow.data.windows.find((item) => item.label === "4h")!.buy_pct! < 50 ? "vendedora" : "equilibrada")}
                </Tag>
              </SectionHeader>
              <HistoryChart
                data={flow.data.cvd}
                dataKey="cvd"
                xKey="time"
                label="CVD (USDT)"
                height={230}
              />
            </section>
            <section className="panel panel-pad">
              <SectionHeader title="Más allá del precio" />
              <div className="flow-volume-ratio">
                <span className="mono">
                  {number(flow.data.volume_ratio, 1)}
                  <small>x</small>
                </span>
                <p>Volumen de 15m frente a su ritmo normal.</p>
              </div>
              <Reading>{flow.data.reading}</Reading>
              <Link className="btn btn-blue" to={`/derivados/${simbolo}`}>
                <Zap size={13} />
                Contrastar con derivados
                <ArrowUpRight size={12} />
              </Link>
            </section>
          </div>
        </>
      )}
      {tab === "liquidaciones" && liq.data && !liq.loading && !liq.error && (
        <>
          <div className="overview-metrics liquidation-metrics">
            {[
              {
                label: "Total liquidado",
                value: liq.data.total > 0 ? `$${number(liq.data.total / 1e6)}M` : "—",
                note: `${liq.data.orders} órdenes`,
              },
              {
                label: "Longs liquidados",
                value: liq.data.total > 0 ? `$${number(liq.data.long_usdt / 1e6)}M` : "—",
                note: liquidationLongPct == null ? "Sin cobertura de datos" : `${number(liquidationLongPct, 1)}% del total`,
                tone: "negative",
              },
              {
                label: "Shorts liquidados",
                value: liq.data.total > 0 ? `$${number(liq.data.short_usdt / 1e6)}M` : "—",
                note: liquidationShortPct == null ? "Sin cobertura de datos" : `${number(liquidationShortPct, 1)}% del total`,
                tone: "positive",
              },
              {
                label: "Ritmo del mercado",
                value: liq.data.pace == null ? "—" : `${number(liq.data.pace, 1)}x`,
                note: `$${compact(liq.data.usdt_per_min)} por minuto`,
                tone: "negative",
              },
            ].map((metric) => (
              <div className="overview-metric" key={metric.label}>
                <div className="metric-label">{metric.label}</div>
                <div className={`metric-value ${metric.tone || ""}`}>
                  {metric.value}
                </div>
                <div className="metric-note">{metric.note}</div>
              </div>
            ))}
          </div>
          <div className="two-col-wide">
            <section className="panel panel-pad">
              <SectionHeader
                title="Dónde está la presión"
                subtitle={`Liquidaciones por par · Ventana ${window === 60 ? "1h" : `${window}m`}`}
              />
              <div className="buy-sell-labels">
                <span className="negative">
                  Longs {number((liq.data.long_usdt / liq.data.total) * 100, 1)}
                  %
                </span>
                <span className="positive">
                  Shorts{" "}
                  {number((liq.data.short_usdt / liq.data.total) * 100, 1)}%
                </span>
              </div>
              <div className="bar-track liquidation-main-bar">
                <span
                  className="sell"
                  style={{ width: `${liquidationLongPct ?? 0}%` }}
                />
                <span
                  className="buy"
                  style={{ width: `${liquidationShortPct ?? 0}%` }}
                />
              </div>
              <div className="liquidation-pairs">
                {liq.data.pairs.map((p) => (
                  <Link
                    key={p.symbol}
                    to={`/mercado/flujo/${p.symbol}`}
                    className="liquidation-pair"
                  >
                    <div className="asset-pair">
                      <AssetIcon symbol={p.symbol} size={29} />
                      <div>
                        <strong>{p.symbol.replace("USDT", " / USDT")}</strong>
                        <small className={p.long_usdt === p.short_usdt ? "muted" : p.long_usdt > p.short_usdt ? "negative" : "positive"}>
                          {p.long_usdt === 0 && p.short_usdt === 0 ? "Sin liquidaciones en ventana" : p.long_usdt === p.short_usdt ? "Liquidaciones equilibradas" : p.long_usdt > p.short_usdt ? "Más longs liquidados" : "Más shorts liquidados"}
                        </small>
                      </div>
                    </div>
                    <div className="liquidation-mini-bar">
                      <div className="bar-track">
                        <span
                          className="sell"
                          style={{ width: `${p.long_usdt + p.short_usdt > 0 ? p.long_usdt / (p.long_usdt + p.short_usdt) * 100 : 0}%` }}
                        />
                        <span
                          className="buy"
                          style={{ width: `${p.long_usdt + p.short_usdt > 0 ? p.short_usdt / (p.long_usdt + p.short_usdt) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <strong className="mono">
                      ${compact(p.long_usdt + p.short_usdt)}
                    </strong>
                    <ArrowUpRight size={13} className="muted" />
                  </Link>
                ))}
              </div>
            </section>
            <section className="panel panel-pad">
              <SectionHeader title="La mayor orden" />
              {liq.data.largest_order ? (
                <>
                  <div className="largest-order">
                    <AssetIcon symbol={liq.data.largest_order.symbol} size={35} />
                    <span className="mono negative">${compact(liq.data.largest_order.amount_usdt)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Par</span>
                    <strong>{liq.data.largest_order.symbol.replace("USDT", " / USDT")}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Posición liquidada</span>
                    <Tag tone={liq.data.largest_order.side === "LONG" ? "red" : "green"}>{liq.data.largest_order.side}</Tag>
                  </div>
                  <div className="detail-row">
                    <span>Detectada</span>
                    <span>{liq.data.largest_order.created_at ? ago(liq.data.largest_order.created_at) : "—"}</span>
                  </div>
                  <Link to={`/mercado/flujo/${liq.data.largest_order.symbol}`} className="btn btn-blue">
                    Ver flujo de {liq.data.largest_order.symbol.replace("USDT", "")}
                    <ArrowRight size={13} />
                  </Link>
                </>
              ) : (
                <p className="slim-note">No hay una orden de liquidación destacada disponible en esta ventana.</p>
              )}
              {liq.data.reading && <Reading>{liq.data.reading}</Reading>}
            </section>
          </div>
          <p className="slim-note">
            <Info size={12} />
            Binance reporta solo la última liquidación por símbolo cada segundo:
            las cifras son un mínimo, no el total real.
          </p>
        </>
      )}
      {tab === "movers" && movers.data && !movers.loading && !movers.error && (
        <>
          <div className="movers-context">
            <span>
              BTC{" "}
              <strong className="positive mono">
                {percent(movers.data.btc_change_pct)}
              </strong>
            </span>
            <span>
              <i className="small-dot positive" />
              {movers.data.breadth_pct == null ? "—" : `${number(movers.data.breadth_pct, 1)}%`} de pares al alza
            </span>
            <span className="muted">Volumen diario superior a 20 M USDT</span>
          </div>
          <div className="two-col">
            <MoverList
              title="Los que más suben"
              rows={movers.data.gainers}
              positive
            />
            <MoverList title="Los que más bajan" rows={movers.data.losers} />
          </div>
          <section className="panel panel-pad" style={{ marginTop: 22 }}>
            <SectionHeader
              title="Volumen anormal, precio en calma"
              subtitle="Actividad elevada que todavía no se traduce en movimiento."
            />
            {movers.data.volume_flat.map((q) => (
              <Link
                className="volume-flat-row"
                key={q.symbol}
                to={`/mercado/flujo/${q.symbol}`}
              >
                <div className="asset-pair">
                  <AssetIcon symbol={q.symbol} size={30} />
                  <strong>{q.symbol}</strong>
                </div>
                <span className="mono">{percent(q.change_pct)}</span>
                <Tag tone="amber">Volumen {q.volume_ratio == null ? "—" : `~${q.volume_ratio}x`}</Tag>
                <span className={q.buy_pct == null ? "muted" : "positive"}>{q.buy_pct == null ? "—" : `${q.buy_pct}% compra`}</span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
            {!movers.data.volume_flat.length && (
              <p className="slim-note">
                No hay anomalías de volumen sin movimiento en esta ventana.
              </p>
            )}
            <Reading>{movers.data.reading}</Reading>
          </section>
          <p className="slim-note">
            Los valores y la cobertura dependen de la información que el backend recibe del proveedor de mercado.
            {movers.data.status === "collecting" ? " El backend todavía está reuniendo historial suficiente para esta ventana." : ""}
          </p>
        </>
      )}
    </div>
  );
}
function MoverList({
  title,
  rows,
  positive = false,
}: {
  title: string;
  rows: AssetQuote[];
  positive?: boolean;
}) {
  return (
    <section className="panel panel-pad">
      <SectionHeader title={title}>
        {positive ? (
          <ArrowUpRight className="positive" size={17} />
        ) : (
          <ArrowDownRight className="negative" size={17} />
        )}
      </SectionHeader>
      <div className="mover-list">
        {rows.map((q, i) => (
          <Link
            className="mover-row"
            to={`/mercado/flujo/${q.symbol}`}
            key={q.symbol}
          >
            <span className="mover-rank">{i + 1}</span>
            <div className="asset-pair">
              <AssetIcon symbol={q.symbol} size={29} />
              <div>
                <strong>{q.symbol.replace("USDT", "")}</strong>
                <small>
                  {q.volume_ratio == null ? "Volumen —" : `~${q.volume_ratio}x volumen`}{" "}
                  <span className="separator-dot">·</span> {q.buy_pct == null ? "—" : `${q.buy_pct}% compra`}
                </small>
              </div>
            </div>
            <strong className={`mono ${positive ? "positive" : "negative"}`}>
              {percent(q.change_pct)}
            </strong>
            <ArrowUpRight size={12} className="muted" />
          </Link>
        ))}
      </div>
    </section>
  );
}
