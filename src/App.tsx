import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useParams,
} from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Layout from "@/components/Layout";
import { AppProvider, useApp } from "@/context/AppContext";
import { hasAccess, isBanActive } from "@/api/access";
import { ResourceState } from "@/components/ui";
import { getAccountRestriction } from "@/api/account";
import { appConfig } from "@/api/config";
import { useApi } from "@/hooks/useApi";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import SignalsPage from "@/pages/Signals";
import RadarPage from "@/pages/Radar";
import WatchlistPage from "@/pages/Watchlist";
import MercadoPage from "@/pages/Mercado";
import ResultadosPage from "@/pages/Resultados";
import RegimenPage from "@/pages/Regimen";
import DerivadosPage from "@/pages/Derivados";
import CalendarioPage from "@/pages/Calendario";
import CalculadoraPage from "@/pages/Calculadora";
import GuiaPage from "@/pages/Guia";
import PlanesPage from "@/pages/Planes";
import ReferidosPage from "@/pages/Referidos";
import CuentaPage from "@/pages/Cuenta";
import SoportePage from "@/pages/Soporte";
import AdminPage from "@/pages/Admin";
import AjustesAvisosPage from "@/pages/AjustesAvisos";

function SessionGuard() {
  const { user, loading } = useApp();
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
        <h1>Cuenta bloqueada</h1>
        <p>
          {restriction.data?.reason ||
            "Consultando el motivo de la restricción..."}
        </p>
        <p>
          {user.ban_until
            ? `Finaliza el ${new Date(user.ban_until).toLocaleString("es", { timeZone: user.tz })}.`
            : "La restricción es permanente."}
        </p>
        <a
          className="btn btn-secondary"
          href={`https://wa.me/${appConfig.whatsapp[0].replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          Contactar administrador
        </a>
      </div>
    );
  return <Outlet />;
}
function AccessGuard() {
  const { user } = useApp();
  if (!user || !hasAccess(user))
    return (
      <div className="resource-state">
        <ShieldAlert size={40} />
        <h1>Acceso vencido</h1>
        <p>
          Tu prueba o plan ha finalizado. Reactiva Premium para volver a las
          señales y al análisis del mercado.
        </p>
        <Link className="btn btn-primary" to="/planes">
          Ver planes
        </Link>
      </div>
    );
  return <Outlet />;
}
function AdminGuard() {
  const { user } = useApp();
  return user?.is_admin ? <AdminPage /> : <Navigate to="/" replace />;
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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/r/:ref_code" element={<ReferralLink />} />
          <Route element={<SessionGuard />}>
            <Route element={<Layout />}>
              <Route element={<AccessGuard />}>
                <Route index element={<DashboardPage />} />
                <Route path="senales" element={<SignalsPage />} />
                <Route path="radar" element={<RadarPage />} />
                <Route path="watchlist" element={<WatchlistPage />} />
                <Route path="mercado" element={<MercadoPage />} />
                <Route
                  path="mercado/flujo/:simbolo"
                  element={<MercadoPage />}
                />
                <Route path="mercado/liquidaciones" element={<MercadoPage />} />
                <Route path="mercado/movers" element={<MercadoPage />} />
                <Route path="resultados" element={<ResultadosPage />} />
                <Route path="regimen" element={<RegimenPage />} />
                <Route path="derivados" element={<DerivadosPage />} />
                <Route path="derivados/:simbolo" element={<DerivadosPage />} />
                <Route path="calendario" element={<CalendarioPage />} />
              </Route>
              <Route path="calculadora" element={<CalculadoraPage />} />
              <Route path="guia" element={<GuiaPage />} />
              <Route path="guia/:tema" element={<GuiaPage />} />
              <Route path="planes" element={<PlanesPage />} />
              <Route path="referidos" element={<ReferidosPage />} />
              <Route path="cuenta" element={<CuentaPage />} />
              <Route path="soporte" element={<SoportePage />} />
              <Route path="ajustes/avisos" element={<AjustesAvisosPage />} />
              <Route path="admin" element={<AdminGuard />} />
              <Route
                path="*"
                element={
                  <div className="resource-state">
                    <h1>Esta página no existe</h1>
                    <Link className="btn btn-primary" to="/">
                      Volver a mi espacio
                    </Link>
                  </div>
                }
              />
            </Route>
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
