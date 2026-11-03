import { t } from "@/i18n/translation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getBillingPlans, getPaymentHistory, startPayment, verifyPayment } from "@/api";
import type { PaymentSession } from "@/api/account";
import { appConfig } from "@/api/config";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime, numberTrimmed } from "@/utils/format";
import {
  CopyButton,
  Countdown,
  PageHeader,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";

const statusLabels = {
  pending: "Pendiente",
  verifying: "Verificando",
  confirmed: "Confirmado",
  expired: "Vencido",
  failed: "Fallido",
};

const premiumBenefitGroups = [
  {
    title: "Señales y seguimiento",
    items: [
      "Acceso continuo a las señales Premium LONG y SHORT",
      "Niveles de entrada, Stop Loss, TP1 y TP2 en cada señal",
      "Seguimiento de estados, objetivos, cancelaciones y cierres",
    ],
  },
  {
    title: "Inteligencia de mercado",
    items: [
      "Radar de oportunidades con score, estructura y contexto",
      "Cotizaciones, gráficos, amplitud y movimientos del mercado en vivo",
      "Régimen de BTC en 15M, 1H y 4H con ADX, ATR y tendencia",
      "Flujo, CVD, delta y niveles visibles del libro de órdenes",
      "Derivados: funding, interés abierto, base, ratios long/short y flujo taker",
      "Monitor de liquidaciones y calendario macro y cripto",
    ],
  },
  {
    title: "Herramientas y rendimiento",
    items: [
      "Watchlist personal de hasta 10 pares con análisis multi-temporalidad",
      "Resultados: R acumulado y medio, win rate, curva e historial de cierres",
      "Calculadora de riesgo, tamaño de posición, exposición y margen estimado",
      "Guía del trader y contenido educativo de la plataforma",
    ],
  },
  {
    title: "Avisos y control",
    items: [
      "Centro de notificaciones e historial personal",
      "Avisos del navegador y Telegram según permisos y preferencias",
    ],
  },
];
export default function PlanesPage() {
  const { user, toast } = useApp();
  // WhatsApp contact variables are optional; never let a missing contact crash the whole page.
  const adminWhatsapp = appConfig.whatsapp[0] ?? "";
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = useApi(getPaymentHistory);
  const billing = useApi(getBillingPlans);
  const premiumPlan = billing.data?.plans.find((plan) => plan.plan === "premium");
  async function start() {
    setBusy(true);
    setError("");
    try {
      setPayment(await startPayment());
      setWallet("");
      void history.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!payment) return;
    setBusy(true);
    setError("");
    try {
      const record = await verifyPayment(payment.record.id, wallet);
      setPayment({ ...payment, record });
      void history.refresh();
      if (record.status === "confirmed") {
        toast("Pago confirmado por el backend. Tu acceso Premium se actualizó.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (payment?.record.status !== "verifying") return;
    const timer = setInterval(() => {
      void verifyPayment(payment.record.id, wallet)
        .then((record) => {
          setPayment((old) => (old ? { ...old, record } : null));
          if (record.status === "confirmed") {
            toast("Pago confirmado por el backend. Tu acceso Premium se actualizó.");
            void history.refresh();
          }
        })
        .catch((err) => setError((err as Error).message));
    }, 1800);
    return () => clearInterval(timer);
  }, [payment?.record.id, payment?.record.status, wallet]);
  return (
    <div>
      <PageHeader
        eyebrow={t("UNA SOLA SEÑAL. TODO EL CONTEXTO.")}
        title={t("Invierte en una mejor perspectiva.")}
        description={t("FREE para probar la plataforma. PREMIUM para mantener el acceso completo a todos los módulos.")}
      >
        <Tag tone={user?.plan === "premium" ? "green" : "blue"} dot>
          {t("Tu plan: ")}{(user?.plan || "free").toUpperCase()}
        </Tag>
      </PageHeader>
      <div className="plans-grid">
        <section className="plan-option">
          <div className="eyebrow">{t("EXPLORA LA PLATAFORMA")}</div>
          <h2>FREE</h2>
          <div className="plan-price">
            0<span>USDT</span>
          </div>
          <p>
            {appConfig.trialDays} {t("días de prueba con acceso completo a todas las funciones Premium para cuentas nuevas.")}
          </p>
          <ul>
            <li><Check size={14} />{t("Las mismas señales y módulos que Premium durante la prueba")}</li>
            <li><Check size={14} />{t("Radar, mercado, régimen y análisis de derivados")}</li>
            <li><Check size={14} />{t("Watchlist, resultados, calculadora y guía")}</li>
            <li><Check size={14} />{t("Notificaciones web y Telegram según configuración")}</li>
          </ul>
          <span className="slim-note">
            {t("La prueba comienza al verificar tu teléfono. Al vencer, los módulos analíticos requieren una suscripción Premium activa; tu cuenta y la sección de pagos siguen disponibles.")}
          </span>
        </section>
        <section className="plan-option premium-plan">
          <div className="premium-heading">
            <span className="eyebrow">{t("TU VENTAJA, SIN INTERRUPCIONES")}</span>
            <Sparkles size={17} />
          </div>
          <h2>PREMIUM</h2>
          <div className="plan-price">
            {premiumPlan?.price_usdt ? numberTrimmed(Number(premiumPlan.price_usdt), 3) : "—"}
            <span>{premiumPlan ? `USDT / ${premiumPlan.duration_days} días` : "USDT · plan no disponible"}</span>
          </div>
          <p>
            {t("Acceso continuo a todas las áreas de KERYNTIX MARKET DESK durante el periodo contratado: señales, análisis, herramientas y seguimiento.")}
          </p>
          <div className="premium-benefits" aria-label={t("Beneficios incluidos en Premium")}>
            {premiumBenefitGroups.map((group) => (
              <section className="premium-benefit-group" key={group.title}>
                <h3>{t(group.title)}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}><Check size={13} />{t(item)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="premium-availability-note">
            {t("Las señales y métricas son informativas y dependen de la disponibilidad de las fuentes conectadas. La plataforma no ejecuta órdenes automáticamente ni incluye copy trading.")}
          </p>
          <button
            className="btn btn-primary"
            disabled={busy || billing.loading || billing.error != null || billing.data?.payment_configured !== true || !premiumPlan || payment?.record.status === "verifying"}
            onClick={() => void start()}
          >
            <CreditCard size={14} />
            {busy
              ? "Preparando pago..."
              : user?.plan === "premium"
                ? premiumPlan ? `Renovar ${premiumPlan.duration_days} días` : "Consultar plan"
                : "Activar Premium"}
            <ArrowRight size={13} />
          </button>
        </section>
      </div>
      {billing.data && !billing.data.payment_configured && (
        <p className="form-error" role="status">{t("Los pagos no están habilitados porque el backend no tiene configurada la verificación y la wallet receptora. No transfieras fondos.")}</p>
      )}
      {billing.error && <p className="form-error" role="alert">{t("No se pudo consultar la configuración de pagos: ")}{billing.error}</p>}
      <p className="slim-note">
        <Info size={12} />
        {t("Si ya tienes Premium, los 30 días se suman a tu vencimiento actual. No pierdes los días restantes.")}</p>
      {payment && (
        <section className="panel panel-pad payment-panel">
          <SectionHeader title={t("Tu solicitud de pago en USDT")}>
            <Tag
              tone={
                payment.record.status === "confirmed"
                  ? "green"
                  : payment.record.status === "expired" ||
                      payment.record.status === "failed"
                    ? "red"
                    : "amber"
              }
              dot
            >
              {statusLabels[payment.record.status]}
            </Tag>
          </SectionHeader>
          <div className="payment-real-notice">
            <Info size={15} />
            <span>{t("La verificación se realiza en la red configurada por el backend. Revisa la red, el token y el monto antes de transferir.")}</span>
          </div>
          {payment.record.status === "confirmed" ? (
            <div className="payment-confirmed">
              <CheckCircle2 size={45} />
              <h2>{t("Tu acceso Premium está activo.")}</h2>
              <p>{t("El backend confirmó la transferencia. Tu estado de suscripción debe reflejar la activación.")}</p>
            </div>
          ) : (
            <div className="payment-grid">
              <div className="payment-qr">
                {payment.wallet_dest ? (
                  <QRCodeSVG value={payment.wallet_dest} size={160} marginSize={4} title={t("Dirección receptora de pago USDT")} />
                ) : (
                  <div className="payment-qr-empty">{t("Sin dirección configurada")}</div>
                )}
                <span>{premiumPlan?.network || "Red configurada por el backend"} · {premiumPlan?.token || "USDT"}</span>
              </div>
              <div className="form-stack">
                <div className="payment-amount">
                  <span>{t("Monto exacto solicitado por el backend")}</span>
                  <strong className="mono">
                    {payment.price}
                    <small>USDT</small>
                  </strong>
                  <CopyButton text={payment.price} label={t("Copiar monto")} />
                </div>
                <div className="payment-destination">
                  <span>{t("Dirección receptora")}</span>
                  <code>{payment.wallet_dest || "No configurada por el backend"}</code>
                  {payment.wallet_dest && <CopyButton text={payment.wallet_dest} label={t("Copiar dirección")} />}
                </div>
                <div className="status-row">
                  <Clock3 size={12} />
                  {t("La solicitud vence en")}{" "}
                  <Countdown until={payment.expires_at} long />
                </div>
                <label className="input-field">
                  <span>{t("Wallet desde la que realizaste el depósito")}</span>
                  <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder={t("0x seguido de 40 caracteres")}
                    disabled={payment.record.status === "verifying"}
                  />
                </label>
                {payment.record.status === "verifying" && payment.record.confirmations != null && (
                  <span className="slim-note">{t("Confirmaciones reportadas por la red: ")}{payment.record.confirmations}</span>
                )}
                <button
                  className="btn btn-blue"
                  disabled={
                    busy ||
                    payment.record.status === "verifying" ||
                    payment.record.status === "expired"
                  }
                  onClick={() => void verify()}
                >
                  {payment.record.status === "verifying" ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  {payment.record.status === "verifying"
                    ? "Esperando confirmaciones..."
                    : payment.record.status === "failed"
                      ? "Reintentar verificación"
                      : "Verificar transferencia"}
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {!payment && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="two-col" style={{ marginTop: 25 }}>
        <section>
          <SectionHeader title={t("Tu historial de pagos")} />
          <ResourceState
            loading={history.loading}
            error={history.error}
            retry={history.refresh}
            empty={!history.loading && !history.error && !history.data?.length}
            emptyText={t("Tus pagos aparecerán aquí cuando crees una solicitud.")}
          />
          {history.data && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Fecha")}</th>
                    <th>{t("Monto USDT")}</th>
                    <th>{t("Estado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((record) => (
                    <tr key={record.id}>
                      <td className="muted">
                        {dateTime(record.created_at, user?.tz)}
                      </td>
                      <td className="mono">{record.amount_usdt}</td>
                      <td>
                        <Tag
                          tone={
                            record.status === "confirmed"
                              ? "green"
                              : record.status === "expired" ||
                                  record.status === "failed"
                                ? "red"
                                : "amber"
                          }
                        >
                          {statusLabels[record.status]}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="manual-payment">
          <SectionHeader title={t("¿Prefieres ayuda con tu pago?")} />
          <p>
            {t("Contacta con un administrador para coordinar la alternativa manual. Nunca compartas claves privadas ni frases semilla.")}</p>
          {adminWhatsapp ? (
            <a
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/${adminWhatsapp}`}
            >
              <MessageCircle size={14} />
              {t("Contactar por WhatsApp")}<ArrowRight size={13} />
            </a>
          ) : (
            <p className="slim-note" role="status">
              {t("El contacto de WhatsApp del administrador todavía no está configurado.")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
