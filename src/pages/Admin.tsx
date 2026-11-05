import { t } from "@/i18n/translation";
import { useCallback, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  activatePremium,
  adminBanUser,
  adminUnbanUser,
  getAdminOverview,
  getAdminUsers,
  getStatsBaseline,
  resetStats,
  restoreStats,
} from "@/api/account";
import type { User } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime } from "@/utils/format";
import {
  Modal,
  PageHeader,
  RefreshButton,
  ResourceState,
  SectionHeader,
  Tag,
} from "@/components/ui";

export default function AdminPage() {
  const { toast } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<User | null>(null);
  const [days, setDays] = useState(30);
  const [banDays, setBanDays] = useState(7);
  const [banType, setBanType] = useState("temporary");
  const [permanentConfirmed, setPermanentConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const stats = useApi(getAdminOverview);
  const users = useApi(
    () => getAdminUsers(query, filter, page),
    [query, filter, page],
  );
  const baseline = useApi(getStatsBaseline);
  const resetReason = "Reinicio por optimización de estrategia";
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  async function runStatsReset(action: "reset" | "restore") {
    setResetBusy(true);
    setResetError("");
    try {
      if (action === "reset") {
        if (!resetConfirmed)
          throw new Error("Confirma que quieres reiniciar las estadísticas.");
        await resetStats(resetReason);
        toast("Estadísticas reiniciadas: se medirán desde cero");
      } else {
        await restoreStats();
        toast("Histórico completo restaurado");
      }
      setResetConfirmed(false);
      void baseline.refresh();
    } catch (err) {
      setResetError((err as Error).message);
    } finally {
      setResetBusy(false);
    }
  }
  const closeDetail = useCallback(() => setSelected(null), []);
  async function run(action: "activate" | "ban" | "unban") {
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      if (action === "ban" && banType === "permanent" && !permanentConfirmed)
        throw new Error(
          "Confirma que comprendes que el bloqueo será permanente.",
        );
      if (
        action === "ban" &&
        banType === "temporary" &&
        (!Number.isInteger(banDays) || banDays < 1 || banDays > 365)
      )
        throw new Error("El baneo temporal debe durar de 1 a 365 días.");
      const updated =
        action === "activate"
          ? await activatePremium(selected.user_id, days)
          : action === "ban"
            ? await adminBanUser(
                selected.user_id,
                banType === "permanent"
                  ? undefined
                  : new Date(Date.now() + banDays * 86400000).toISOString(),
                reason,
              )
            : await adminUnbanUser(selected.user_id);
      setSelected(updated);
      void users.refresh();
      void stats.refresh();
      toast(
        action === "activate"
          ? `Plan Premium ampliado ${days} días`
          : action === "ban"
            ? "Usuario bloqueado. Sus fechas de plan se mantienen."
            : "Restricción eliminada",
      );
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageHeader
        eyebrow={t("ADMINISTRACIÓN DE KERYNTIX MARKET DESK")}
        title={t("Una plataforma bajo control.")}
        description={t("Gestiona usuarios, planes y restricciones mediante las rutas administrativas del backend.")}
      >
        <RefreshButton
          loading={users.loading}
          onClick={() => {
            void users.refresh();
            void stats.refresh();
            void baseline.refresh();
          }}
        />
      </PageHeader>
      <div className="admin-metrics">
        {[
          {
            key: "all",
            label: "Usuarios registrados",
            value: stats.data?.total_users,
            icon: Users,
          },
          {
            key: "trial",
            label: "En prueba gratuita",
            value: stats.data?.trial_users,
            icon: Clock3,
          },
          {
            key: "premium",
            label: "Premium activos",
            value: stats.data?.premium_users,
            icon: ShieldCheck,
          },
          {
            key: "banned",
            label: "Usuarios bloqueados",
            value: stats.data?.banned_users,
            icon: ShieldAlert,
          },
        ].map((metric) => (
          <button
            className={`admin-metric ${filter === metric.key ? "active" : ""}`}
            key={metric.key}
            onClick={() => {
              setFilter(metric.key);
              setPage(0);
            }}
          >
            <div>
              <span>{t(metric.label)}</span>
              <metric.icon size={15} />
            </div>
            <strong>{metric.value ?? "..."}</strong>
          </button>
        ))}
      </div>
      <section className="panel panel-pad" style={{ marginBottom: 22 }}>
        <SectionHeader
          title={t("Reiniciar estadísticas")}
          subtitle={t("Empieza a medir la estrategia desde cero tras modificarla. No se borra ninguna operación.")}
        >
          <Tag tone={baseline.data?.active ? "amber" : "blue"}>
            {baseline.data?.active ? "Reiniciadas" : "Histórico completo"}
          </Tag>
        </SectionHeader>
        <ResourceState
          loading={baseline.loading}
          error={baseline.error}
          retry={baseline.refresh}
        />
        {baseline.data && !baseline.loading && !baseline.error && (
          <div className="form-stack">
            <div className="detail-row">
              <span>{t("Contando desde")}</span>
              <strong>
                {baseline.data.reset_at
                  ? dateTime(baseline.data.reset_at)
                  : "El inicio (sin reinicios)"}
              </strong>
            </div>
            <div className="detail-row">
              <span>{t("Operaciones que cuentan ahora")}</span>
              <strong className="mono">{baseline.data.trades_counted}</strong>
            </div>
            <div className="detail-row">
              <span>{t("Operaciones archivadas (ocultas de las estadísticas)")}</span>
              <strong className="mono">{baseline.data.trades_archived}</strong>
            </div>
            {baseline.data.reason && (
              <div className="detail-row">
                <span>{t("Motivo del último reinicio")}</span>
                <span>{baseline.data.reason}</span>
              </div>
            )}
            <div className="detail-row">
              <span>{t("Motivo del reinicio")}</span>
              <strong>{t(resetReason)}</strong>
            </div>
            <label className="terms-check">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
              />
              <span>
                {t("Entiendo que Resultados y la Vista general empezarán desde cero para todos los usuarios.")}</span>
            </label>
            {resetError && (
              <p className="form-error" role="alert">
                {resetError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn btn-danger"
                disabled={resetBusy || !resetConfirmed}
                onClick={() => void runStatsReset("reset")}
              >
                <RotateCcw size={13} />
                {t("Reiniciar estadísticas")}</button>
              {baseline.data.active && (
                <button
                  className="btn btn-secondary"
                  disabled={resetBusy}
                  onClick={() => void runStatsReset("restore")}
                >
                  {t("Restaurar histórico completo")}</button>
              )}
            </div>
            <p className="slim-note" style={{ padding: 0 }}>
              {t("Cada usuario cuenta solo las señales que recibió desde el reinicio y los cierres ocurridos durante sus periodos de acceso. Los registros anteriores se conservan y se recuperan con “Restaurar histórico completo”.")}</p>
          </div>
        )}
      </section>
      <div className="filter-row">
        <div className="search-field admin-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={t("Busca por ID, teléfono o @usuario")}
            aria-label={t("Buscar usuarios")}
          />
          {query && (
            <button
              className="icon-button"
              aria-label={t("Limpiar búsqueda")}
              onClick={() => setQuery("")}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span className="slim-note" style={{ padding: 0 }}>
          {users.data?.total || 0} {t("usuarios encontrados")}</span>
      </div>
      <ResourceState
        loading={users.loading}
        error={users.error}
        retry={users.refresh}
        empty={!users.loading && !users.error && !users.data?.users.length}
        emptyText={t("No hay usuarios que coincidan con estos filtros.")}
      />
      {users.data && !users.loading && !users.error && (
        <section className="panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Usuario")}</th>
                  <th>{t("Teléfono")}</th>
                  <th>{t("Plan")}</th>
                  <th>{t("Vencimiento")}</th>
                  <th>{t("Estado")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((user) => (
                  <tr key={user.user_id}>
                    <td>
                      <div>
                        <strong>{user.username || user.user_id}</strong>
                        <small className="admin-user-id mono">
                          {user.user_id}
                          {user.is_admin ? " · ADMIN" : ""}
                        </small>
                      </div>
                    </td>
                    <td className="mono">{user.phone}</td>
                    <td>
                      <Tag tone={user.plan === "premium" ? "green" : "blue"}>
                        {user.plan === "premium" ? "PREMIUM" : "En prueba"}
                      </Tag>
                    </td>
                    <td className="muted">
                      {dateTime(
                        user.plan_end || user.trial_end || user.created_at,
                      )}
                    </td>
                    <td>
                      <Tag tone={user.banned ? "red" : "green"} dot>
                        {user.banned ? "Bloqueado" : "Activo"}
                      </Tag>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelected(user);
                          setActionError("");
                          setReason("");
                          setPermanentConfirmed(false);
                        }}
                      >
                        {t("Ver ficha")}<ChevronRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {t("Página ")}{page + 1} {t("de")}{" "}
              {Math.max(1, Math.ceil(users.data.total / users.data.limit))}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label={t("Página anterior de usuarios")}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={t("Página siguiente de usuarios")}
                disabled={(page + 1) * users.data.limit >= users.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>
      )}
      {selected && (
        <Modal
          title={`Ficha de ${selected.username || selected.user_id}`}
          onClose={closeDetail}
        >
          <Tag tone={selected.banned ? "red" : "green"} dot>
            {selected.banned ? "Cuenta bloqueada" : "Cuenta activa"}
            {selected.is_admin ? " · Administrador" : ""}
          </Tag>
          <div className="detail-row">
            <span>{t("ID")}</span>
            <strong className="mono">{selected.user_id}</strong>
          </div>
          <div className="detail-row">
            <span>{t("Teléfono")}</span>
            <strong className="mono">{selected.phone}</strong>
          </div>
          <div className="detail-row">
            <span>{t("Plan / Vencimiento")}</span>
            <span>
              {selected.plan.toUpperCase()} ·{" "}
              {dateTime(
                selected.plan_end || selected.trial_end || selected.created_at,
              )}
            </span>
          </div>
          <div className="admin-action-section">
            <SectionHeader title={t("Activar o ampliar Premium")} />
            <div className="admin-activation">
              <label className="input-field">
                <span>{t("Días a sumar")}</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void run("activate")}
              >
                <Check size={13} />
                {t("Activar plan")}</button>
            </div>
            <p className="slim-note">
              {t("Se acumula sobre el plan activo. Si está vencido, comienza desde hoy.")}</p>
          </div>
          <div className="admin-action-section">
            <SectionHeader title={t("Control de acceso")} />
            {selected.is_admin ? (
              <p className="slim-note">
                <ShieldCheck size={13} />
                {t("Los administradores no se pueden banear.")}</p>
            ) : selected.banned ? (
              <>
                <p className="slim-note">
                  {selected.ban_until
                    ? `Bloqueo temporal hasta ${dateTime(selected.ban_until)}.`
                    : "Bloqueo permanente."}
                </p>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void run("unban")}
                >
                  {t("Desbanear usuario")}</button>
              </>
            ) : (
              <div className="form-stack">
                <div className="form-grid">
                  <label className="input-field">
                    <span>{t("Tipo de restricción")}</span>
                    <select
                      value={banType}
                      onChange={(e) => setBanType(e.target.value)}
                    >
                      <option value="temporary">{t("Temporal")}</option>
                      <option value="permanent">{t("Permanente")}</option>
                    </select>
                  </label>
                  {banType === "temporary" && (
                    <label className="input-field">
                      <span>{t("Duración en días (1-365)")}</span>
                      <input
                        type="number"
                        list="ban-durations"
                        value={banDays}
                        min={1}
                        max={365}
                        onChange={(e) => setBanDays(Number(e.target.value))}
                      />
                      <datalist id="ban-durations">
                        {[1, 3, 7, 15, 30].map((value) => (
                          <option value={value} key={value} />
                        ))}
                      </datalist>
                    </label>
                  )}
                </div>
                <label className="input-field">
                  <span>{t("Motivo de la restricción")}</span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={t("Indica el motivo en lenguaje claro")}
                  />
                </label>
                {banType === "permanent" && (
                  <label className="terms-check">
                    <input
                      type="checkbox"
                      checked={permanentConfirmed}
                      onChange={(e) => setPermanentConfirmed(e.target.checked)}
                    />
                    <span>{t("Confirmo el bloqueo permanente de esta cuenta.")}</span>
                  </label>
                )}
                <button
                  className="btn btn-danger"
                  disabled={busy || !reason.trim()}
                  onClick={() => void run("ban")}
                >
                  <ShieldAlert size={13} />
                  {banType === "permanent"
                    ? "Confirmar baneo permanente"
                    : `Banear ${banDays} días`}
                </button>
              </div>
            )}
            <p className="slim-note">
              {t("El bloqueo no cambia el plan ni detiene sus fechas. El backend notificará al usuario al bloquearlo o desbanearlo.")}</p>
          </div>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
