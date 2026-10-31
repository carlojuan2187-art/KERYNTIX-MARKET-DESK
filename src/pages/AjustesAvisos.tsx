import { useEffect, useState } from "react";
import { Bell, BellRing, Info, ShieldCheck, Smartphone, Send, Monitor } from "lucide-react";
import { updateAlertPrefs } from "@/api";
import type { AlertPrefs } from "@/api/types";
import { appConfig } from "@/api/config";
import { useApp } from "@/context/AppContext";
import { currentBrowserPushSubscription, subscribeCurrentBrowserToPush, supportsWebPush, unsubscribeCurrentBrowserFromPush } from "@/api/webPush";
import { PageHeader, SectionHeader, Tag } from "@/components/ui";

type ChannelKey = "in_app" | "telegram" | "web_push";

export default function AjustesAvisosPage() {
  const { user, setUser, toast, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [pushSupported] = useState(() => supportsWebPush());
  const [pushRegistered, setPushRegistered] = useState(false);
  const prefs = user?.alert_prefs;

  useEffect(() => {
    let cancelled = false;
    void currentBrowserPushSubscription().then((subscription) => {
      if (!cancelled) setPushRegistered(Boolean(subscription));
    }).catch(() => {
      if (!cancelled) setPushRegistered(false);
    });
    return () => { cancelled = true; };
  }, [user?.user_id]);

  if (!user || !prefs) return null;

  async function toggleCategory(key: keyof AlertPrefs) {
    if (!user || !prefs) return;
    setBusy(true);
    try {
      const updated = await updateAlertPrefs({ [key]: !prefs[key] });
      setUser({ ...user, alert_prefs: updated });
      toast(t("Preferencias de avisos guardadas"));
    } catch {
      toast(t("No se pudieron guardar los ajustes. Intenta otra vez."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChannel(key: ChannelKey) {
    if (!user || !prefs || busy) return;
    setBusy(true);
    try {
      // The channel switch is a user-level preference. Each browser has its own
      // endpoint; registering an additional device is handled by the button below.
      const enabling = !Boolean(prefs[key]);
      if (key === "telegram" && enabling && !user.telegram_chat_id) {
        throw new Error(t("Primero debes vincular Telegram desde el apartado Cuenta."));
      }
      if (key === "web_push") {
        if (enabling) {
          await subscribeCurrentBrowserToPush();
          setPushRegistered(true);
          setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
        }
        const updated = await updateAlertPrefs({ web_push: enabling });
        setUser({ ...user, alert_prefs: updated });
        if (!enabling) {
          await unsubscribeCurrentBrowserFromPush();
          setPushRegistered(false);
        }
      } else {
        const updated = await updateAlertPrefs({ [key]: enabling });
        setUser({ ...user, alert_prefs: updated });
      }
      toast(t("Canales de notificación actualizados"));
    } catch (error) {
      toast(t((error as Error).message || "No se pudieron guardar los ajustes. Intenta otra vez."), "error");
      if (key === "web_push") {
        setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
        void currentBrowserPushSubscription().then((subscription) => setPushRegistered(Boolean(subscription))).catch(() => setPushRegistered(false));
      }
    } finally {
      setBusy(false);
    }
  }

  async function registerThisBrowser() {
    if (!user || !prefs?.web_push || busy || pushRegistered) return;
    setBusy(true);
    try {
      await subscribeCurrentBrowserToPush();
      setPushRegistered(true);
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      toast(t("Este navegador quedó registrado para Web Push"));
    } catch (error) {
      toast(t((error as Error).message || "No se pudo registrar este navegador."), "error");
      void currentBrowserPushSubscription().then((subscription) => setPushRegistered(Boolean(subscription))).catch(() => setPushRegistered(false));
    } finally {
      setBusy(false);
    }
  }

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const value = await Notification.requestPermission();
    setPermission(value);
    toast(value === "granted" ? t("Permiso para notificaciones concedido") : t("Puedes cambiar el permiso desde la configuración de tu navegador."), "info");
  }

  const channels: { key: ChannelKey; title: string; description: string; icon: typeof Bell; disabled?: boolean }[] = [
    { key: "in_app", title: "Centro de FTrade", description: "Guarda los avisos en el centro de notificaciones y muestra avisos dentro de la plataforma.", icon: Bell },
    { key: "telegram", title: "Telegram", description: user.telegram_chat_id ? "Envía los avisos al chat de Telegram vinculado a tu cuenta." : "Vincula Telegram desde Cuenta para poder recibir avisos por este canal.", icon: Send, disabled: !user.telegram_chat_id },
    { key: "web_push", title: "Navegador y dispositivo", description: "Recibe notificaciones del sistema incluso cuando FTrade está cerrado, en este navegador.", icon: Smartphone, disabled: !pushSupported },
  ];

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
            { key: "on" as const, title: "Avisos automáticos", description: "Interruptor general para los avisos de anomalías." },
            { key: "signals" as const, title: "Nuevas señales", description: "Aviso cuando FTrade publica una señal nueva disponible para tu cuenta." },
            { key: "liq" as const, title: "Liquidaciones", description: "Barridos de longs y squeezes de shorts, globales o por par." },
            { key: "mov" as const, title: "Movimientos con volumen", description: "Pumps y dumps respaldados por volumen confirmado." },
            { key: "vol" as const, title: "Volumen sin movimiento", description: "Volumen anormal mientras el precio permanece estable." },
          ].map((item) => (
            <div className="preference-row" key={item.key}>
              <div><h3>{t(item.title)}</h3><p>{t(item.description)}</p></div>
              <button role="switch" aria-checked={Boolean(prefs[item.key])} aria-label={t(item.title)}
                className={`switch ${prefs[item.key] ? "on" : ""}`} disabled={busy || (item.key !== "on" && !prefs.on)}
                onClick={() => void toggleCategory(item.key)} />
            </div>
          ))}
        </section>
        <div className="stack">
          <section className="panel panel-pad">
            <SectionHeader title={t("Dónde quieres recibir avisos")}>
              <Monitor size={16} className="muted" />
            </SectionHeader>
            <p className="account-explainer">{t("Activa cada canal por separado. Los tipos de aviso y el interruptor general siguen aplicándose a todos los canales.")}</p>
            {channels.map((channel) => {
              const Icon = channel.icon;
              const enabled = Boolean(prefs[channel.key]);
              return (
                <div className="preference-row" key={channel.key}>
                  <div className="preference-copy">
                    <h3><Icon size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />{t(channel.title)}</h3>
                    <p>{t(channel.description)}</p>
                    {channel.key === "web_push" && <>
                      <Tag tone={pushRegistered ? "green" : "muted"} dot>{pushRegistered ? t("Este navegador está registrado") : t("Este navegador aún no está registrado")}</Tag>
                      {prefs.web_push && !pushRegistered && <button className="btn btn-secondary" style={{ display: "flex", marginTop: 9 }} disabled={busy} onClick={() => void registerThisBrowser()}>
                        <Smartphone size={13} />{t("Registrar este navegador")}
                      </button>}
                    </>}
                  </div>
                  <button role="switch" aria-checked={enabled} aria-label={t(channel.title)}
                    className={`switch ${enabled ? "on" : ""}`} disabled={busy || Boolean(channel.disabled)}
                    onClick={() => void toggleChannel(channel.key)} />
                </div>
              );
            })}
            {!pushSupported && <p className="account-explainer">{t("Este navegador o contexto no admite Web Push. Usa HTTPS y un navegador compatible para activar este canal.")}</p>}
            {pushSupported && permission !== "granted" && prefs.web_push && <Tag tone="amber" dot>{permission === "denied" ? t("Permiso bloqueado en el navegador") : t("El permiso del navegador todavía no está concedido")}</Tag>}
          </section>
          <section className="panel panel-pad">
            <SectionHeader title={t("Notificaciones del navegador")}>
              <BellRing size={16} className="muted" />
            </SectionHeader>
            <p className="account-explainer">{t("Web Push permite recibir avisos aunque FTrade esté cerrada. La suscripción se guarda para este navegador y puedes retirarla desactivando su canal.")}</p>
            <Tag tone={permission === "granted" ? "green" : permission === "denied" ? "amber" : "muted"} dot>
              {permission === "granted" ? t("Permiso concedido") : permission === "denied" ? t("Permiso bloqueado") : permission === "unsupported" ? t("No compatible") : t("Permiso pendiente")}
            </Tag>
            <button className="btn btn-secondary" style={{ display: "flex", marginTop: 18 }}
              disabled={permission === "granted" || permission === "unsupported"}
              onClick={() => void requestPermission()}>
              <Bell size={13} />{permission === "granted" ? t("Notificaciones activadas") : t("Permitir notificaciones")}
            </button>
          </section>
          <section className="notification-rules">
            <SectionHeader title={t("Un filtro pensado para tu atención")} />
            <div><ShieldCheck size={17} /><p>{t("Máximo 8 avisos por hora en total. No se repite el mismo par durante 45 minutos, salvo que la magnitud se duplique.")}</p></div>
            <div><Info size={17} /><p>{t("Los avisos de mercado desaparecen de pantalla a los")} {appConfig.alertDuration} {t("segundos y los estados de señales a los 7 segundos. Si activas Centro de FTrade, los avisos permanecen allí incluso después de leerlos.")}</p></div>
          </section>
        </div>
      </div>
    </div>
  );
}
