import { getIntlLocale } from "@/i18n/translation";
import { t } from "@/i18n/translation";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Check,
  ExternalLink,
  LogOut,
  Monitor,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { getMe, updateProfile } from "@/api";
import {
  logout,
  startTelegramLink,
  unlinkTelegramAccount,
  verifyTelegramLink,
  type TelegramLinkRequest,
} from "@/api/account";
import { appConfig } from "@/api/config";
import { getSessions, revokeSession } from "@/api/terminal";
import { useApp } from "@/context/AppContext";
import { useApi } from "@/hooks/useApi";
import { dateTime, number } from "@/utils/format";
import { PageHeader, ResourceState, SectionHeader, Tag } from "@/components/ui";

export default function CuentaPage() {
  const { user, setUser, toast, theme, toggleTheme, variant, setVariant } =
    useApp();
  const [tz, setTz] = useState(user?.tz || "America/Havana");
  const [exchange, setExchange] = useState(user?.exchange || "");
  const [busy, setBusy] = useState(false);
  const [telegramLinkRequest, setTelegramLinkRequest] = useState<TelegramLinkRequest | null>(null);
  const [telegramError, setTelegramError] = useState("");
  const [error, setError] = useState("");
  const sessions = useApi(getSessions);
  const navigate = useNavigate();
  if (!user) {
    return (
      <div>
        <PageHeader
          eyebrow={t("TU ESPACIO, A TU MANERA")}
          title={t("Cargando tu cuenta…")}
          description={t("Estamos comprobando tu sesión para mostrar tu perfil y tu plan.")}
        />
        <section className="panel panel-pad" role="status" aria-live="polite">
          <p className="account-explainer">
            {t("Si esta pantalla no cambia, vuelve al inicio e inténtalo de nuevo. No hace falta refrescar el teléfono.")}</p>
          <div className="signal-detail-actions">
            <Link className="btn btn-secondary" to="/">{t("Volver al inicio")}</Link>
            <Link className="btn btn-primary" to="/login">{t("Volver a iniciar sesión")}</Link>
          </div>
        </section>
      </div>
    );
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      new Intl.DateTimeFormat(getIntlLocale(), { timeZone: tz }).format(new Date());
      const updated = await updateProfile({
        tz,
        exchange: exchange.trim() || undefined,
      });
      setUser(updated);
      toast("Tu configuración se guardó correctamente");
    } catch (err) {
      setError(
        (err as Error).message || "Revisa la zona horaria. Usa un nombre IANA, como America/Havana.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await logout();
      setUser(null);
      navigate("/login");
    } catch (err) {
      toast((err as Error).message || "No se pudo cerrar la sesión con el servidor.", "error");
    }
  }
  async function requestTelegramLink() {
    setTelegramError("");
    try {
      const request = await startTelegramLink();
      setTelegramLinkRequest(request);
    } catch (err) {
      setTelegramError((err as Error).message || "No se pudo crear el enlace de Telegram.");
    }
  }
  async function confirmTelegramLink() {
    if (!telegramLinkRequest) return;
    setTelegramError("");
    try {
      const state = await verifyTelegramLink(telegramLinkRequest.token);
      if (!state.linked) {
        setTelegramError("Todavía no recibimos la confirmación del contacto. Comparte tu contacto desde el bot e inténtalo otra vez.");
        return;
      }
      const updated = await getMe();
      setUser(updated);
      setTelegramLinkRequest(null);
      toast("Telegram se vinculó correctamente");
    } catch (err) {
      setTelegramError((err as Error).message || "No se pudo comprobar la vinculación.");
    }
  }
  async function removeTelegramLink() {
    setTelegramError("");
    try {
      const updated = await unlinkTelegramAccount();
      setUser(updated);
      toast("Telegram se desvinculó correctamente", "info");
    } catch (err) {
      setTelegramError((err as Error).message || "No se pudo desvincular Telegram.");
    }
  }
  const expires = user.plan === "premium" ? user.plan_end : user.trial_end;
  const active = Boolean(expires && Date.parse(expires) > Date.now());
  return (
    <div>
      <PageHeader
        eyebrow={t("TU ESPACIO, A TU MANERA")}
        title={t("Todo empieza por ti.")}
        description={t("Gestiona tu perfil, tu acceso y la forma en la que recibes contexto.")}
      >
        {user.is_admin && (
          <Link className="btn btn-secondary" to="/admin">
            <ShieldCheck size={14} />
            {t("Abrir panel admin")}<ArrowRight size={12} />
          </Link>
        )}
      </PageHeader>
      <div className="two-col">
        <section className="panel panel-pad">
          <SectionHeader title={t("Mi perfil")}>
            <span className="avatar">
              {user.username?.slice(1, 3).toUpperCase() || "FT"}
            </span>
          </SectionHeader>
          <div className="detail-row">
            <span>{t("Trader")}</span>
            <strong>{user.username || "Mi cuenta"}</strong>
          </div>
          <div className="detail-row">
            <span>{t("Teléfono verificado")}</span>
            <strong className="mono">{user.phone}</strong>
          </div>
          <div className="detail-row">
            <span>{t("Mi plan")}</span>
            <Tag tone={active ? "green" : "red"} dot>
              {user.plan === "premium" ? "PREMIUM" : "FREE"} ·{" "}
              {active
                ? user.plan === "free"
                  ? "En prueba"
                  : "Activo"
                : "Vencido"}
            </Tag>
          </div>
          <div className="detail-row">
            <span>
              {user.plan === "free" ? "Finaliza la prueba" : "Vencimiento"}
            </span>
            <span>
              {expires ? dateTime(expires, user.tz) : "Sin plan activo"}
            </span>
          </div>
          {user.plan === "free" && active && (
            <p className="slim-note">
              {t("Te quedan")}{" "}
              {Math.ceil((Date.parse(expires!) - Date.now()) / 86400000)} {t("días de acceso gratuito.")}</p>
          )}
          <div className="detail-row">
            <span>{t("Perfil de riesgo")}</span>
            <span className="mono">
              {number(user.risk_profile.capital, 0)} {t("USDT ·")}{" "}
              {user.risk_profile.risk_pct}%
            </span>
          </div>
          <div className="signal-detail-actions">
            <Link className="btn btn-primary" to="/planes">
              {user.plan === "premium" ? "Renovar mi acceso" : "Ver Premium"}
              <ArrowRight size={13} />
            </Link>
            <Link className="btn btn-quiet" to="/calculadora">
              {t("Cambiar perfil de riesgo")}</Link>
          </div>
        </section>
        <section className="panel panel-pad">
          <SectionHeader title={t("Tu configuración")} />
          <div className="form-stack">
            <label className="input-field">
              <span>{t("Zona horaria")}</span>
              <input
                list="timezone-list"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
              />
              <datalist id="timezone-list">
                {[
                  "America/Havana",
                  "America/Mexico_City",
                  "America/Bogota",
                  "America/New_York",
                  "America/Argentina/Buenos_Aires",
                  "Europe/Madrid",
                  "UTC",
                ].map((zone) => (
                  <option value={zone} key={zone} />
                ))}
              </datalist>
              <small>
                {t("Todas las fechas se adaptan a esta zona. Los periodos estadísticos se calculan en UTC.")}</small>
            </label>
            <label className="input-field">
              <span>{t("Registrar exchange")}</span>
              <input
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                placeholder={t("Ej. Binance Futures")}
              />
              <small>
                {t("Texto libre. No solicitamos claves API ni acceso a tu exchange.")}</small>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => void save()}
              disabled={busy}
            >
              <Check size={13} />
              {busy ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </section>
        <section className="panel panel-pad">
          <SectionHeader title={t("Vinculación con Telegram")}>
            <Send size={16} className="muted" />
          </SectionHeader>
          <p className="account-explainer">
            {t("Solo se utiliza para verificar el teléfono y entregar notificaciones. No hay chats ni herramientas de trading fuera de la web.")}</p>
          <div className="detail-row">
            <span>{t("Estado")}</span>
            <Tag tone={user.telegram_chat_id ? "green" : "muted"} dot>
              {user.telegram_chat_id ? "Vinculado" : "Sin vincular"}
            </Tag>
          </div>
          {user.telegram_chat_id ? (
            <button
              className="btn btn-danger"
              style={{ marginTop: 15 }}
              onClick={() => void removeTelegramLink()}
            >
              {t("Desvincular Telegram")}</button>
          ) : (
            <div className="signal-detail-actions">
              {telegramLinkRequest ? (
                  <>
                    <a
                      className="btn btn-blue"
                      href={telegramLinkRequest.deep_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Abrir bot de Telegram")}<ExternalLink size={12} />
                    </a>
                    <button
                      className="btn btn-secondary"
                      onClick={() => void confirmTelegramLink()}
                    >
                      {t("Comprobar vinculación")}</button>
                    <p className="slim-note">
                      {t("El enlace vence a los cinco minutos. Comparte tu propio contacto desde el bot.")}</p>
                  </>
                ) : (
                  <button
                    className="btn btn-blue"
                    onClick={() => void requestTelegramLink()}
                  >
                    <Send size={14} />
                    {t("Crear enlace de vinculación")}</button>
                )}
              {telegramError && <p className="form-error" role="alert">{telegramError}</p>}
            </div>
          )}
          <Link
            className="btn btn-quiet"
            to="/ajustes/avisos"
            style={{ marginTop: 17 }}
          >
            <Bell size={13} />
            {t("Gestionar avisos")}<ArrowRight size={12} />
          </Link>
        </section>
        <section className="panel panel-pad">
          <SectionHeader title={t("Un espacio que se adapta a ti")}>
            <Settings2 size={16} className="muted" />
          </SectionHeader>
          <div className="detail-row">
            <span>{t("Apariencia")}</span>
            <button className="btn btn-secondary" onClick={toggleTheme}>
              {theme === "dark" ? "Oscuro" : "Claro"} {t("· Cambiar")}</button>
          </div>
          <div className="detail-row">
            <span>{t("Versión de diseño")}</span>
            <div className="variant-switch">
              <button
                className={variant === "terminal" ? "active" : ""}
                onClick={() => setVariant("terminal")}
              >
                {t("Terminal")}</button>
              <button
                className={variant === "panorama" ? "active" : ""}
                onClick={() => setVariant("panorama")}
              >
                {t("Panorama")}</button>
            </div>
          </div>
          <p className="slim-note">
            {t("Terminal: precisión y seguimiento de setups. Panorama: mapa de mercado, amplitud y lectura visual. Tu elección se conserva en este navegador.")}</p>
        </section>
      </div>
      <section className="panel panel-pad" style={{ marginTop: 22 }}>
        <SectionHeader
          title={t("Sesiones activas")}
          subtitle={t("Revisa desde dónde se usa tu cuenta.")}
        />
        <ResourceState
          loading={sessions.loading}
          error={sessions.error}
          retry={sessions.refresh}
          empty={!sessions.loading && !sessions.error && !sessions.data?.length}
          emptyText={t("No hay otras sesiones activas.")}
        />
        {sessions.data?.map((session) => (
          <div className="session-row" key={session.id}>
            {session.current ? <Monitor size={19} /> : <Smartphone size={19} />}
            <div>
              <h3>
                {session.device}
                {session.current && <Tag tone="green">{t("Esta sesión")}</Tag>}
              </h3>
              <p>
                {session.location} ·{" "}
                {session.current
                  ? "Ahora"
                  : dateTime(session.last_activity, user.tz)}
              </p>
            </div>
            {!session.current && (
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await revokeSession(session.id);
                  void sessions.refresh();
                  toast("Sesión cerrada");
                }}
              >
                {t("Cerrar sesión")}</button>
            )}
          </div>
        ))}
      </section>
      <div className="account-logout">
        <span>
          {t("Tu cuenta fue creada el ")}{dateTime(user.created_at, user.tz)}.
        </span>
        <button className="btn btn-danger" onClick={() => void signOut()}>
          <LogOut size={13} />
          {t("Cerrar mi sesión")}</button>
      </div>
    </div>
  );
}
