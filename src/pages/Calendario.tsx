import { useState } from "react";
import { Clock3, Globe2, Info } from "lucide-react";
import { getCalendarEvents, getRegime } from "@/api";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime } from "@/utils/format";
import {
  Countdown,
  PageHeader,
  RefreshButton,
  ResourceState,
  Tag,
} from "@/components/ui";

export default function CalendarioPage() {
  const { user } = useApp();
  const [view, setView] = useState<7 | 30>(7);
  const [impact, setImpact] = useState("all");
  const { data, loading, error, refresh } = useApi(
    () => getCalendarEvents(view),
    [view],
  );
  const { data: regime } = useApi(getRegime);
  const filtered =
    data?.filter((e) => impact === "all" || e.impact === impact) || [];
  return (
    <div>
      <PageHeader
        eyebrow="ANTICIPAR ES PARTE DEL PLAN"
        title="Lo que puede mover el mercado."
        description="Eventos macro, vencimientos y funding. Pon el calendario a tu favor."
      >
        <RefreshButton loading={loading} onClick={refresh} />
      </PageHeader>
      <div className="calendar-context">
        <span>
          <Globe2 size={13} />
          Sesión actual{" "}
          <strong>{regime?.session_now || "—"}</strong>
        </span>
        <span>
          <Clock3 size={13} />
          Tu zona horaria <strong>{user?.tz || "UTC"}</strong>
        </span>
      </div>
      <div className="filter-row">
        <div className="tabs" style={{ marginBottom: 0, border: 0 }}>
          <button
            className={`pair-chip ${view === 7 ? "active" : ""}`}
            onClick={() => setView(7)}
          >
            Próximos 7 días
          </button>
          <button
            className={`pair-chip ${view === 30 ? "active" : ""}`}
            onClick={() => setView(30)}
          >
            Próximos 30 días
          </button>
        </div>
        <select
          className="styled-input"
          aria-label="Filtrar impacto"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          style={{ width: "auto", fontSize: 10 }}
        >
          <option value="all">Todos los impactos</option>
          <option value="alto">Impacto alto</option>
          <option value="medio">Impacto medio</option>
          <option value="bajo">Impacto bajo</option>
        </select>
      </div>
      <ResourceState
        loading={loading}
        error={error}
        retry={refresh}
        empty={!loading && !error && !filtered.length}
        emptyText="No hay eventos con este nivel de impacto en el periodo seleccionado."
      />
      {!loading && !error && (
        <div className="calendar-events">
          {filtered.map((event) => (
            <article className="calendar-event" key={event.id}>
              <div className="calendar-event-date">
                <span>
                  {new Date(event.date)
                    .toLocaleDateString("es", {
                      month: "short",
                      timeZone: user?.tz,
                    })
                    .toUpperCase()}
                </span>
                <strong>
                  {new Date(event.date).toLocaleDateString("es", {
                    day: "2-digit",
                    timeZone: user?.tz,
                  })}
                </strong>
                <span>
                  {new Date(event.date).toLocaleDateString("es", {
                    weekday: "long",
                    timeZone: user?.tz,
                  })}
                </span>
              </div>
              <div className="calendar-event-content">
                <div>
                  <Tag
                    tone={
                      event.impact === "alto"
                        ? "red"
                        : event.impact === "medio"
                          ? "amber"
                          : "blue"
                    }
                    dot
                  >
                    Impacto {event.impact}
                  </Tag>
                  <span className="muted small">{event.category}</span>
                </div>
                <h2>{event.title}</h2>
                <p>
                  {event.category === "FOMC"
                    ? "La decisión de tipos y el mensaje de la Fed pueden cambiar las expectativas de liquidez."
                    : event.category === "CPI"
                      ? "La inflación de EE. UU. puede mover el dólar, los tipos y los activos de riesgo."
                      : event.category === "NFP"
                        ? "El empleo de EE. UU. influye en las expectativas de política monetaria."
                        : event.category === "Deribit"
                          ? "Las coberturas y el vencimiento de derivados pueden aumentar la volatilidad. Viernes, 08:00 UTC."
                          : "Intercambio periódico de comisiones entre posiciones long y short en Binance Futures."}
                </p>
              </div>
              <div className="calendar-event-time">
                <span>{dateTime(event.date, user?.tz)}</span>
                <strong>
                  <Clock3 size={12} />
                  <Countdown until={event.date} long />
                </strong>
                <small>Tiempo restante</small>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="slim-note">
        <Info size={12} />
        {view === 30
          ? "La vista de 30 días omite los vencimientos semanales y conserva los mensuales y trimestrales."
          : "Los vencimientos de Deribit ocurren los viernes a las 08:00 UTC."}{" "}
        Los eventos dependen de las fuentes configuradas en el backend; una lista vacía puede indicar que no hay eventos disponibles en el periodo.
      </p>
    </div>
  );
}
