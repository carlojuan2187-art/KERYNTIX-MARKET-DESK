import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  ChartCandlestick,
  CheckCircle2,
  Clock3,
  Info,
  ShieldCheck,
  Waves,
  Zap,
} from "lucide-react";
import { getSignals, subscribeWs } from "@/api";
import { cancelReasons, signalLabel, signalMetrics } from "@/api/signals";
import type { CancelReason, SignalState } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import {
  ago,
  dateTime,
  number,
  percent,
  plainPrice,
  price,
} from "@/utils/format";
import {
  AssetIcon,
  CopyButton,
  Countdown,
  PageHeader,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { Score } from "@/components/SignalTable";
import { MarketChart } from "@/components/Charts";

const breakdownLabels: Record<string, string> = {
  structure: "Estructura",
  confluence: "Confluencia",
  momentum: "Momentum",
  liquidity: "Liquidez",
};
export default function SignalsPage() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [showChart, setShowChart] = useState(false);
  const { data, loading, error, refresh } = useApi(getSignals);
  useEffect(
    () =>
      subscribeWs((event) => {
        if (event.channel === "signals") void refresh();
      }),
    [refresh],
  );
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const filtered =
    data?.filter((s) => filter === "all" || s.status === filter) || [];
  const signal =
    data?.find((s) => s.symbol === params.get("par")) || filtered[0];
  return (
    <div>
      <PageHeader
        eyebrow="SEÑALES DEL BACKEND · ACTUALIZACIÓN CADA 15 S"
        title="Señales con un plan."
        description="Una entrada, un riesgo definido y objetivos claros. Tú mantienes el control."
      >
        <RefreshButton onClick={refresh} loading={loading} />
      </PageHeader>
      <div className="signal-top-notice">
        <ShieldCheck size={16} />
        <span>No persigas el precio; espera la zona indicada.</span>
        <span className="muted">Máximo 10 señales vigentes</span>
      </div>
      <div className="tabs">
        {[
          { key: "all", label: "Todas" },
          { key: "PENDING", label: "Pendientes" },
          { key: "TOUCHED", label: "En seguimiento" },
          { key: "CANCELLED", label: "Canceladas" },
        ].map((tab) => (
          <button
            className={`tab ${filter === tab.key ? "active" : ""}`}
            key={tab.key}
            onClick={() => {
              setFilter(tab.key);
              setParams({});
            }}
          >
            {tab.label}
            <span className="muted small">
              {data?.filter((s) => tab.key === "all" || s.status === tab.key)
                .length || 0}
            </span>
          </button>
        ))}
      </div>
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !filtered.length}
        emptyText="No hay señales registradas en este estado. Cuando el backend publique señales, aparecerán aquí."
      />
      {!loading && !error && signal && filtered.length > 0 && (
        <div className="signals-layout">
          <div className="signal-selection">
            {filtered.map((s) => {
              const status = signalLabel(s);
              return (
                <button
                  className={`signal-select-item ${signal.symbol === s.symbol ? "selected" : ""}`}
                  key={s.symbol}
                  onClick={() => {
                    setParams({ par: s.symbol });
                    setShowChart(false);
                  }}
                >
                  <div className="signal-select-heading">
                    <div className="asset-pair">
                      <AssetIcon symbol={s.symbol} />
                      <div>
                        <strong>{s.symbol.replace("USDT", " / USDT")}</strong>
                        <small>
                          {s.direction} · {s.leverage}x
                        </small>
                      </div>
                    </div>
                    {s.score == null ? <span className="muted">—</span> : <Score value={s.score} />}
                  </div>
                  <div className="signal-select-status">
                    <Tag tone={status.tone} dot>
                      {status.label}
                    </Tag>
                    <span>{ago(s.created_at)}</span>
                  </div>
                  <div className="signal-select-entry">
                    <span>Zona de entrada</span>
                    <strong className="mono">
                      {price(s.entry_low ?? s.entry_price ?? (metrics.hasEntry ? metrics.entry : null))}
                      {s.entry_high ? ` - ${price(s.entry_high)}` : ""}
                    </strong>
                  </div>
                  {s.status === "PENDING" && (
                    <div className="signal-countdown">
                      <Clock3 size={11} />
                      Ventana de entrada
                      <Countdown until={s.expires_at} />
                    </div>
                  )}
                </button>
              );
            })}
            <div className="slim-note">
              <Info size={12} />
              Una señal cancelada no cuenta como pérdida. Las operaciones
              abiertas siguen activas hasta resolverse.
            </div>
          </div>
          <SignalDetail
            signal={signal}
            tz={user?.tz}
            showChart={showChart}
            onChart={() => setShowChart((show) => !show)}
          />
        </div>
      )}
    </div>
  );
}
function SignalDetail({
  signal: s,
  tz,
  showChart,
  onChart,
}: {
  signal: SignalState;
  tz?: string;
  showChart: boolean;
  onChart: () => void;
}) {
  const metrics = signalMetrics(s);
  const status = signalLabel(s);
  const copiedEntry = s.entry_low ?? s.entry_price ?? (metrics.hasEntry ? metrics.entry : null);
  const allPrices = `${s.symbol} ${s.direction}\nEntrada: ${copiedEntry != null && copiedEntry > 0 ? plainPrice(copiedEntry) : "—"}${s.entry_high ? ` - ${plainPrice(s.entry_high)}` : ""}\nStop Loss: ${s.stop_loss != null && s.stop_loss > 0 ? plainPrice(s.stop_loss) : "—"}\n${metrics.targets.map((target) => `${target.label}: ${plainPrice(target.price)}`).join("\n")}`;
  return (
    <section className="signal-detail panel">
      <div className="signal-detail-top">
        <div className="asset-pair">
          <AssetIcon symbol={s.symbol} size={39} />
          <div>
            <h2>{s.symbol.replace("USDT", " / USDT")}</h2>
            <p>Binance USDT-M · {s.timeframes?.join(" / ")}</p>
          </div>
        </div>
        <Tag tone={s.direction === "LONG" ? "green" : "red"}>
          {s.direction === "LONG" ? (
            <ArrowUpRight size={12} />
          ) : (
            <ArrowDownRight size={12} />
          )}
          {s.direction}
        </Tag>
      </div>
      <div className="signal-detail-state">
        <Tag tone={status.tone} dot>
          {status.label}
        </Tag>
        <span>
          {s.status === "PENDING"
            ? "Esperando un toque en la zona indicada"
            : s.status === "CANCELLED"
              ? "Setup invalidado. Sin impacto en resultados."
              : "Entrada confirmada. Seguimiento sin vencimiento."}
        </span>
      </div>
      {s.status === "CANCELLED" && (
        <div className="cancel-reading">
          <Info size={16} />
          <p>
            {cancelReasons[s.cancel_reason as CancelReason] ||
              "El setup ya no cumple las condiciones de entrada."}
            <strong>No cuenta como pérdida.</strong>
          </p>
        </div>
      )}
      {s.operation_result === "TP1_HIT" && (
        <div className="tp-reading">
          <CheckCircle2 size={16} />
          <p>
            TP1 alcanzado: asegura beneficios o mueve el SL a breakeven. Si el
            precio retrocede al stop, el cierre seguirá contando como TP1.
          </p>
        </div>
      )}
      <div className="signal-key-metrics">
        <div>
          <span>Riesgo / Beneficio</span>
          <strong className="positive mono">{metrics.rr == null ? "—" : `1 : ${number(metrics.rr, 1)}`}</strong>
        </div>
        <div>
          <span>Apalancamiento sugerido</span>
          <strong className="mono">
            {s.leverage == null ? "—" : `${s.leverage}x`} {s.leverage != null && <small className="muted">aislado</small>}
          </strong>
        </div>
        <div>
          <span>Score del setup</span>
          <strong className="mono">
            {s.score == null ? "—" : s.score}
            <small className="muted"> / 100</small>
          </strong>
        </div>
      </div>
      <SectionHeader title="Tu plan de operación">
        <span className="small muted">Precios en USDT</span>
      </SectionHeader>
      <div className="trade-levels">
        <div className="trade-level">
          <span className="level-marker level-entry" />
          <span>Entrada</span>
          <strong className="mono">{metrics.hasEntry ? price(metrics.entry) : "—"}</strong>
          <span className="muted">Referencia</span>
        </div>
        <div className="trade-level">
          <span className="level-marker level-stop" />
          <span>Stop Loss</span>
          <strong className="mono negative">{metrics.hasStop ? price(s.stop_loss) : "—"}</strong>
          <span className="mono negative">
            {percent(metrics.stop_distance_pct)}
          </span>
        </div>
        {metrics.targets.map((target) => (
          <div className="trade-level" key={target.label}>
            <span className="level-marker level-target" />
            <span>{target.label}</span>
            <strong className="mono positive">{price(target.price)}</strong>
            <span className="mono positive">
              {percent(target.distance_pct)}{" "}
              <small className="muted">· {number(target.r, 1)}R</small>
            </span>
          </div>
        ))}
      </div>
      <div className="signal-detail-actions">
        <CopyButton
          text={allPrices}
          label="Copiar precios"
          className="btn btn-secondary"
        />
        <Link className="btn btn-primary" to={`/calculadora?senal=${s.symbol}`}>
          <Calculator size={13} />
          Calcular tamaño
          <ArrowRight size={12} />
        </Link>
        <button
          className={`btn ${showChart ? "btn-blue" : "btn-secondary"}`}
          onClick={onChart}
        >
          <ChartCandlestick size={13} />
          Gráfico
        </button>
      </div>
      <div className="signal-crosslinks">
        <Link to={`/derivados/${s.symbol}?direccion=${s.direction}`}>
          <Zap size={13} />
          Derivados del par
          <ArrowUpRight size={12} />
        </Link>
        <Link to={`/mercado/flujo/${s.symbol}`}>
          <Waves size={13} />
          Ver flujo agresivo
          <ArrowUpRight size={12} />
        </Link>
      </div>
      {showChart && (
        <div className="signal-inline-chart">
          <MarketChart key={s.symbol} initialSymbol={s.symbol} />
        </div>
      )}
      <div className="score-breakdown">
        <SectionHeader title="Qué hay detrás del score" />
        {Object.entries(
          s.score_breakdown && Object.keys(s.score_breakdown).length > 0
            ? s.score_breakdown
            : {},
        ).map(([key, value]) => (
          <div className="breakdown-row" key={key}>
            <span>{breakdownLabels[key] || key}</span>
            <div className="progress-bar">
              <span
                style={{
                  width: `${(value / (key === "structure" || key === "confluence" ? 30 : 20)) * 100}%`,
                }}
              />
            </div>
            <span className="mono">
              {value}
              <span className="muted">
                /{key === "structure" || key === "confluence" ? 30 : 20}
              </span>
            </span>
          </div>
        ))}
        {(!s.score_breakdown || Object.keys(s.score_breakdown).length === 0) && (
          <p className="slim-note">El backend no proporcionó un desglose del score para esta señal.</p>
        )}
      </div>
      <details className="signal-engine-raw">
        <summary>Ver datos completos del motor</summary>
        <pre>{JSON.stringify(s, null, 2)}</pre>
      </details>
      <div className="signal-timestamps">
        <span>
          Creada <b>{dateTime(s.created_at, tz)}</b>
        </span>
        {s.expires_at && (
          <span>
            Vence <b>{dateTime(s.expires_at, tz)}</b>
          </span>
        )}
        {s.touched_at && (
          <span>
            Entrada tocada <b>{dateTime(s.touched_at, tz)}</b>
          </span>
        )}
        {s.cancelled_at && (
          <span>
            Cancelada <b>{dateTime(s.cancelled_at, tz)}</b>
          </span>
        )}
      </div>
    </section>
  );
}
