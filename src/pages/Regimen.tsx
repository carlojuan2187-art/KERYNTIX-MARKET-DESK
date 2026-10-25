import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getRegime } from "@/api";
import { useApi } from "@/hooks/useApi";
import { compact, dateTime, number, percent } from "@/utils/format";
import {
  PageHeader,
  Reading,
  RefreshButton,
  ResourceState,
  SectionHeader,
} from "@/components/ui";
import { MarketChart } from "@/components/Charts";
import { RegimePanel } from "./Dashboard";

export default function RegimenPage() {
  const { data, loading, error, refresh } = useApi(getRegime);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 300000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <div>
      <PageHeader
        eyebrow="ADAPTA TU ESTRATEGIA AL CONTEXTO"
        title="No todos los mercados se operan igual."
        description="El régimen de BTC ayuda a entender qué tipo de entorno tienes delante."
      >
        <RefreshButton loading={loading} onClick={refresh} />
      </PageHeader>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && !loading && !error && (
        <>
          <div className="regime-classifications">
            {[
              "TENDENCIA ALCISTA",
              "TENDENCIA BAJISTA",
              "RANGO",
              "TRANSICIÓN",
              "ALTA VOLATILIDAD",
            ].map((trend) => (
              <span
                className={data.trend === trend ? "active" : ""}
                key={trend}
              >
                {trend}
              </span>
            ))}
          </div>
          <div className="dashboard-main-grid">
            <MarketChart />
            <RegimePanel
              regime={data}
              breadth={data.market_breadth == null ? null : Math.round(data.market_breadth * 100)}
            />
          </div>
          <section className="panel panel-pad">
            <SectionHeader
              title="Las piezas del contexto"
              subtitle="No se trata de un indicador aislado, sino de la confluencia entre ellos."
            />
            <div className="regime-factors">
              {[
                {
                  label: "Fuerza de tendencia",
                  title: `ADX ${number(data.adx, 1)}`,
                  text: "Por encima de 25: tendencia con fuerza. No indica por sí solo la dirección.",
                },
                {
                  label: "Volatilidad",
                  title: `ATR ${number(data.atr_pct)}%`,
                  text: "Rango relativo del precio. Ajusta la distancia del stop al movimiento del mercado.",
                },
                {
                  label: "Bandas de Bollinger",
                  title: data.bollinger_state || "Sin datos",
                  text: "El precio se mantiene sobre la media. La expansión acompaña el impulso.",
                },
                {
                  label: "Participación",
                  title: `${number(data.volume_relative, 2)}x volumen`,
                  text: "El volumen supera su media: el movimiento tiene participación, no solo precio.",
                },
              ].map((factor) => (
                <div key={factor.label}>
                  <span>{factor.label}</span>
                  <h3>{factor.title}</h3>
                  <p>{factor.text}</p>
                </div>
              ))}
            </div>
            <div className="regime-secondary">
              <span>
                Amplitud{" "}
                <strong className="positive">
                  {data.market_breadth == null ? "—" : `${Math.round(data.market_breadth * 100)}% al alza`}
                </strong>
              </span>
              <span>
                Funding{" "}
                <strong className="mono">
                  {data.funding_rate == null ? "—" : percent(data.funding_rate * 100, 4)}
                </strong>
              </span>
              <span>
                Interés abierto{" "}
                <strong className="mono">${data.oi_value == null ? "—" : compact(data.oi_value)}</strong>
              </span>
              <span>
                Sesión <strong>{data.session_now || "—"}</strong>
              </span>
            </div>
            <Reading title="Cómo llevarlo a tu operativa">
              En un entorno alcista con ADX fuerte, los retrocesos a zonas de
              interés pueden tener más contexto que los cortos contra tendencia.
              No anticipes la entrada: espera un setup confirmado y dimensiona
              el riesgo antes de operar.
            </Reading>
            <Link className="btn btn-primary" to="/senales">
              Buscar setups con contexto
              <ArrowUpRight size={13} />
            </Link>
          </section>
          <p className="slim-note">
            <Clock3 size={12} />
            Refresco automático cada 5 minutos. Última lectura:{" "}
            {dateTime(data.updated_at)}.
          </p>
        </>
      )}
    </div>
  );
}
