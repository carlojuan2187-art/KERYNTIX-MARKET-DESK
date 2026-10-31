import { t } from "@/i18n/translation";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  Check,
  Pencil,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  calculatePosition,
  getSignals,
  updateProfile,
  type CalcResult,
} from "@/api";
import { useApp } from "@/context/AppContext";
import { useApi } from "@/hooks/useApi";
import { number, price } from "@/utils/format";
import { PageHeader, Reading, SectionHeader, Tag } from "@/components/ui";

type Field = "capital" | "risk_pct" | "entry" | "stop" | "tp1" | "tp2" | "tp3";
export default function CalculadoraPage() {
  const { user, setUser, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const { data: signals } = useApi(getSignals);
  const [form, setForm] = useState<Record<Field, string>>({
    capital: user?.risk_profile.capital ? String(user.risk_profile.capital) : "",
    risk_pct: user?.risk_profile.risk_pct ? String(user.risk_profile.risk_pct) : "1",
    entry: "",
    stop: "",
    tp1: "",
    tp2: "",
    tp3: "",
  });
  const [editProfile, setEditProfile] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fromSignal = params.get("senal");
  useEffect(() => {
    const signal = signals?.find((s) => s.symbol === fromSignal);
    if (signal) {
      setForm((old) => ({
        ...old,
        entry: signal.entry_price != null ? String(signal.entry_price) : "",
        stop: String(signal.stop_loss),
        tp1: String(signal.tp1),
        tp2: signal.tp2 ? String(signal.tp2) : "",
        tp3: signal.tp3 ? String(signal.tp3) : "",
      }));
      setResult(null);
    }
  }, [signals, fromSignal]);
  function field(key: Field, label: string, hint?: string) {
    return (
      <label className="input-field" htmlFor={`calc-${key}`}>
        <span>{t(label)}</span>
        <input
          id={`calc-${key}`}
          inputMode="decimal"
          type="number"
          min="0"
          step="any"
          value={form[key]}
          disabled={(key === "capital" || key === "risk_pct") && !editProfile}
          onChange={(e) => {
            setForm({ ...form, [key]: e.target.value });
            setResult(null);
          }}
        />
        {hint && <small>{t(hint)}</small>}
      </label>
    );
  }
  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await calculatePosition({
          capital: Number(form.capital),
          risk_pct: Number(form.risk_pct),
          entry: Number(form.entry),
          stop: Number(form.stop),
          tp1: Number(form.tp1),
          tp2: Number(form.tp2) || undefined,
          tp3: Number(form.tp3) || undefined,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile() {
    const capital = Number(form.capital);
    const risk_pct = Number(form.risk_pct);
    const maxRisk = 10;
    if (capital <= 0 || risk_pct <= 0 || risk_pct > maxRisk) {
      setError(
        `Capital y riesgo deben ser positivos. El riesgo máximo en este modo es ${maxRisk}%.`,
      );
      return;
    }
    setError("");
    try {
      const updated = await updateProfile({
        risk_profile: { capital, risk_pct },
      });
      setUser(updated);
      setEditProfile(false);
      toast("Perfil de riesgo guardado para tu próxima operación");
    } catch (err) {
      setError((err as Error).message || "No se pudo guardar el perfil de riesgo.");
    }
  }
  return (
    <div>
      <PageHeader
        eyebrow={t("PROTEGE LO QUE IMPORTA")}
        title={t("Primero el riesgo. Después la operación.")}
        description={t("Convierte tu plan en un tamaño de posición, antes de comprometer capital.")}
      >
        <Link className="btn btn-secondary" to="/guia/riesgo">
          <ShieldCheck size={14} />
          {t("Gestión de riesgo")}</Link>
      </PageHeader>
      <div className="two-col calculator-layout">
        <section className="panel panel-pad">
          <div className="tabs">
            <button
              className={`tab ${!fromSignal ? "active" : ""}`}
              onClick={() => {
                setParams({});
                setResult(null);
              }}
            >
              {t("Modo manual")}</button>
            <button
              className={`tab ${fromSignal ? "active" : ""}`}
              onClick={() => {
                if (signals?.length) setParams({ senal: signals[0].symbol });
              }}
            >
              {t("Desde una señal")}</button>
          </div>
          {fromSignal && (
            <label className="input-field" style={{ marginBottom: 22 }}>
              <span>{t("Señal de referencia")}</span>
              <select
                value={fromSignal}
                onChange={(e) => setParams({ senal: e.target.value })}
              >
                {signals?.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} · {s.direction} · {s.status}
                  </option>
                ))}
              </select>
            </label>
          )}
          <form className="form-stack" onSubmit={calculate} noValidate>
            <SectionHeader title={t("Tu perfil de riesgo")}>
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => setEditProfile((edit) => !edit)}
              >
                <Pencil size={11} />
                {editProfile ? "Cancelar edición" : "Cambiar capital / riesgo"}
              </button>
            </SectionHeader>
            <div className="form-grid">
              {field("capital", "Capital disponible (USDT)")}
              {field(
                "risk_pct",
                "Riesgo por operación (%)",
                "1 significa el 1% de tu capital.",
              )}
            </div>
            {editProfile && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void saveProfile()}
              >
                <Check size={12} />
                {t("Guardar perfil de riesgo")}</button>
            )}
            <div className="calculator-divider" />
            <SectionHeader title={t("Niveles de la operación")}>
              <Tag tone="muted">{t("Dirección automática")}</Tag>
            </SectionHeader>
            <div className="form-grid">
              {field("entry", "Precio de entrada (USDT)")}
              {field("stop", "Stop Loss (USDT)")}
              {field("tp1", "Take Profit 1 (USDT)")}
              {field("tp2", "Take Profit 2 · opcional")}
              {field("tp3", "Take Profit 3 · opcional")}
            </div>
            <p className="slim-note" style={{ padding: 0 }}>
              {t("Stop debajo de la entrada = LONG. Stop encima = SHORT.")}</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary calculator-submit"
              disabled={busy}
              type="submit"
            >
              <Calculator size={15} />
              {busy ? "Calculando tu riesgo..." : "Calcular tamaño de posición"}
              <ArrowRight size={14} />
            </button>
          </form>
        </section>
        <section className="panel panel-pad calculator-result">
          <SectionHeader title={t("Tu operación, dimensionada")}>
            {result && (
              <Tag tone={result.direction === "LONG" ? "green" : "red"}>
                {result.direction}
              </Tag>
            )}
          </SectionHeader>
          {!result ? (
            <div className="calculator-empty">
              <div className="risk-illustration">
                <Target size={60} strokeWidth={0.8} />
                <ShieldCheck size={21} />
              </div>
              <h2>
                {t("El mejor trade empieza")}<br />
                {t("por un riesgo definido.")}</h2>
              <p>
                {t("Introduce tus niveles y descubre cuánto operar, qué margen necesitas y qué puedes ganar o perder.")}</p>
              <span className="small muted">
                {t("No ejecutamos operaciones por ti.")}</span>
            </div>
          ) : (
            <>
              <div className="risk-result-top">
                <span>{t("Tu riesgo por operación")}</span>
                <strong className="mono">
                  {number(result.risk_usdt)}
                  <small>USDT</small>
                </strong>
                <Tag tone="amber">
                  {form.risk_pct}{t("% de tu capital · sin comisiones")}</Tag>
              </div>
              <div className="detail-list">
                {[
                  {
                    label: "Cantidad",
                    value: `${number(result.qty, 6)} unidades`,
                  },
                  {
                    label: "Tamaño de posición",
                    value: `${number(result.position_size)} USDT`,
                  },
                  {
                    label: "Apalancamiento mínimo",
                    value: `${result.leverage_min}x`,
                  },
                  {
                    label: "Margen aislado",
                    value: `${number(result.isolated_margin)} USDT`,
                  },
                  {
                    label: "Liquidación aproximada",
                    value: `${price(result.liquidation_approx)} USDT`,
                  },
                  {
                    label: "Comisión estimada ida / vuelta",
                    value: `${number(result.fees_usdt)} USDT`,
                  },
                ].map((item) => (
                  <div key={item.label} className="detail-row">
                    <span>{t(item.label)}</span>
                    <strong className="mono">{item.value}</strong>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 25 }}>
                <SectionHeader title={t("Si el plan llega a sus objetivos")} />
                <div className="table-scroll">
                  <table className="data-table calc-targets">
                    <thead>
                      <tr>
                        <th>{t("Nivel")}</th>
                        <th>R:R</th>
                        <th>{t("Bruto")}</th>
                        <th>{t("Neto estimado")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.map((target) => (
                        <tr key={target.level}>
                          <td>{target.level}</td>
                          <td className="mono">{number(target.r, 1)}R</td>
                          <td className="mono positive">
                            +{number(target.usdt)}
                          </td>
                          <td
                            className={`mono ${target.net_usdt >= 0 ? "positive" : "negative"}`}
                          >
                            {target.net_usdt > 0 ? "+" : ""}
                            {number(target.net_usdt)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>{t("Stop Loss")}</td>
                        <td className="mono negative">-1.0R</td>
                        <td className="mono negative">
                          -{number(result.risk_usdt)}
                        </td>
                        <td className="muted">{t("+ comisiones")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <Reading title={t("Números para decidir, no para prometer")}>
                {t("Comisión taker de 0,05% por lado. MMR asumido de 0,4%. La liquidación es orientativa y no incluye funding ni tramos de mantenimiento. Los objetivos suponen cerrar el 100% de la posición en cada nivel, por separado.")}</Reading>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
