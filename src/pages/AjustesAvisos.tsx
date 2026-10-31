import { t } from "@/i18n/translation";
import { useState } from "react";
import { Bell, BellRing, Info, ShieldCheck } from "lucide-react";
import { updateAlertPrefs } from "@/api";
import type { AlertPrefs } from "@/api/types";
import { appConfig } from "@/api/config";
import { useApp } from "@/context/AppContext";
import { PageHeader, SectionHeader, Tag } from "@/components/ui";

export default function AjustesAvisosPage() {
  const { user, setUser, toast, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const prefs = user?.alert_prefs;
  if (!user || !prefs) return null;
  async function toggle(key: keyof AlertPrefs) {
    if (!user || !prefs) return;
    setBusy(true);
    try {
      const updated = await updateAlertPrefs({ [key]: !prefs[key] });
      setUser({ ...user, alert_prefs: updated });
      toast("Preferencias de avisos guardadas");
    } catch {
      toast("No se pudieron guardar los ajustes. Intenta otra vez.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const value = await Notification.requestPermission();
    setPermission(value);
    toast(
      value === "granted"
        ? "Notificaciones del navegador activadas"
        : "Puedes cambiar el permiso desde la configuración de tu navegador.",
      "info",
    );
  }
  return (
    <div>
      <PageHeader
        eyebrow={t("LO IMPORTANTE, CUANDO IMPORTA")}
        title={t("Menos avisos. Más relevancia.")}
        description={t("Recibe contexto cuando el mercado se sale de lo habitual, no con cada fluctuación.")}
      />
      <div className="two-col">
        <section className="panel panel-pad">
          <SectionHeader title={t("Tus preferencias de mercado")}>
            <Bell size={15} className="muted" />
          </SectionHeader>
          {[
            {
              key: "on" as const,
              title: "Avisos automáticos",
              description: "Interruptor general para los avisos de anomalías.",
            },
            {
              key: "signals" as const,
              title: "Nuevas señales",
              description: "Aviso cuando FTrade publica una señal nueva disponible para tu cuenta.",
            },
            {
              key: "liq" as const,
              title: "Liquidaciones",
              description:
                "Barridos de longs y squeezes de shorts, globales o por par.",
            },
            {
              key: "mov" as const,
              title: "Movimientos con volumen",
              description: "Pumps y dumps respaldados por volumen confirmado.",
            },
            {
              key: "vol" as const,
              title: "Volumen sin movimiento",
              description:
                "Volumen anormal mientras el precio permanece estable.",
            },
          ].map((item) => (
            <div className="preference-row" key={item.key}>
              <div>
                <h3>{t(item.title)}</h3>
                <p>{t(item.description)}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[item.key]}
                aria-label={t(item.title)}
                className={`switch ${prefs[item.key] ? "on" : ""}`}
                disabled={busy || (item.key !== "on" && !prefs.on)}
                onClick={() => void toggle(item.key)}
              />
            </div>
          ))}
        </section>
        <div className="stack">
          <section className="panel panel-pad">
            <SectionHeader title={t("Notificaciones del navegador")}>
              <BellRing size={16} className="muted" />
            </SectionHeader>
            <p className="account-explainer">
              {t("Permite que el navegador muestre notificaciones de eventos recibidos del backend mientras la web está abierta. Las notificaciones con la web cerrada requieren que el servicio Web Push esté configurado.")}</p>
            <Tag tone={permission === "granted" ? "green" : "muted"} dot>
              {permission === "granted"
                ? t("Permiso concedido")
                : permission === "denied"
                  ? t("Permiso bloqueado")
                  : permission === "unsupported"
                    ? t("No compatible")
                    : t("Permiso pendiente")}
            </Tag>
            <button
              className="btn btn-secondary"
              style={{ display: "flex", marginTop: 18 }}
              disabled={
                permission === "granted" || permission === "unsupported"
              }
              onClick={() => void requestPermission()}
            >
              <Bell size={13} />
              {permission === "granted"
                ? t("Notificaciones activadas")
                : t("Activar notificaciones")}
            </button>
          </section>
          <section className="notification-rules">
            <SectionHeader title={t("Un filtro pensado para tu atención")} />
            <div>
              <ShieldCheck size={17} />
              <p>
                {t("Máximo 8 avisos por hora en total. No se repite el mismo par durante 45 minutos, salvo que la magnitud se duplique.")}</p>
            </div>
            <div>
              <Info size={17} />
              <p>
                {t("Los avisos de mercado desaparecen de pantalla a los")}{" "}
                {appConfig.alertDuration} {t("segundos y los estados de señales a los 7 segundos. Todos permanecen en el centro de notificaciones, incluso después de leerlos.")}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
