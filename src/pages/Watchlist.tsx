import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Minus,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  addWatchlistItem,
  getSignals,
  getWatchlist,
  removeWatchlistItem,
} from "@/api";
import { type AssetQuote } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { compact, number, percent, price } from "@/utils/format";
import {
  AssetIcon,
  Modal,
  PageHeader,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { Sparkline } from "@/components/Charts";
import { Score } from "@/components/SignalTable";

export default function WatchlistPage() {
  const { quotes, user, setUser, toast } = useApp();
  const { data, setData, loading, error, refresh } = useApi(getWatchlist);
  const { data: signals } = useApi(getSignals);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<AssetQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const closeDetail = useCallback(() => setSelected(null), []);
  const items = quotes.filter((q) =>
    data?.some((item) => item.symbol === q.symbol),
  );
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
  return (
    <div>
      <PageHeader
        eyebrow="TU SELECCIÓN, TU PERSPECTIVA"
        title="Sigue lo que te importa."
        description="Tendencia, participación y contexto de hasta 10 pares. Sin alterar tus señales."
      >
        <Tag tone="muted">{data?.length || 0} / 10 pares</Tag>
        <button
          className="btn btn-primary"
          onClick={() => setAdding((value) => !value)}
          disabled={(data?.length || 0) >= 10}
        >
          <Plus size={14} />
          Agregar par
        </button>
      </PageHeader>
      {adding && (
        <section className="watchlist-search panel panel-pad">
          <SectionHeader title="Añade un par de Binance Futures" />
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
                aria-label="Buscar par para watchlist"
              />
              <button
                className="btn btn-primary"
                disabled={busy || !query.trim()}
                type="submit"
              >
                Agregar
              </button>
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
              No hay coincidencias nuevas entre las cotizaciones recibidas del backend.
            </p>
          )}
        </section>
      )}
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !data?.length}
        emptyText="Tu próxima oportunidad empieza por observar. Agrega BTC, ETH o SOL para empezar."
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
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Par</th>
                  <th>Precio (USDT)</th>
                  <th>24h</th>
                  <th>Tendencia 15M / 1H / 4H</th>
                  <th>Score</th>
                  <th>Contexto</th>
                  <th>Últimas 24h</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  const activeSignal = signals?.find(
                    (s) => s.symbol === q.symbol && s.status !== "CANCELLED",
                  );
                  return (
                    <tr key={q.symbol}>
                      <td>
                        <button
                          className="asset-pair watchlist-detail-button"
                          onClick={() => setSelected(q)}
                        >
                          <AssetIcon symbol={q.symbol} size={31} />
                          <div>
                            <strong>
                              {q.symbol.replace("USDT", " / USDT")}
                            </strong>
                            <small>{q.name}</small>
                          </div>
                        </button>
                      </td>
                      <td className="mono">{price(q.price)}</td>
                      <td
                        className={`mono ${q.change_pct == null ? "muted" : q.change_pct >= 0 ? "positive" : "negative"}`}
                      >
                        {percent(q.change_pct)}
                      </td>
                      <td>
                        <div className="trend-directions">
                          {Object.entries(q.trend).map(([tf, trend]) => (
                            <span
                              className={
                                trend === "up"
                                  ? "positive"
                                  : trend === "down"
                                    ? "negative"
                                    : "muted"
                              }
                              key={tf}
                              title={`${tf}: ${trend === "up" ? "alcista" : trend === "down" ? "bajista" : trend === "flat" ? "lateral" : "sin datos"}`}
                            >
                              {trend === "up" ? (
                                <ArrowUpRight size={15} />
                              ) : trend === "down" ? (
                                <ArrowDownRight size={15} />
                              ) : (
                                <Minus size={15} />
                              )}
                              <small>{tf}</small>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {q.score == null ? <span className="muted">—</span> : <Score value={q.score} />}
                      </td>
                      <td>
                        <div className="watchlist-context">
                          {activeSignal && (
                            <Link to={`/senales?par=${q.symbol}`}>
                              <Tag tone="green" dot>
                                Señal activa
                              </Tag>
                            </Link>
                          )}
                          {q.liquidity_sweep && (
                            <Tag tone="blue">Barrido reciente</Tag>
                          )}
                          {!activeSignal && q.liquidity_sweep === false && (
                            <span className="muted">En observación</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Sparkline
                          values={q.sparkline}
                          positive={q.change_pct != null && q.change_pct >= 0}
                          width={71}
                          height={25}
                        />
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Quitar ${q.symbol}`}
                          onClick={() => void remove(q.symbol)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
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
        Tu watchlist es informativa. Añadir o quitar un par no modifica las
        señales generadas por el scanner.
      </p>
      {selected && (
        <Modal title={selected.name} onClose={closeDetail}>
          <div className="flow-title">
            <div className="asset-pair">
              <AssetIcon symbol={selected.symbol} size={42} />
              <div>
                <h2>{selected.symbol.replace("USDT", " / USDT")}</h2>
                <small>Binance USDT-M Futures</small>
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
          <div className="detail-row">
            <span>Volumen 24h</span>
            <span className="mono">${compact(selected.volume_24h)}</span>
          </div>
          <div className="detail-row">
            <span>Máximo / Mínimo 24h</span>
            <span className="mono">
              {price(selected.high_24h)} / {price(selected.low_24h)}
            </span>
          </div>
          <div className="detail-row">
            <span>Compra agresiva</span>
            <span className="positive mono">
              {number(selected.buy_pct, 1)}%
            </span>
          </div>
          <div className="detail-row">
            <span>Señal activa</span>
            {signals?.some(
              (s) => s.symbol === selected.symbol && s.status !== "CANCELLED",
            ) ? (
              <Link
                className="link-accent"
                to={`/senales?par=${selected.symbol}`}
              >
                <Check size={12} />
                Ver señal
                <ArrowRight size={12} />
              </Link>
            ) : (
              <span className="muted">Sin señal confirmada</span>
            )}
          </div>
          <div className="signal-detail-actions">
            <Link
              className="btn btn-primary"
              to={`/mercado/flujo/${selected.symbol}`}
            >
              Ver flujo
              <ArrowUpRight size={13} />
            </Link>
            <Link className="btn btn-blue" to={`/derivados/${selected.symbol}`}>
              Derivados
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}
