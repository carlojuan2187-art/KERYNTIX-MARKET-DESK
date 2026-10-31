import { t } from "@/i18n/translation";
import { useState } from "react";
import { ArrowUpRight, CheckCircle2, MessageCircle, Send } from "lucide-react";
import { appConfig } from "@/api/config";
import { createTicket, getTickets } from "@/api/terminal";
import { useApi } from "@/hooks/useApi";
import { useApp } from "@/context/AppContext";
import { dateTime } from "@/utils/format";
import { PageHeader, ResourceState, SectionHeader, Tag } from "@/components/ui";

export default function SoportePage() {
  const { user, toast } = useApp();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tickets = useApi(getTickets);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ticket = await createTicket(subject, message);
      setSubject("");
      setMessage("");
      void tickets.refresh();
      toast(`Ticket ${ticket.id} creado y enviado al backend.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageHeader
        eyebrow={t("ESTAMOS PARA AYUDARTE")}
        title={t("Una respuesta empieza por escucharte.")}
        description={t("Habla con un administrador o deja tu consulta en un ticket.")}
      />
      <div className="two-col">
        <section className="panel panel-pad">
          <SectionHeader title={t("Cuéntanos qué ocurre")} />
          <form className="form-stack" onSubmit={send}>
            <label className="input-field">
              <span>{t("Asunto")}</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("Por ejemplo: consulta sobre mi plan")}
                required
                minLength={5}
              />
            </label>
            <label className="input-field">
              <span>{t("Tu consulta")}</span>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("Describe qué necesitas y qué ocurrió. No incluyas claves privadas ni códigos de acceso.")}
                required
                minLength={10}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy} type="submit">
              <Send size={13} />
              {busy ? "Guardando consulta..." : "Crear ticket de soporte"}
            </button>
            <p className="slim-note" style={{ padding: 0 }}>
              {t("El ticket se guarda en el servicio de soporte de FTrade. No incluyas claves privadas ni códigos de acceso.")}</p>
          </form>
        </section>
        <section className="support-contact">
          <MessageCircle size={32} strokeWidth={1.2} />
          <h2>{t("Una conversación directa.")}</h2>
          <p>
            {t("Para ayuda con pagos o acceso, puedes contactar por WhatsApp con el equipo administrador.")}</p>
          {appConfig.whatsapp.length ? (
            appConfig.whatsapp.map((phone, index) => (
              <a
                className="support-admin"
                key={phone}
                href={`https://wa.me/${phone}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div>
                  <strong>{t("Administrador ")}{index + 1}</strong>
                  <span>+{phone}</span>
                </div>
                <ArrowUpRight size={16} />
              </a>
            ))
          ) : (
            <p className="slim-note" role="status">
              {t("El contacto de WhatsApp del administrador todavía no está configurado.")}
            </p>
          )}
          <div className="support-safety">
            <CheckCircle2 size={15} />
            <span>
              {t("Nunca te pediremos tu frase semilla, claves privadas ni acceso a tu exchange.")}</span>
          </div>
        </section>
      </div>
      <section style={{ marginTop: 30 }}>
        <SectionHeader title={t("Tus consultas")} />
        <ResourceState
          loading={tickets.loading}
          error={tickets.error}
          retry={tickets.refresh}
          empty={!tickets.loading && !tickets.error && !tickets.data?.length}
          emptyText={t("Todavía no has creado tickets. Cuando lo hagas, podrás consultarlos aquí.")}
        />
        {tickets.data?.map((ticket) => (
          <div className="ticket-row" key={ticket.id}>
            <div>
              <span className="mono muted small">{ticket.id}</span>
              <h3>{ticket.subject}</h3>
              <p>{ticket.message}</p>
            </div>
            <div>
              <Tag tone="blue" dot>
                {ticket.status}
              </Tag>
              <time>{dateTime(ticket.created_at, user?.tz)}</time>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
