import { t } from "@/i18n/translation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getRegime } from "@/api";
import type { MarketRegime, MarketRegimeTimeframe, MarketRegimeTimeframeAnalysis } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
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

const REGIME_TIMEFRAMES: { value: MarketRegimeTimeframe; label: string; longLabel: string }[] = [
  { value: "4h", label: "4H", longLabel: "4 horas" },
  { value: "1h", label: "1H", longLabel: "1 hora" },
  { value: "15m", label: "15M", longLabel: "15 minutos" },
];

function timeframeTrend(analysis: MarketRegimeTimeframeAnalysis): MarketRegime["trend"] {
  if (analysis.regime === "UP") return "TENDENCIA ALCISTA";
  if (analysis.regime === "DOWN") return "TENDENCIA BAJISTA";
  if (analysis.regime === "RANGE" && (analysis.vol_percentile ?? 0) >= 90) {
    return "ALTA VOLATILIDAD";
  }
  if (analysis.regime === "RANGE") return "RANGO";
  if (analysis.regime === "VOLATILE") return "ALTA VOLATILIDAD";
  return "TRANSICIÓN";
}

export default function RegimenPage() {
  const { language } = useApp();
  void language; // Subscribe to language changes so imported translations refresh.
  const [timeframe, setTimeframe] = useState<MarketRegimeTimeframe>("4h");
  const { data, loading, error, refresh } = useApi(getRegime);
  const selectedAnalysis = data?.timeframes?.[timeframe];
  const displayRegime: MarketRegime | null = data && selectedAnalysis
    ? {
        ...data,
        trend: timeframeTrend(selectedAnalysis),
        adx: selectedAnalysis.adx,
        atr_pct: selectedAnalysis.atr_pct,
        bollinger_state: selectedAnalysis.bandwidth_trend ?? undefined,
        volume_relative: selectedAnalysis.rel_volume,
      }
    : null;
  const selectedTimeframeLabel = REGIME_TIMEFRAMES.find((item) => item.value === timeframe)?.longLabel ?? "4 horas";

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh();
    }, 300000);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <div>
      <PageHeader
        eyebrow={t("ADAPTA TU ESTRATEGIA AL CONTEXTO")}
        title={t("No todos los mercados se operan igual.")}
        description={t("Selecciona 4H, 1H o 15M para consultar el régimen de BTC y los indicadores de esa temporalidad.")}
      >
        <RefreshButton loading={loading} onClick={refresh} />
      </PageHeader>
      <div className="regime-timeframe-picker">
        <span>{t("Temporalidad del régimen")}</span>
        <div className="timeframes" role="group" aria-label={t("Temporalidad del régimen de mercado")}>
          {REGIME_TIMEFRAMES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={timeframe === item.value ? "active" : ""}
              aria-pressed={timeframe === item.value}
              title={t(`Ver régimen de ${item.longLabel}`)}
              onClick={() => setTimeframe(item.value)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>
      <ResourceState loading={loading} error={error} retry={refresh} />
      {data && !loading && !error && !displayRegime && (
        <p className="slim-note" role="status">
          {t("No hay datos suficientes para calcular el régimen de ")}{selectedTimeframeLabel}{t(". Prueba otra temporalidad o actualiza los datos.")}</p>
      )}
      {displayRegime && !loading && !error && (
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
                className={displayRegime.trend === trend ? "active" : ""}
                key={trend}
              >
                {t(trend)}
              </span>
            ))}
          </div>
          <div className="dashboard-main-grid">
            <MarketChart />
            <RegimePanel
              regime={displayRegime}
              timeframeLabel={timeframe.toUpperCase()}
              breadth={displayRegime.market_breadth == null ? null : Math.round(displayRegime.market_breadth * 100)}
            />
          </div>
          <section className="panel panel-pad">
            <SectionHeader
              title={`Las piezas del contexto · ${timeframe.toUpperCase()}`}
              subtitle={t(`Indicadores calculados sobre velas de ${selectedTimeframeLabel}. El contexto de amplitud y derivados es global.`)}
            />
            <div className="regime-factors">
              {[
                {
                  label: "Fuerza de tendencia",
                  title: `ADX ${number(displayRegime.adx, 1)}`,
                  text: "Por encima de 25: tendencia con fuerza. No indica por sí solo la dirección.",
                },
                {
                  label: "Volatilidad",
                  title: `ATR ${number(displayRegime.atr_pct)}%`,
                  text: "Rango relativo del precio. Ajusta la distancia del stop al movimiento del mercado.",
                },
                {
                  label: "Bandas de Bollinger",
                  title: displayRegime.bollinger_state || "Sin datos",
                  text: "El precio se mantiene sobre la media. La expansión acompaña el impulso.",
                },
                {
                  label: "Participación",
                  title: `${number(displayRegime.volume_relative, 2)}x volumen`,
                  text: "El volumen supera su media: el movimiento tiene participación, no solo precio.",
                },
              ].map((factor) => (
                <div key={factor.label}>
                  <span>{t(factor.label)}</span>
                  <h3>{t(factor.title)}</h3>
                  <p>{t(factor.text)}</p>
                </div>
              ))}
            </div>
            <div className="regime-secondary">
              <span>
                {t("Amplitud")}{" "}
                <strong className="positive">
                  {displayRegime.market_breadth == null ? "—" : `${Math.round(displayRegime.market_breadth * 100)}% al alza`}
                </strong>
              </span>
              <span>
                {t("Funding")}{" "}
                <strong className="mono">
                  {displayRegime.funding_rate == null ? "—" : percent(displayRegime.funding_rate * 100, 4)}
                </strong>
              </span>
              <span>
                {t("Interés abierto")}{" "}
                <strong className="mono">${displayRegime.oi_value == null ? "—" : compact(displayRegime.oi_value)}</strong>
              </span>
              <span>
                {t("Sesión ")}<strong>{displayRegime.session_now || "—"}</strong>
              </span>
            </div>
            <Reading title={t("Cómo llevarlo a tu operativa")}>
              {t("En un entorno alcista con ADX fuerte, los retrocesos a zonas de interés pueden tener más contexto que los cortos contra tendencia. No anticipes la entrada: espera un setup confirmado y dimensiona el riesgo antes de operar.")}</Reading>
            <Link className="btn btn-primary" to="/senales">
              {t("Buscar setups con contexto")}<ArrowUpRight size={13} />
            </Link>
          </section>
          <p className="slim-note">
            <Clock3 size={12} />
            {t("Refresco automático cada 5 minutos. Última lectura:")}{" "}
            {dateTime(displayRegime.updated_at)}.
          </p>
        </>
      )}
    </div>
  );
}
