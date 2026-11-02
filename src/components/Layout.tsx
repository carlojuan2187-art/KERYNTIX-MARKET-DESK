import { t } from "@/i18n/translation";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowDownUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Gauge,
  Globe2,
  LayoutDashboard,
  Menu,
  Moon,
  PanelTop,
  Radar,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { ago, percent, price } from "@/utils/format";
import { AssetIcon, Brand, LanguageSwitch, Modal } from "./ui";
import { Sparkline } from "./Sparkline";

const groups = [
  {
    label: "PRINCIPAL",
    links: [
      { to: "/", label: "Vista general", icon: LayoutDashboard },
      { to: "/senales", label: "Señales", icon: Zap },
      { to: "/radar", label: "Radar de oportunidades", icon: Radar },
      { to: "/watchlist", label: "Mi watchlist", icon: Star },
    ],
  },
  {
    label: "ANÁLISIS DE MERCADO",
    links: [
      { to: "/mercado", label: "Mercado en vivo", icon: Activity },
      { to: "/derivados", label: "Derivados", icon: ArrowDownUp },
      { to: "/regimen", label: "Régimen de mercado", icon: Gauge },
      { to: "/resultados", label: "Resultados", icon: ChartNoAxesCombined },
      { to: "/calendario", label: "Calendario cripto", icon: CalendarDays },
    ],
  },
  {
    label: "HERRAMIENTAS",
    links: [
      { to: "/calculadora", label: "Calculadora de riesgo", icon: Calculator },
      { to: "/guia", label: "Guía del trader", icon: BookOpen },
      { to: "/referidos", label: "Mis referidos", icon: Users },
      { to: "/planes", label: "Mi plan", icon: CreditCard },
    ],
  },
];

/**
 * En móvil las tablas se muestran como tarjetas (sin scroll lateral).
 * Para eso cada celda necesita su etiqueta: se copia desde el <th> de su columna.
 */
function useResponsiveTableLabels() {
  useEffect(() => {
    const root = document.querySelector(".page-content");
    if (!root) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      root.querySelectorAll("table.data-table").forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map(
          (th) => (th.textContent || "").trim(),
        );
        table.querySelectorAll("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            const label = heads[index];
            if (label && cell.getAttribute("data-label") !== label) {
              cell.setAttribute("data-label", label);
            }
          });
        });
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}

