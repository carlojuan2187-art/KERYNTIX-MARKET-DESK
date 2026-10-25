import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldCheck,
} from "lucide-react";
import { getPerformance } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime, number, price } from "@/utils/format";
import {
  AssetIcon,
  PageHeader,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";
import { HistoryChart } from "@/components/Charts";

export default function ResultadosPage() {
  const { user } = useApp();
  const [period, setPeriod] = useState("month");
  const [page, setPage] = useState(0);
  const { data, loading, error, refresh } = useApi(
    () => getPerformance(period),
    [period],
  );
  return (
    <div>
      <PageHeader
        eyebrow="RESULTADOS, SIN FILTROS"
        title="La disciplina en números."
        description="Solo operaciones cerradas que tocaron entrada. Cada R cuenta una historia."
      >
        <select
          aria-label="Periodo de resultados"
          className="styled-input"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(0);
          }}
        >
          <option value="day">Hoy (UTC)</option>
          <option value="week">Últimos 7 días</option>
          <option value="month">Últimos 30 días</option>
          <option value="all">Desde el inicio</option>
        </select>
      </PageHeader>
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && data?.operations === 0}
        emptyText="Aún no hay operaciones cerradas en este periodo. Prueba con 7 días, 30 días o el histórico total."
      />
      {data && !loading && !error && data.operations > 0 && (
        <>
          <div className="overview-metrics">
            {[
              {
                label: "Operaciones cerradas",
                value: String(data.operations).padStart(2, "0"),
                note: `${data.wins} ganadas · ${data.losses} perdidas`,
              },
              {
                label: "Win rate",
                value: `${number(data.win_rate, 1)}%`,
                note: "Ganada = cierre en TP1 o TP2",
                tone: "positive",
              },
              {
                label: "R acumulado",
                value: `${data.total_r > 0 ? "+" : ""}${number(data.total_r)}R`,
                note: "Riesgo real por operación",
                tone: "positive",
              },
              {
                label: "R medio por operación",
                value: `${data.average_r > 0 ? "+" : ""}${number(data.average_r)}R`,
                note: "Incluye todos los cierres",
                tone: "positive",
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
          <section className="panel panel-pad">
            <SectionHeader
              title="La curva de tu estrategia"
              subtitle="R acumulado, ordenado por fecha de cierre"
            >
              <Tag tone="green">
                <ArrowUpRight size={12} />+{number(data.total_r)}R
              </Tag>
            </SectionHeader>
            <HistoryChart data={data.curve} height={265} />
            <div className="results-extremes">
              <div>
                <span>Mejor operación</span>
                <strong className="positive mono">
                  +{number(data.best_r)}R
                </strong>
              </div>
              <div>
                <span>Peor operación</span>
                <strong className="negative mono">
                  {number(data.worst_r)}R
                </strong>
              </div>
              <div>
                <span>Racha actual</span>
                <strong className={data.streak > 0 ? "positive" : "negative"}>
                  {Math.abs(data.streak)}{" "}
                  {data.streak > 0 ? "ganadas" : "perdidas"}
                </strong>
              </div>
            </div>
          </section>
          <section className="panel" style={{ marginTop: 22 }}>
            <div className="section-padding">
              <SectionHeader
                title="Cada operación, al detalle"
                subtitle="Sin pendientes, sin canceladas y sin resultados hipotéticos."
              />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Par / Dirección</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Cierre</th>
                    <th>R obtenido</th>
                    <th>Fecha de cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trades.slice(page * 8, (page + 1) * 8).map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        <div className="asset-pair">
                          <AssetIcon symbol={trade.symbol} size={28} />
                          <div>
                            <strong>
                              {trade.symbol.replace("USDT", " / USDT")}
                            </strong>
                            <small
                              style={{
                                color:
                                  trade.direction === "LONG"
                                    ? "var(--green)"
                                    : "var(--red)",
                              }}
                            >
                              {trade.direction}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{price(trade.entry_price)}</td>
                      <td className="mono">{price(trade.exit_price)}</td>
                      <td>
                        <Tag tone={trade.result === "SL" ? "red" : "green"}>
                          {trade.result === "SL" ? (
                            <ArrowDownRight size={11} />
                          ) : (
                            <ArrowUpRight size={11} />
                          )}
                          {trade.result}
                        </Tag>
                      </td>
                      <td
                        className={`mono ${trade.r_result > 0 ? "positive" : "negative"}`}
                      >
                        {trade.r_result > 0 ? "+" : ""}
                        {number(trade.r_result)}R
                      </td>
                      <td className="muted">
                        {dateTime(trade.closed_at, user?.tz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {page * 8 + 1}-{Math.min((page + 1) * 8, data.operations)} de{" "}
                {data.operations} operaciones
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Página anterior"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {page + 1} / {Math.ceil(data.operations / 8)}
                </span>
                <button
                  className="icon-button"
                  aria-label="Página siguiente"
                  disabled={(page + 1) * 8 >= data.operations}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      <p className="slim-note">
        <ShieldCheck size={12} />
        Si una operación toca TP1 y después retrocede al Stop Loss, se registra
        como TP1. Un SL antes del primer objetivo equivale a -1,00R.
      </p>
      <p className="slim-note" style={{ paddingTop: 0 }}>
        <Info size={12} />
        Este histórico incluye únicamente cierres registrados por el backend. Los resultados anteriores no garantizan resultados futuros.
      </p>
    </div>
  );
}
