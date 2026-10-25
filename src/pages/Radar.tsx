import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ScanLine, ShieldCheck } from "lucide-react";
import { getRadarSnapshot } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { ago } from "@/utils/format";
import {
  AssetIcon,
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  Tag,
} from "@/components/ui";
import { Score } from "@/components/SignalTable";

export default function RadarPage() {
  const { data, loading, error, refresh } = useApi(getRadarSnapshot);
  const [filter, setFilter] = useState("all");
  const rows =
    data?.filter((item) => filter === "all" || item.kind === filter) || [];
  return (
    <div>
      <PageHeader
        eyebrow="ANTES DE LA SEÑAL"
        title="Oportunidades en formación."
        description="El scanner conecta estructura, liquidez y volumen. Tú ves lo que merece atención."
      >
        <RefreshButton onClick={refresh} loading={loading} />
      </PageHeader>
      <div className="filter-row">
        <div className="pair-chips">
          {[
            { key: "all", label: "Todo el radar" },
            { key: "setup", label: "Setups activos" },
            { key: "sweep", label: "Barridos" },
            { key: "watch", label: "En vigilancia" },
            { key: "move", label: "Movimientos" },
          ].map((item) => (
            <button
              className={`pair-chip ${filter === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
              <span>
                {data?.filter(
                  (row) => item.key === "all" || row.kind === item.key,
                ).length || 0}
              </span>
            </button>
          ))}
        </div>
        <span className="status-row">
          <ScanLine size={12} />
          Snapshot del scanner · 15M / 5M
        </span>
      </div>
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !rows.length}
        emptyText="No hay oportunidades en esta categoría. Prueba otra vista del radar."
      />
      {!loading && !error && (
        <div className="radar-list">
          {rows.map((row, index) => (
            <article className="radar-row" key={`${row.symbol}-${row.kind}`}>
              <span className="radar-index mono">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="radar-opportunity-main">
                <div className="radar-opportunity-heading">
                  <div className="asset-pair">
                    <AssetIcon symbol={row.symbol} size={35} />
                    <div>
                      <strong>{row.symbol.replace("USDT", " / USDT")}</strong>
                      <small>{ago(row.created_at)}</small>
                    </div>
                  </div>
                  <Tag
                    tone={
                      row.kind === "setup"
                        ? "green"
                        : row.kind === "sweep"
                          ? "blue"
                          : row.kind === "watch"
                            ? "amber"
                            : "red"
                    }
                  >
                    {row.label}
                  </Tag>
                </div>
                <p>{row.detail}</p>
                <div className="radar-breakdown">
                  {Object.entries(row.score_breakdown).map(([key, value]) => (
                    <span key={key}>
                      {
                        (
                          {
                            structure: "Estructura",
                            confluence: "Confluencia",
                            momentum: "Momentum",
                            liquidity: "Liquidez",
                          } as Record<string, string>
                        )[key]
                      }
                      <strong className="mono">{value}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="radar-score">
                {row.score == null ? (
                  <span className="muted">Score —</span>
                ) : (
                  <Score value={row.score} />
                )}
                <span className={row.direction == null ? "muted" : row.direction === "LONG" ? "positive" : "negative"}>
                  {row.direction ?? "Dirección —"}
                </span>
                <Link
                  className="btn btn-secondary"
                  to={
                    row.kind === "setup"
                      ? `/senales?par=${row.symbol}`
                      : `/mercado/flujo/${row.symbol}`
                  }
                >
                  {row.kind === "setup" ? "Ver señal" : "Ver flujo"}
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Reading title="Contexto, no una invitación a entrar">
        Un barrido o un volumen inusual no son una señal confirmada. El radar es
        una vista de solo lectura del scanner y no cambia las señales de tu
        cuenta. Espera una zona de entrada y una confirmación válida.
      </Reading>
      <Link className="btn btn-quiet" to="/guia">
        <ShieldCheck size={14} />
        Aprende a interpretar el radar
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