export default function Layout() {
  const {
    variant,
    setVariant,
    theme,
    toggleTheme,
    quotes,
    user,
    signalCount,
    notifications,
    readNotification,
    deleteAllNotifications,
    toast,
    t,
    language,
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 800px)").matches,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [confirmDeleteNotices, setConfirmDeleteNotices] = useState(false);
  const [deletingNotices, setDeletingNotices] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(new Date());
  const loc = useLocation();
  useResponsiveTableLabels();
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeNotices = useCallback(() => { setNoticesOpen(false); setConfirmDeleteNotices(false); }, []);
  const unread = notifications.filter((n) => !n.read).length;
  const current = groups
    .flatMap((g) => g.links)
    .find(
      (l) =>
        l.to === loc.pathname ||
        (l.to !== "/" && loc.pathname.startsWith(l.to)),
    );
  const label =
    current?.label ||
    (loc.pathname === "/cuenta"
      ? "Mi cuenta"
      : loc.pathname === "/admin"
        ? "Administración"
        : "Tu espacio");
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (mobileOpen)
      document.querySelector<HTMLButtonElement>(".close-sidebar")?.focus();
  }, [mobileOpen]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", keydown);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  return (
    <div className={`app-shell variant-${variant}`}>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        aria-label={t("Navegación principal")}
        aria-hidden={isMobile && !mobileOpen}
        inert={isMobile && !mobileOpen}
      >
        <div className="sidebar-brand">
          <Link to="/" aria-label={t("KERYNTIX MARKET DESK, inicio")}>
            <Brand />
          </Link>
          <button
            className="icon-button close-sidebar"
            aria-label={t("Cerrar menú")}
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <Link to="/cuenta" className="workspace-label">
          <span>
            <Globe2 size={13} />
          </span>
          <span>{t("Mi espacio de trading")}</span>
          <ChevronDown className="chevron" size={12} />
        </Link>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{t(group.label)}</div>
              {group.links.map((item) => {
                const active =
                  item.to === "/"
                    ? loc.pathname === "/"
                    : loc.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon />
                    <span>{t(item.label)}</span>
                    {item.to === "/senales" && signalCount > 0 && (
                      <span className="nav-count">{signalCount}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link className="sidebar-help" to="/soporte">
            <CircleHelp size={15} />
            {t("Ayuda y soporte")}<ArrowUpRight size={12} style={{ marginLeft: "auto" }} />
          </Link>
          <Link className="profile-link" to="/cuenta">
            <span className="avatar">
              {user?.username?.replace(/^@/, "").slice(0, 2).toUpperCase() || "FT"}
            </span>
            <div className="profile-copy">
              <strong>
                {user?.username || t("Mi cuenta")}
              </strong>
              <span>
                {t("Plan ")}{user?.plan === "premium" ? "Premium" : "Free"}{" "}
                <span className="separator-dot">·</span>{" "}
                {user?.is_admin ? "Administrador" : "Mi cuenta"}
              </span>
            </div>
            <Settings2 size={15} />
          </Link>
        </div>
      </aside>
      <div className="main-shell" inert={isMobile && mobileOpen}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            aria-label={t("Abrir menú")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <Link className="mobile-brand" to="/" aria-label={t("KERYNTIX MARKET DESK, inicio")}>
            <Brand compact />
          </Link>
          <div className="breadcrumbs">
            <span>{t("Espacio de trabajo")}</span>
            <ChevronRight />
            <strong>{t(label)}</strong>
          </div>
          <div
            className="variant-switch"
            aria-label={t("Seleccionar versión de diseño")}
          >
            <button
              className={variant === "terminal" ? "active" : ""}
              aria-pressed={variant === "terminal"}
              onClick={() => setVariant("terminal")}
            >
              <PanelTop size={12} />
              <span className="variant-label">{t("Terminal")}</span>
            </button>
            <button
              className={variant === "panorama" ? "active" : ""}
              aria-pressed={variant === "panorama"}
              onClick={() => setVariant("panorama")}
            >
              <Sparkles size={12} />
              <span className="variant-label">{t("Panorama")}</span>
            </button>
          </div>
          <div className="topbar-actions">
            <LanguageSwitch />
            <button
              className="search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label={t("Buscar un par")}
            >
              <Search size={15} />
              <span>{t("Buscar un par")}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-divider" />
            <span className="topbar-clock mono">
              {now.toLocaleTimeString(language, {
                timeZone: user?.tz || "America/Havana",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <button
              className="icon-button"
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? t("Cambiar a modo claro")
                  : t("Cambiar a modo oscuro")
              }
              aria-label={
                theme === "dark"
                  ? t("Cambiar a modo claro")
                  : t("Cambiar a modo oscuro")
              }
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`${t("Notificaciones")}, ${unread} ${t("sin leer")}`}
              onClick={() => setNoticesOpen(true)}
            >
              <Bell size={16} />
              {unread > 0 && <span className="notification-indicator" />}
            </button>
          </div>
        </header>
        <div className="ticker-strip" aria-label={t("Cotizaciones recibidas del backend")}>
          {quotes.slice(0, 5).map((quote) => (
            <Link
              key={quote.symbol}
              to={`/mercado/flujo/${quote.symbol}`}
              className="ticker-item"
            >
              <AssetIcon symbol={quote.symbol} size={24} />
              <div>
                <div className="ticker-pair">
                  {quote.symbol.replace("USDT", "")}
                  <span>/ USDT</span>
                </div>
                <div className="ticker-values">
                  <span className={`mono ${quote.price_direction === "up" ? "price-up" : quote.price_direction === "down" ? "price-down" : ""}`}>{price(quote.price)}</span>
                  <span
                    className={quote.change_pct == null ? "muted" : quote.change_pct >= 0 ? "positive" : "negative"}
                  >
                    {percent(quote.change_pct)}
                  </span>
                </div>
              </div>
              <Sparkline
                values={quote.sparkline}
                positive={quote.change_pct != null && quote.change_pct >= 0}
                width={48}
                height={21}
              />
            </Link>
          ))}
        </div>
        <main className="page-content">
          <div className="page-enter" key={`${loc.pathname}-${variant}`}>
            <Outlet />
          </div>
        </main>
        <footer className="legal-footer">
          <span>
            <ShieldCheck size={10} />
            {t("Informativo. No es asesoría financiera ni garantía de resultados.")}</span>
          <span>
            <span className="live-dot" />
            {t("Backend de mercado ")}<span className="separator-dot">·</span> {t("Binance USDT-M")}{" "}
            <span className="separator-dot">·</span>{" "}
            {user?.tz || "UTC"}
          </span>
        </footer>
        <nav className="bottom-nav" aria-label={t("Accesos rápidos")}>
          {[
            groups[0].links[0],
            groups[0].links[1],
            groups[0].links[2],
            groups[1].links[0],
            { to: "/watchlist", label: "Watchlist", icon: Star },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                (
                  item.to === "/"
                    ? loc.pathname === "/"
                    : loc.pathname.startsWith(item.to)
                )
                  ? "active"
                  : ""
              }
            >
              <item.icon />
              <span>
                {t(item.label === "Vista general" ? "Inicio" : item.label === "Radar de oportunidades" ? "Radar" : item.label === "Mercado en vivo" ? "Mercado" : item.label)}
              </span>
            </Link>
          ))}
        </nav>
      </div>
      {searchOpen && (
        <Modal title={t("Encuentra tu próximo par")} onClose={closeSearch}>
          <div className="search-field">
            <Search size={17} />
            <input
              autoFocus
              aria-label={t("Símbolo o nombre del activo")}
              placeholder={t("Bitcoin, AVAX, 1000PEPE...")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="search-results">
            {quotes
              .filter((q) =>
                `${q.symbol} ${q.name}`
                  .toLowerCase()
                  .includes(query.toLowerCase().replace("/", "")),
              )
              .slice(0, 9)
              .map((q) => (
                <Link
                  className="search-result"
                  to={`/mercado/flujo/${q.symbol}`}
                  onClick={closeSearch}
                  key={q.symbol}
                >
                  <div className="asset-pair">
                    <AssetIcon symbol={q.symbol} />
                    <div>
                      <strong>{q.symbol.replace("USDT", " / USDT")}</strong>
                      <small>{q.name}</small>
                    </div>
                  </div>
                  <div className={`search-result-price mono ${q.price_direction === "up" ? "price-up" : q.price_direction === "down" ? "price-down" : ""}`}>
                    {price(q.price)}
                    <span
                      className={q.change_pct == null ? "muted" : q.change_pct >= 0 ? "positive" : "negative"}
                    >
                      {percent(q.change_pct)}
                    </span>
                  </div>
                </Link>
              ))}
            {!quotes.some((q) =>
              `${q.symbol} ${q.name}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && (
              <p className="slim-note">
                {t("No encontramos ese par. Prueba con BTC, SOL o AVAX.")}</p>
            )}
          </div>
          <p className="slim-note">
            {t("Catálogo de símbolos recibidos desde el backend de Binance USDT-M. Presiona Esc para cerrar.")}</p>
        </Modal>
      )}
      {noticesOpen && (
        <Modal title={t("Centro de notificaciones")} onClose={closeNotices}>
          <div className="notification-tools">
            <span>{notifications.length} {t("notificaciones")} · {unread} {t("sin leer")}</span>
            <div className="notification-tool-actions">
              <button
                className="btn btn-quiet"
                onClick={() => notifications.forEach((n) => readNotification(n.id))}
                disabled={!unread}
              >
                <CheckCheck size={13} />
                {t("Marcar todas como leídas")}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setConfirmDeleteNotices(true)}
                disabled={!notifications.length || deletingNotices}
              >
                <Trash2 size={13} />
                {t("Borrar historial")}
              </button>
            </div>
          </div>
          {confirmDeleteNotices && (
            <div className="notification-delete-confirm" role="alertdialog" aria-label={t("Confirmar borrado del historial")}>
              <div>
                <strong>{t("¿Borrar todas las notificaciones?")}</strong>
                <p>{t("Se eliminarán de tu centro de notificaciones. Los envíos pendientes no se cancelarán.")}</p>
              </div>
              <div className="notification-delete-actions">
                <button className="btn btn-quiet" onClick={() => setConfirmDeleteNotices(false)} disabled={deletingNotices}>
                  {t("Cancelar")}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={deletingNotices || !notifications.length}
                  onClick={async () => {
                    setDeletingNotices(true);
                    try {
                      const deleted = await deleteAllNotifications();
                      setConfirmDeleteNotices(false);
                      setNoticesOpen(false);
                      toast(`${t("Historial borrado")}: ${deleted}`, "success");
                    } catch (error) {
                      toast(t((error as Error).message || "No se pudo borrar el historial."), "error");
                    } finally {
                      setDeletingNotices(false);
                    }
                  }}
                >
                  <Trash2 size={13} />
                  {deletingNotices ? t("Borrando…") : t("Sí, borrar historial")}
                </button>
              </div>
            </div>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              className={`notification-item ${n.read ? "" : "unread"}`}
              to={n.href}
              onClick={() => {
                readNotification(n.id);
                closeNotices();
              }}
            >
              <h3>{t(n.title)}</h3>
              <p>{t(n.text)}</p>
              <time>
                {ago(n.created_at)}
                {n.read ? ` · ${t("Leída")}` : ""}
              </time>
            </Link>
          ))}
          {!notifications.length && (
            <p className="slim-note">{t("Aún no tienes notificaciones.")}</p>
          )}
          <Link
            className="btn btn-quiet"
            to="/ajustes/avisos"
            onClick={closeNotices}
          >
            <Settings2 size={14} />
            {t("Ajustes de avisos")}<ChevronRight size={13} />
          </Link>
        </Modal>
      )}
    </div>
  );
}
