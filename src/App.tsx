import { getIntlLocale } from "@/i18n/translation";
import { t } from "@/i18n/translation";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useParams,
} from "react-router-dom";
import { Component, Suspense, lazy, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import Layout from "@/components/Layout";
import { AppProvider, useApp } from "@/context/AppContext";
import { hasAccess, isBanActive } from "@/api/access";
import { ResourceState } from "@/components/ui";
import { getAccountRestriction } from "@/api/account";
import { appConfig } from "@/api/config";
import { useApi } from "@/hooks/useApi";
const LoginPage = lazy(() => import("@/pages/Login"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const SignalsPage = lazy(() => import("@/pages/Signals"));
const RadarPage = lazy(() => import("@/pages/Radar"));
const WatchlistPage = lazy(() => import("@/pages/Watchlist"));
const MercadoPage = lazy(() => import("@/pages/Mercado"));
const ResultadosPage = lazy(() => import("@/pages/Resultados"));
const RegimenPage = lazy(() => import("@/pages/Regimen"));
const DerivadosPage = lazy(() => import("@/pages/Derivados"));
const CalendarioPage = lazy(() => import("@/pages/Calendario"));
const CalculadoraPage = lazy(() => import("@/pages/Calculadora"));
const GuiaPage = lazy(() => import("@/pages/Guia"));
const PlanesPage = lazy(() => import("@/pages/Planes"));
const ReferidosPage = lazy(() => import("@/pages/Referidos"));
const CuentaPage = lazy(() => import("@/pages/Cuenta"));
const SoportePage = lazy(() => import("@/pages/Soporte"));
const AdminPage = lazy(() => import("@/pages/Admin"));
const AjustesAvisosPage = lazy(() => import("@/pages/AjustesAvisos"));

function PageLoading() {
  return (
    <div className="resource-state page-loading" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>{t("Cargando sección…")}</p>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}


class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the exception available in browser diagnostics instead of leaving a
    // completely black page with no clue about the failing component.
    console.error("FTrade: error al renderizar una pantalla", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="resource-state" role="alert" style={{ minHeight: "55vh", justifyContent: "center", padding: 24 }}>
          <ShieldAlert size={36} />
          <h1>{t("No se pudo mostrar esta sección")}</h1>
          <p>{t("Ocurrió un error al cargar la pantalla. Puedes volver a intentarlo sin cerrar tu sesión.")}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {t("Recargar sección")}</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SessionGuard() {
  const { user, loading, language } = useApp();
  void language;
  const restriction = useApi(getAccountRestriction);
  if (loading)
    return (
      <div className="page-content">
        <ResourceState loading error={null} />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (isBanActive(user))
    return (
      <div
        className="resource-state"
        style={{ minHeight: "100vh", justifyContent: "center" }}
      >
        <ShieldAlert size={40} />
        <h1>{t("Cuenta bloqueada")}</h1>
        <p>
          {t(restriction.data?.reason ||
            "Consultando el motivo de la restricción...")}
        </p>
        <p>
          {user.ban_until
            ? `Finaliza el ${new Date(user.ban_until).toLocaleString(getIntlLocale(), { timeZone: user.tz })}.`
            : t("La restricción es permanente.")}
        </p>
        {appConfig.whatsapp[0] ? (
          <a
            className="btn btn-secondary"
            href={`https://wa.me/${appConfig.whatsapp[0]}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Contactar administrador")}</a>
        ) : (
          <p>{t("El contacto de WhatsApp del administrador no está configurado.")}</p>
        )}
      </div>
    );
  return <Outlet />;
}
function AccessGuard() {
  const { user } = useApp();
  const [, setAccessClock] = useState(Date.now());
  useEffect(() => {
    // Re-evaluate persisted trial/plan expiry while a tab remains open. The API
    // already blocks expired access immediately; this updates the visible UI too.
    const timer = window.setInterval(() => setAccessClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  if (!user || !hasAccess(user))
    return (
      <div className="resource-state">
        <ShieldAlert size={40} />
        <h1>{t("Acceso vencido")}</h1>
        <p>
          {t("Tu prueba gratuita de cinco días o tu suscripción ha finalizado. Reactiva Premium para recuperar el acceso a todas las funciones de FTrade.")}</p>
        <Link className="btn btn-primary" to="/planes">
          {t("Ver planes")}</Link>
      </div>
    );
  return <Outlet />;
}
function AdminGuard() {
  const { user } = useApp();
  return user?.is_admin ? <LazyPage><AdminPage /></LazyPage> : <Navigate to="/" replace />;
}
function ReferralLink() {
  const { ref_code: code } = useParams<{ ref_code: string }>();
  // Preserve attribution through the login flow; the API consumes it when the
  // user starts registration. The referral URL itself always stays on the web app.
  if (code?.startsWith("ref_")) sessionStorage.setItem("ftrade.referrer", code);
  return <Navigate to="/login" replace />;
}
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <PageErrorBoundary>
        <Routes>
          <Route path="/login" element={<LazyPage><LoginPage /></LazyPage>} />
          <Route path="/r/:ref_code" element={<ReferralLink />} />
          <Route element={<SessionGuard />}>
            <Route element={<Layout />}>
              <Route element={<AccessGuard />}>
                <Route index element={<LazyPage><DashboardPage /></LazyPage>} />
                <Route path="senales" element={<LazyPage><SignalsPage /></LazyPage>} />
                <Route path="radar" element={<LazyPage><RadarPage /></LazyPage>} />
                <Route path="watchlist" element={<LazyPage><WatchlistPage /></LazyPage>} />
                <Route path="mercado" element={<LazyPage><MercadoPage /></LazyPage>} />
                <Route
                  path="mercado/flujo/:simbolo"
                  element={<LazyPage><MercadoPage /></LazyPage>}
                />
                <Route path="mercado/liquidaciones" element={<LazyPage><MercadoPage /></LazyPage>} />
                <Route path="mercado/movers" element={<LazyPage><MercadoPage /></LazyPage>} />
                <Route path="resultados" element={<LazyPage><ResultadosPage /></LazyPage>} />
                <Route path="regimen" element={<LazyPage><RegimenPage /></LazyPage>} />
                <Route path="derivados" element={<LazyPage><DerivadosPage /></LazyPage>} />
                <Route path="derivados/:simbolo" element={<LazyPage><DerivadosPage /></LazyPage>} />
                <Route path="calendario" element={<LazyPage><CalendarioPage /></LazyPage>} />
                <Route path="calculadora" element={<LazyPage><CalculadoraPage /></LazyPage>} />
                <Route path="guia" element={<LazyPage><GuiaPage /></LazyPage>} />
                <Route path="guia/:tema" element={<LazyPage><GuiaPage /></LazyPage>} />
                <Route path="referidos" element={<LazyPage><ReferidosPage /></LazyPage>} />
                <Route path="ajustes/avisos" element={<LazyPage><AjustesAvisosPage /></LazyPage>} />
              </Route>
              <Route path="planes" element={<LazyPage><PlanesPage /></LazyPage>} />
              <Route path="cuenta" element={<LazyPage><CuentaPage /></LazyPage>} />
              <Route path="soporte" element={<LazyPage><SoportePage /></LazyPage>} />
              <Route path="admin" element={<AdminGuard />} />
              <Route
                path="*"
                element={
                  <div className="resource-state">
                    <h1>{t("Esta página no existe")}</h1>
                    <Link className="btn btn-primary" to="/">
                      {t("Volver a mi espacio")}</Link>
                  </div>
                }
              />
            </Route>
          </Route>
        </Routes>
        </PageErrorBoundary>
      </AppProvider>
    </BrowserRouter>
  );
}
