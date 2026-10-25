import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowRight, ArrowUpRight, Clock3, Info, Waves } from "lucide-react";
import { getDerivatives, getSignals } from "@/api";
import { useApi } from "@/hooks/useApi";
import { number, percent } from "@/utils/format";
import {
  Countdown,
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";

export default function DerivadosPage() {
  const { simbolo = "BTCUSDT" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: signals } = useApi(getSignals);
  const { data, loading, error, refresh } = useApi(
    () => getDerivatives(simbolo),
    [simbolo],
  );
  const symbols = [
    ...new Set([
      "BTCUSDT",
      "ETHUSDT",
      ...(signals
        ?.filter((s) => s.status !== "CANCELLED")
        .map((s) => s.symbol) || []),
    ]),
  ];
  const direction = params.get("direccion");
  const fundingRate = data?.funding_rate ?? null;
  const longPct = data?.long_short_ratio?.percent_long ?? null;
  const shortPct = data?.long_short_ratio?.percent_short ?? null;
  const topLongPct = data?.top_trader_ratio?.long ?? null;
  const topShortPct = data?.top_trader_ratio?.short ?? null;
  const longShortRatio = longPct != null && shortPct != null && shortPct > 0 ? longPct / shortPct : null;
  return (
    <div>
      <PageHeader
        eyebrow="CÓMO ESTÁ POSICIONADO EL MERCADO"
        title="Mira detrás de las posiciones."
        description="Funding, interés abierto y sesgo de los traders. Más contexto para tu próxima entrada."
      >
        <RefreshButton loading={loading} onClick={refresh} />
      </PageHeader>
      <div className="filter-row">
        <div className="pair-chips">
          {symbols.map((symbol) => (
            <button
              className={`pair-chip ${symbol === simbolo ? "active" : ""}`}
              key={symbol}
              onClick={() =>
                navigate(
                  `/derivados/${symbol}${direction ? `?direccion=${direction}` : ""}`,
                )
              }
            >
              {symbol.replace("USDT", "")}
            </button>
          ))}
        </div>
        <Link className="btn btn-blue" to={`/mercado/flujo/${simbolo}`}>
          <Waves size={12} />
          Ver flujo del par
          <ArrowUpRight size={12} />
        </Link>
      </div>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && !loading && !error && (
        <>
          <div className="overview-metrics derivatives-metrics">
            <div className="overview-metric">
              <div className="metric-label">
                Funding actual
                <Info size={12} />
              </div>
              <div
                className={`metric-value ${fundingRate == null ? "" : fundingRate >= 0 ? "positive" : "negative"}`}
              >
                {percent(fundingRate == null ? null : fundingRate * 100, 4)}
              </div>
              <div className="metric-note">
                {fundingRate == null
                  ? "Sin dato de funding del proveedor"
                  : fundingRate >= 0
                    ? "Los largos pagan a los cortos"
                    : "Los cortos pagan a los largos"}
              </div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">
                Próximo cobro
                <Clock3 size={12} />
              </div>
              <div className="metric-value">
                {data.funding_next ? <Countdown until={data.funding_next} /> : "—"}
              </div>
              <div className="metric-note">
                Liquidación de funding en Binance
              </div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">Interés abierto (OI)</div>
              <div className="metric-value">
                {data.open_interest == null ? "—" : `$${number(data.open_interest / 1e9, 2)}`}
                <small>mil M</small>
              </div>
              <div className="metric-note">
                <span className="positive">
                  {percent(data.oi_change_24h, 1)}
                </span>
                en las últimas 24h
              </div>
            </div>
            <div className="overview-metric">
              <div className="metric-label">Prima mark / index</div>
              <div className="metric-value">
                {percent(data.mark_index_delta)}
              </div>
              <div className="metric-note">
                Diferencia porcentual de referencia
              </div>
            </div>
          </div>
          <div className="two-col">
            <section className="panel panel-pad">
              <SectionHeader
                title="De qué lado están las cuentas"
                subtitle={`${simbolo.replace("USDT", " / USDT")} · Ratio long / short`}
              />
              <div className="ratio-numbers">
                <div className="positive">
                  <strong>
                    {number(longPct, 1)}
                    {longPct == null ? null : <span>%</span>}
                  </strong>
                  <span>Cuentas long</span>
                </div>
                <div className="negative">
                  <strong>
                    {number(shortPct, 1)}
                    {shortPct == null ? null : <span>%</span>}
                  </strong>
                  <span>Cuentas short</span>
                </div>
              </div>
              <div className="bar-track ratio-bar">
                <span
                  className="buy"
                  style={{ width: `${longPct ?? 0}%` }}
                />
                <span
                  className="sell"
                  style={{ width: `${shortPct ?? 0}%` }}
                />
              </div>
              <div className="detail-row">
                <span>Ratio long / short actual</span>
                <strong className="mono">
                  {number(longShortRatio, 3)}
                </strong>
              </div>
              <div className="detail-row">
                <span>Cuentas long hace 24h</span>
                <strong className="mono">
                  {data.long_short_ratio.value_24h_ago == null ? "—" : `${number(data.long_short_ratio.value_24h_ago, 1)}%`}
                </strong>
              </div>
              <Reading title="Cómo interpretarlo">
                Una mayoría en un lado no confirma una tendencia. Puede
                acompañar el impulso, pero también crear combustible para una
                liquidación cuando el precio se mueve en contra.
              </Reading>
            </section>
            <section className="panel panel-pad">
              <SectionHeader
                title="El posicionamiento de los top traders"
                subtitle="Distribución de las cuentas con mayor actividad."
              />
              <div className="ratio-numbers">
                <div className="positive">
                  <strong>
                    {number(topLongPct, 1)}
                    {topLongPct == null ? null : <span>%</span>}
                  </strong>
                  <span>Top traders long</span>
                </div>
                <div className="negative">
                  <strong>
                    {number(topShortPct, 1)}
                    {topShortPct == null ? null : <span>%</span>}
                  </strong>
                  <span>Top traders short</span>
                </div>
              </div>
              <div className="bar-track ratio-bar">
                <span
                  className="buy"
                  style={{ width: `${topLongPct ?? 0}%` }}
                />
                <span
                  className="sell"
                  style={{ width: `${topShortPct ?? 0}%` }}
                />
              </div>
              <div className="detail-row">
                <span>Cambio de OI en 1 hora</span>
                <strong
                  className={`mono ${data.oi_change_1h == null ? "" : data.oi_change_1h >= 0 ? "positive" : "negative"}`}
                >
                  {percent(data.oi_change_1h, 1)}
                </strong>
              </div>
              <div className="detail-row">
                <span>Cambio de OI en 24 horas</span>
                <strong
                  className={`mono ${data.oi_change_24h == null ? "" : data.oi_change_24h >= 0 ? "positive" : "negative"}`}
                >
                  {percent(data.oi_change_24h, 1)}
                </strong>
              </div>
              {data.reading && <Reading title="La lectura de FTrade">{data.reading}</Reading>}
            </section>
          </div>
          {direction && (
            <div className="signal-context-reading">
              <Tag tone={direction === "LONG" ? "green" : "red"}>
                Tu señal {direction}
              </Tag>
              <p>
                {direction === "LONG"
                  ? "Tu LONG va con la mayoría de las cuentas. El posicionamiento acompaña, pero también te expone a un barrido de longs. Respeta la entrada y el Stop Loss."
                  : "Tu SHORT va contra la mayoría de las cuentas. No basta con un mercado cargado de longs: confirma que el flujo y la estructura respalden el movimiento."}
              </p>
              <Link className="link-accent" to={`/senales?par=${simbolo}`}>
                Volver a la señal
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
          <p className="slim-note">
            <Info size={12} />
            El interés abierto no revela por sí solo si el nuevo capital es
            comprador o vendedor. Contrástalo con el precio y el flujo.
          </p>
        </>
      )}
    </div>
  );
}
