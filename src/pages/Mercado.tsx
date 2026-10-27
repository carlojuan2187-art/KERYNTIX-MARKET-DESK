import { useEffect, useRef, useState } from "react";
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
  getOrderBook,
  getOrderFlow,
  type AssetQuote,
  type OrderBookData,
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
  const orderBook = useApi<OrderBookData | null>(
    (): Promise<OrderBookData | null> => tab === "flujo" ? getOrderBook(simbolo, 20) : Promise.resolve(null),
    [simbolo, tab],
  );
  const refreshInFlight = useRef(false);
  const liq = useApi(() => getLiquidationSummary(window), [window]);
  const movers = useApi(() => getMoversSnapshot(window), [window]);
  useEffect(
    () =>
      subscribeWs((event) => {
        const payload = event.payload as { window?: number };
        // A liquidation event contributes to every selectable summary window;
        // the event bridge currently publishes its shared 15m summary.
        if (event.channel === "market.liquidations" && tab === "liquidaciones") {
          void liq.refresh();
          return;
        }
        if (event.channel === "market.movers" && tab === "movers" && payload.window === window)
          void movers.refresh();
      }),
    [window, tab, liq.refresh, movers.refresh],
  );
  useEffect(() => {
    // Poll only the active view, at a bounded rate. Flow/depth snapshots are
    // refreshed together; liquidations and movers also need periodic refreshes
    // when a websocket event is quiet or a window other than 15m is selected.
    const cadence = tab === "liquidaciones" ? 10_000 : 15_000;
    const timer = globalThis.setInterval(() => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      const pending = tab === "flujo"
        ? Promise.all([flow.refresh(), orderBook.refresh()])
        : tab === "liquidaciones" ? liq.refresh() : movers.refresh();
      void pending.finally(() => { refreshInFlight.current = false; });
    }, cadence);
    return () => globalThis.clearInterval(timer);
  }, [tab, flow.refresh, orderBook.refresh, liq.refresh, movers.refresh]);
  const active =
    tab === "flujo" ? flow : tab === "liquidaciones" ? liq : movers;
  const refreshCurrent = () => {
    if (tab === "flujo") {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      void Promise.all([flow.refresh(), orderBook.refresh()]).finally(() => {
        refreshInFlight.current = false;
      });
      return;
    }
    void active.refresh();
  };
  const defaultPairs = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    ...(Array.isArray(user?.watchlist)
      ? user.watchlist.map((item) =>
          typeof item === "string" ? item : item?.symbol,
        ).filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
      : []),
  ];
  const pairSymbols = [...new Set(defaultPairs)];
  const quote = quotes.find((q) => q.symbol === simbolo);
  const flowWindows = Array.isArray(flow.data?.windows) ? flow.data.windows : [];
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
        <RefreshButton loading={active.loading || (tab === "flujo" && orderBook.loading)} onClick={refreshCurrent} />
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
                {price(quote?.price ?? flowWindows[0]?.price)}
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
          <div className="market-data-status" aria-live="polite">
            <Tag tone={flow.data.quality?.volume_ratio_4h_ready ? "green" : "amber"}>
              {flow.data.quality?.volume_ratio_4h_ready ? "Referencia de volumen 4H disponible" : "Referencia de volumen 4H en recopilación"}
            </Tag>
            <span>Actualizado {flow.data.updated_at ? ago(flow.data.updated_at) : "—"}</span>
            <span>{flow.data.quality?.history_hours == null ? "Historial —" : `${number(flow.data.quality.history_hours, 1)} h de velas`}</span>
            <span>Última vela cerrada {flow.data.quality?.last_closed_candle_at ? ago(flow.data.quality.last_closed_candle_at) : "—"}</span>
          </div>
          {flow.data.quality?.message && <p className="slim-note" role="status">{flow.data.quality.message}</p>}
          <div className="flow-windows">
            {flowWindows.map((item) => (
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
                <div className="detail-row">
                  <span>Cambio del precio</span>
                  <strong className={`mono ${item.change_pct == null ? "" : item.change_pct >= 0 ? "positive" : "negative"}`}>{percent(item.change_pct)}</strong>
                </div>
                <div className="detail-row">
                  <span>Volumen negociado</span>
                  <strong className="mono">{item.volume_usdt == null ? "—" : `$${compact(item.volume_usdt)}`}</strong>
                </div>
                {item.volume_ratio != null && (
                  <div className="detail-row">
                    <span>Volumen vs. normal</span>
                    <strong className="mono">{number(item.volume_ratio, 2)}x</strong>
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="two-col-wide" style={{ marginTop: 22 }}>
            <section className="panel panel-pad">
              <SectionHeader
                title="Lo que revela el volumen"
                subtitle="Delta acumulado (CVD) · 48 velas de 5 minutos · Últimas 4 horas"
              >
                <Tag
                  tone={flowWindows.find((item) => item.label === "4h")?.buy_pct == null ? "muted" : (flowWindows.find((item) => item.label === "4h")?.buy_pct ?? 50) > 50 ? "green" : "red"}
                >
                  {flowWindows.find((item) => item.label === "4h")?.buy_pct == null ? null : (flowWindows.find((item) => item.label === "4h")!.buy_pct! >= 50 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
                  Tendencia{" "}
                  {flowWindows.find((item) => item.label === "4h")?.buy_pct == null
                    ? "—"
                    : (flowWindows.find((item) => item.label === "4h")!.buy_pct! > 50 ? "compradora" : flowWindows.find((item) => item.label === "4h")!.buy_pct! < 50 ? "vendedora" : "equilibrada")}
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
              <SectionHeader title="Más allá del precio" subtitle="Flujo, divergencia y actividad relativa" />
              {flow.data.price_cvd && (
                <div className={`flow-divergence ${flow.data.price_cvd.status}`}>
                  <div className="flow-divergence-header">
                    <strong>{flow.data.price_cvd.label}</strong>
                    <Tag tone={flow.data.price_cvd.status === "bearish_divergence" || flow.data.price_cvd.status === "sellers_confirmed" ? "red" : flow.data.price_cvd.status === "bullish_divergence" || flow.data.price_cvd.status === "buyers_confirmed" ? "green" : "amber"}>
                      {flow.data.price_cvd.price_change_pct == null ? "Sin lectura" : percent(flow.data.price_cvd.price_change_pct)}
                    </Tag>
                  </div>
                  <p>{flow.data.price_cvd.message}</p>
                  <div className="detail-row">
                    <span>Delta neto · última hora</span>
                    <strong className={`mono ${flow.data.price_cvd.delta_usdt == null ? "" : flow.data.price_cvd.delta_usdt >= 0 ? "positive" : "negative"}`}>{flow.data.price_cvd.delta_usdt == null ? "—" : `${flow.data.price_cvd.delta_usdt >= 0 ? "+" : "−"}$${compact(Math.abs(flow.data.price_cvd.delta_usdt))}`}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Delta / volumen cotizado</span>
                    <strong className="mono">{percent(flow.data.price_cvd.delta_share_pct)}</strong>
                  </div>
                </div>
              )}
              <div className="flow-volume-ratio">
                {flow.data.volume_ratio != null ? (
                  <>
                    <span className="mono">{number(flow.data.volume_ratio, 1)}<small>x</small></span>
                    <p>Volumen de 15m frente a su ritmo normal.</p>
                  </>
                ) : (
                  <p>El ratio de volumen de 15m aparecerá cuando exista una referencia histórica fiable.</p>
                )}
              </div>
              <Reading>{flow.data.reading}</Reading>
              <Link className="btn btn-blue" to={`/derivados/${simbolo}`}>
                <Zap size={13} />
                Contrastar con derivados
                <ArrowUpRight size={12} />
              </Link>
            </section>
          </div>
          <section className="panel panel-pad order-book-panel" style={{ marginTop: 22 }}>
            <SectionHeader title={`Libro de órdenes · ${simbolo.replace("USDT", " / USDT")}`} subtitle="Profundidad agregada de los 20 mejores niveles · Binance USDⓈ-M Futures">
              {orderBook.data?.updated_at && <Tag tone="muted">Actualizado {ago(orderBook.data.updated_at)}</Tag>}
            </SectionHeader>
            {orderBook.loading && !orderBook.data && <p className="slim-note">Cargando profundidad del libro…</p>}
            {orderBook.error && <p className="slim-note" role="status">{orderBook.data ? `No se pudo refrescar el libro; se mantiene la última lectura (${ago(orderBook.data.updated_at)}).` : `El libro de órdenes no está disponible ahora. ${orderBook.error}`}</p>}
            {orderBook.data && (
              <>
                <div className="order-book-metrics">
                  <div className="overview-metric"><div className="metric-label">Mejor bid</div><div className="metric-value positive mono">{price(orderBook.data.best_bid)}</div></div>
                  <div className="overview-metric"><div className="metric-label">Mejor ask</div><div className="metric-value negative mono">{price(orderBook.data.best_ask)}</div></div>
                  <div className="overview-metric"><div className="metric-label">Spread</div><div className="metric-value mono">{price(orderBook.data.spread)}</div><div className="metric-note">{percent(orderBook.data.spread_pct, 4)}</div></div>
                  <div className="overview-metric"><div className="metric-label">Desequilibrio por profundidad</div><div className={`metric-value mono ${(orderBook.data.imbalance_pct ?? 0) > 0 ? "positive" : (orderBook.data.imbalance_pct ?? 0) < 0 ? "negative" : ""}`}>{percent(orderBook.data.imbalance_pct, 1)}</div><div className="metric-note">Solo los niveles visibles</div></div>
                </div>
                <div className="order-book-depth-bars">
                  <div><span className="positive">Bids · ${compact(orderBook.data.bid_depth_usdt)}</span><span className="negative">Asks · ${compact(orderBook.data.ask_depth_usdt)}</span></div>
                  <div className="bar-track"><span className="buy" style={{ width: `${orderBook.data.bid_share_pct ?? 50}%` }} /><span className="sell" style={{ width: `${orderBook.data.bid_share_pct == null ? 50 : 100 - orderBook.data.bid_share_pct}%` }} /></div>
                </div>
                <div className="order-book-columns">
                  <div>
                    <h3 className="order-book-side positive">Compras límite (Bid)</h3>
                    <div className="order-book-head"><span>Precio</span><span>Cantidad</span><span>Valor USDT</span></div>
                    {orderBook.data.bids.slice(0, 5).map((level) => <div className="order-book-row bid" key={`bid-${level.price}`}><span className="mono">{price(level.price)}</span><span className="mono">{compact(level.quantity)}</span><span className="mono">${compact(level.notional_usdt)}</span></div>)}
                  </div>
                  <div>
                    <h3 className="order-book-side negative">Ventas límite (Ask)</h3>
                    <div className="order-book-head"><span>Precio</span><span>Cantidad</span><span>Valor USDT</span></div>
                    {orderBook.data.asks.slice(0, 5).map((level) => <div className="order-book-row ask" key={`ask-${level.price}`}><span className="mono">{price(level.price)}</span><span className="mono">{compact(level.quantity)}</span><span className="mono">${compact(level.notional_usdt)}</span></div>)}
                  </div>
                </div>
                <p className="slim-note">El desequilibrio refleja únicamente los primeros {orderBook.data.limit} niveles del libro. Las órdenes pueden cancelarse o cambiar antes de ejecutarse; no implica que el precio vaya a dirigirse a esa zona.</p>
              </>
            )}
          </section>
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
          <div className="market-data-status" aria-live="polite">
            <Tag tone={liq.data.connected ? "green" : "red"}>{liq.data.connected ? "Feed de liquidaciones conectado" : "Feed de liquidaciones desconectado"}</Tag>
            <Tag tone={liq.data.coverage_complete ? "green" : "amber"}>{liq.data.coverage_complete ? "Ventana cubierta" : "Recopilando historial"}</Tag>
            <span>Ventana observada: {liq.data.coverage_seconds == null ? "—" : `${number(liq.data.coverage_seconds / 60, 1)} min`}</span>
            <span>Actualizado {liq.data.updated_at ? ago(liq.data.updated_at) : "—"}</span>
            <span>{liq.data.last_event_at ? `Última liquidación ${ago(liq.data.last_event_at)}` : "Sin evento de liquidación observado todavía"}</span>
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
                {(Array.isArray(liq.data.pairs) ? liq.data.pairs : []).map((p) => (
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
          <div className="market-data-status" aria-live="polite">
            <Tag tone={movers.data.status === "ok" ? "green" : "amber"}>{movers.data.status === "ok" ? "Cobertura suficiente" : "Historial en recopilación"}</Tag>
            <span>Historial {number(movers.data.collected_minutes, 1)} / {number(movers.data.required_minutes, 1)} min</span>
            <span>Universo elegible: {movers.data.eligible_count ?? "—"} pares</span>
            <span>Actualizado {movers.data.updated_at ? ago(movers.data.updated_at) : "—"}</span>
          </div>
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
            <MoverList title="Los que más bajan" rows={Array.isArray(movers.data.losers) ? movers.data.losers : []} />
          </div>
          <section className="panel panel-pad" style={{ marginTop: 22 }}>
            <SectionHeader
              title="Volumen anormal, precio en calma"
              subtitle="Actividad elevada que todavía no se traduce en movimiento."
            />
            {(Array.isArray(movers.data.volume_flat) ? movers.data.volume_flat : []).map((q) => (
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
                <Tag tone={q.volume_ratio_source === "exact" ? "green" : "amber"}>Volumen {q.volume_ratio == null ? "—" : `${q.volume_ratio_source === "exact" ? "" : "~"}${number(q.volume_ratio, 1)}x ${q.volume_ratio_source === "exact" ? "medido" : "estimado"}`}</Tag>
                <span className={q.buy_pct == null ? "muted" : "positive"}>{q.buy_pct == null ? "—" : `${q.buy_pct}% compra`}</span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
            {(!Array.isArray(movers.data.volume_flat) || !movers.data.volume_flat.length) && (
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
                  {q.volume_ratio == null ? "Volumen —" : `${q.volume_ratio_source === "exact" ? "" : "~"}${number(q.volume_ratio, 1)}x volumen ${q.volume_ratio_source === "exact" ? "medido" : "estimado"}`}{" "}
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
